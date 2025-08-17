import React, { useEffect, useMemo, useState } from "react";

const STORE_KEY = "compliance_policies_v1";

/* ----------------- UI helpers ----------------- */
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
      "w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2 outline-none focus:border-indigo-500 min-h-[140px] " +
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

/* ----------------- utils ----------------- */
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const todayISO = () => new Date().toISOString().slice(0,10);

const nextReviewFrom = (baseISO, cycle) => {
  const d = new Date((baseISO || todayISO()) + "T00:00:00Z");
  const add = (days) => { d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0,10); };
  switch (cycle) {
    case "quarterly": return add(90);
    case "semiannual": return add(182);
    case "annual": return add(365);
    default: return add(365);
  }
};

const TEMPLATES = [
  {
    key: "code_of_conduct",
    title: "Code of Conduct",
    category: "Ethics & Conduct",
    tags: ["SOC2:CC1", "ISO27001:A.7"],
    content: `## Purpose
Set expectations for employee behavior and ethical standards.

## Scope
All employees, contractors, and temporary staff.

## Policy
- Treat colleagues and customers with respect.
- No discrimination or harassment.
- Report violations via designated channels.

## Enforcement
Violations may result in disciplinary action.`,
  },
  {
    key: "access_control",
    title: "Access Control Policy",
    category: "Security",
    tags: ["SOC2:CC6", "ISO27001:A.9"],
    content: `## Purpose
Define how access is requested, approved, provisioned, and reviewed.

## Policy
- Least privilege by default.
- MFA required for admin and production access.
- Quarterly access reviews by owners.`,
  },
  {
    key: "data_retention",
    title: "Data Retention & Disposal",
    category: "Data Governance",
    tags: ["ISO27001:A.8", "GDPR:Art5"],
    content: `## Policy
- Retain customer data only as long as necessary.
- Define retention periods per data class.
- Secure deletion and disposal must be logged.`,
  },
  {
    key: "incident_response",
    title: "Incident Response",
    category: "Security",
    tags: ["SOC2:CC7", "ISO27001:A.16"],
    content: `## Purpose
Describe how security incidents are identified, triaged, communicated, and closed.

## Steps
1. Detect & Triage
2. Contain
3. Eradicate
4. Recover
5. Postmortem & learnings`,
  },
];

const blankPolicy = () => ({
  id: uid(),
  title: "New Policy",
  code: "",
  category: "",
  status: "draft",                // draft | active | archived
  version: 1,
  owner: "",
  reviewers: "",
  effective_from: "",
  last_reviewed: "",
  review_cycle: "annual",         // annual | semiannual | quarterly
  next_review: nextReviewFrom(todayISO(), "annual"),
  tags: [],
  scope: "global",               // global | company | business_unit | location
  applies_to: "",
  require_ack: false,
  ack_frequency: "yearly",       // yearly | once
  references: "",
  content: "",
  change_log: [],
});

