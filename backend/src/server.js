// backend/src/index.js (or your actual entry file)
import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import pg from 'pg';
import crypto from 'crypto';

import publicAuth from './routes/publicAuth.js';
import auth from './routes/auth.js';
import modulesRouter from './routes/modules.js';

const app = express();
app.set('trust proxy', 1);

/* -------------------- Origins -------------------- */
const FRONTEND_ORIGIN  = process.env.FRONTEND_ORIGIN  || 'https://geniusgrid-web.onrender.com';
const MARKETING_ORIGIN = process.env.MARKETING_ORIGIN || 'https://geniusgrid-landing.onrender.com';

const PUBLIC_ALLOWED = [
  'http://localhost:5173',
  'http://localhost:4173',
  MARKETING_ORIGIN,
  FRONTEND_ORIGIN,
].filter(Boolean);

const APP_ALLOWED = [
  'http://localhost:5173',
  FRONTEND_ORIGIN,
].filter(Boolean);

/* -------------------- Core middleware (order matters) -------------------- */
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(helmet({ contentSecurityPolicy: false }));

// ❌ Do NOT add any global app.use(cors(...)) — keep CORS scoped below.

// Public v1 API (no credentials)
app.use('/api/public/v1', cors({
  origin: PUBLIC_ALLOWED,
  credentials: false,
  methods: ['GET', 'HEAD', 'OPTIONS'],
  maxAge: 86400,
}));

// Legacy public API (keep if you still hit /api/public/*)
app.use('/api/public', cors({
  origin: PUBLIC_ALLOWED,
  credentials: false,
  methods: ['GET', 'HEAD', 'OPTIONS'],
  maxAge: 86400,
}));

// Auth/session API (cookies) – only the app FE
app.use('/api/auth', cors({
  origin: APP_ALLOWED,
  credentials: true,
}));

/* -------------------- DB -------------------- */
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
});

/* -------------------- Helpers -------------------- */
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
  // 10-char, URL-safe, uppercase
  return crypto.randomBytes(8).toString('base64url').slice(0, 10).toUpperCase();
}

/* -------------------- DEBUG (remove after verifying) -------------------- */
app.get('/__ping', (_req, res) => res.json({ ok: true, now: new Date().toISOString() }));
app.get('/__routes', (req, res) => {
  const list = [];
  const stack = app._router?.stack || [];
  stack.forEach((l) => {
    if (l.route?.path) list.push({ methods: Object.keys(l.route.methods), path: l.route.path });
    else if (l.name === 'router' && l.handle?.stack) {
      l.handle.stack.forEach((s) => { if (s.route?.path) list.push({ methods: Object.keys(s.route.methods), path: s.route.path }); });
    }
  });
  res.json(list);
});

/* -------------------- Health -------------------- */
app.get('/health', (_req, res) => res.json({ ok: true }));

/* -------------------- v1: Modules (landing uses this) -------------------- */
app.get('/api/public/v1/modules', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM public.v_modules_public_v1');
    return sendCacheJson(req, res, rows);
  } catch (err) {
    // Fallback if the view doesn't exist
    if (err?.code !== '42P01') return next(err);
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
    } catch (e2) { return next(e2); }
  }
});

/* -------------------- v1: Start signup + pre-signup -------------------- */
app.get('/api/public/v1/start-signup', async (req, res, next) => {
  try {
    const raw = parseModulesParam(req.query.modules);
    const plan = String(req.query.plan || 'free').toLowerCase();

    if (raw.length === 0) return res.status(400).json({ message: 'modules required' });

    const { rows } = await pool.query(
      `SELECT code FROM public.modules WHERE is_active = true AND code = ANY($1::text[])`,
      [raw]
    );
    const valid = rows.map(r => r.code);
    if (valid.length === 0) return res.status(400).json({ message: 'no valid modules' });

    const code = makeShortCode();
    await pool.query(
      `INSERT INTO public.pre_signups (code, modules, plan_code, expires_at)
       VALUES ($1, $2, $3, now() + interval '15 minutes')`,
      [code, valid, plan]
    );

    const appUrl = (process.env.APP_PUBLIC_URL || process.env.APP_ORIGIN || '').replace(/\/+$/, '');
    if (!appUrl) return res.status(500).json({ message: 'APP_PUBLIC_URL not configured' });

    return res.redirect(302, `${appUrl}/signup?code=${encodeURIComponent(code)}`);
  } catch (e) { next(e); }
});

app.get('/api/public/v1/pre-signup/:code', async (req, res, next) => {
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

/* -------------------- Existing routers (keep) -------------------- */
app.use('/api', modulesRouter);
app.use('/api/public', publicAuth);
app.use('/api/auth', auth);

/* -------------------- 404 & Error -------------------- */
app.use((req, res) => res.status(404).json({ message: 'Not Found' }));
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal Server Error' });
});

/* -------------------- Boot -------------------- */
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 GeniusGrid backend running on port ${port}`);
  console.log('Public allowed origins:', PUBLIC_ALLOWED);
  console.log('BOOT OK – serving /api/public/v1/modules', new Date().toISOString());
});
