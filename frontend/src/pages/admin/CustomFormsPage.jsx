// src/pages/admin/CustomFormsPage.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import {
  Plus, Search, Save, Eye, Edit3, Rocket, CheckCircle2,
  Trash2, GripVertical, CheckSquare, Type, Hash, CalendarDays,
  ListChecks, Boxes, Upload
} from "lucide-react";

/**
 * WORLD-CLASS CUSTOM FORMS UI (Leads / CRM)
 * - Safe against non-array API payloads (prevents .map / .filter crashes)
 * - Versioned forms (draft / published / active)
 * - Sections: General / Advance
 * - Field types: text, textarea, number, date, select, checkbox, email, phone, file
 * - Uses gg-* tokens + Tailwind; no external UI libs
 */

/* ----------------------------- Tiny helpers ----------------------------- */
const cls = (...xs) => xs.filter(Boolean).join(" ");
const toKey = (s) => String(s || "")
  .trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64);

/** Always normalize any API shape to an array */
const toArray = (x) => {
  if (Array.isArray(x)) return x;
  if (Array.isArray(x?.items)) return x.items;
  if (Array.isArray(x?.data?.items)) return x.data.items;
  if (Array.isArray(x?.data)) return x.data;
  if (x && typeof x === "object") return Object.values(x); // lenient fallback
  return [];
};

const FIELD_TYPES = [
  { v: "text",      label: "Text",      icon: Type },
  { v: "textarea",  label: "Textarea",  icon: ListChecks },
  { v: "number",    label: "Number",    icon: Hash },
  { v: "date",      label: "Date",      icon: CalendarDays },
  { v: "select",    label: "Select",    icon: Boxes },
  { v: "checkbox",  label: "Checkbox",  icon: CheckSquare },
  { v: "email",     label: "Email",     icon: MailIcon },
  { v: "phone",     label: "Phone",     icon: PhoneIcon },
  { v: "file",      label: "File",      icon: Upload },
];

