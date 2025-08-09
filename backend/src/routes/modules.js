// backend/src/routes/modules.js
import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db/index.js';

const router = Router();

/* -------------------- helpers -------------------- */
function sendCacheJson(req, res, data) {
  const body = JSON.stringify(data);
  const etag = '"' + crypto.createHash('sha1').update(body).digest('hex') + '"';
  res.set('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400');
  res.set('ETag', etag);
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  res.type('application/json').send(body);
}

function parseModulesParam(mods) {
  return String(mods || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
    .filter((s, i, a) => a.indexOf(s) === i); // dedupe
}

function makeShortCode() {
  // 10-char URL-safe, uppercase
  return crypto.randomBytes(8).toString('base64url').slice(0, 10).toUpperCase();
}

/* -------------------- v1 (preferred) -------------------- */

/** GET /api/public/v1/modules
 * Returns the exact shape expected by the landing:
 * [{ id, cat, name, icon, desc, paid, version, updatedAt, tags, popularity }]
 */
router.get('/public/v1/modules', async (req, res, next) => {
  try {
    // Prefer the view; it encodes the canonical shape & ordering
    const { rows } = await pool.query('SELECT * FROM public.v_modules_public_v1');
    return sendCacheJson(req, res, rows);
  } catch (err) {
    // Fallback: derive from modules table if the view is missing
    if (err?.code !== '42P01') return next(err); // not "relation does not exist"
    try {
      const { rows } = await pool.query(`
        SELECT
          code                                   AS id,
          lower(category)                        AS cat,
          name,
          coalesce(icon,'🧩')                    AS icon,
          coalesce(description,'')               AS "desc",
          coalesce(paid,false)                   AS paid,
          coalesce(version,'1.0.0')              AS version,
          to_char(coalesce(updated_at, now()), 'YYYY-MM-DD') AS "updatedAt",
          coalesce(tags, ARRAY[]::text[])        AS tags,
          coalesce(popularity, 90)               AS popularity
        FROM public.modules
        WHERE is_active = true
        ORDER BY popularity DESC NULLS LAST, sort_order, name;
      `);
      return sendCacheJson(req, res, rows);
    } catch (e2) {
      return next(e2);
    }
  }
});

/** GET /api/public/v1/start-signup?modules=crm,accounting&plan=free
 * Validates module codes, creates a short-lived pre-signup record, redirects to app /signup
 */
router.get('/public/v1/start-signup', async (req, res, next) => {
  try {
    const raw = parseModulesParam(req.query.modules);
    const plan = String(req.query.plan || 'free').toLowerCase();

    if (raw.length === 0) {
      return res.status(400).json({ message: 'modules required' });
    }

    const { rows } = await pool.query(
      `SELECT code FROM public.modules WHERE is_active = true AND code = ANY($1::text[])`,
      [raw]
    );
    const valid = rows.map(r => r.code);
    if (valid.length === 0) {
      return res.status(400).json({ message: 'no valid modules' });
    }

    const code = makeShortCode();
    await pool.query(
      `INSERT INTO public.pre_signups (code, modules, plan_code, expires_at)
       VALUES ($1, $2, $3, now() + interval '15 minutes')`,
      [code, valid, plan]
    );

    const appUrl = process.env.APP_PUBLIC_URL || process.env.APP_ORIGIN;
    if (!appUrl) return res.status(500).json({ message: 'APP_PUBLIC_URL not configured' });

    return res.redirect(302, `${appUrl.replace(/\/+$/, '')}/signup?code=${encodeURIComponent(code)}`);
  } catch (e) { next(e); }
});

/** GET /api/public/v1/pre-signup/:code (optional for signup UI) */
router.get('/public/v1/pre-signup/:code', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT modules, plan_code
         FROM public.pre_signups
        WHERE code=$1 AND expires_at > now()`,
      [req.params.code]
    );
    if (!rows.length) return res.status(404).json({ message: 'Not found or expired' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

/* -------------------- legacy (kept for compatibility) -------------------- */

/** Public: list active modules (legacy shape) */
router.get('/public/modules', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT code, name, category, description
         FROM public.modules
        WHERE is_active = true
        ORDER BY sort_order, name`
    );
    res.json(rows);
  } catch (e) { next(e); }
});

/** Public: create pre-signup code and redirect (legacy path) */
router.get('/public/start-signup', async (req, res, next) => {
  try {
    const raw = parseModulesParam(req.query.modules);
    const plan = String(req.query.plan || 'free').toLowerCase();

    const { rows } = await pool.query(
      `SELECT code FROM public.modules WHERE is_active = true AND code = ANY($1::text[])`,
      [raw]
    );
    const valid = rows.map(r => r.code);

    const code = makeShortCode();
    await pool.query(
      `INSERT INTO public.pre_signups (code, modules, plan_code, expires_at)
       VALUES ($1, $2, $3, now() + interval '15 minutes')`,
      [code, valid, plan]
    );

    const appUrl = process.env.APP_PUBLIC_URL || process.env.APP_ORIGIN;
    if (!appUrl) return res.status(500).json({ message: 'APP_PUBLIC_URL not configured' });

    return res.redirect(302, `${appUrl.replace(/\/+$/, '')}/signup?code=${encodeURIComponent(code)}`);
  } catch (e) { next(e); }
});

/** Public: fetch pre-signup by code (legacy path) */
router.get('/public/pre-signup/:code', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT modules, plan_code
         FROM public.pre_signups
        WHERE code=$1 AND expires_at > now()`,
      [req.params.code]
    );
    if (!rows.length) return res.status(404).json({ message: 'Not found or expired' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

export default router;
