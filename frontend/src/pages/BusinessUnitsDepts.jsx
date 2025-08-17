import React, { useEffect, useMemo, useRef, useState } from "react";

/* Local-first persistence (no backend dependency yet) */
const STORE_KEY = "org_units_v1";

/* ---------- Small UI helpers ---------- */
const Field = ({ label, children, className = "" }) => (
  <label className={"block " + className}>
    <span className="block text-xs uppercase tracking-wide text-gray-400 mb-1">{label}</span>
    {children}
  </label>
);
const Input = (p) => (
  <input
    {...p}
    className={
      "w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2 outline-none focus:border-indigo-500 " +
      (p.className || "")
    }
  />
);
const Section = ({ title, desc, children }) => (
  <section className="bg-[#111418] rounded-2xl p-5 md:p-6 shadow-xl border border-white/5">
    <div className="mb-5">
      <div className="text-base md:text-lg font-semibold">{title}</div>
      {desc && <div className="text-xs text-gray-400 mt-0.5">{desc}</div>}
    </div>
    {children}
  </section>
);

/* ---------- Utilities ---------- */
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function buildTree(items) {
  const byId = new Map();
  const roots = [];
  (items || []).forEach((u) => byId.set(u.id, { ...u, children: [] }));
  byId.forEach((u) => {
    if (u.parentId && byId.has(u.parentId)) byId.get(u.parentId).children.push(u);
    else roots.push(u);
  });
  // sort kids by name
  const sortRec = (node) => {
    node.children.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
    node.children.forEach(sortRec);
  };
  roots.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
  roots.forEach(sortRec);
  return roots;
}

function flatten(node, out = []) {
  out.push(node);
  node.children?.forEach((c) => flatten(c, out));
  return out;
}