function MailIcon(props){ return <svg viewBox="0 0 24 24" className="w-4 h-4" {...props}><path fill="currentColor" d="M20 4H4a2 2 0 0 0-2 2v.4l10 6.25L22 6.4V6a2 2 0 0 0-2-2Zm0 4.25L12.46 13a1 1 0 0 1-1 0L4 8.25V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2Z"/></svg>; }
function PhoneIcon(props){ return <svg viewBox="0 0 24 24" className="w-4 h-4" {...props}><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24c1.1.36 2.3.56 3.5.56a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 8a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.2.2 2.4.56 3.5a1 1 0 0 1-.24 1Z"/></svg>; }

/* ----------------------------- API wrapper ------------------------------ */
function useFormsApi() {
  // Adjust routes to your backend if needed
  const listForms = (params={}) =>
    axios.get("/api/custom-forms", { params }).then(r => r.data);

  const createForm = (payload) =>
    axios.post("/api/custom-forms", payload).then(r => r.data);

  const listVersions = (formId) =>
    axios.get(`/api/custom-forms/${formId}/versions`).then(r => r.data);

  const createDraftFromActive = (formId) =>
    axios.post(`/api/custom-forms/${formId}/versions/draft`).then(r => r.data);

  const publishVersion = (formId, version) =>
    axios.patch(`/api/custom-forms/${formId}/versions/${version}/publish`).then(r => r.data);

  const setActive = (formId, version) =>
    axios.patch(`/api/custom-forms/${formId}/versions/${version}/activate`).then(r => r.data);

  const getFields = (formId, version) =>
    axios.get(`/api/custom-forms/${formId}/versions/${version}/fields`).then(r => r.data);

  const createField = (formId, version, payload) =>
    axios.post(`/api/custom-forms/${formId}/versions/${version}/fields`, payload).then(r => r.data);

  const updateField = (fieldId, patch) =>
    axios.patch(`/api/custom-fields/${fieldId}`, patch).then(r => r.data);

  const deleteField = (fieldId) =>
    axios.delete(`/api/custom-fields/${fieldId}`).then(r => r.data);

  const reorder = (formId, version, items) =>
    axios.post(`/api/custom-forms/${formId}/versions/${version}/reorder`, { items }).then(r => r.data);

  return {
    listForms, createForm, listVersions, createDraftFromActive,
    publishVersion, setActive, getFields, createField, updateField, deleteField, reorder
  };
}

/* ----------------------------- Page begins ------------------------------ */
export default function CustomFormsPage() {
  const api = useFormsApi();

  const [loading, setLoading] = useState(false);
  const [forms, setForms] = useState([]);                 // always array
  const [q, setQ] = useState("");

  const [selectedForm, setSelectedForm] = useState(null); // object
  const [versions, setVersions] = useState([]);           // [{version, status}]
  const [currentVersion, setCurrentVersion] = useState(null); // number
  const [fields, setFields] = useState([]);               // current version fields (array)
  const [saving, setSaving] = useState(false);
  const [bannerMsg, setBannerMsg] = useState("");

  const setBanner = (msg) => {                            // small helper (auto-clear)
    setBannerMsg(msg);
    if (msg) setTimeout(() => setBannerMsg(""), 1800);
  };

  /* load forms */
  const loadForms = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listForms({ module: "crm", record_type: "lead" });
      const list = toArray(data);
      setForms(list);
      if (list.length && !selectedForm) {
        selectForm(list[0]);
      }
    } catch (e) {
      console.error(e);
      setForms([]); // keep it an array to avoid map/filter crashes
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadForms(); }, [loadForms]);

  const selectForm = async (form) => {
    setSelectedForm(form);
    setFields([]);
    setVersions([]);
    setCurrentVersion(null);
    if (!form?.id) return;
    try {
      const vsRaw = await api.listVersions(form.id);
      const vs = toArray(vsRaw);
      setVersions(vs);
      const active = vs.find(v => v.status === "active") || vs[0];
      if (active) {
        setCurrentVersion(active.version);
        const fl = await api.getFields(form.id, active.version);
        setFields(normalizeFields(fl));
      }
    } catch (e) {
      console.error(e);
      setVersions([]);
      setFields([]);
    }
  };

  const normalizeFields = (raw) => {
    const arr = toArray(raw);
    return arr
      .map(f => ({
        id: f.id,
        code: f.code,
        label: f.label,
        field_type: f.field_type,
        is_required: !!f.is_required,
        placeholder: f.placeholder || "",
        help_text: f.help_text || "",
        // options_json can be array or object; also carry group in options_json.group
        options_json: Array.isArray(f.options_json) ? f.options_json
                     : Array.isArray(f.options_json?.options) ? f.options_json.options
                     : [],
        validation_json: f.validation_json || {},
        order_index: Number(f.order_index || 0),
        group: f.options_json?.group || f.group || "general",
      }))
      .sort((a,b) => (a.group.localeCompare(b.group)) || (a.order_index - b.order_index));
  };

  const filteredForms = useMemo(() => {
    const list = toArray(forms);
    const qq = q.trim().toLowerCase();
    if (!qq) return list;
    return list.filter(f =>
      String(f.label || "").toLowerCase().includes(qq) ||
      String(f.code || "").toLowerCase().includes(qq)
    );
  }, [forms, q]);

  /* ---------------------------- mutations ---------------------------- */

  const onCreateForm = async () => {
    const label = prompt("Form name (e.g., Lead Create Form):");
    if (!label) return;
    try {
      setSaving(true);
      const payload = {
        label,
        code: toKey(label),
        module: "crm",
        record_type: "lead",
        description: "Form to capture lead details",
      };
      const created = await api.createForm(payload);
      setBanner("Form created.");
      await loadForms();
      const createdObj = Array.isArray(created) ? created[0] : created;
      if (createdObj?.id) selectForm(createdObj);
    } catch (e) {
      console.error(e);
      setBanner("Failed to create form.");
    } finally { setSaving(false); }
  };

  const refreshVersions = async () => {
    if (!selectedForm?.id) return [];
    const vs = toArray(await api.listVersions(selectedForm.id));
    setVersions(vs);
    return vs;
  };

  const ensureDraft = async () => {
    if (!selectedForm?.id) return null;
    const existing = versions.find(v => v.status === "draft");
    if (existing) return existing.version;
    const d = await api.createDraftFromActive(selectedForm.id);
    const vs = await refreshVersions();
    const draft = vs.find(v => v.status === "draft") || d;
    return draft?.version || (Array.isArray(d) ? d[0]?.version : null);
  };

  const switchVersion = async (ver) => {
    if (!selectedForm?.id || !ver) return;
    setCurrentVersion(ver);
    const fl = await api.getFields(selectedForm.id, ver);
    setFields(normalizeFields(fl));
  };

  const onPublish = async () => {
    if (!selectedForm?.id || !currentVersion) return;
    try {
      setSaving(true);
      await api.publishVersion(selectedForm.id, currentVersion);
      await refreshVersions();
      setBanner("Version published.");
    } catch (e) {
      console.error(e);
      setBanner("Failed to publish.");
    } finally { setSaving(false); }
  };

  const onSetActive = async () => {
    if (!selectedForm?.id || !currentVersion) return;
    try {
      setSaving(true);
      await api.setActive(selectedForm.id, currentVersion);
      await refreshVersions();
      setBanner("Version set active.");
    } catch (e) {
      console.error(e);
      setBanner("Failed to set active.");
    } finally { setSaving(false); }
  };

  const onAddField = async (group="general") => {
    if (!selectedForm?.id) return;
    try {
      setSaving(true);
      const draftVer = await ensureDraft();
      const version = draftVer || currentVersion;
      const label = prompt("Field label:");
      if (!label) return;
      const code = toKey(label);
      const base = {
        code,
        label,
        field_type: "text",
        is_required: false,
        placeholder: "",
        help_text: "",
        options_json: { group }, // carry section info
        order_index: (fields.filter(f => f.group === group).length) * 10,
      };
      await api.createField(selectedForm.id, version, base);
      const fl = await api.getFields(selectedForm.id, version);
      setFields(normalizeFields(fl));
      setCurrentVersion(version);
      setBanner("Field added to draft.");
    } catch (e) {
      console.error(e);
      setBanner("Failed to add field.");
    } finally { setSaving(false); }
  };

  const onUpdateField = async (id, patch) => {
    try {
      setSaving(true);
      // If group changed, also persist it inside options_json for the backend
      if (patch.group) {
        patch.options_json = { ...(patch.options_json || {}), group: patch.group };
      }
      await api.updateField(id, patch);
      setFields(prev => prev.map(f => (f.id === id ? { ...f, ...patch } : f))
        .sort((a,b)=> (a.group.localeCompare(b.group)) || (a.order_index - b.order_index)));
      setBanner("Field updated.");
    } catch (e) {
      console.error(e);
      setBanner("Failed to update field.");
    } finally { setSaving(false); }
  };

  const onDeleteField = async (field) => {
    if (!field?.id) return;
    if (!confirm(`Delete field "${field.label}" ?`)) return;
    try {
      setSaving(true);
      await api.deleteField(field.id);
      setFields(prev => prev.filter(f => f.id !== field.id));
      setBanner("Field deleted.");
    } catch (e) {
      console.error(e);
      setBanner("Failed to delete field.");
    } finally { setSaving(false); }
  };

  const onMove = (field, dir) => {
    // simple reorder within group (local)
    const same = fields.filter(f => f.group === field.group).sort((a,b)=>a.order_index-b.order_index);
    const idx = same.findIndex(f => f.id === field.id);
    const target = dir === "up" ? same[idx-1] : same[idx+1];
    if (!target) return;
    const a = field, b = target;
    const next = fields.map(f => {
      if (f.id === a.id) return { ...f, order_index: b.order_index };
      if (f.id === b.id) return { ...f, order_index: a.order_index };
      return f;
    }).sort((x,y)=> (x.group.localeCompare(y.group)) || (x.order_index - y.order_index));
    setFields(next);
  };

  const persistOrder = async () => {
    if (!selectedForm?.id || !currentVersion) return;
    try {
      setSaving(true);
      const items = fields.map((f, i) => ({ id: f.id, group: f.group, order_index: i * 10 }));
      await api.reorder(selectedForm.id, currentVersion, items);
      setFields(prev => prev.map((f, i) => ({ ...f, order_index: i*10 })));
      setBanner("Order saved.");
    } catch (e) {
      console.error(e);
      setBanner("Failed to save order.");
    } finally { setSaving(false); }
  };

  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const selectedField = fields.find(f => f.id === selectedFieldId) || null;

  /* ------------------------------- UI -------------------------------- */

  const VersionBadge = ({ v }) => {
    const status = versions.find(x => x.version === v)?.status || "draft";
    const color = status === "active" ? "bg-emerald-500/15 text-emerald-500"
               : status === "draft"  ? "bg-amber-500/15 text-amber-500"
                                     : "bg-sky-500/15 text-sky-500";
    return <span className={cls("px-2 py-0.5 rounded-lg text-xs", color)}>{status} • v{v}</span>;
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="gg-panel rounded-2xl p-4 md:p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg md:text-xl font-semibold">Custom Forms</h1>
          <span className="text-sm gg-muted">Design, version and publish form layouts</span>
          {bannerMsg && (
            <span className="ml-2 text-xs px-2 py-0.5 rounded-lg bg-primary/10 text-primary">
              {bannerMsg}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button className="gg-btn" onClick={onCreateForm} disabled={saving}>
            <Plus className="w-4 h-4 mr-1" /> New Form
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="mt-4 grid grid-cols-12 gap-4">
        {/* Left: Forms list */}
        <aside className="col-span-12 md:col-span-3">
          <div className="gg-panel rounded-2xl p-3">
            <div className="relative mb-2">
              <input
                className="gg-input pl-9"
                placeholder="Search forms"
                value={q}
                onChange={(e)=>setQ(e.target.value)}
              />
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-60" />
            </div>
            <ul className="max-h-[70vh] overflow-auto pr-1">
              {loading && <li className="p-2 text-sm gg-muted">Loading…</li>}
              {!loading && toArray(filteredForms).map(f => (
                <li key={f.id || f.code}>
                  <button
                    className={cls(
                      "w-full text-left px-3 py-2 rounded-lg hover:bg-base-200/70",
                      selectedForm?.id === f.id && "bg-base-200/90"
                    )}
                    onClick={()=>selectForm(f)}
                  >
                    <div className="font-medium">{f.label}</div>
                    <div className="text-xs gg-muted">{f.code}</div>
                  </button>
                </li>
              ))}
              {!loading && toArray(filteredForms).length === 0 && (
                <li className="p-2 text-sm gg-muted">No forms yet.</li>
              )}
            </ul>
          </div>
        </aside>

        {/* Center: Builder */}
        <main className="col-span-12 md:col-span-6">
          <div className="gg-panel rounded-2xl p-4 md:p-5 space-y-4">
            {/* Form header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base md:text-lg font-semibold">
                  {selectedForm?.label || "Select or create a form"}
                </div>
                {selectedForm && (
                  <div className="text-xs gg-muted">
                    {selectedForm.module?.toUpperCase()} • {selectedForm.record_type}
                  </div>
                )}
              </div>
              {selectedForm && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs gg-muted">Version</span>
                    <select
                      className="gg-input h-9"
                      value={currentVersion || ""}
                      onChange={(e)=>switchVersion(Number(e.target.value))}
                    >
                      {toArray(versions).map(v => (
                        <option key={v.version} value={v.version}>
                          v{v.version} ({v.status})
                        </option>
                      ))}
                    </select>
                    {currentVersion && <VersionBadge v={currentVersion} />}
                  </div>
                </div>
              )}
            </div>

            {/* Version actions */}
            {selectedForm && (
              <div className="flex flex-wrap items-center gap-2">
                <button className="gg-btn" onClick={async()=>{
                  const draftV = await ensureDraft();
                  const vs = await refreshVersions();
                  const v = vs.find(x=>x.status==="draft");
                  if (v) switchVersion(v.version);
                }}>
                  <Edit3 className="w-4 h-4 mr-1" /> Create/Edit Draft
                </button>

                <button className="gg-btn" onClick={onPublish} disabled={!currentVersion}>
                  <Rocket className="w-4 h-4 mr-1" /> Publish
                </button>

                <button className="gg-btn" onClick={onSetActive} disabled={!currentVersion}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Set Active
                </button>

                <button className="gg-btn gg-btn-ghost" onClick={persistOrder}>
                  <Save className="w-4 h-4 mr-1" /> Save Order
                </button>

                <button className="gg-btn gg-btn-ghost" onClick={()=>window.print()}>
                  <Eye className="w-4 h-4 mr-1" /> Preview
                </button>
              </div>
            )}

            {/* Sections */}
            {selectedForm && (
              <div className="space-y-4">
                <Section
                  title="General"
                  subtitle="Shown in the first section of the lead drawer."
                  onAdd={()=>onAddField("general")}
                >
                  <FieldList
                    items={fields.filter(f=>f.group==="general")}
                    onMove={onMove}
                    onPick={(id)=>setSelectedFieldId(id)}
                    selectedId={selectedFieldId}
                    onDelete={onDeleteField}
                  />
                </Section>

                <Section
                  title="Advance"
                  subtitle="Additional fields collapsed by default in the lead drawer."
                  onAdd={()=>onAddField("advance")}
                >
                  <FieldList
                    items={fields.filter(f=>f.group==="advance")}
                    onMove={onMove}
                    onPick={(id)=>setSelectedFieldId(id)}
                    selectedId={selectedFieldId}
                    onDelete={onDeleteField}
                  />
                </Section>
              </div>
            )}
          </div>
        </main>

        {/* Right: Inspector / Preview */}
        <aside className="col-span-12 md:col-span-3 space-y-4">
          {/* Field inspector */}
          <div className="gg-panel rounded-2xl p-4 md:p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Field Inspector</div>
              {selectedField && <span className="text-xs gg-muted">{selectedField.field_type}</span>}
            </div>

            {!selectedField && (
              <div className="text-sm gg-muted">Select a field to edit its properties.</div>
            )}

            {selectedField && (
              <FieldInspector
                field={selectedField}
                onChange={(patch)=>onUpdateField(selectedField.id, patch)}
              />
            )}
          </div>

          {/* Live preview */}
          {selectedForm && (
            <div className="gg-panel rounded-2xl p-4">
              <div className="font-semibold mb-2">Live Preview</div>
              <div className="text-xs gg-muted mb-2">As it would appear in the Add Lead drawer.</div>
              <PreviewCard title="General" items={fields.filter(f=>f.group==="general")} />
              <div className="h-3" />
              <PreviewCard title="Advance" items={fields.filter(f=>f.group==="advance")} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------- Pieces ------------------------------- */

function Section({ title, subtitle, children, onAdd }) {
  return (
    <section className="gg-surface rounded-2xl p-3 md:p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">{title}</div>
          {subtitle && <div className="text-xs gg-muted">{subtitle}</div>}
        </div>
        <button className="gg-btn" onClick={onAdd}><Plus className="w-4 h-4 mr-1" /> Add field</button>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function FieldList({ items, onMove, onPick, selectedId, onDelete }) {
  const list = toArray(items).slice().sort((a,b)=>a.order_index-b.order_index);
  if (!list.length) {
    return <div className="text-sm gg-muted">No fields yet.</div>;
  }
  return (
    <ul className="space-y-2">
      {list.map((f) => (
        <li key={f.id}>
          <div
            className={cls(
              "rounded-xl border border-[color:var(--border)] p-2.5 flex items-center gap-2",
              selectedId === f.id && "ring-1 ring-primary/40"
            )}
          >
            <GripVertical className="w-4 h-4 opacity-50" />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{f.label}</div>
              <div className="text-xs gg-muted truncate">
                {f.code} • {f.field_type}{f.is_required ? " • required" : ""}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className="gg-btn gg-btn-ghost h-8 min-h-8" onClick={()=>onMove(f, "up")}>↑</button>
              <button className="gg-btn gg-btn-ghost h-8 min-h-8" onClick={()=>onMove(f, "down")}>↓</button>
              <button className="gg-btn h-8 min-h-8" onClick={()=>onPick(f.id)}>Edit</button>
              <button className="gg-btn gg-btn-ghost h-8 min-h-8" onClick={()=>onDelete(f)}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function FieldInspector({ field, onChange }) {
  const typeMeta = FIELD_TYPES.find(t => t.v === field.field_type) || FIELD_TYPES[0];
  const Icon = typeMeta.icon;

  const set = (patch) => onChange(patch);

  const [optsText, setOptsText] = useState(
    Array.isArray(field.options_json) ? field.options_json.join(", ")
    : Array.isArray(field.options_json?.options) ? field.options_json.options.join(", ")
    : ""
  );
  useEffect(()=> {
    setOptsText(
      Array.isArray(field.options_json) ? field.options_json.join(", ")
      : Array.isArray(field.options_json?.options) ? field.options_json.options.join(", ")
      : ""
    );
  }, [field.id]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg gg-surface flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
        <div className="font-medium">{typeMeta.label}</div>
      </div>

      <div>
        <label className="gg-label">Label</label>
        <input
          className="gg-input"
          value={field.label}
          onChange={(e)=>set({ label: e.target.value })}
        />
      </div>

      <div>
        <label className="gg-label">Key</label>
        <input
          className="gg-input"
          value={field.code}
          onChange={(e)=>set({ code: toKey(e.target.value) })}
          placeholder="auto from label"
        />
      </div>

      <div>
        <label className="gg-label">Type</label>
        <select
          className="gg-input"
          value={field.field_type}
          onChange={(e)=>set({ field_type: e.target.value })}
        >
          {FIELD_TYPES.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="gg-label">Required</label>
          <select
            className="gg-input"
            value={field.is_required ? "1" : "0"}
            onChange={(e)=>set({ is_required: e.target.value === "1" })}
          >
            <option value="0">No</option>
            <option value="1">Yes</option>
          </select>
        </div>
        <div>
          <label className="gg-label">Section</label>
          <select
            className="gg-input"
            value={field.group || "general"}
            onChange={(e)=>set({ group: e.target.value, options_json: { ...(field.options_json || {}), group: e.target.value } })}
          >
            <option value="general">General</option>
            <option value="advance">Advance</option>
          </select>
        </div>
      </div>

      <div>
        <label className="gg-label">Placeholder</label>
        <input
          className="gg-input"
          value={field.placeholder || ""}
          onChange={(e)=>set({ placeholder: e.target.value })}
        />
      </div>

      <div>
        <label className="gg-label">Help text</label>
        <textarea
          className="gg-input h-20"
          value={field.help_text || ""}
          onChange={(e)=>set({ help_text: e.target.value })}
        />
      </div>

      {(field.field_type === "select") && (
        <div>
          <label className="gg-label">Options (comma separated)</label>
          <input
            className="gg-input"
            value={optsText}
            onChange={(e)=>setOptsText(e.target.value)}
            onBlur={()=>set({ options_json: optsText.split(",").map(s=>s.trim()).filter(Boolean) })}
            placeholder="Hot, Warm, Cold"
          />
        </div>
      )}

      <div>
        <label className="gg-label">Validation (min JSON)</label>
        <input
          className="gg-input"
          placeholder='e.g. {"min":1,"max":100}'
          defaultValue={JSON.stringify(field.validation_json || {})}
          onBlur={(e)=>{
            try { set({ validation_json: JSON.parse(e.target.value || "{}") }); }
            catch { /* ignore invalid */ }
          }}
        />
      </div>
    </div>
  );
}

function PreviewCard({ title, items }) {
  const list = toArray(items);
  return (
    <div className="rounded-xl border border-[color:var(--border)] p-3">
      <div className="font-medium mb-2">{title}</div>
      {!list.length && <div className="text-sm gg-muted">No fields.</div>}
      <div className="grid grid-cols-1 gap-2">
        {list.map(f => (
          <div key={f.id} className="space-y-1.5">
            <div className="text-xs gg-muted">
              {f.label}{f.is_required && <span className="text-rose-400 ml-0.5">*</span>}
            </div>
            {f.field_type === "textarea" ? (
              <textarea className="gg-input h-16" placeholder={f.placeholder || ""} disabled />
            ) : f.field_type === "select" ? (
              <select className="gg-input" disabled>
                <option value="">{f.placeholder || "Select…"}</option>
                {(Array.isArray(f.options_json) ? f.options_json : []).map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : f.field_type === "checkbox" ? (
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" disabled /> {f.placeholder || f.label}
              </label>
            ) : f.field_type === "date" ? (
              <input className="gg-input" type="date" disabled />
            ) : (
              <input className="gg-input" placeholder={f.placeholder || ""} disabled />
            )}
            {f.help_text && <div className="text-[11px] gg-muted">{f.help_text}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
