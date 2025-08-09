// backend/src/routes/modules.js
import { Router } from 'express';
import { pool } from '../db/index.js';

const router = Router();

/** Public: list active modules (for landing page) */
router.get('/public/modules', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT code, name, category, description
         FROM modules
        WHERE is_active = true
        ORDER BY sort_order, name`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

/** Public: create pre-signup code and redirect to app signup */
router.get('/public/start-signup', async (req, res, next) => {
  try {
    const raw = (req.query.modules || '').split(',').map(s => s.trim()).filter(Boolean);
    const plan = (req.query.plan || 'free').toLowerCase();

    // validate module codes against catalog
    const { rows } = await pool.query(
      `SELECT code FROM modules WHERE is_active=true AND code = ANY($1)`,
      [raw]
    );
    const valid = rows.map(r => r.code);

    // create short code
    const code = Math.random().toString(36).slice(2, 10).toUpperCase();
    await pool.query(
      `INSERT INTO pre_signups (code, modules, plan_code, expires_at)
       VALUES ($1, $2, $3, now() + interval '15 minutes')`,
      [code, valid, plan]
    );

    return res.redirect(302, `${process.env.APP_PUBLIC_URL}/signup?code=${encodeURIComponent(code)}`);
  } catch (e) { next(e); }
});

/** Public: fetch pre-signup by code (optional for signup page UI) */
router.get('/public/pre-signup/:code', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT modules, plan_code
         FROM pre_signups
        WHERE code=$1 AND expires_at > now()`,
      [req.params.code]
    );
    if (!rows.length) return res.status(404).json({ message: 'Not found or expired' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

export default router;
