// src/pages/LeadCreate.jsx
// Production‑ready, futuristic Add Lead page with AI assist, inline company create,
// custom fields, validation, and keyboard‑friendly UX. No menu logic touched.
// Tailwind + lucide‑react. Replace API paths if yours differ.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Building2,
  Sparkles,
  Loader2,
  Plus,
  X,
  Mail,
  Phone,
  User,
  Landmark,
  Globe2,
  Tag,
  Info,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || ""; // same‑origin if empty

function cx(...a) { return a.filter(Boolean).join(" "); }
function api(path) { return `${API_BASE}${path}`.replace(/([^:]\/)\/+/, "$1"); }

const STATUS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

export default function LeadCreate() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company_id: "",
    company_name: "",
    website: "",
    source: "",
    status: "new",
    owner_id: "",
    tags: [],
    notes: "",
    custom: {}, // dynamic custom fields
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // company search / inline create
  const [coQuery, setCoQuery] = useState("");
  const [coResults, setCoResults] = useState([]);
  const [coOpen, setCoOpen] = useState(false);
  const [coBusy, setCoBusy] = useState(false);

  // custom fields
  const [customDefs, setCustomDefs] = useState([]); // [{key,label,type,section:"General"|"Advance",options?:[]}]
  const [loadingCustoms, setLoadingCustoms] = useState(true);

  // AI assist
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [aiNext, setAiNext] = useState([]);
  const [aiScore, setAiScore] = useState(null);
  const [aiTags, setAiTags] = useState([]);

  // draft autosave
  const draftKey = "lead.create.draft.v1";
  useEffect(() => {
    // load draft
    const raw = localStorage.getItem(draftKey);
    if (raw) {
      try { setForm((prev) => ({ ...prev, ...JSON.parse(raw) })); } catch {}
    }
  }, []);
  useEffect(() => {
    const id = setTimeout(() => localStorage.setItem(draftKey, JSON.stringify(form)), 400);
    return () => clearTimeout(id);
  }, [form]);

  // load custom fields
  useEffect(() => {
    let alive = true; (async () => {
      try {
        setLoadingCustoms(true);
        const res = await fetch(api("/api/crm/leads/custom-fields"), { credentials: "include" });
        const json = await res.json();
        if (!alive) return;
        setCustomDefs(Array.isArray(json?.items) ? json.items : json || []);
      } catch (e) {
        console.error("custom fields", e);
        setCustomDefs([]);
      } finally { if (alive) setLoadingCustoms(false); }
    })(); return () => { alive = false; };
  }, []);

  // company search (debounced)
  useEffect(() => {
    if (!coOpen) return;
    const q = coQuery.trim();
    const t = setTimeout(async () => {
      try {
        setCoBusy(true);
        const res = await fetch(api(`/api/companies/search?q=${encodeURIComponent(q)}`), { credentials: "include" });
        const json = await res.json();
        setCoResults(json?.items || json || []);
      } catch (e) {
        console.error("company search", e); setCoResults([]);
      } finally { setCoBusy(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [coQuery, coOpen]);

  const validate = () => {
    const e = {};
    if (!form.name?.trim()) e.name = "Name is required";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = "Invalid email";
    if (form.phone && !/^\+?[0-9\-()\s]{7,}$/.test(form.phone)) e.phone = "Invalid phone";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name?.trim(),
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        company_id: form.company_id || null,
        company_name: form.company_name?.trim() || null,
        website: form.website?.trim() || null,
        source: form.source?.trim() || null,
        status: form.status,
        owner_id: form.owner_id || null,
        tags: form.tags,
        notes: form.notes?.trim() || null,
        custom: form.custom || {},
        ai: {
          score: aiScore,
          summary: aiSummary,
          next: aiNext,
          tags: aiTags,
        },
      };
      const res = await fetch(api("/api/leads"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Create failed (${res.status})`);
      const json = await res.json();
      localStorage.removeItem(draftKey);
      navigate(`/app/crm/leads`);
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to create lead");
    } finally { setSaving(false); }
  };

  const aiSuggest = async () => {
    setAiBusy(true);
    try {
      const res = await fetch(api("/api/leads/ai-draft"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          company: form.company_name,
          email: form.email,
          phone: form.phone,
          website: form.website,
          notes: form.notes,
          custom: form.custom,
        }),
      });
      const json = await res.json();
      setAiSummary(json.summary ?? aiSummary);
      setAiNext(Array.isArray(json.next) ? json.next : aiNext);
      setAiScore(json.score ?? aiScore);
      setAiTags(Array.isArray(json.tags) ? json.tags : aiTags);
    } catch (e) {
      console.error(e);
      alert("AI suggestion failed");
    } finally { setAiBusy(false); }
  };

  const addTag = (t) => setForm((f) => ({ ...f, tags: Array.from(new Set([...(f.tags||[]), t])) }));
  const removeTag = (t) => setForm((f) => ({ ...f, tags: (f.tags||[]).filter((x) => x !== t) }));

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setCustom = (k, v) => setForm((f) => ({ ...f, custom: { ...f.custom, [k]: v } }));

  const groupedCustoms = useMemo(() => {
    const groups = { General: [], Advance: [] };
    for (const d of customDefs) (groups[d.section || "General"] ||= []).push(d);
    return groups;
  }, [customDefs]);

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white/60 dark:bg-zinc-950/50 backdrop-blur">
        <button onClick={() => navigate(-1)} className="rounded-xl border border-zinc-200/70 dark:border-zinc-800 px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="font-semibold">Create Lead</div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={aiSuggest} disabled={aiBusy} className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium border border-indigo-500/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20">
            {aiBusy ? <Loader2 className="h-4 w-4 animate-spin"/> : <Sparkles className="h-4 w-4"/>}
            AI Assist
          </button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold bg-gradient-to-r from-indigo-500 to-sky-500 text-white shadow hover:opacity-95">
            {saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}
            Save Lead
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Left: main form */}
        <div className="xl:col-span-2 space-y-4">
          <section className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-950/50 p-4 backdrop-blur">
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs text-zinc-500">Lead Name *</span>
                <div className={cx("mt-1 flex items-center gap-2 rounded-xl border px-3 py-2", errors.name ? "border-red-400" : "border-zinc-200/70 dark:border-zinc-800") }>
                  <User className="h-4 w-4 opacity-70"/>
                  <input value={form.name} onChange={(e)=>setField("name", e.target.value)} className="w-full bg-transparent outline-none" placeholder="e.g., John Carter" />
                </div>
                {errors.name && <div className="text-xs text-red-500 mt-1">{errors.name}</div>}
              </label>

              <label className="block">
                <span className="text-xs text-zinc-500">Status</span>
                <select value={form.status} onChange={(e)=>setField("status", e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200/70 dark:border-zinc-800 px-3 py-2 bg-transparent">
                  {STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-zinc-500">Email</span>
                <div className={cx("mt-1 flex items-center gap-2 rounded-xl border px-3 py-2", errors.email ? "border-red-400" : "border-zinc-200/70 dark:border-zinc-800") }>
                  <Mail className="h-4 w-4 opacity-70"/>
                  <input value={form.email} onChange={(e)=>setField("email", e.target.value)} className="w-full bg-transparent outline-none" placeholder="name@company.com" />
                </div>
                {errors.email && <div className="text-xs text-red-500 mt-1">{errors.email}</div>}
              </label>

              <label className="block">
                <span className="text-xs text-zinc-500">Phone</span>
                <div className={cx("mt-1 flex items-center gap-2 rounded-xl border px-3 py-2", errors.phone ? "border-red-400" : "border-zinc-200/70 dark:border-zinc-800") }>
                  <Phone className="h-4 w-4 opacity-70"/>
                  <input value={form.phone} onChange={(e)=>setField("phone", e.target.value)} className="w-full bg-transparent outline-none" placeholder="+91 9xxxx xxxxx" />
                </div>
                {errors.phone && <div className="text-xs text-red-500 mt-1">{errors.phone}</div>}
              </label>

              <label className="block sm:col-span-2">
                <span className="text-xs text-zinc-500">Company</span>
                <div className="mt-1 flex gap-2">
                  <div className="relative flex-1">
                    <div className="flex items-center gap-2 rounded-xl border border-zinc-200/70 dark:border-zinc-800 px-3 py-2 bg-transparent">
                      <Building2 className="h-4 w-4 opacity-70"/>
                      <input
                        onFocus={()=>setCoOpen(true)}
                        value={form.company_name}
                        onChange={(e)=>{ setField("company_name", e.target.value); setCoQuery(e.target.value); }}
                        placeholder="Type to search or add new"
                        className="w-full bg-transparent outline-none"
                      />
                      {form.company_id && (
                        <span className="text-[10px] rounded px-1.5 py-0.5 border border-emerald-500/30 text-emerald-600 ml-auto">linked</span>
                      )}
                    </div>
                    {coOpen && (
                      <div className="absolute z-20 mt-2 w-full rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl max-h-60 overflow-auto">
                        <div className="p-2 text-xs text-zinc-500">{coBusy ? "Searching…" : "Select a company or create new"}</div>
                        {coResults.map((c)=> (
                          <button key={c.id} onClick={()=>{ setField("company_id", c.id); setField("company_name", c.name); setCoOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-zinc-900/5">
                            {c.name}
                          </button>
                        ))}
                        <div className="p-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
                          <button
                            onClick={async ()=>{
                              const name = form.company_name?.trim(); if (!name) return;
                              try {
                                setCoBusy(true);
                                const r = await fetch(api("/api/companies"), { method:"POST", credentials:"include", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ name }) });
                                const j = await r.json();
                                setField("company_id", j.id); setField("company_name", j.name); setCoOpen(false);
                              } catch(e){ console.error(e); alert("Create company failed"); } finally { setCoBusy(false); }
                            }}
                            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm border border-zinc-200/70 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                          >
                            <Plus className="h-4 w-4"/> Create "{form.company_name || "new company"}"
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </label>

              <label className="block">
                <span className="text-xs text-zinc-500">Website</span>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-zinc-200/70 dark:border-zinc-800 px-3 py-2">
                  <Globe2 className="h-4 w-4 opacity-70"/>
                  <input value={form.website} onChange={(e)=>setField("website", e.target.value)} className="w-full bg-transparent outline-none" placeholder="https://example.com" />
                </div>
              </label>

              <label className="block">
                <span className="text-xs text-zinc-500">Source</span>
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-zinc-200/70 dark:border-zinc-800 px-3 py-2">
                  <Landmark className="h-4 w-4 opacity-70"/>
                  <input value={form.source} onChange={(e)=>setField("source", e.target.value)} className="w-full bg-transparent outline-none" placeholder="Campaign / Referral" />
                </div>
              </label>

              <label className="block sm:col-span-2">
                <span className="text-xs text-zinc-500">Notes</span>
                <textarea value={form.notes} onChange={(e)=>setField("notes", e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-zinc-200/70 dark:border-zinc-800 px-3 py-2 bg-transparent" placeholder="Context, pain points, timeline…"/>
              </label>

              {/* Tags */}
              <div className="sm:col-span-2">
                <div className="text-xs text-zinc-500 mb-1">Tags</div>
                <div className="flex flex-wrap gap-2">
                  {(form.tags||[]).map((t)=> (
                    <span key={t} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border border-zinc-300 dark:border-zinc-700">
                      <Tag className="h-3.5 w-3.5"/>{t}
                      <button onClick={()=>removeTag(t)} className="ml-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        <X className="h-3 w-3"/>
                      </button>
                    </span>
                  ))}
                  {(aiTags||[]).filter(t=>!(form.tags||[]).includes(t)).slice(0,6).map((t)=> (
                    <button key={t} onClick={()=>addTag(t)} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border border-indigo-400/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20">
                      <Sparkles className="h-3.5 w-3.5"/> {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Custom fields */}
          <section className="rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 bg-white/70 dark:bg-zinc-950/50 p-4 backdrop-blur">
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-3">Custom Fields</div>
            {loadingCustoms ? (
              <div className="text-sm text-zinc-500"><Loader2 className="h-4 w-4 inline animate-spin mr-2"/> Loading…</div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {Object.entries(groupedCustoms).map(([section, defs]) => (
                  <div key={section} className="sm:col-span-1">
                    <div className="text-xs text-zinc-500 mb-2">{section}</div>
                    <div className="space-y-3">
                      {defs.map((d)=> (
                        <div key={d.key}>
                          <div className="text-xs text-zinc-500">{d.label}</div>
                          {d.type === "select" ? (
                            <select value={form.custom?.[d.key] ?? ""} onChange={(e)=>setCustom(d.key, e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200/70 dark:border-zinc-800 px-3 py-2 bg-transparent">
                              <option value="">Select…</option>
                              {(d.options||[]).map((o)=>(<option key={o} value={o}>{o}</option>))}
                            </select>
                          ) : d.type === "date" ? (
                            <input type="date" value={form.custom?.[d.key] ?? ""} onChange={(e)=>setCustom(d.key, e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200/70 dark:border-zinc-800 px-3 py-2 bg-transparent"/>
                          ) : d.type === "textarea" ? (
                            <textarea rows={3} value={form.custom?.[d.key] ?? ""} onChange={(e)=>setCustom(d.key, e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200/70 dark:border-zinc-800 px-3 py-2 bg-transparent"/>
                          ) : (
                            <input value={form.custom?.[d.key] ?? ""} onChange={(e)=>setCustom(d.key, e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200/70 dark:border-zinc-800 px-3 py-2 bg-transparent"/>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: AI panel */}
        <div className="space-y-4">
          <section className="rounded-2xl border border-indigo-400/30 bg-indigo-50/40 dark:bg-indigo-900/10 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-wider text-indigo-700 dark:text-indigo-300">AI Insights</div>
              <button onClick={aiSuggest} disabled={aiBusy} className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs border border-indigo-500/30 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20">
                {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Sparkles className="h-3.5 w-3.5"/>}
                Refresh
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-zinc-500 mb-1">Predicted Score</div>
                <div className="text-2xl font-semibold">{aiScore ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Summary</div>
                <div className="text-sm whitespace-pre-wrap min-h-[72px]">{aiSummary || "No AI summary yet."}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Next Actions</div>
                <ul className="list-disc list-inside text-sm space-y-1 min-h-[64px]">
                  {(aiNext||[]).length ? aiNext.map((t,i)=>(<li key={i}>{t}</li>)) : <li>—</li>}
                </ul>
              </div>
              {(aiTags||[]).length > 0 && (
                <div>
                  <div className="text-xs text-zinc-500 mb-1">AI Tags</div>
                  <div className="flex flex-wrap gap-2">
                    {aiTags.map((t)=>(
                      <button key={t} onClick={()=>addTag(t)} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border border-indigo-400/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20">
                        <Sparkles className="h-3.5 w-3.5"/> {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-[11px] text-zinc-500 flex items-start gap-2">
                <Info className="h-3.5 w-3.5 mt-0.5"/>
                Connect this to your backend at <code>/api/leads/ai-draft</code> (OpenAI/RAG). It returns {`{ score, summary, next, tags }`}.
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
