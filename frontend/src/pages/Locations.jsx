import React, { useEffect, useMemo, useState } from "react";

const STORE_KEY = "org_locations_v1";

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

const TZONES = ["Asia/Kolkata","Asia/Dubai","UTC","America/New_York","Europe/London","Asia/Singapore"];
const TYPES  = ["Office","Warehouse","Store","Factory","Branch"];

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const blank = () => ({
  id: uid(),
  name: "New Location",
  code: "",
  type: "Office",
  is_primary: false,
  active: true,
  timezone: "Asia/Kolkata",
  phone: "",
  email: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  postal_code: "",
  country: "India",
  gstin: "",
  pan: "",
  notes: "",
  working_days: ["Mon","Tue","Wed","Thu","Fri"],
  open_time: "09:30",
  close_time: "18:00",
});

export default function Locations() {
  const [list, setList] = useState(() => {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { try { return JSON.parse(raw); } catch {} }
    // Seed example
    return [
      { ...blank(), name: "Head Office", code: "HQ", city: "Bengaluru", state: "KA", postal_code: "560001", is_primary: true },
      { ...blank(), name: "Warehouse 01", code: "WH01", type: "Warehouse", city: "Mumbai", state: "MH" },
    ];
  });
  const [selectedId, setSelectedId] = useState(() => list[0]?.id || null);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");

  // persist
  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
  }, [list]);

  // derived
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    const hit = (x) =>
      [x.name, x.code, x.city, x.state, x.country].some((s) =>
        String(s || "").toLowerCase().includes(q)
      );
    return list.filter(hit);
  }, [list, query]);

  const selected = list.find((x) => x.id === selectedId) || null;

  // ops
  const addLocation = () => {
    const n = blank();
    setList((prev) => [n, ...prev]);
    setSelectedId(n.id);
    setMsg("Added");
    setTimeout(() => setMsg(""), 800);
  };

  const duplicate = (id) => {
    const cur = list.find((x) => x.id === id);
    if (!cur) return;
    const copy = { ...cur, id: uid(), name: cur.name + " (Copy)", code: "" };
    setList((prev) => [copy, ...prev]);
    setSelectedId(copy.id);
    setMsg("Duplicated");
    setTimeout(() => setMsg(""), 800);
  };

  const remove = (id) => {
    const next = list.filter((x) => x.id !== id);
    setList(next);
    if (selectedId === id) setSelectedId(next[0]?.id || null);
    setMsg("Removed");
    setTimeout(() => setMsg(""), 800);
  };

  const update = (id, patch) => {
    setList((prev) =>
      prev.map((x) => (x.id === id ? { ...x, ...patch } : x))
    );
  };

  const setPrimary = (id) => {
    setList((prev) => prev.map((x) => ({ ...x, is_primary: x.id === id })));
  };

  const save = () => {
    // persistence already done by effect; just feedback
    setMsg("Saved");
    setTimeout(() => setMsg(""), 1000);
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">Admin / Locations</div>
          <h1 className="text-2xl md:text-3xl font-bold">Locations</h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage offices, branches, warehouses and stores.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="px-2 py-1 rounded bg-white/10 text-sm">{msg}</span>}
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={addLocation}>+ Add</button>
          <button className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500" onClick={save}>Save</button>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-5">
        {/* List */}
        <div className="md:col-span-4">
          <Section title="All Locations">
            <div className="mb-3">
              <Input placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="rounded-xl border border-white/10 overflow-hidden">
              {filtered.length === 0 ? (
                <div className="p-4 text-sm text-gray-400">No matches.</div>
              ) : (
                filtered.map((x) => {
                  const active = x.id === selectedId;
                  return (
                    <div
                      key={x.id}
                      className={[
                        "px-3 py-2 border-b border-white/5 cursor-pointer",
                        active ? "bg-white/10" : "hover:bg-white/5",
                      ].join(" ")}
                      onClick={() => setSelectedId(x.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{x.name}</div>
                          <div className="text-xs text-gray-400 truncate">
                            {x.code || "-"} • {x.city || "—"}, {x.country || "—"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {x.is_primary && <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-600/30 text-indigo-300">Primary</span>}
                          {!x.active && <span className="text-[11px] px-2 py-0.5 rounded bg-red-600/30 text-red-300">Inactive</span>}
                          <button
                            className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5"
                            onClick={(e) => { e.stopPropagation(); duplicate(x.id); }}
                          >
                            Copy
                          </button>
                          <button
                            className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5"
                            onClick={(e) => { e.stopPropagation(); remove(x.id); }}
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
              <div className="text-sm text-gray-400">Select a location to edit.</div>
            </Section>
          ) : (
            <>
              <Section title="Identity & Preferences">
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Name">
                    <Input value={selected.name} onChange={(e) => update(selected.id, { name: e.target.value })} />
                  </Field>
                  <Field label="Code">
                    <Input value={selected.code} onChange={(e) => update(selected.id, { code: e.target.value.toUpperCase() })} />
                  </Field>
                  <Field label="Type">
                    <select
                      className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2"
                      value={selected.type}
                      onChange={(e) => update(selected.id, { type: e.target.value })}
                    >
                      {TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Timezone">
                    <select
                      className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2"
                      value={selected.timezone}
                      onChange={(e) => update(selected.id, { timezone: e.target.value })}
                    >
                      {TZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </Field>
                  <Field label="Working Days">
                    <Input
                      value={selected.working_days.join(", ")}
                      onChange={(e) =>
                        update(selected.id, {
                          working_days: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                        })
                      }
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Open Time">
                      <Input type="time" value={selected.open_time} onChange={(e) => update(selected.id, { open_time: e.target.value })} />
                    </Field>
                    <Field label="Close Time">
                      <Input type="time" value={selected.close_time} onChange={(e) => update(selected.id, { close_time: e.target.value })} />
                    </Field>
                  </div>

                  <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
                    <input type="checkbox" checked={selected.is_primary} onChange={(e) => (e.target.checked ? setPrimary(selected.id) : update(selected.id, { is_primary: false }))} />
                    <span className="text-sm">Set as Primary location</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
                    <input type="checkbox" checked={selected.active} onChange={(e) => update(selected.id, { active: e.target.checked })} />
                    <span className="text-sm">Active</span>
                  </label>
                </div>
              </Section>

              <Section title="Address">
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Address line 1"><Input value={selected.address1} onChange={(e) => update(selected.id, { address1: e.target.value })} /></Field>
                  <Field label="Address line 2"><Input value={selected.address2} onChange={(e) => update(selected.id, { address2: e.target.value })} /></Field>
                  <Field label="City"><Input value={selected.city} onChange={(e) => update(selected.id, { city: e.target.value })} /></Field>
                  <Field label="State/Region"><Input value={selected.state} onChange={(e) => update(selected.id, { state: e.target.value })} /></Field>
                  <Field label="Postal Code"><Input value={selected.postal_code} onChange={(e) => update(selected.id, { postal_code: e.target.value })} /></Field>
                  <Field label="Country"><Input value={selected.country} onChange={(e) => update(selected.id, { country: e.target.value })} /></Field>
                </div>
              </Section>

              <Section title="Contact & Tax">
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Phone"><Input value={selected.phone} onChange={(e) => update(selected.id, { phone: e.target.value })} /></Field>
                  <Field label="Email"><Input type="email" value={selected.email} onChange={(e) => update(selected.id, { email: e.target.value })} /></Field>
                  <Field label="GSTIN"><Input value={selected.gstin} onChange={(e) => update(selected.id, { gstin: e.target.value })} /></Field>
                  <Field label="PAN"><Input value={selected.pan} onChange={(e) => update(selected.id, { pan: e.target.value })} /></Field>
                  <Field label="Notes" className="md:col-span-2"><Textarea value={selected.notes} onChange={(e) => update(selected.id, { notes: e.target.value })} /></Field>
                </div>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