/* ---------- Component ---------- */
export default function BusinessUnitsDepts() {
  const [units, setUnits] = useState(() => {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch {}
    }
    // Seed with a simple org to start
    return [
      { id: uid(), type: "BusinessUnit", name: "HQ", code: "HQ", manager: "", cost_center: "1000", active: true, parentId: null },
      { id: uid(), type: "Department",   name: "Sales", code: "SALES", manager: "", cost_center: "1100", active: true, parentId: null },
    ];
  });
  const [msg, setMsg] = useState("");
  const [expanded, setExpanded] = useState(() => new Set()); // which node ids are open
  const tree = useMemo(() => buildTree(units), [units]);

  useEffect(() => {
    // Persist to local storage automatically
    localStorage.setItem(STORE_KEY, JSON.stringify(units));
  }, [units]);

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openAll = () => {
    const all = new Set();
    tree.forEach((r) => flatten(r).forEach((n) => all.add(n.id)));
    setExpanded(all);
  };
  const closeAll = () => setExpanded(new Set());

  const addRootUnit = (type = "BusinessUnit") => {
    setUnits((u) => [
      ...u,
      { id: uid(), type, name: type === "BusinessUnit" ? "New BU" : "New Department", code: "", manager: "", cost_center: "", active: true, parentId: null },
    ]);
    setMsg("Added");
    setTimeout(() => setMsg(""), 800);
  };

  const addChild = (parentId, type = "Department") => {
    setUnits((u) => [
      ...u,
      { id: uid(), type, name: type === "BusinessUnit" ? "New BU" : "New Department", code: "", manager: "", cost_center: "", active: true, parentId },
    ]);
    setMsg("Added");
    setTimeout(() => setMsg(""), 800);
    setExpanded((prev) => new Set(prev).add(parentId));
  };

  const updateField = (id, key, val) => {
    setUnits((u) => u.map((x) => (x.id === id ? { ...x, [key]: val } : x)));
  };

  const removeNode = (id) => {
    // cascade delete
    const idsToRemove = new Set([id]);
    const recur = (pid) => {
      units.forEach((n) => {
        if (n.parentId === pid) { idsToRemove.add(n.id); recur(n.id); }
      });
    };
    recur(id);
    setUnits((u) => u.filter((x) => !idsToRemove.has(x.id)));
    setMsg("Removed");
    setTimeout(() => setMsg(""), 800);
  };

  function Node({ node, depth = 0 }) {
    const isOpen = expanded.has(node.id);
    const pad = { paddingLeft: `${depth * 16 + 8}px` };
    const isBU = node.type === "BusinessUnit";

    return (
      <div className="border-b border-white/5">
        <div className="flex items-center gap-2 py-2" style={pad}>
          <button
            className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 grid place-items-center"
            onClick={() => toggle(node.id)}
            title={isOpen ? "Collapse" : "Expand"}
          >
            {isOpen ? "▾" : "▸"}
          </button>
          <span className="text-sm px-2 py-1 rounded bg-white/5">{isBU ? "BU" : "Dept"}</span>
          <input
            className="flex-1 bg-[#0B0D10] border border-white/10 rounded px-2 py-1 text-sm"
            placeholder={isBU ? "Business Unit name" : "Department name"}
            value={node.name}
            onChange={(e) => updateField(node.id, "name", e.target.value)}
          />
          <input
            className="w-28 bg-[#0B0D10] border border-white/10 rounded px-2 py-1 text-sm"
            placeholder="Code"
            value={node.code}
            onChange={(e) => updateField(node.id, "code", e.target.value.toUpperCase())}
          />
          <input
            className="w-40 bg-[#0B0D10] border border-white/10 rounded px-2 py-1 text-sm"
            placeholder="Manager"
            value={node.manager}
            onChange={(e) => updateField(node.id, "manager", e.target.value)}
          />
          <input
            className="w-28 bg-[#0B0D10] border border-white/10 rounded px-2 py-1 text-sm"
            placeholder="Cost Ctr"
            value={node.cost_center}
            onChange={(e) => updateField(node.id, "cost_center", e.target.value)}
          />
          <label className="text-xs flex items-center gap-2 px-2 py-1 rounded bg-white/5">
            <input
              type="checkbox"
              checked={!!node.active}
              onChange={(e) => updateField(node.id, "active", e.target.checked)}
            />
            Active
          </label>
          <div className="flex items-center gap-2">
            <button
              className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5"
              onClick={() => addChild(node.id, "Department")}
              title="Add Department"
            >
              + Dept
            </button>
            <button
              className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5"
              onClick={() => addChild(node.id, "BusinessUnit")}
              title="Add Business Unit"
            >
              + BU
            </button>
            <button
              className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5"
              onClick={() => removeNode(node.id)}
              title="Remove (cascades)"
            >
              ✖
            </button>
          </div>
        </div>

        {isOpen && node.children?.length > 0 && (
          <div>
            {node.children.map((c) => (
              <Node key={c.id} node={c} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">Admin / Business Units & Depts</div>
          <h1 className="text-2xl md:text-3xl font-bold">Business Units & Departments</h1>
          <p className="text-sm text-gray-400 mt-1">
            Build your organization hierarchy. Add Business Units, then nest Departments under them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="px-2 py-1 rounded bg-white/10 text-sm">{msg}</span>}
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={openAll}>Expand all</button>
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={closeAll}>Collapse all</button>
          <button className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500" onClick={() => setMsg("Saved")}>Save</button>
        </div>
      </div>

      {/* Actions */}
      <Section title="Quick Actions">
        <div className="grid md:grid-cols-4 gap-3">
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={() => addRootUnit("BusinessUnit")}>
            + Add Business Unit (root)
          </button>
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={() => addRootUnit("Department")}>
            + Add Department (root)
          </button>
          <div className="text-xs text-gray-400 md:col-span-2">
            Tip: You can add child units/departments to any row using the “+ Dept” or “+ BU” buttons.
          </div>
        </div>
      </Section>

      {/* Tree */}
      <Section title="Hierarchy" desc="Click ▸ to expand. Remove cascades to all children.">
        <div className="rounded-xl border border-white/10 overflow-hidden">
          {tree.length === 0 ? (
            <div className="p-4 text-sm text-gray-400">No units yet. Add your first Business Unit.</div>
          ) : (
            tree.map((n) => <Node key={n.id} node={n} depth={0} />)
          )}
        </div>
      </Section>
    </div>
  );
}
