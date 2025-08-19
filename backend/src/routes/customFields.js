// src/routes/customFields.js (ONLY replace the GET "/" route)
router.get("/", async (req, res) => {
  const recordType = String(req.query.record_type || "").trim().toLowerCase();
  if (!recordType) return res.status(400).json({ error: "record_type is required" });

  const tenantId = req.ctx?.tenantId;
  const userId   = req.ctx?.userId;
  if (!tenantId || !userId) return res.status(401).json({ error: "Not signed in" });

  const DIAG = String(req.query.diag || "") === "1";
  const diag = { tenantId, userId, recordType };

  try {
    await withClient(async (client) => {
      // Step 0: basic DB info
      try {
        const who = await client.query("select current_user, current_database(), current_schema()");
        const sp  = await client.query("show search_path");
        diag.db = { who: who.rows[0], search_path: sp.rows[0]?.search_path };
      } catch (e) {
        diag.step0 = { error: e.message, code: e.code, detail: e.detail, hint: e.hint };
        if (DIAG) return res.status(500).json({ diag });
        throw e;
      }

      // Step 1: set context (safe)
      try {
        await client.query(
          `select set_config('app.tenant_id',$1,true), set_config('app.user_id',$2,true)`,
          [String(tenantId), String(userId)]
        );
        diag.step1 = "ctx ok";
      } catch (e) {
        diag.step1 = { error: e.message, code: e.code, detail: e.detail, hint: e.hint };
        if (DIAG) return res.status(500).json({ diag });
        throw e;
      }

      // Step 2: ensure tables exist (lightweight probe)
      try {
        const tables = await client.query(`
          select table_name
          from information_schema.tables
          where table_schema='public'
            and table_name in ('custom_forms','custom_form_versions','custom_fields')
          order by table_name
        `);
        diag.step2 = { have: tables.rows.map(r => r.table_name) };
        if (diag.step2.have.length < 3) {
          const err = new Error("One or more tables missing");
          err.status = 500;
          err.code = "42P01";
          if (DIAG) return res.status(500).json({ diag, error: err.message, code: err.code });
          throw err;
        }
      } catch (e) {
        diag.step2 = { error: e.message, code: e.code, detail: e.detail, hint: e.hint };
        if (DIAG) return res.status(500).json({ diag });
        throw e;
      }

      // Step 3: ensure form WITHOUT ON CONFLICT
      let formId;
      try {
        const q1 = await client.query(
          `select id from public.custom_forms where tenant_id=$1 and code=$2 limit 1`,
          [tenantId, recordType]
        );
        formId = q1.rows[0]?.id;
        if (!formId) {
          const ins = await client.query(
            `insert into public.custom_forms
               (tenant_id,module_name,code,name,is_active)
             values ($1,'crm',$2, initcap($2)||' Form', true)
             returning id`,
            [tenantId, recordType]
          );
          formId = ins.rows[0].id;
        }
        diag.step3 = { formId };
      } catch (e) {
        diag.step3 = { error: e.message, code: e.code, detail: e.detail, hint: e.hint };
        if (DIAG) return res.status(500).json({ diag });
        throw e;
      }

      // Step 4: ensure active version
      let formVersionId;
      try {
        const v1 = await client.query(
          `select id from public.custom_form_versions
             where tenant_id=$1 and form_id=$2
               and status='active' and effective_to is null
             order by version desc limit 1`,
          [tenantId, formId]
        );
        formVersionId = v1.rows[0]?.id;
        if (!formVersionId) {
          const ins = await client.query(
            `insert into public.custom_form_versions
               (tenant_id, form_id, version, status, effective_from)
             values ($1,$2,1,'active', now())
             returning id`,
            [tenantId, formId]
          );
          formVersionId = ins.rows[0].id;
        }
        diag.step4 = { formVersionId };
      } catch (e) {
        diag.step4 = { error: e.message, code: e.code, detail: e.detail, hint: e.hint };
        if (DIAG) return res.status(500).json({ diag });
        throw e;
      }

      // Step 5: read fields
      try {
        const { rows } = await client.query(
          `select id, code, label, field_type, placeholder, help_text,
                  coalesce(options_json, '[]'::jsonb)    as options_json,
                  coalesce(validation_json, '{}'::jsonb) as validation_json,
                  order_index, is_required, is_active
             from public.custom_fields
            where tenant_id=$1 and form_version_id=$2
            order by order_index nulls last, label`,
          [tenantId, formVersionId]
        );
        if (DIAG) return res.json({ diag, items: rows });
        return res.json({ items: rows });
      } catch (e) {
        diag.step5 = { error: e.message, code: e.code, detail: e.detail, hint: e.hint };
        if (DIAG) return res.status(500).json({ diag });
        throw e;
      }
    });
  } catch (err) {
    req.log?.error({ err, diag }, "GET /api/custom-fields failed");
    res.status(Number(err?.status || 500)).json({
      error: err?.message || "Server error",
      code: err?.code || null,
      detail: err?.detail || null,
      hint: err?.hint || null,
      diag: DIAG ? diag : undefined,
    });
  }
});