/* ----------------- component ----------------- */
export default function CompliancePolicies() {
  const [items, setItems] = useState(() => {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { try { return JSON.parse(raw); } catch {} }
    // seed
    return [
      { ...blankPolicy(), title: "Access Control Policy", code: "ACP", category: "Security", tags: ["SOC2:CC6"], content: TEMPLATES.find(t=>t.key==="access_control")?.content || "" },
      { ...blankPolicy(), title: "Code of Conduct", code: "COC", category: "Ethics & Conduct", tags: ["SOC2:CC1"], content: TEMPLATES.find(t=>t.key==="code_of_conduct")?.content || "" },
    ];
  });
  const [selectedId, setSelectedId] = useState(() => items[0]?.id || null);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(items));
  }, [items]);

  const selected = items.find((x) => x.id === selectedId) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      [p.title, p.code, p.category, p.status, ...(p.tags||[])].some((v) =>
        String(v || "").toLowerCase().includes(q)
      )
    );
  }, [items, query]);

  const addBlank = () => {
    const n = blankPolicy();
    setItems((prev) => [n, ...prev]);
    setSelectedId(n.id);
    toast("Added");
  };
  const addFromTemplate = (tplKey) => {
    const tpl = TEMPLATES.find((t) => t.key === tplKey);
    const n = { ...blankPolicy(), title: tpl?.title || "New Policy", category: tpl?.category || "", tags: tpl?.tags || [], content: tpl?.content || "" };
    setItems((prev) => [n, ...prev]);
    setSelectedId(n.id);
    toast("Added from template");
  };
  const duplicate = (id) => {
    const cur = items.find((x) => x.id === id);
    if (!cur) return;
    const copy = { ...cur, id: uid(), title: cur.title + " (Copy)", code: "" };
    setItems((prev) => [copy, ...prev]);
    setSelectedId(copy.id);
    toast("Duplicated");
  };
  const remove = (id) => {
    const next = items.filter((x) => x.id !== id);
    setItems(next);
    if (selectedId === id) setSelectedId(next[0]?.id || null);
    toast("Removed");
  };
  const update = (id, patch) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const setStatus = (id, status) => {
    const now = todayISO();
    setItems((prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;
        const changes = [...(x.change_log || []), { at: now, action: `status:${x.status}→${status}` }];
        const effective_from = status === "active" && !x.effective_from ? now : x.effective_from;
        return {
          ...x,
          status,
          effective_from,
          next_review: nextReviewFrom(x.last_reviewed || effective_from || now, x.review_cycle),
          change_log: changes,
        };
      })
    );
    toast(status === "active" ? "Activated" : status === "archived" ? "Archived" : "Updated");
  };

  const bumpVersion = (id) => {
    const now = todayISO();
    setItems((prev) =>
      prev.map((x) => {
        if (x.id !== id) return x;
        return {
          ...x,
          version: (x.version || 1) + 1,
          last_reviewed: now,
          next_review: nextReviewFrom(now, x.review_cycle),
          change_log: [...(x.change_log || []), { at: now, action: "version++" }],
        };
      })
    );
    toast("Version bumped");
  };

  const toggleTag = (tag) => {
    if (!selected) return;
    const has = (selected.tags || []).includes(tag);
    const tags = has ? selected.tags.filter((t) => t !== tag) : [...(selected.tags || []), tag];
    update(selected.id, { tags });
  };

  const toast = (t) => { setMsg(t); setTimeout(() => setMsg(""), 900); };

  const download = (filename, mime, content) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportMarkdown = () => {
    if (!selected) return;
    const meta = [
      `Title: ${selected.title}`,
      `Code: ${selected.code || "-"}`,
      `Category: ${selected.category || "-"}`,
      `Version: ${selected.version}`,
      `Status: ${selected.status}`,
      `Owner: ${selected.owner || "-"}`,
      `Review Cycle: ${selected.review_cycle}`,
      `Effective From: ${selected.effective_from || "-"}`,
      `Last Reviewed: ${selected.last_reviewed || "-"}`,
      `Next Review: ${selected.next_review || "-"}`,
      `Tags: ${(selected.tags || []).join(", ") || "-"}`,
    ].join("\n");
    const md = `---\n${meta}\n---\n\n${selected.content || ""}\n`;
    download(`${(selected.code || selected.title).replace(/\s+/g,"_")}.md`, "text/markdown", md);
    toast("Markdown exported");
  };

  const exportJSON = () => {
    if (!selected) return;
    download(`${(selected.code || selected.title).replace(/\s+/g,"_")}.json`, "application/json", JSON.stringify(selected, null, 2));
    toast("JSON exported");
  };

  const COMMON_TAGS = ["SOC2:CC1","SOC2:CC6","SOC2:CC7","ISO27001:A.5","ISO27001:A.7","ISO27001:A.9","GDPR:Art5","GDPR:Art32"];

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">Admin / Compliance Policies</div>
          <h1 className="text-2xl md:text-3xl font-bold">Compliance Policies</h1>
          <p className="text-sm text-gray-400 mt-1">
            Define, review, and publish company policies. Track versions and review cycles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="px-2 py-1 rounded bg-white/10 text-sm">{msg}</span>}
          <div className="relative">
            <details className="group">
              <summary className="list-none px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer">
                + Add
              </summary>
              <div className="absolute right-0 mt-1 w-56 rounded-lg border border-white/10 bg-[#0B0D10] p-2 shadow-xl z-10">
                <button className="w-full text-left px-2 py-1 rounded hover:bg-white/5" onClick={addBlank}>Blank</button>
                <div className="h-px my-1 bg-white/10" />
                {TEMPLATES.map((t) => (
                  <button key={t.key} className="w-full text-left px-2 py-1 rounded hover:bg-white/5" onClick={() => addFromTemplate(t.key)}>
                    {t.title}
                  </button>
                ))}
              </div>
            </details>
          </div>
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={exportMarkdown}>Export .md</button>
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={exportJSON}>Export .json</button>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-5">
        {/* List */}
        <div className="md:col-span-4">
          <Section title="Policies">
            <div className="mb-3">
              <Input placeholder="Search title, code, tag…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="rounded-xl border border-white/10 overflow-hidden">
              {filtered.length === 0 ? (
                <div className="p-4 text-sm text-gray-400">No matches.</div>
              ) : (
                filtered.map((p) => {
                  const active = p.id === selectedId;
                  return (
                    <div
                      key={p.id}
                      className={[
                        "px-3 py-2 border-b border-white/5 cursor-pointer",
                        active ? "bg-white/10" : "hover:bg-white/5",
                      ].join(" ")}
                      onClick={() => setSelectedId(p.id)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{p.title}</div>
                          <div className="text-xs text-gray-400 truncate">
                            {(p.code || "-")} • {p.category || "—"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {p.status === "active" && <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-600/30 text-emerald-200">Active</span>}
                          {p.status === "draft" && <span className="text-[11px] px-2 py-0.5 rounded bg-yellow-600/30 text-yellow-200">Draft</span>}
                          {p.status === "archived" && <span className="text-[11px] px-2 py-0.5 rounded bg-gray-600/30 text-gray-200">Archived</span>}
                          <button
                            className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5"
                            onClick={(e) => { e.stopPropagation(); duplicate(p.id); }}
                          >
                            Copy
                          </button>
                          <button
                            className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5"
                            onClick={(e) => { e.stopPropagation(); remove(p.id); }}
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
            <Section title="Editor"><div className="text-sm text-gray-400">Select a policy to edit.</div></Section>
          ) : (
            <>
              <Section title="Metadata">
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Title">
                    <Input value={selected.title} onChange={(e) => update(selected.id, { title: e.target.value })} />
                  </Field>
                  <Field label="Code">
                    <Input value={selected.code} onChange={(e) => update(selected.id, { code: e.target.value.toUpperCase() })} />
                  </Field>

                  <Field label="Category">
                    <Input placeholder="Security / Data Governance / Ethics …" value={selected.category} onChange={(e) => update(selected.id, { category: e.target.value })} />
                  </Field>
                  <Field label="Status">
                    <select
                      className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2"
                      value={selected.status}
                      onChange={(e) => setStatus(selected.id, e.target.value)}
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                    </select>
                  </Field>

                  <Field label="Owner">
                    <Input value={selected.owner} onChange={(e) => update(selected.id, { owner: e.target.value })} />
                  </Field>
                  <Field label="Reviewers">
                    <Input placeholder="Comma separated names/emails" value={selected.reviewers} onChange={(e) => update(selected.id, { reviewers: e.target.value })} />
                  </Field>

                  <Field label="Review Cycle">
                    <select
                      className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2"
                      value={selected.review_cycle}
                      onChange={(e) => update(selected.id, { review_cycle: e.target.value, next_review: nextReviewFrom(selected.last_reviewed || selected.effective_from || todayISO(), e.target.value) })}
                    >
                      <option value="quarterly">Quarterly</option>
                      <option value="semiannual">Semiannual</option>
                      <option value="annual">Annual</option>
                    </select>
                  </Field>
                  <Field label="Effective From">
                    <Input type="date" value={selected.effective_from || ""} onChange={(e) => update(selected.id, { effective_from: e.target.value })} />
                  </Field>
                  <Field label="Last Reviewed">
                    <Input type="date" value={selected.last_reviewed || ""} onChange={(e) => update(selected.id, { last_reviewed: e.target.value, next_review: nextReviewFrom(e.target.value, selected.review_cycle) })} />
                  </Field>
                  <Field label="Next Review (auto)">
                    <Input type="date" value={selected.next_review || ""} onChange={(e) => update(selected.id, { next_review: e.target.value })} />
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
                  <Field label="Applies To (free text)">
                    <Input placeholder="Roles, units, locations…" value={selected.applies_to} onChange={(e) => update(selected.id, { applies_to: e.target.value })} />
                  </Field>

                  <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
                    <input type="checkbox" checked={selected.require_ack} onChange={(e) => update(selected.id, { require_ack: e.target.checked })} />
                    <span className="text-sm">Require employee acknowledgment</span>
                  </label>
                  <Field label="Acknowledgment Frequency">
                    <select
                      className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2"
                      value={selected.ack_frequency}
                      onChange={(e) => update(selected.id, { ack_frequency: e.target.value })}
                      disabled={!selected.require_ack}
                    >
                      <option value="once">Once</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </Field>
                </div>
              </Section>

              <Section title="Compliance Tags">
                <div className="flex flex-wrap gap-2">
                  {COMMON_TAGS.map((t) => {
                    const on = (selected.tags || []).includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTag(t)}
                        className={[
                          "px-3 py-1 rounded-lg border border-white/10 text-sm",
                          on ? "bg-indigo-600/30 text-indigo-200" : "hover:bg-white/5",
                        ].join(" ")}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Section title="Content (Markdown)">
                <Field label="Policy Text">
                  <Textarea
                    placeholder="Write your policy in Markdown…"
                    value={selected.content}
                    onChange={(e) => update(selected.id, { content: e.target.value })}
                  />
                </Field>
                <Field label="References (comma separated URLs or docs)">
                  <Input
                    placeholder="https://example.com/policy, Internal Doc 123"
                    value={selected.references}
                    onChange={(e) => update(selected.id, { references: e.target.value })}
                  />
                </Field>

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={() => setStatus(selected.id, "active")} disabled={selected.status === "active"}>
                    Publish (Activate)
                  </button>
                  <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={() => setStatus(selected.id, "archived")} disabled={selected.status === "archived"}>
                    Archive
                  </button>
                  <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={() => bumpVersion(selected.id)}>
                    Bump Version
                  </button>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-[#0B0D10] p-4">
                  <div className="text-xs text-gray-400 mb-1">Change Log</div>
                  {(selected.change_log || []).length === 0 ? (
                    <div className="text-sm text-gray-400">No changes yet.</div>
                  ) : (
                    <ul className="text-sm">
                      {selected.change_log.slice().reverse().map((c, i) => (
                        <li key={i} className="py-1 border-b border-white/5">
                          <span className="opacity-70">{c.at}</span> — {c.action}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
