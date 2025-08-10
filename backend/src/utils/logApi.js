// src/utils/logApi.js
export async function logApi(client, {
  tenantId, userId, method = 'POST', path,
  statusCode, latencyMs = null, ip = null, userAgent = null,
  reqBody = null, resBody = null
}) {
  await client.query(
    `INSERT INTO public.api_request_logs
      (tenant_id, user_id, method, path, status_code, latency_ms, request_body, response_body, ip, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [tenantId || null, userId || null, method, path, statusCode, latencyMs, reqBody, resBody, ip, userAgent]
  );
}
