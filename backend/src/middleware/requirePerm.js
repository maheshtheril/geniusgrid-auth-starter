// middleware/requirePerm.js
export function requirePerm(...codes) {
  return (req, res, next) => {
    const have = new Set(req.session?.permissions || []);
    if (!codes.length || codes.some(c => have.has(c))) return next();
    return res.status(403).json({ error: "Forbidden" });
  };
}

// example usage
app.get("/api/crm/leads", requireAuth, requirePerm("crm.leads.view"), listLeads);
