// src/routes/bootstrap.routes.js
import express from "express";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { companyContext } from "../middleware/companyContext.js";

const router = express.Router();

router.get("/", requireAuth, companyContext, async (req, res) => {
  const { user_id, tenant_id } = req.session;
  const company_id = req.context?.company_id || null;

  try {
    const userQ = await pool.query(
      `SELECT id, name, email FROM res_users WHERE id=$1 AND tenant_id=$2`,
      [user_id, tenant_id]
    );

    const rolesQ = await pool.query(
      `SELECT r.id, r.code, r.name
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND r.tenant_id = $2`,
      [user_id, tenant_id]
    );

    const permsQ = await pool.query(
      `SELECT DISTINCT p.code
       FROM roles_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       JOIN user_roles ur ON ur.role_id = rp.role_id
       WHERE ur.user_id = $1 AND p.tenant_id = $2`,
      [user_id, tenant_id]
    );

    const companiesQ = await pool.query(
      `SELECT c.id, c.name, c.code
       FROM res_company c
       JOIN user_companies uc ON uc.company_id = c.id
       WHERE c.tenant_id = $1 AND uc.user_id = $2
       ORDER BY c.name`,
      [tenant_id, user_id]
    );

    const menusQ = await pool.query(
      `SELECT mt.id, mt.name, mt.icon, mt.path, mt.parent_id, mt.sort_order, mt.permission_code
       FROM tenant_menus tm
       JOIN menu_templates mt ON mt.id = tm.menu_id
       WHERE tm.tenant_id = $1
       ORDER BY mt.sort_order, mt.name`,
      [tenant_id]
    );

    const settingsQ = await pool.query(
      `SELECT module, key, value
       FROM module_settings
       WHERE tenant_id = $1`,
      [tenant_id]
    );

    // filter menus by permission set
    const permSet = new Set(permsQ.rows.map(r => r.code));
    const menus = menusQ.rows.filter(m => !m.permission_code || permSet.has(m.permission_code));

    // pick active company (existing session selection or first allowed)
    const activeCompany = company_id && companiesQ.rows.find(c => c.id === company_id)
      ? company_id
      : (companiesQ.rows[0]?.id || null);

    if (activeCompany && activeCompany !== req.session.company_id) {
      req.session.company_id = activeCompany;
    }

    // Optional: lightweight dashboard summary
    const dashboardQ = await pool.query(
      `SELECT
         (SELECT COUNT(1) FROM leads l WHERE l.tenant_id=$1) AS leads_total,
         (SELECT COUNT(1) FROM deals d WHERE d.tenant_id=$1) AS deals_total,
         (SELECT COUNT(1) FROM notifications n WHERE n.tenant_id=$1 AND n.user_id=$2 AND n.is_read=false) AS unread_notifications` ,
      [tenant_id, user_id]
    );

    res.json({
      user: userQ.rows[0],
      tenant: { id: tenant_id },
      roles: rolesQ.rows,
      permissions: Array.from(permSet),
      companies: companiesQ.rows,
      activeCompanyId: activeCompany,
      menus,
      settings: settingsQ.rows,
      dashboard: dashboardQ.rows[0] || { leads_total: 0, deals_total: 0, unread_notifications: 0 }
    });
  } catch (e) {
    console.error("/api/bootstrap error", e);
    res.status(500).json({ message: "Bootstrap failed" });
  }
});

export default router;