
import { pool } from '../db/index.js';

export async function seedEntitlementsForPlan(tenantId, planCode='free') {
  // modules
  await pool.query(
    `INSERT INTO entitlements (tenant_id, scope, code, value, source)
     SELECT $1,'module',pm.module_code,'enabled','plan'
     FROM plan_modules pm WHERE pm.plan_code=$2
     ON CONFLICT (tenant_id,scope,code) DO NOTHING`,
    [tenantId, planCode]
  );
  // limits
  await pool.query(
    `INSERT INTO entitlements (tenant_id, scope, code, value, source)
     SELECT $1,'limit',pl.limit_code,COALESCE(pl.hard_limit::text,'unlimited'),'plan'
     FROM plan_limits pl WHERE pl.plan_code=$2
     ON CONFLICT (tenant_id,scope,code) DO NOTHING`,
    [tenantId, planCode]
  );
}

export async function installModulesForTenant(tenantId, userId, moduleCodes=[], planCode='free') {
  // only allow modules that exist & active
  const { rows } = await pool.query(
    `SELECT code FROM modules WHERE is_active=true AND code = ANY($1)`,
    [moduleCodes]
  );
  const valid = rows.map(r => r.code);
  if (!valid.length) return { installed: 0 };

  // ensure plan entitlements exist
  await seedEntitlementsForPlan(tenantId, planCode);

  // only install modules the plan actually enables
  const { rows: allowed } = await pool.query(
    `SELECT code FROM entitlements
     WHERE tenant_id=$1 AND scope='module' AND value='enabled' AND code = ANY($2)`,
    [tenantId, valid]
  );
  const canInstall = allowed.map(r => r.code);
  if (!canInstall.length) return { installed: 0, blocked: valid };

  const values = canInstall
    .map(c => `('${tenantId}','${c}','installed',now(),${userId ? `'${userId}'` : 'NULL'})`)
    .join(',');

  await pool.query(
    `INSERT INTO tenant_modules (tenant_id, module_code, status, installed_at, installed_by)
     VALUES ${values}
     ON CONFLICT (tenant_id, module_code) DO NOTHING`
  );

  return { installed: canInstall.length, blocked: valid.filter(v => !canInstall.includes(v)) };
}
