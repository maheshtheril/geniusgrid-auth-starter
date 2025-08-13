import express from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

function getTenant(req) {
  return req.user?.tenant_id || req.user?.tenantId || req.session?.tenant_id || req.session?.tenantId || null;
}
function getUser(req) {
  return req.user?.id || req.session?.user?.id || req.session?.user_id || null;
}

/** POST /api/ai/prospect/jobs */
router.post("/ai/prospect/jobs", requireAuth, async (req, res, next) => {
  try {
    const tenantId = getTenant(req);
    const userId = getUser(req);
    if (!tenantId) return res.status(400).json({ message: "Missing tenant" });

    const { prompt, size = 25, providers = ["pdl"], filters = {} } = req.body || {};
    if (!prompt || String(prompt).trim().length < 6) {
      return res.status(400).json({ message: "Prompt too short" });
    }

    const { rows } = await pool.query(
      `INSERT INTO public.ai_prospect_jobs
         (tenant_id, created_by, prompt, size, providers, filters)
       VALUES (ensure_tenant_scope(), $1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, String(prompt).trim(), Math.min(Math.max(+size || 25, 1), 500), providers, filters]
    );

    res.json({ data: rows[0] });
  } catch (e) { next(e); }
});

/** GET /api/ai/prospect/jobs/:id */
router.get("/ai/prospect/jobs/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM public.ai_prospect_jobs
        WHERE id=$1 AND tenant_id=ensure_tenant_scope()`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: "Not found" });
    res.json({ data: rows[0] });
  } catch (e) { next(e); }
});

/** GET /api/ai/prospect/jobs/:id/events?since=<timestamp>&limit=200 */
router.get("/ai/prospect/jobs/:id/events", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { since, limit = 200 } = req.query;
    const params = [id, Number(limit)];
    let where = `job_id=$1`;
    if (since) { params.push(new Date(since)); where += ` AND ts > $3`; }
    const { rows } = await pool.query(
      `SELECT id, ts, level, message, meta FROM public.ai_prospect_events
        WHERE ${where}
        ORDER BY ts ASC
        LIMIT $2`,
      params
    );
    res.json({ data: rows });
  } catch (e) { next(e); }
});

/** POST /api/ai/prospect/jobs/:id/cancel */
router.post("/ai/prospect/jobs/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query(
      `UPDATE public.ai_prospect_jobs
          SET status='canceled', finished_at=now()
        WHERE id=$1 AND tenant_id=ensure_tenant_scope() AND status IN ('queued','running')`,
      [id]
    );
    if (!rowCount) return res.status(404).json({ message: "Not found or not cancelable" });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
