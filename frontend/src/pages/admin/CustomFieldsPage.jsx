// src/pages/CustomFieldsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Plus, GripVertical, Edit3, Trash2, Eye, EyeOff, Save, X,
  SlidersHorizontal, ChevronDown, CheckCircle2
} from "lucide-react";

/** -----------------------------------------------------------------------
 *  Axios instance (points to your backend)
 *  Set VITE_API_URL in frontend/.env.local, e.g. VITE_API_URL=http://localhost:4000
 *  --------------------------------------------------------------------- */
const RAW = (import.meta.env.VITE_API_URL || "http://localhost:4000").trim();
const API_BASE = RAW.replace(/\/+$/, "");
const http = axios.create({ baseURL: API_BASE, withCredentials: true });

/** -----------------------------------------------------------------------
 *  API adapter (URLs match your backend router mounted at /api/custom-fields)
 *  --------------------------------------------------------------------- */
const api = {
  list: (recordType) =>
    http.get(`/api/custom-fields`, { params: { record_type: recordType } })
      .then(r => r.data?.items || r.data || []),

  create: (payload) =>
    http.post(`/api/custom-fields`, payload).then(r => r.data),

  update: (id, payload) =>
    http.put(`/api/custom-fields/${id}`, payload).then(r => r.data),

  remove: (id) =>
    http.delete(`/api/custom-fields/${id}`).then(r => r.data),

  reorder: (recordType, order) =>
    http.put(`/api/custom-fields/reorder`, { record_type: recordType, order })
      .then(r => r.data),
};

/** Entities your tenants can customize now (extend anytime) */
const ENTITY_OPTIONS = [
  { code: "lead",     label: "CRM • Leads" },
  { code: "contact",  label: "CRM • Contacts" },
  { code: "company",  label: "CRM • Companies" },
  { code: "deal",     label: "CRM • Deals" },
];

/** Allowed field types */
const FIELD_TYPES = [
  { v: "text",     l: "Text" },
  { v: "textarea", l: "Textarea" },
  { v: "number",   l: "Number" },
  { v: "date",     l: "Date" },
  { v: "email",    l: "Email" },
  { v: "phone",    l: "Phone" },
  { v: "select",   l: "Select (dropdown)" },
  { v: "checkbox", l: "Checkbox" },
  { v: "file",     l: "File upload" },
];

/** Utility */
const keyFromLabel = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);

