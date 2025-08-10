// utils/menuTree.js
export function buildMenuTree(items) {
  const byId = new Map(items.map(m => [m.id, { ...m, children: [] }]));
  const roots = [];
  for (const m of byId.values()) {
    if (m.parent_id && byId.has(m.parent_id)) byId.get(m.parent_id).children.push(m);
    else roots.push(m);
  }
  const sortBy = (a,b)=>(a.sort_order ?? 999)-(b.sort_order ?? 999) || a.label.localeCompare(b.label);
  roots.sort(sortBy);
  roots.forEach(r=>r.children.sort(sortBy));
  return roots;
}
