// src/routes/leads.import.routes.js
import { Router } from "express";
import multer from "multer";
import Papa from "papaparse";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { phoneToNorm } from "../services/phone.js";
import { findDuplicateCandidates } from "../services/dupes.js";
import { aiScoreLead, aiSummarizeLead } from "../services/ai.js";

const upload = multer();
const router = Router();

router.post("/imports", requireAuth, async (req,res,next)=>{
  try{
    const { filename, options } = req.body || {};
    const { rows } = await pool.query(
      `insert into public.lead_imports (tenant_id, created_by, filename, options)
       values (ensure_tenant_scope(), $1, $2, $3) returning *`,
      [req.user?.id||null, filename||"upload.csv", options||{}]
    );
    res.json({ ok:true, import: rows[0] });
  }catch(e){ next(e); }
});

router.post("/imports/:id/parse", requireAuth, upload.single("file"), async (req,res,next)=>{
  const client = await pool.connect();
  try{
    await client.query("begin");
    const importId = req.params.id;
    const file = req.file;
    if(!file) return res.status(400).json({message:"file required"});

    // parse CSV
    const text = file.buffer.toString("utf8");
    const parsed = Papa.parse(text, { header:true, skipEmptyLines:true });
    const rows = parsed.data || [];
    let total = 0, invalid = 0;

    for(let i=0;i<rows.length;i++){
      const r = rows[i];
      total++;
      const name  = (r.name || r.full_name || r.lead || "").toString().trim();
      const email = (r.email || "").toString().trim();
      const phone = (r.phone || r.mobile || "").toString().trim();
      const company = (r.company || r.organization || "").toString().trim();
      const phone_norm = phoneToNorm(phone); // your existing normalizer

      const norm = { name, email: email || null, phone: phone || null, phone_norm, company };
      const errors = [];
      if(!name) errors.push("name required");

      // pre-dupe candidates
      const dup_candidates = await findDuplicateCandidates(client, norm);

      await client.query(
        `insert into public.lead_import_items
          (tenant_id, import_id, row_num, raw, norm, errors, dup_candidates)
         values (ensure_tenant_scope(), $1, $2, $3, $4, $5, $6)`,
        [importId, i+1, r, norm, errors, dup_candidates]
      );
      if(errors.length) invalid++;
    }

    await client.query(
      `update public.lead_imports set
         total_rows = $2, invalid_rows = $3, valid_rows = ($2-$3),
         status = 'ready', updated_at = now()
       where id = $1 and tenant_id = ensure_tenant_scope()`,
      [importId, total, invalid]
    );

    await client.query("commit");
    res.json({ ok:true, import_id: importId, total, invalid });
  }catch(e){ try{await client.query("rollback");}catch{} next(e); }
  finally{ client.release(); }
});

router.post("/imports/:id/commit", requireAuth, async (req,res,next)=>{
  const client = await pool.connect();
  try{
    await client.query("begin");
    const importId = req.params.id;
    const { default_stage="new", default_status="new", default_source="Import", ai_enrich=true } = req.body || {};

    // pick items with no errors; decision null = auto
    const { rows: items } = await client.query(
      `select id, norm, dup_candidates
         from public.lead_import_items
        where import_id = $1 and tenant_id = ensure_tenant_scope() and coalesce(array_length(errors,1),0)=0`,
      [importId]
    );

    const createdIds = [];

    for(const it of items){
      const n = it.norm || {};
      // exact dup guard by unique indexes; try insert
      const { rows: ins } = await client.query(
        `insert into public.leads
           (tenant_id, name, email, phone, company, source, status, stage, created_at)
         values (ensure_tenant_scope(), $1,$2,$3,$4,$5,$6,$7, now())
         on conflict do nothing
         returning id`,
        [n.name, n.email, n.phone, n.company, default_source, default_status, default_stage]
      );
      if(ins.length){
        createdIds.push(ins[0].id);
      }else{
        // if conflict and you want auto-merge: call your /leads/merge with the best candidate
        // (optional) left out here for brevity
      }
    }

    await client.query(
      `update public.lead_imports set status='done', updated_at = now()
        where id=$1 and tenant_id = ensure_tenant_scope()`,
      [importId]
    );

    await client.query("commit");

    // AI enrich (fire-and-forget)
    if (ai_enrich && createdIds.length) {
      setImmediate(async ()=>{
        for(const id of createdIds){
          try {
            await aiSummarizeLead({ id });
            await aiScoreLead({ id });
          } catch {}
        }
      });
    }

    res.json({ ok:true, created: createdIds.length, created_ids: createdIds });
  }catch(e){ try{await client.query("rollback");}catch{} next(e); }
  finally{ client.release(); }
});

export default router;
