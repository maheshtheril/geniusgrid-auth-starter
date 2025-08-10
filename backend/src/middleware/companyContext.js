// src/middleware/companyContext.js
import { pool } from "../db/pool.js";

export async function companyContext(req, res, next) {
  try {
    const { tenant_id, user_id } = req.session;
    if (!tenant_id || !user_id) return next();

    // 1) pick candidate company id
    const headerCid = req.header("X-Company-ID");
    const candidate = headerCid || req.session.company_id || null;

    if (!candidate) return next();

    // 2) validate mapping user<->company within same tenant
    const q = await pool.query(
      `SELECT c.id
       FROM res_company c
       JOIN user_companies uc ON uc.company_id = c.id
       WHERE c.tenant_id = $1 AND uc.user_id = $2 AND c.id = $3
       LIMIT 1`,
      [tenant_id, user_id, candidate]
    );

    if (q.rowCount) {
      req.context = req.context || {};
      req.context.company_id = candidate;
      req.session.company_id = candidate; // persist selection
    }

    return next();
  } catch (e) {
    console.error("companyContext error", e);
    return next();
  }
}