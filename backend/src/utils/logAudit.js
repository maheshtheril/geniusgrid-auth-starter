export async function logAudit(client, {
  tenantId, userId=null, action, entity, entityId=null,
  before=null, after=null, meta={}, req=null
}) {
  const ip = req?.ip || null;
  const ua = req?.headers?.['user-agent'] || null;
  await client.query(
    `INSERT INTO public.audit_logs
     (tenant_id,user_id,action,entity,entity_id,before_data,after_data,meta,ip,user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [tenantId, userId, action, entity, String(entityId ?? ''), before, after, meta, ip, ua]
  );
}
