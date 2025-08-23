import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
// NOTE: This version avoids premium plugins so it WORKS OUT‑OF‑THE‑BOX.
// It ships a custom header/toolbar and CSS that mimics a Telerik/Kendo Scheduler look.

import { DateTime } from "luxon";
import { http } from "@/lib/http";


const DEFAULT_DURATION_MIN = 45;
const TZ_CHOICES = ["Asia/Kolkata", "UTC", "Asia/Dubai", "Europe/London", "America/New_York"];
const STATUS_COLORS = {
  new: "#5A6C7C", working: "#0EA5E9", contacted: "#22C55E", qualified: "#A855F7", won: "#16A34A", lost: "#EF4444", stale: "#F59E0B",
};
const PRIORITY_BADGE = { 1: "P1", 2: "P2", 3: "P3" };

/* ----------------------------- Hooks ------------------------------ */
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : initialValue; } catch { return initialValue; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }, [key, value]);
  return [value, setValue];
}
const toLux = (iso, tz) => iso ? DateTime.fromISO(iso, { zone: tz || "local" }) : null;
const fmt = (iso, tz) => (iso ? toLux(iso, tz).toFormat("EEE, dd LLL yyyy • HH:mm") : "");

/* ----------------------------- Page ------------------------------- */
export default function LeadsScheduler({ initialView = "timeGridWeek", initialTZ = "Asia/Kolkata", height = "calc(100vh - 140px)", onOpenLead }) {
  const calRef = useRef(null);
  const [timeZone, setTimeZone] = useLocalStorage("leadsCal.tz", initialTZ);
  const [viewName, setViewName] = useLocalStorage("leadsCal.view", initialView);
  const [query, setQuery] = useLocalStorage("leadsCal.q", "");
  const [status, setStatus] = useLocalStorage("leadsCal.status", "");
  const [priority, setPriority] = useLocalStorage("leadsCal.priority", "");
  const [ownerId, setOwnerId] = useLocalStorage("leadsCal.ownerId", "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [owners, setOwners] = useState([]);
  const [events, setEvents] = useState([]);
  const visibleRange = useRef({ start: null, end: null });
  const timer = useRef(null);

  const fetchEvents = useCallback(async ({ start, end }) => {
    setLoading(true); setError("");
    try {
      const params = { start: DateTime.fromJSDate(start).toISO(), end: DateTime.fromJSDate(end).toISO() };
      if (query) params.q = query; if (status) params.status = status; if (priority) params.priority = priority; if (ownerId) params.ownerId = ownerId;

      let rows = [];
      try {
        const r = await http.get("/api/leads/calendar", { params });
        rows = r.data;
      } catch {
        const r = await http.get("/api/leads", { params });
        rows = r.data?.items || r.data || [];
        rows = rows.filter((x) => !!x.followup_at);
      }

      // owners (for filter)
      const oMap = new Map();
      rows.forEach((r) => { if (r.owner_id) oMap.set(r.owner_id, r.owner || "Unassigned"); });
      setOwners(Array.from(oMap, ([id, title]) => ({ id, title })));

      const fc = rows.map((r) => {
        const startDT = toLux(r.followup_at || r.created_at, timeZone);
        const endDT = startDT?.plus({ minutes: r.duration_min || DEFAULT_DURATION_MIN });
        const color = STATUS_COLORS[r.status] || "#3B82F6";
        return {
          id: r.id,
          title: r.name || "(unnamed)",
          start: startDT?.toISO(), end: endDT?.toISO(), allDay: false,
          backgroundColor: color, borderColor: color,
          extendedProps: { lead: r },
        };
      });
      setEvents(fc);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || "Failed to load events");
    } finally { setLoading(false); }
  }, [query, status, priority, ownerId, timeZone]);

  const debouncedFetch = useCallback((range) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fetchEvents(range), 220);
  }, [fetchEvents]);

  const handleDatesSet = useCallback((arg) => {
    visibleRange.current = { start: arg.start, end: arg.end };
    debouncedFetch({ start: arg.start, end: arg.end });
  }, [debouncedFetch]);

  const refreshNow = useCallback(() => {
    const vr = visibleRange.current; if (!vr.start || !vr.end) return;
    fetchEvents(vr);
  }, [fetchEvents]);

  const onDrop = useCallback(async (info) => {
    const id = info.event.id; const startISO = DateTime.fromJSDate(info.event.start).toISO();
    try { await http.patch(`/api/leads/${id}`, { followup_at: startISO }); }
    catch (e) { info.revert(); setError(e?.response?.data?.message || e?.message || "Reschedule failed"); }
  }, []);

  const onResize = useCallback(async (info) => {
    const id = info.event.id; const startISO = DateTime.fromJSDate(info.event.start).toISO();
    const endISO = info.event.end ? DateTime.fromJSDate(info.event.end).toISO() : null;
    try {
      const dur = endISO ? Math.max(5, Math.round(DateTime.fromISO(endISO).diff(DateTime.fromISO(startISO), "minutes").minutes)) : DEFAULT_DURATION_MIN;
      await http.patch(`/api/leads/${id}`, { followup_at: startISO, duration_min: dur });
    } catch (e) { info.revert(); setError(e?.response?.data?.message || e?.message || "Resize failed"); }
  }, []);

  const onSelect = useCallback(async (sel) => {
    const atISO = DateTime.fromJSDate(sel.start).toISO();
    const input = window.prompt("Create follow‑up — enter Lead NAME or UUID\n(Replace this with your LeadPicker modal later)");
    sel.view.calendar.unselect(); if (!input) return;
    const isUUID = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(input);
    try {
      let id = input;
      if (!isUUID) { const r = await http.post("/api/leads", { name: input, followup_at: atISO }); id = r.data?.id || r.id; }
      else { await http.patch(`/api/leads/${id}`, { followup_at: atISO }); }
      refreshNow();
    } catch (e) { setError(e?.response?.data?.message || e?.message || "Create failed"); }
  }, [refreshNow]);

  const onClick = useCallback((info) => {
    const lead = info.event.extendedProps?.lead;
    if (onOpenLead && lead?.id) { onOpenLead(lead.id); return; }
    alert(`Lead: ${lead?.name || info.event.title}\nStatus: ${lead?.status || "—"}\nWhen: ${fmt(lead?.followup_at || info.event.startStr, timeZone)}`);
  }, [onOpenLead, timeZone]);

  const renderEvent = useCallback((arg) => {
    const r = arg.event.extendedProps?.lead || {}; const p = Number(r.priority) || 2; const badge = PRIORITY_BADGE[Math.max(1, Math.min(3, p))];
    return (
      <div className="ggk-event">
        <div className="ggk-event-top"><span className={`ggk-badge ggk-badge-p${p}`}>{badge}</span><span className="ggk-title">{r.name || arg.event.title}</span></div>
        <div className="ggk-sub">{r.company || r.email || r.phone || ""}</div>
      </div>
    );
  }, []);

  useEffect(() => { const vr = visibleRange.current; if (vr.start && vr.end) debouncedFetch(vr); }, [query, status, priority, ownerId, timeZone]);

  /* --------------------------- Toolbar UI --------------------------- */
  const Toolbar = () => (
    <div className="ggk-toolbar">
      <div className="ggk-left">
        <button onClick={() => calRef.current?.getApi().today()} className="ggk-btn ggk-primary">Today</button>
        <button onClick={() => calRef.current?.getApi().prev()} className="ggk-btn">‹</button>
        <button onClick={() => calRef.current?.getApi().next()} className="ggk-btn">›</button>
        <select className="ggk-select" value={viewName} onChange={(e)=>{ setViewName(e.target.value); calRef.current?.getApi().changeView(e.target.value); }}>
          <option value="dayGridMonth">Month</option>
          <option value="timeGridWeek">Week</option>
          <option value="timeGridDay">Day</option>
        </select>
      </div>
      <div className="ggk-right">
        <input className="ggk-input" placeholder="Search lead/company/email…" value={query} onChange={(e)=>setQuery(e.target.value)} />
        <select className="ggk-select" value={status} onChange={(e)=>setStatus(e.target.value)}>
          <option value="">All Status</option>
          {Object.keys(STATUS_COLORS).map(s=> <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="ggk-select" value={priority} onChange={(e)=>setPriority(e.target.value)}>
          <option value="">All Priority</option>
          <option value="1">P1</option><option value="2">P2</option><option value="3">P3</option>
        </select>
        <select className="ggk-select" value={ownerId} onChange={(e)=>setOwnerId(e.target.value)}>
          <option value="">All Owners</option>
          {owners.map(o=> <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>
        <select className="ggk-select" value={timeZone} onChange={(e)=>setTimeZone(e.target.value)}>
          {TZ_CHOICES.map(tz=> <option key={tz} value={tz}>{tz}</option>)}
        </select>
        <button onClick={refreshNow} className="ggk-btn">Refresh</button>
        {loading && <span className="ggk-hint">Loading…</span>}
        {error && <span className="ggk-err" onClick={()=>setError("")}>{error}</span>}
      </div>
    </div>
  );

  return (
    <div className="ggk-wrap">
      <Toolbar />
      <FullCalendar
        ref={calRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={viewName}
        timeZone={timeZone}
        headerToolbar={false}
        height={height}
        weekends={true}
        nowIndicator={true}
        selectable={true}
        selectMirror={true}
        editable={true}
        eventResizableFromStart={true}
        select={onSelect}
        eventDrop={onDrop}
        eventResize={onResize}
        eventClick={onClick}
        eventContent={renderEvent}
        datesSet={handleDatesSet}
        slotMinTime="07:00:00"
        slotMaxTime="21:00:00"
        slotDuration="00:30:00"
        firstDay={1}
        events={events}
        longPressDelay={150}
        eventLongPressDelay={0}
        selectLongPressDelay={0}
        dayMaxEventRows={3}
        views={{
          dayGridMonth: { dayMaxEventRows: 4 },
          timeGridWeek: { slotEventOverlap: true },
          timeGridDay: { slotEventOverlap: true },
        }}
      />

    </div>
  );
}
