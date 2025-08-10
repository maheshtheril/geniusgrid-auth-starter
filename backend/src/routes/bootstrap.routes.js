// src/routes/bootstrap.routes.js
import express from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { companyContext } from "../middleware/companyContext.js";

const router = express.Router();

/** Utility: run a query and return [] on error (for optional tables) */
async function tryQuery(sql, params = []) {
  try {
    const { rows } = await pool.query(sql, params);
    return rows || [];
  } catch (e) {
    // console.warn("[bootstrap optional]", e?.message || e);
    return [];
  }
}

/** Normalize menu row into a stable shape */
function normalizeMenuRow(r) {
  const name =
    r.name ?? r.label ?? r.display_name ?? r.title ?? r.menu_name ?? r.code ?? String(r.id);
  const path = r.path ?? r.route ?? r.url ?? null;

  let parent_id = r.parent_id ?? r.parent ?? r.parentid ?? null;
  if (typeof parent_id === "string" && parent_id.trim() === "") parent_id = null;

  const sort_order = r.sort_order ?? r.order ?? r.position ?? 0;
  const permission_code = r.permission_code ?? r.permission ?? r.perm_code ?? null;
  const icon = r.icon ?? r.emoji ?? null;

  return { id: r.id, code: r.code ?? null, name, path, parent_id, sort_order, permission_code, icon };
}

router.get("/", requireAuth, companyContext, async (req, res) => {
  const user_id = req.session?.user_id ?? req.session?.userId;
  const tenant_id = req.session?.tenant_id ?? req.session?.tenantId;
  const requestedCompanyId = req.context?.company_id ?? null;

  try {
    /* ---------- User ---------- */
    const userRows = await tryQuery(
      `SELECT id, name, email FROM res_users WHERE id=$1 AND tenant_id=$2 LIMIT 1`,
      [user_id, tenant_id]
    );
    const user = userRows[0] || null;

    /* ---------- Companies ---------- */
    let companies = await tryQuery(
      `SELECT c.id, c.name, c.code
         FROM res_company c
         JOIN user_companies uc ON uc.company_id = c.id
        WHERE c.tenant_id = $1 AND uc.user_id = $2
        ORDER BY c.name`,
      [tenant_id, user_id]
    );

    if (companies.length === 0) {
      companies = await tryQuery(
        `SELECT id, name, code
           FROM res_company
          WHERE tenant_id = $1
          ORDER BY name`,
        [tenant_id]
      );
    }

    let activeCompanyId =
      (requestedCompanyId && companies.find((c) => c.id === requestedCompanyId)?.id) ||
      req.session?.company_id ||
      companies[0]?.id ||
      null;

    if (activeCompanyId !== req.session?.company_id) {
      req.session.company_id = activeCompanyId || null;
    }

    /* ---------- Roles ---------- */
    const roles = await tryQuery(
      `SELECT r.id, r.code, r.name
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = $1 AND r.tenant_id = $2`,
      [user_id, tenant_id]
    );

    /* ---------- Permissions ---------- */
    const permRows = await tryQuery(
      `SELECT DISTINCT p.code
         FROM roles_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
         JOIN user_roles ur ON ur.role_id = rp.role_id
        WHERE ur.user_id = $1 AND p.tenant_id = $2`,
      [user_id, tenant_id]
    );
    const permSet = new Set(permRows.map((r) => r.code).filter(Boolean));

    /* ---------- Menus ---------- */
    const rawMenus = await tryQuery(
      `SELECT mt.*, tm.menu_id
         FROM tenant_menus tm
         JOIN menu_templates mt ON mt.id = tm.menu_id
        WHERE tm.tenant_id = $1
        ORDER BY mt.sort_order NULLS LAST, mt.id`,
      [tenant_id]
    );
    let menus = rawMenus.map(normalizeMenuRow);

    // Permission filter with fallback
    let filtered = menus;
    if (permSet.size > 0) {
      filtered = menus.filter((m) => !m.permission_code || permSet.has(m.permission_code));
    } else {
      filtered = menus.filter((m) => !m.permission_code);
    }
    if (filtered.length === 0) filtered = menus; // fallback if filter kills all menus
    menus = filtered;

    /* ---------- Settings ---------- */
    const settings = await tryQuery(
      `SELECT module, key, value FROM module_settings WHERE tenant_id=$1`,
      [tenant_id]
    );

    /* ---------- Dashboard ---------- */
    const dashRows = await tryQuery(
      `SELECT
         COALESCE((SELECT COUNT(1) FROM leads l WHERE l.tenant_id=$1),0) AS leads_total,
         COALESCE((SELECT COUNT(1) FROM deals d WHERE d.tenant_id=$1),0) AS deals_total,
         COALESCE((SELECT COUNT(1) FROM notifications n
                    WHERE n.tenant_id=$1
                      AND (n.user_id=$2 OR n.user_id IS NULL)
                      AND n.is_read=false),0) AS unread_notifications`,
      [tenant_id, user_id]
    );
    const dashboard =
      dashRows[0] || { leads_total: 0, deals_total: 0, unread_notifications: 0 };

    /* ---------- Response ---------- */
    res.json({
      user,
      tenant: { id: tenant_id },
      roles,
      permissions: Array.from(permSet),
      companies,
      activeCompanyId,
      menus,
      settings,
      dashboard
    });
  } catch (e) {
    console.error("/api/bootstrap fatal", e?.stack || e);
    res.status(500).json({ message: "Bootstrap failed" });
  }
});

export default router;
