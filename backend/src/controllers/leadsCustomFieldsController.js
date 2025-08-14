export async function getActiveLeadsFormVersionId(tenantId) {
  const client = await pool.connect();
  try {
    await setTenantScope(client, tenantId);

    const formRes = await client.query(
      `
      insert into custom_forms (tenant_id, module_name, code, name)
      values ($1, 'crm', 'leads', 'Leads Form')
      on conflict (tenant_id, module_name, code)
      do update set name = excluded.name
      returning id;
      `,
      [tenantId]
    );
    const formId = formRes.rows[0].id;

    const verRes = await client.query(
      `
      with got as (
        select id
        from custom_form_versions
        where tenant_id = $1 and form_id = $2 and status = 'active'
        order by version desc
        limit 1
      ),
      ins as (
        insert into custom_form_versions (tenant_id, form_id, version, status)
        select $1, $2, 1, 'active'
        where not exists (select 1 from got)
        returning id
      )
      select id from got
      union all
      select id from ins
      limit 1;
      `,
      [tenantId, formId]
    );

    return verRes.rows[0].id;
  } finally {
    client.release();
  }
}
export { listFields, createField, saveValuesForLead };