export default function CustomFieldsPage() {
  const [entity, setEntity] = useState(ENTITY_OPTIONS[0].code);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null); // field object or null
  const [dragId, setDragId] = useState(null);

  // fetch
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr("");
    api.list(entity)
      .then(items => { if (alive) setRows(sanitize(items)); })
      .catch(e => { if (alive) setErr(e?.response?.data?.message || "Failed to load custom fields"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [entity]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(r =>
      String(r.label).toLowerCase().includes(term) ||
      String(r.code || r.key).toLowerCase().includes(term) ||
      String(r.field_type || r.type).toLowerCase().includes(term)
    );
  }, [rows, q]);

  const openCreate = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit = (row) => { setEditing(row); setDrawerOpen(true); };

  const onDelete = async (row) => {
    if (!confirm(`Delete custom field "${row.label}"?`)) return;
    try {
      await api.remove(row.id);
      setRows(prev => prev.filter(r => r.id !== row.id));
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to delete.");
    }
  };

  // drag reorder (simple, no lib)
  const onDragStart = (id) => setDragId(id);
  const onDragOver = (e, overId) => {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    setRows(prev => {
      const from = prev.findIndex(r => r.id === dragId);
      const to = prev.findIndex(r => r.id === overId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };
  const onDragEnd = () => setDragId(null);

  const saveOrder = async () => {
    setSavingOrder(true);
    try {
      const order = rows.map((r, i) => ({ id: r.id, order_index: i + 1 }));
      await api.reorder(entity, order);
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to save order");
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="gg-panel rounded-2xl p-4 md:p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">Custom Fields</h1>
            <span className="text-sm text-[color:var(--muted)]">({rows.length})</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                className="gg-input h-10 rounded-xl pr-8"
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
                aria-label="Entity"
              >
                {ENTITY_OPTIONS.map(opt => (
                  <option key={opt.code} value={opt.code}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 opacity-70 pointer-events-none" />
            </div>

            <div className="relative">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search fields…"
                className="gg-input h-10 rounded-xl pl-3 pr-10 w-64"
              />
              <SlidersHorizontal className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 opacity-60" />
            </div>

            <button className="gg-btn gg-btn-primary rounded-xl" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" /> New Field
            </button>
          </div>
        </div>

        <div className="mt-4">
          {err && <div className="text-rose-400 text-sm mb-2">{err}</div>}
          <div className="overflow-hidden rounded-xl border border-[color:var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-base-200/70">
                <tr>
                  <th className="text-left px-3 py-2 w-10">#</th>
                  <th className="text-left px-3 py-2">Label</th>
                  <th className="text-left px-3 py-2">Key</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-left px-3 py-2">Required</th>
                  <th className="text-left px-3 py-2">Active</th>
                  <th className="text-right px-3 py-2 w-48">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-[color:var(--muted)]">Loading…</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-[color:var(--muted)]">No fields yet.</td></tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id}
                      draggable
                      onDragStart={() => onDragStart(r.id)}
                      onDragOver={(e) => onDragOver(e, r.id)}
                      onDragEnd={onDragEnd}
                      className={`border-t border-[color:var(--border)] ${dragId === r.id ? "bg-primary/5" : ""}`}>
                    <td className="px-3 py-2 align-middle">
                      <GripVertical className="w-4 h-4 opacity-60 cursor-grab" title="Drag to reorder" />
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <div className="font-medium">{r.label}</div>
                      {r.help_text && <div className="text-xs text-[color:var(--muted)]">{r.help_text}</div>}
                    </td>
                    <td className="px-3 py-2 align-middle"><code className="text-xs">{r.code || r.key}</code></td>
                    <td className="px-3 py-2 align-middle">{prettyType(r.field_type || r.type)}</td>
                    <td className="px-3 py-2 align-middle">{r.is_required ? "Yes" : "No"}</td>
                    <td className="px-3 py-2 align-middle">
                      <span className={`badge ${r.is_active ? "badge-success" : ""}`}>{r.is_active ? "Active" : "Hidden"}</span>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <div className="flex items-center gap-2 justify-end">
                        <button className="gg-btn gg-btn-ghost h-8 min-h-8" onClick={() => toggleActive(r, setRows)}>
                          {r.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button className="gg-btn gg-btn-ghost h-8 min-h-8" onClick={() => openEdit(r)}>
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button className="gg-btn gg-btn-ghost h-8 min-h-8 text-rose-500" onClick={() => onDelete(r)}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 1 && (
                <tfoot>
                  <tr>
                    <td colSpan={7} className="px-3 py-2">
                      <div className="flex justify-end">
                        <button className="gg-btn rounded-xl" onClick={saveOrder} disabled={savingOrder}>
                          <Save className="w-4 h-4 mr-1" /> {savingOrder ? "Saving…" : "Save order"}
                        </button>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {drawerOpen && (
        <FieldDrawer
          entity={entity}
          initial={editing}
          onClose={() => setDrawerOpen(false)}
          onSaved={(saved) => {
            setDrawerOpen(false);
            setRows(prev => upsert(prev, saved));
          }}
        />
      )}
    </div>
  );
}

/* ---------- Drawer (Create/Edit) ---------- */
function FieldDrawer({ entity, initial, onClose, onSaved }) {
  const isEdit = !!(initial?.id);
  const [f, setF] = useState(() => ({
    label: initial?.label || "",
    code: initial?.code || initial?.key || "",
    field_type: initial?.field_type || initial?.type || "text",
    placeholder: initial?.placeholder || "",
    help_text: initial?.help_text || "",
    options_text: (initial?.options_json || initial?.options || []).join(", "),
    is_required: !!initial?.is_required,
    is_active: initial?.is_active !== false,
    default_value: initial?.default_value ?? "",
    validation_json: initial?.validation_json || { min: null, max: null, regex: "" },
    visibility: initial?.visibility || { when: [] }, // simple conditions builder
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!f.code && f.label) setF(s => ({ ...s, code: keyFromLabel(f.label) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.label]);

  const onChange = (k) => (e) => setF(s => ({ ...s, [k]: e?.target?.value ?? e }));
  const onBool   = (k) => (e) => setF(s => ({ ...s, [k]: !!(e?.target?.checked ?? e) }));

  const save = async () => {
    setErr("");
    const payload = {
      record_type: entity,           // important for backend
      label: f.label.trim(),
      code: (f.code || keyFromLabel(f.label)).trim(),
      field_type: f.field_type,
      placeholder: f.placeholder || null,
      help_text: f.help_text || null,
      options_json: f.field_type === "select"
        ? (f.options_text || "").split(",").map(s => s.trim()).filter(Boolean)
        : [],
      is_required: !!f.is_required,
      is_active: !!f.is_active,
      default_value: f.default_value ?? null,
      validation_json: sanitizeValidation(f.validation_json),
      visibility: sanitizeVisibility(f.visibility),
    };
    if (!payload.label) { setErr("Label is required."); return; }
    if (!payload.code)  { setErr("Key is required.");   return; }

    setSaving(true);
    try {
      const saved = initial?.id
        ? await api.update(initial.id, payload)
        : await api.create(payload);
      onSaved?.(normalizeOne(saved));
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to save field.");
    } finally {
      setSaving(false);
    }
  };

  // preview
  const preview = useMemo(() => {
    const base = "gg-input w-full h-10 md:h-11";
    switch (f.field_type) {
      case "textarea":
        return <textarea className={`${base} h-24`} placeholder={f.placeholder} />;
      case "number":
        return <input type="number" className={base} placeholder={f.placeholder || "0"} />;
      case "date":
        return <input type="date" className={base} />;
      case "email":
        return <input type="email" className={base} placeholder={f.placeholder || "you@company.com"} />;
      case "phone":
        return <input type="tel" className={base} placeholder={f.placeholder || "+91 98765 43210"} />;
      case "select":
        return (
          <select className={base} defaultValue="">
            <option value="" disabled>{f.placeholder || "Select…"}</option>
            {(f.options_text || "").split(",").map(s => s.trim()).filter(Boolean).map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        );
      case "checkbox":
        return (
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className="gg-checkbox" defaultChecked={!!f.default_value} />
            <span className="text-sm">{f.placeholder || "Enable"}</span>
          </label>
        );
      case "file":
        return <input type="file" className={base} />;
      default:
        return <input className={base} placeholder={f.placeholder || "Enter value"} />;
    }
  }, [f]);

  return (
    <div className="fixed inset-0 z-[10000]">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full sm:w-[840px] bg-[var(--surface)] border-l border-[color:var(--border)] shadow-2xl animate-slideIn will-change-transform flex flex-col">
        <div className="px-4 md:px-5 py-3 border-b border-[color:var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl gg-surface flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-semibold leading-tight">
                {isEdit ? "Edit custom field" : "New custom field"}
              </h2>
              <div className="gg-muted text-xs">Entity: <strong>{entity}</strong></div>
            </div>
          </div>
          <button className="gg-btn gg-btn-ghost" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-5 space-y-5">
          <section className="gg-panel rounded-2xl p-4 md:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="gg-label">Label *</label>
                <input className="gg-input h-10" value={f.label} onChange={onChange("label")} placeholder="e.g., PAN Number" />
              </div>
              <div>
                <label className="gg-label">Key *</label>
                <input className="gg-input h-10" value={f.code} onChange={onChange("code")} placeholder="auto_from_label" />
                <p className="text-[10px] mt-1 text-[color:var(--muted)]">snake_case, stable, used in APIs</p>
              </div>

              <div>
                <label className="gg-label">Type</label>
                <select className="gg-input h-10" value={f.field_type} onChange={onChange("field_type")}>
                  {FIELD_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-4">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" className="gg-checkbox" checked={f.is_required} onChange={onBool("is_required")} />
                  Required
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" className="gg-checkbox" checked={f.is_active} onChange={onBool("is_active")} />
                  Active (visible)
                </label>
              </div>

              <div>
                <label className="gg-label">Placeholder</label>
                <input className="gg-input h-10" value={f.placeholder} onChange={onChange("placeholder")} placeholder="Shown inside the input" />
              </div>
              <div>
                <label className="gg-label">Help text</label>
                <input className="gg-input h-10" value={f.help_text} onChange={onChange("help_text")} placeholder="Shown as helper under the field" />
              </div>

              {f.field_type === "select" && (
                <div className="md:col-span-2">
                  <label className="gg-label">Options (comma separated)</label>
                  <input className="gg-input h-10" value={f.options_text} onChange={onChange("options_text")} placeholder="Hot, Warm, Cold" />
                </div>
              )}

              <div>
                <label className="gg-label">Default value</label>
                <input className="gg-input h-10" value={f.default_value} onChange={onChange("default_value")} />
              </div>

              {/* Validation */}
              <div className="md:col-span-2">
                <div className="text-sm font-medium mb-2">Validation</div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="gg-label">Min</label>
                    <input className="gg-input h-10" value={f.validation_json?.min ?? ""} onChange={(e)=>setF(s=>({...s, validation_json:{...s.validation_json, min:e.target.value}}))} />
                  </div>
                  <div>
                    <label className="gg-label">Max</label>
                    <input className="gg-input h-10" value={f.validation_json?.max ?? ""} onChange={(e)=>setF(s=>({...s, validation_json:{...s.validation_json, max:e.target.value}}))} />
                  </div>
                  <div>
                    <label className="gg-label">Regex</label>
                    <input className="gg-input h-10" value={f.validation_json?.regex ?? ""} onChange={(e)=>setF(s=>({...s, validation_json:{...s.validation_json, regex:e.target.value}}))} placeholder="^\\d{10}$" />
                  </div>
                </div>
              </div>

              {/* Simple visibility builder */}
              <div className="md:col-span-2">
                <div className="text-sm font-medium mb-2">Show when (optional)</div>
                <ConditionEditor value={f.visibility} onChange={(v) => setF(s => ({ ...s, visibility: v }))} />
              </div>
            </div>
          </section>

          <section className="gg-panel rounded-2xl p-4 md:p-5">
            <div className="text-sm font-semibold mb-2">Live preview</div>
            <div className="space-y-1.5">
              <label className="text-xs md:text-sm gg-muted">
                {f.label} {f.is_required && <span className="text-rose-400">*</span>}
              </label>
              {preview}
              {f.help_text && <p className="text-xs" style={{ color: "var(--muted)" }}>{f.help_text}</p>}
            </div>
          </section>

          {err && <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 text-rose-300 text-sm px-3 py-2">{err}</div>}
        </div>

        <div className="px-4 md:px-5 py-3 border-t border-[color:var(--border)] flex items-center justify-between gap-3 sticky bottom-0 bg-[var(--surface)]">
          <div className="flex items-center gap-2 text-xs md:text-sm gg-muted">
            <CheckCircle2 className="w-4 h-4" />
            <span>Keys are immutable once used in data. Prefer new fields over renaming keys.</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="gg-btn gg-btn-ghost" type="button" onClick={onClose}>Cancel</button>
            <button className="gg-btn gg-btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save field"}
            </button>
          </div>
        </div>
      </aside>

      <style>{`
        @keyframes slideIn { 0% { transform: translateX(24px); opacity: .0; } 60% { transform: translateX(-2px); opacity: 1; } 100% { transform: translateX(0); } }
        .animate-slideIn { animation: slideIn .22s cubic-bezier(.2,.8,.2,1) both; }
      `}</style>
    </div>
  );
}

/* ---------- Tiny condition builder (optional rules) ---------- */
function ConditionEditor({ value, onChange }) {
  const rules = value?.when || [];
  const update = (idx, patch) => {
    const next = rules.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChange?.({ when: next });
  };
  const add = () => onChange?.({ when: [...rules, { field: "", op: "eq", val: "" }] });
  const remove = (idx) => onChange?.({ when: rules.filter((_, i) => i !== idx) });

  return (
    <div className="space-y-2">
      {rules.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr,120px,1fr,auto] gap-2">
          <input className="gg-input h-10" placeholder="Field key (e.g., stage)" value={r.field} onChange={(e)=>update(i, { field: e.target.value })} />
          <select className="gg-input h-10" value={r.op} onChange={(e)=>update(i, { op: e.target.value })}>
            <option value="eq">=</option>
            <option value="ne">≠</option>
            <option value="in">in</option>
            <option value="nin">not in</option>
          </select>
          <input className="gg-input h-10" placeholder="Value / CSV for in" value={r.val} onChange={(e)=>update(i, { val: e.target.value })} />
          <button className="gg-btn gg-btn-ghost h-10 min-h-10" onClick={() => remove(i)}><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <button className="gg-btn h-9" type="button" onClick={add}><Plus className="w-4 h-4 mr-1" /> Add rule</button>
    </div>
  );
}

/* ---------- Helpers ---------- */
function upsert(prev, saved) {
  const it = normalizeOne(saved);
  const idx = prev.findIndex(r => r.id === it.id);
  if (idx === -1) return [...prev, it].sort((a, b) => (a.order_index ?? 9999) - (b.order_index ?? 9999));
  const next = [...prev]; next[idx] = it; return next;
}
function sanitize(items) { return (Array.isArray(items) ? items : []).map(normalizeOne).sort((a,b)=>(a.order_index??9999)-(b.order_index??9999)); }
function normalizeOne(r) {
  return {
    id: r.id,
    label: r.label,
    code: r.code || r.key,
    field_type: r.field_type || r.type,
    placeholder: r.placeholder ?? "",
    help_text: r.help_text ?? "",
    options_json: r.options_json || r.options || [],
    is_required: !!(r.is_required ?? r.required),
    is_active: r.is_active !== false,
    order_index: r.order_index ?? r.orderIndex ?? 9999,
    default_value: r.default_value,
    validation_json: r.validation_json || r.validation || {},
    visibility: r.visibility || {},
  };
}
function prettyType(t){ const m = FIELD_TYPES.find(x=>x.v===t); return m?m.l:t; }
function sanitizeValidation(v){
  const out = { ...v };
  if (out.min === "") delete out.min;
  if (out.max === "") delete out.max;
  if (!out.regex) delete out.regex;
  return out;
}
function sanitizeVisibility(v){ return v?.when && Array.isArray(v.when) ? v : { when: [] }; }
async function toggleActive(row, setRows){
  try {
    const next = { is_active: !row.is_active };
    // only send changed flag; backend handles partial update
    await api.update(row.id, next);
    setRows(prev => prev.map(r => (r.id === row.id ? { ...r, ...next } : r)));
  } catch (e) { alert(e?.response?.data?.message || "Failed."); }
}
