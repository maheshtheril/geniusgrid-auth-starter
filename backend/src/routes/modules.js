import { Router } from 'express';
import { pool } from '../db/index.js';
import { installModulesForTenant, seedEntitlementsForPlan } from '../services/entitlements.js';

const router = Router();

// little helper to read auth context regardless of shape
function getAuth(req) {
  const a = req.user || req.auth || {};
  return { tenantId: a.tenantId || a.tenant_id, userId: a.userId || a.user_id };
}

// Public: list modules for landing picker
router.get('/public/modules', async (req,res,next) => {
  try {
    const { rows } = await pool.query(
      `SELECT code,name,category,description
       FROM modules WHERE is_active=true ORDER BY sort_order,name`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// Auth: install selected modules for current tenant (Free plan baseline)
router.post('/modules/install', async (req,res,next) => {
  try {
    const { tenantId, userId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ message: 'Not authenticated' });

    const selected = Array.isArray(req.body.selectedModules) ? req.body.selectedModules : [];
    if (!selected.length) return res.json({ installed: 0 });

    // ensure entitlements (Free) exist before install
    await seedEntitlementsForPlan(tenantId, 'free');
    const result = await installModulesForTenant(tenantId, userId, selected, 'free');
    res.json(result);
  } catch (e) { next(e); }
});

// Auth: get current entitlements (for menus/limits)
router.get('/billing/entitlements', async (req,res,next) => {
  try {
    const { tenantId } = getAuth(req);
    if (!tenantId) return res.status(401).json({ message: 'Not authenticated' });
    const { rows } = await pool.query(
      `SELECT scope,code,value,source,expires_at FROM entitlements WHERE tenant_id=$1`,
      [tenantId]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// NEW: marketing → app redirect (no CORS). Example:
// GET /api/public/start-signup?modules=crm,sales,inventory&plan=free
router.get('/public/start-signup', async (req, res, next) => {
  try {
    const raw = (req.query.modules || '').split(',').map(s => s.trim()).filter(Boolean);
    const plan = (req.query.plan || 'free').toLowerCase();

    const { rows } = await pool.query(
      `SELECT code FROM modules WHERE is_active=true AND code = ANY($1)`,
      [raw]
    );
    const valid = rows.map(r => r.code);

    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    await pool.query(
      `INSERT INTO pre_signups (code, modules, plan_code, expires_at)
       VALUES ($1,$2,$3, now() + interval '15 minutes')`,
      [code, valid, plan]
    );
    return res.redirect(302, `${process.env.APP_PUBLIC_URL}/signup?code=${encodeURIComponent(code)}`);
  } catch (e) { next(e); }
});


// (Optional) used by the Signup page to show what was chosen
router.get('/public/pre-signup/:code', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT modules, plan_code FROM pre_signups
         WHERE code=$1 AND expires_at > now()`,
      [req.params.code]
    );
    if (!rows.length) return res.status(404).json({ message: 'Not found or expired' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

export default router;

