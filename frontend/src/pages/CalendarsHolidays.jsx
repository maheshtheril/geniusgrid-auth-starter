import React, { useEffect, useMemo, useState } from "react";

const STORE_KEY = "org_calendars_v1";

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

const TZONES = ["Asia/Kolkata","Asia/Dubai","UTC","America/New_York","Europe/London","Asia/Singapore"];
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const blankHoliday = () => ({
  id: uid(),
  name: "",
  date: new Date().toISOString().slice(0,10), // YYYY-MM-DD
  region: "",
  optional: false,
  recurrence: "none", // none | yearly
});

const blankCalendar = () => ({
  id: uid(),
  name: "Company Calendar",
  code: "CAL",
  color: "#5b6cff",
  timezone: "Asia/Kolkata",
  work_week: ["Mon","Tue","Wed","Thu","Fri"],
  start_time: "09:30",
  end_time: "18:00",
  holidays: [
    // seed a couple of fixed-date examples
    { id: uid(), name: "Republic Day", date: "2025-01-26", region: "IN", optional: false, recurrence: "yearly" },
    { id: uid(), name: "Independence Day", date: "2025-08-15", region: "IN", optional: false, recurrence: "yearly" },
  ],
});

export default function CalendarsHolidays() {
  const [calendars, setCalendars] = useState(() => {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { try { return JSON.parse(raw); } catch {} }
    return [blankCalendar()];
  });
  const [selectedId, setSelectedId] = useState(() => calendars[0]?.id || null);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(calendars));
  }, [calendars]);

  const selected = calendars.find(c => c.id === selectedId) || null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return calendars;
    return calendars.filter(c =>
      [c.name, c.code, c.timezone].some(v => String(v||"").toLowerCase().includes(q))
    );
  }, [calendars, query]);

  const updateCal = (id, patch) => {
    setCalendars(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
  };

  const addCalendar = () => {
    const n = blankCalendar();
    setCalendars(prev => [n, ...prev]);
    setSelectedId(n.id);
    setMsg("Added");
    setTimeout(() => setMsg(""), 800);
  };

  const duplicateCalendar = (id) => {
    const cur = calendars.find(c => c.id === id);
    if (!cur) return;
    const copy = { ...cur, id: uid(), name: cur.name + " (Copy)", code: "" };
    setCalendars(prev => [copy, ...prev]);
    setSelectedId(copy.id);
    setMsg("Duplicated");
    setTimeout(() => setMsg(""), 800);
  };

  const removeCalendar = (id) => {
    const next = calendars.filter(c => c.id !== id);
    setCalendars(next);
    if (selectedId === id) setSelectedId(next[0]?.id || null);
    setMsg("Removed");
    setTimeout(() => setMsg(""), 800);
  };

  const toggleDay = (id, day) => {
    const cal = calendars.find(c => c.id === id);
    if (!cal) return;
    const has = cal.work_week.includes(day);
    const work_week = has ? cal.work_week.filter(d => d !== day) : [...cal.work_week, day];
    updateCal(id, { work_week });
  };

  const addHoliday = () => {
    if (!selected) return;
    updateCal(selected.id, { holidays: [{ ...blankHoliday() }, ...selected.holidays] });
  };

  const removeHoliday = (hid) => {
    if (!selected) return;
    updateCal(selected.id, { holidays: selected.holidays.filter(h => h.id !== hid) });
  };

  const updateHoliday = (hid, patch) => {
    if (!selected) return;
    updateCal(selected.id, {
      holidays: selected.holidays.map(h => (h.id === hid ? { ...h, ...patch } : h)),
    });
  };

  const addCommonFixedIN = () => {
    if (!selected) return;
    const year = new Date().getFullYear();
    const fx = [
      { name: "New Year's Day",  date: `${year}-01-01` },
      { name: "Republic Day",    date: `${year}-01-26` },
      { name: "Labour Day",      date: `${year}-05-01` },
      { name: "Independence Day",date: `${year}-08-15` },
      { name: "Gandhi Jayanti",  date: `${year}-10-02` },
      { name: "Christmas Day",   date: `${year}-12-25` },
    ].map(x => ({ id: uid(), region: "IN", optional: false, recurrence: "yearly", ...x }));
    updateCal(selected.id, { holidays: [...fx, ...selected.holidays] });
    setMsg("Added common fixed-date holidays");
    setTimeout(() => setMsg(""), 1000);
  };

  const save = () => {
    // Already persisted to localStorage by effect; show feedback
    setMsg("Saved");
    setTimeout(() => setMsg(""), 1000);
  };

  // ----- ICS export (holidays only, all-day events) -----
  const toYYYYMMDD = (d) => d.replaceAll("-", "");
  const plusOneDay = (d) => {
    const dt = new Date(d);
    dt.setDate(dt.getDate() + 1);
    return dt.toISOString().slice(0,10);
  };
  const downloadICS = () => {
    if (!selected) return;
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//GeniusGrid//Calendars//EN",
      ...selected.holidays.map(h => ([
        "BEGIN:VEVENT",
        `UID:${h.id}@geniusgrid`,
        `DTSTART;VALUE=DATE:${toYYYYMMDD(h.date)}`,
        `DTEND;VALUE=DATE:${toYYYYMMDD(plusOneDay(h.date))}`,
        `SUMMARY:${h.name}${h.optional ? " (Optional)" : ""}`,
        ...(h.recurrence === "yearly" ? ["RRULE:FREQ=YEARLY"] : []),
        "END:VEVENT",
      ].join("\r\n"))),
      "END:VCALENDAR",
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(selected.code || "calendar").toLowerCase()}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">Admin / Calendars & Holidays</div>
          <h1 className="text-2xl md:text-3xl font-bold">Calendars & Holidays</h1>
          <p className="text-sm text-gray-400 mt-1">
            Define work weeks, hours and holiday lists. Export as .ics for other tools.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className="px-2 py-1 rounded bg-white/10 text-sm">{msg}</span>}
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={addCalendar}>+ Add</button>
          <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={downloadICS}>Export .ics</button>
          <button className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500" onClick={save}>Save</button>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-5">
        {/* Calendars list */}
        <div className="md:col-span-4">
          <Section title="Calendars">
            <div className="mb-3">
              <Input placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="rounded-xl border border-white/10 overflow-hidden">
              {filtered.length === 0 ? (
                <div className="p-4 text-sm text-gray-400">No matches.</div>
              ) : (
                filtered.map((c) => {
                  const active = c.id === selectedId;
                  return (
                    <div
                      key={c.id}
                      className={[
                        "px-3 py-2 border-b border-white/5 cursor-pointer",
                        active ? "bg-white/10" : "hover:bg-white/5",
                      ].join(" ")}
                      onClick={() => setSelectedId(c.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-xs text-gray-400 truncate">
                            {c.code || "-"} • {c.timezone}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-4 h-4 rounded" style={{ background: c.color }} />
                          <button
                            className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5"
                            onClick={(e) => { e.stopPropagation(); duplicateCalendar(c.id); }}
                          >
                            Copy
                          </button>
                          <button
                            className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5"
                            onClick={(e) => { e.stopPropagation(); removeCalendar(c.id); }}
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
              <div className="text-sm text-gray-400">Select a calendar to edit.</div>
            </Section>
          ) : (
            <>
              <Section title="Calendar Settings">
                <div className="grid md:grid-cols-2 gap-4">
                  <Field label="Name">
                    <Input value={selected.name} onChange={(e) => updateCal(selected.id, { name: e.target.value })} />
                  </Field>
                  <Field label="Code">
                    <Input value={selected.code} onChange={(e) => updateCal(selected.id, { code: e.target.value.toUpperCase() })} />
                  </Field>
                  <Field label="Color">
                    <div className="flex items-center gap-2">
                      <Input type="color" className="h-10 w-16 p-1" value={selected.color} onChange={(e) => updateCal(selected.id, { color: e.target.value })} />
                      <Input value={selected.color} onChange={(e) => updateCal(selected.id, { color: e.target.value })} />
                    </div>
                  </Field>
                  <Field label="Timezone">
                    <select
                      className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2"
                      value={selected.timezone}
                      onChange={(e) => updateCal(selected.id, { timezone: e.target.value })}
                    >
                      {TZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </Field>
                  <Field label="Work Week" className="md:col-span-2">
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDay(selected.id, d)}
                          className={[
                            "px-3 py-1 rounded-lg border border-white/10",
                            selected.work_week.includes(d) ? "bg-indigo-600/30 text-indigo-200" : "hover:bg-white/5"
                          ].join(" ")}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Start Time">
                      <Input type="time" value={selected.start_time} onChange={(e) => updateCal(selected.id, { start_time: e.target.value })} />
                    </Field>
                    <Field label="End Time">
                      <Input type="time" value={selected.end_time} onChange={(e) => updateCal(selected.id, { end_time: e.target.value })} />
                    </Field>
                  </div>
                </div>
              </Section>

              <Section title="Holidays" desc="Add fixed-date holidays. Use recurrence 'Yearly' for repeating dates.">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={addHoliday}>
                    + Add Holiday
                  </button>
                  <button className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5" onClick={addCommonFixedIN}>
                    + Add common fixed-date (IN)
                  </button>
                </div>

                {selected.holidays.length === 0 ? (
                  <div className="text-sm text-gray-400">No holidays yet.</div>
                ) : (
                  <div className="grid gap-3">
                    {selected.holidays.map(h => (
                      <div key={h.id} className="grid md:grid-cols-12 gap-3 bg-[#0B0D10] border border-white/10 rounded-xl p-3">
                        <Field label="Date" className="md:col-span-2">
                          <Input type="date" value={h.date} onChange={(e) => updateHoliday(h.id, { date: e.target.value })} />
                        </Field>
                        <Field label="Name" className="md:col-span-4">
                          <Input value={h.name} onChange={(e) => updateHoliday(h.id, { name: e.target.value })} />
                        </Field>
                        <Field label="Region" className="md:col-span-2">
                          <Input placeholder="IN / State code" value={h.region} onChange={(e) => updateHoliday(h.id, { region: e.target.value })} />
                        </Field>
                        <Field label="Recurrence" className="md:col-span-2">
                          <select
                            className="w-full rounded-xl bg-[#0B0D10] border border-white/10 px-3 py-2"
                            value={h.recurrence}
                            onChange={(e) => updateHoliday(h.id, { recurrence: e.target.value })}
                          >
                            <option value="none">None</option>
                            <option value="yearly">Yearly</option>
                          </select>
                        </Field>
                        <Field label="Optional" className="md:col-span-1">
                          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0B0D10] px-3 py-2">
                            <input type="checkbox" checked={h.optional} onChange={(e) => updateHoliday(h.id, { optional: e.target.checked })} />
                          </label>
                        </Field>
                        <div className="md:col-span-1 flex items-end">
                          <button
                            className="w-full text-sm px-2 py-1 rounded border border-white/10 hover:bg-white/5"
                            onClick={() => removeHoliday(h.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
