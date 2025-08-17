import React, { useEffect, useMemo, useState } from "react";

const STORE_KEY = "numbering_schemes_v1";

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
const Textarea = (p) => (
  <textarea
    {...p}
    className={
      "w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2 outline-none focus:border-indigo-500 min-h-[90px] " +
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

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const todayISO = () => new Date().toISOString().slice(0, 10);
const fyLabel = (d, startMonth = 4) => {
  const dt = new Date(d);
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth() + 1;
  const fyStart = m >= startMonth ? y : y - 1;
  const fyEndShort = String((fyStart + 1) % 100).padStart(2, "0");
  return `${fyStart}-${fyEndShort}`; // e.g., 2025-26
};
const fmtTokens = (pattern, ctx) => {
  // {SEQ[:pad]} handled first
  const seqPadRe = /\{SEQ(?::(\d+))?\}/g;
  let out = pattern.replace(seqPadRe, (_, p1) =>
    String(ctx.seq).padStart(p1 ? Number(p1) : 1, "0")
  );
  const map = {
    "{PREFIX}": ctx.prefix || "",
    "{YYYY}": String(ctx.date.getUTCFullYear()),
    "{YY}": String(ctx.date.getUTCFullYear()).slice(-2),
    "{MM}": String(ctx.date.getUTCMonth() + 1).padStart(2, "0"),
    "{DD}": String(ctx.date.getUTCDate()).padStart(2, "0"),
    "{FY}": fyLabel(ctx.date.toISOString().slice(0, 10)),
    "{COMP}": ctx.company || "",
    "{DEPT}": ctx.dept || "",
    "{LOC}": ctx.loc || "",
  };
  Object.entries(map).forEach(([k, v]) => (out = out.split(k).join(v)));
  return out;
};

const defaultSchemes = () => [
  {
    id: uid(),
    active: true,
    name: "Invoices",
    code: "INV",
    applies_to: "invoice",
    prefix: "INV",
    pattern: "{PREFIX}/{FY}/{SEQ:5}",
    next_counter: 1,
    start_at: 1,
    reset: "fiscal", // never | yearly | monthly | fiscal
    scope: "global", // global | company | business_unit | location
    sample_company: "ACME",
    sample_dept: "SALES",
    sample_loc: "HQ",
    notes: "Default fiscal-year sequence for invoices.",
  },
  {
    id: uid(),
    active: true,
    name: "Quotes",
    code: "QTN",
    applies_to: "quote",
    prefix: "QTN",
    pattern: "{PREFIX}/{YYYY}/{MM}/{SEQ:4}",
    next_counter: 1,
    start_at: 1,
    reset: "monthly",
    scope: "global",
    sample_company: "ACME",
    sample_dept: "PRE",
    sample_loc: "HQ",
    notes: "Monthly reset for quotations.",
  },
  {
    id: uid(),
    active: true,
    name: "Purchase Orders",
    code: "PO",
    applies_to: "po",
    prefix: "PO",
    pattern: "{PREFIX}-{FY}-{SEQ:4}",
    next_counter: 1,
    start_at: 1,
    reset: "fiscal",
    scope: "global",
    sample_company: "ACME",
    sample_dept: "PROC",
    sample_loc: "HO",
    notes: "",
  },
];

export default function NumberingSchemes() {
  const [schemes, setSchemes] = useState(() => {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch {}
    }
    return defaultSchemes();
  });
  const [selectedId, setSelectedId] = useState(() => schemes[0]?.id || null);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");
  const [previewDate, setPreviewDate] = useState(todayISO());

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(schemes));
  }, [schemes]);

  const selected = schemes.find((s) => s.id === selectedId) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return schemes;
    return schemes.filter((s) =>
      [s.name, s.code, s.applies_to, s.pattern].some((v) =>
        String(v || "").toLowerCase().includes(q)
      )
    );
  }, [schemes, query]);

  const addScheme = () => {
    const n = {
      id: uid(),
      active: true,
      name: "New Scheme",
      code: "",
      applies_to: "",
      prefix: "",
      pattern: "{PREFIX}/{YYYY}/{SEQ:3}",
      next_counter: 1,
      start_at: 1,
      reset: "never",
      scope: "global",
      sample_company: "ACME",
      sample_dept: "OPS",
      sample_loc: "HQ",
      notes: "",
    };
    setSchemes((prev) => [n, ...prev]);
    setSelectedId(n.id);
    setMsg("Added");
    setTimeout(() => setMsg(""), 800);
  };

  const duplicateScheme = (id) => {
    const cur = schemes.find((s) => s.id === id);
    if (!cur) return;
    const copy = { ...cur, id: uid(), name: cur.name + " (Copy)", code: "" };
    setSchemes((prev) => [copy, ...prev]);
    setSelectedId(copy.id);
    setMsg("Duplicated");
    setTimeout(() => setMsg(""), 800);
  };

  const removeScheme = (id) => {
    const next = schemes.filter((s) => s.id !== id);
    setSchemes(next);
    if (selectedId === id) setSelectedId(next[0]?.id || null);
    setMsg("Removed");
    setTimeout(() => setMsg(""), 800);
  };

  const update = (id, patch) =>
    setSchemes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const bumpCounter = (id, by = 1) => {
    const s = schemes.find((x) => x.id === id);
    if (!s) return;
    update(id, { next_counter: Math.max(0, (s.next_counter || 0) + by) });
    setMsg(by > 0 ? "Counter incremented" : "Counter updated");
    setTimeout(() => setMsg(""), 800);
  };

  const resetCounterNow = (id) => {
    const s = schemes.find((x) => x.id === id);
    if (!s) return;
    update(id, { next_counter: s.start_at || 1 });
    setMsg("Counter reset");
    setTimeout(() => setMsg(""), 800);
  };

  const previewNext = (s) => {
    const date = new Date(previewDate + "T00:00:00Z");
    const ctx = {
      date,
      prefix: s.prefix || "",
      seq: s.next_counter || 1,
      company: s.sample_company || "",
      dept: s.sample_dept || "",
      loc: s.sample_loc || "",
    };
    return fmtTokens(s.pattern || "", ctx);
  };

  const save = () => {
    // Persisted by effect already
    setMsg("Saved");
    setTimeout(() => setMsg(""), 1000);
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">Admin / Numbering Schemes</div>
          <h1 className="text-2xl md:text-3xl font-bold">Numbering Schemes</h1>
          <p className="text-sm text-gray-400 mt-1">
            Define document codes using tokens like <code className="bg-white/5 px-1 rounded">{'{PREFIX}'}</code>,
            <code className="bg-white/5 px-1 rounded">{'{FY}'}</code>,
            <code className="bg-white/5 px-1 rounded">{'{YYYY}'}</code>,
            <code className="bg-white/5 px-1 rounded">{'{MM}'}</code>,
            <code className="bg-white/5 px-1 rounded">{'{SEQ:5}'}</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="px-2 py-1 rounded bg-white/10 text-sm">{msg}</span>}
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={addScheme}>+ Add</button>
          <button className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500" onClick={save}>Save</button>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-5">
        {/* List */}
        <div className="md:col-span-4">
          <Section title="Schemes">
            <div className="mb-3">
              <Input placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="rounded-xl border border-white/10 overflow-hidden">
              {filtered.length === 0 ? (
                <div className="p-4 text-sm text-gray-400">No matches.</div>
              ) : (
                filtered.map((s) => {
                  const active = s.id === selectedId;
                  return (
                    <div
                      key={s.id}
                      className={[
                        "px-3 py-2 border-b border-white/5 cursor-pointer",
                        active ? "bg-white/10" : "hover:bg-white/5",
                      ].join(" ")}
                      onClick={() => setSelectedId(s.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{s.name}</div>
                          <div className="text-xs text-gray-400 truncate">
                            {(s.code || "-")} • {s.applies_to || "—"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!s.active && <span className="text-[11px] px-2 py-0.5 rounded bg-red-600/30 text-red-300">Inactive</span>}
                          <button
                            className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5"
                            onClick={(e) => { e.stopPropagation(); duplicateScheme(s.id); }}
                          >
                            Copy
                          </button>
                          <button
                            className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5"
                            onClick={(e) => { e.stopPropagation(); removeScheme(s.id); }}
                          >
                            ✖
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Section>
        </div>

        {/* Editor */}
        <div className="md:col-span-8">
          {!selected ? (
            <Section title="Editor">
              <div className="text-sm text-gray-400">Select a numbering scheme to edit.</div>
            </Section>
          ) : (
            <>
              <Section title="General">
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Name">
                    <Input value={selected.name} onChange={(e) => update(selected.id, { name: e.target.value })} />
                  </Field>
                  <Field label="Code">
                    <Input value={selected.code} onChange={(e) => update(selected.id, { code: e.target.value.toUpperCase() })} />
                  </Field>
                  <Field label="Applies To">
                    <Input placeholder="invoice, quote, po, grn, ..." value={selected.applies_to} onChange={(e) => update(selected.id, { applies_to: e.target.value })} />
                  </Field>
                  <Field label="Scope">
                    <select
                      className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2"
                      value={selected.scope}
                      onChange={(e) => update(selected.id, { scope: e.target.value })}
                    >
                      <option value="global">Global</option>
                      <option value="company">Company</option>
                      <option value="business_unit">Business Unit</option>
                      <option value="location">Location</option>
                    </select>
                  </Field>
                  <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.active}
                      onChange={(e) => update(selected.id, { active: e.target.checked })}
                    />
                    <span className="text-sm">Active</span>
                  </label>
                  <Field label="Notes" className="md:col-span-2">
                    <Textarea value={selected.notes} onChange={(e) => update(selected.id, { notes: e.target.value })} />
                  </Field>
                </div>
              </Section>

              <Section title="Pattern" desc="Use tokens: {PREFIX} {YYYY} {YY} {MM} {DD} {FY} {SEQ:n} {COMP} {DEPT} {LOC}">
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Prefix">
                    <Input value={selected.prefix} onChange={(e) => update(selected.id, { prefix: e.target.value.toUpperCase() })} />
                  </Field>
                  <Field label="Reset">
                    <select
                      className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2"
                      value={selected.reset}
                      onChange={(e) => update(selected.id, { reset: e.target.value })}
                    >
                      <option value="never">Never</option>
                      <option value="yearly">Calendar Year</option>
                      <option value="fiscal">Fiscal Year (Apr–Mar)</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </Field>

                  <Field label="Pattern">
                    <Input
                      value={selected.pattern}
                      onChange={(e) => update(selected.id, { pattern: e.target.value })}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Start At">
                      <Input
                        type="number"
                        min={0}
                        value={selected.start_at}
                        onChange={(e) => update(selected.id, { start_at: Number(e.target.value) })}
                      />
                    </Field>
                    <Field label="Next Counter">
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={0}
                          value={selected.next_counter}
                          onChange={(e) => update(selected.id, { next_counter: Number(e.target.value) })}
                        />
                        <button
                          className="px-2 py-1 rounded border border-white/10 hover:bg-white/5"
                          onClick={() => bumpCounter(selected.id, +1)}
                        >
                          +1
                        </button>
                        <button
                          className="px-2 py-1 rounded border border-white/10 hover:bg-white/5"
                          onClick={() => resetCounterNow(selected.id)}
                        >
                          Reset
                        </button>
                      </div>
                    </Field>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <Field label="Preview Date">
                    <Input type="date" value={previewDate} onChange={(e) => setPreviewDate(e.target.value)} />
                  </Field>
                  <div />
                  <Field label="Sample Company Code">
                    <Input value={selected.sample_company} onChange={(e) => update(selected.id, { sample_company: e.target.value })} />
                  </Field>
                  <Field label="Sample Dept Code">
                    <Input value={selected.sample_dept} onChange={(e) => update(selected.id, { sample_dept: e.target.value })} />
                  </Field>
                  <Field label="Sample Location Code">
                    <Input value={selected.sample_loc} onChange={(e) => update(selected.id, { sample_loc: e.target.value })} />
                  </Field>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-[#0B0D10] p-4">
                  <div className="text-xs text-gray-400 mb-1">Preview</div>
                  <div className="text-lg font-semibold">{previewNext(selected)}</div>
                </div>
              </Section>

              <Section title="Token Reference">
                <div className="text-sm text-gray-300 space-y-2">
                  <div><code className="bg-white/5 px-1 rounded">{'{PREFIX}'}</code> – from the Prefix field.</div>
                  <div><code className="bg-white/5 px-1 rounded">{'{YYYY}'}</code>/<code className="bg-white/5 px-1 rounded">{'{YY}'}</code>/<code className="bg-white/5 px-1 rounded">{'{MM}'}</code>/<code className="bg-white/5 px-1 rounded">{'{DD}'}</code> – date parts.</div>
                  <div><code className="bg-white/5 px-1 rounded">{'{FY}'}</code> – fiscal year label (Apr–Mar), e.g. 2025-26.</div>
                  <div><code className="bg-white/5 px-1 rounded">{'{SEQ}'}</code> or <code className="bg-white/5 px-1 rounded">{'{SEQ:5}'}</code> – next counter, zero-padded.</div>
                  <div><code className="bg-white/5 px-1 rounded">{'{COMP}'}</code>, <code className="bg-white/5 px-1 rounded">{'{DEPT}'}</code>, <code className="bg-white/5 px-1 rounded">{'{LOC}'}</code> – example org codes for preview.</div>
                </div>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
