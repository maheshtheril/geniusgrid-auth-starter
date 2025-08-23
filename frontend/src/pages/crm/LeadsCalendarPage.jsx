import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import resourceTimeGridPlugin from "@fullcalendar/resource-timegrid"; // premium (optional)
import resourceTimelinePlugin from "@fullcalendar/resource-timeline"; // premium (optional)
// import listPlugin from "@fullcalendar/list"; // optional if you want List view
import { DateTime } from "luxon";

// NOTE: Make sure FullCalendar styles are included in your app root (e.g., main.jsx or App.jsx):
// import "@fullcalendar/core/index.css";
// import "@fullcalendar/daygrid/index.css";
// import "@fullcalendar/timegrid/index.css";
// import "@fullcalendar/resource-timegrid/index.css"; // if using resource views
// import "@fullcalendar/resource-timeline/index.css"; // if using timeline
// import "@/styles/fc-tweaks.css"; // optional: your custom tweaks

// Project helper (axios wrapper). Adjust the import path to your project layout.
import { http } from "@/lib/http";

/* =======================================================================
   LeadsScheduler.jsx — "Telerik‑style" advanced scheduler for Leads follow‑ups
   -----------------------------------------------------------------------
   Key Features
   • Multiple views: Month/Week/Day, Resource Day (by Owner), Resource Timeline
   • Drag & drop + resize to reschedule follow‑ups
   • Timezone switcher (persists per user via localStorage)
   • Filters: status, owner, priority + search (lead name/company)
   • Resource grouping by Owner (auto‑derived from API response)
   • Event popover with Quick Actions (Open Lead Drawer, Mark Done, Push +1d/-1d)
   • Debounced fetching with range awareness

   Backend Assumptions (adjust endpoints as needed):
   • GET  /api/leads/calendar?start=<iso>&end=<iso>&q=&ownerId=&status=&priority=
       → returns array of leads with fields: id, name, company, status, priority,
         followup_at (ISO), owner_id, owner (name), company_id, phone, email
   • PATCH /api/leads/:id  { followup_at, status }

   If you don’t have /api/leads/calendar, this component will fall back to
   /api/leads with params and map data with followup_at present.
   ======================================================================= */

/* ----------------------------- Utilities ------------------------------ */
const DEFAULT_DURATION_MIN = 45;

const TZ_CHOICES = [
  "Asia/Kolkata",
  "UTC",
  "Asia/Calcutta",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
];

const STATUS_COLORS = {
  new: "#64748b", // slate-500
  working: "#0ea5e9", // sky-500
  contacted: "#22c55e", // green-500
  qualified: "#a855f7", // purple-500
  won: "#16a34a", // green-600
  lost: "#ef4444", // red-500
  stale: "#f59e0b", // amber-500
};

const PRIORITY_BADGE = {
  1: "P1",
  2: "P2",
  3: "P3",
};

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);
  return [value, setValue];
}

function toLuxon(dt, tz) {
  if (!dt) return null;
  return DateTime.fromISO(dt, { zone: tz || "local" });
}

function fmt(dt, tz) {
  if (!dt) return "";
  return toLuxon(dt, tz).toFormat("EEE, dd LLL yyyy • HH:mm");
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/* ----------------------------- Main View ------------------------------ */
export default function LeadsScheduler({
  // optional props for deeper integration
  onOpenLead,          // (leadId) => void — open your LeadDrawer
  initialView = "timeGridWeek",
  initialTZ = "Asia/Kolkata",
  height = "calc(100vh - 160px)",
}) {
  const calRef = useRef(null);

  /* ------------------------ local state & filters ----------------------- */
  const [timeZone, setTimeZone] = useLocalStorage("leadsCal.tz", initialTZ);
  const [viewName, setViewName] = useLocalStorage("leadsCal.view", initialView);
  const [query, setQuery] = useLocalStorage("leadsCal.q", "");
  const [status, setStatus] = useLocalStorage("leadsCal.status", "");
  const [ownerId, setOwnerId] = useLocalStorage("leadsCal.ownerId", "");
  const [priority, setPriority] = useLocalStorage("leadsCal.priority", "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resources, setResources] = useState([]); // owners
  const [events, setEvents] = useState([]);

  // track visible range to fetch appropriately
  const visibleStartRef = useRef(null);
  const visibleEndRef = useRef(null);
  const fetchTimerRef = useRef(null);

  const resetError = () => setError("");

  /* ---------------------------- data fetcher ---------------------------- */
  const fetchEvents = useCallback(async ({ start, end }) => {
    setLoading(true);
    setError("");
    try {
      const params = {
        start: DateTime.fromJSDate(start).toISO(),
        end: DateTime.fromJSDate(end).toISO(),
      };
      if (query) params.q = query;
      if (status) params.status = status;
      if (ownerId) params.ownerId = ownerId;
      if (priority) params.priority = priority;

      let rows = [];

      try {
        // Preferred: specialized calendar endpoint
        rows = await http.get("/api/leads/calendar", { params }).then(r => r.data);
      } catch {
        // Fallback: generic leads endpoint (filtering in backend recommended)
        const list = await http.get("/api/leads", { params }).then(r => r.data?.items || r.data || []);
        rows = (list || []).filter(x => !!x.followup_at);
      }

      // Build resources (owners) & event objects
      const ownersMap = new Map();
      const fcEvents = rows.map((r) => {
        const startISO = r.followup_at || r.created_at;
        const startDT = toLuxon(startISO, timeZone);
        const endDT = startDT ? startDT.plus({ minutes: r.duration_min || DEFAULT_DURATION_MIN }) : null;

        if (r.owner_id) {
          if (!ownersMap.has(r.owner_id)) {
            ownersMap.set(r.owner_id, {
              id: r.owner_id,
              title: r.owner || "Unassigned",
            });
          }
        }

        return {
          id: r.id,
          title: r.name || "(unnamed)",
          start: startDT ? startDT.toISO() : undefined,
          end: endDT ? endDT.toISO() : undefined,
          allDay: false,
          extendedProps: {
            lead: r,
          },
          resourceId: r.owner_id || undefined,
          backgroundColor: STATUS_COLORS[r.status] || "#3b82f6",
          borderColor: STATUS_COLORS[r.status] || "#3b82f6",
        };
      });

      setEvents(fcEvents);
      setResources(Array.from(ownersMap.values()));
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || e?.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [query, status, ownerId, priority, timeZone]);

  const debouncedFetch = useCallback((range) => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(() => fetchEvents(range), 250);
  }, [fetchEvents]);

  /* ----------------------- FullCalendar callbacks ----------------------- */
  const handleDatesSet = useCallback((arg) => {
    visibleStartRef.current = arg.start;
    visibleEndRef.current = arg.end;
    debouncedFetch({ start: arg.start, end: arg.end });
  }, [debouncedFetch]);

  const handleEventDrop = useCallback(async (info) => {
    const { event } = info;
    const id = event.id;
    const startISO = DateTime.fromJSDate(event.start).toISO();
    try {
      await http.patch(`/api/leads/${id}`, { followup_at: startISO });
    } catch (e) {
      console.error(e);
      info.revert();
      setError(e?.response?.data?.message || e?.message || "Failed to reschedule");
    }
  }, []);

  const handleEventResize = useCallback(async (info) => {
    // Optionally store end time. If you don't store end in DB, just ignore.
    // You could also interpret the duration as a custom field in your backend.
    const { event } = info;
    const id = event.id;
    const startISO = DateTime.fromJSDate(event.start).toISO();
    const endISO = event.end ? DateTime.fromJSDate(event.end).toISO() : null;
    try {
      await http.patch(`/api/leads/${id}`, { followup_at: startISO, duration_min: endISO ? Math.max(5, Math.round((DateTime.fromISO(endISO).diff(DateTime.fromISO(startISO), 'minutes').minutes))) : DEFAULT_DURATION_MIN });
    } catch (e) {
      console.error(e);
      info.revert();
      setError(e?.response?.data?.message || e?.message || "Failed to resize");
    }
  }, []);

  const handleDateSelect = useCallback(async (selectInfo) => {
    // Quick add follow-up for an existing lead by typing its name
    const title = window.prompt("Create follow-up: enter existing Lead ID or Name (quick search not wired)\n(You can replace this prompt with your LeadPicker modal.)");
    const cal = selectInfo.view.calendar;
    cal.unselect();
    if (!title) return;

    try {
      // Minimal demo: create a blank lead if no UUID was provided
      // In your app, replace with a proper modal & search.
      const dtISO = DateTime.fromJSDate(selectInfo.start).toISO();
      let leadId = title;
      const isUUID = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i.test(title);
      if (!isUUID) {
        const created = await http.post("/api/leads", { name: title, followup_at: dtISO });
        leadId = created.data?.id || created.id;
      } else {
        await http.patch(`/api/leads/${leadId}`, { followup_at: dtISO });
      }
      // immediate refresh
      if (visibleStartRef.current && visibleEndRef.current) {
        fetchEvents({ start: visibleStartRef.current, end: visibleEndRef.current });
      }
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || e?.message || "Failed to create follow-up");
    }
  }, [fetchEvents]);

  const handleEventClick = useCallback((clickInfo) => {
    const lead = clickInfo.event.extendedProps?.lead;
    if (onOpenLead && lead?.id) {
      onOpenLead(lead.id);
      return;
    }
    // fallback: lightweight details
    const s = fmt(lead?.followup_at || clickInfo.event.startStr, timeZone);
    const info = `Lead: ${lead?.name || "(unnamed)"}\nCompany: ${lead?.company || "—"}\nStatus: ${lead?.status || "—"}\nPriority: ${lead?.priority ?? "—"}\nWhen: ${s}`;
    window.alert(info);
  }, [onOpenLead, timeZone]);

  /* ------------------------- Event content UI -------------------------- */
  const renderEventContent = useCallback((arg) => {
    const r = arg.event.extendedProps?.lead || {};
    const pBadge = PRIORITY_BADGE[clamp(Number(r.priority) || 2, 1, 3)];
    return (
      <div className="fc-event-content px-1 py-0.5 text-[11px] leading-tight">
        <div className="flex items-center gap-1">
          {pBadge && (
            <span className="inline-flex items-center justify-center text-[10px] font-semibold bg-black/20 rounded px-1" title={`Priority ${r.priority}`}>{pBadge}</span>
          )}
          <span className="font-semibold truncate">{r.name || arg.event.title}</span>
        </div>
        <div className="opacity-80 truncate">
          {r.company || r.email || r.phone || ""}
        </div>
      </div>
    );
  }, []);

  /* --------------------------- Toolbar actions ------------------------- */
  const refreshNow = useCallback(() => {
    if (visibleStartRef.current && visibleEndRef.current) {
      fetchEvents({ start: visibleStartRef.current, end: visibleEndRef.current });
    } else {
      const api = calRef.current?.getApi();
      if (api) {
        const view = api.view;
        fetchEvents({ start: view.activeStart, end: view.activeEnd });
      }
    }
  }, [fetchEvents]);

  const pushDays = useCallback(async (deltaDays) => {
    const api = calRef.current?.getApi();
    if (!api) return;
    const selected = api.getEvents().filter(ev => ev.isSelected && ev.display !== 'background');
    if (selected.length === 0) return window.alert("Select one or more items first (Ctrl/Cmd‑click).");
    try {
      const updates = selected.map(async (ev) => {
        const newStart = DateTime.fromJSDate(ev.start).plus({ days: deltaDays }).toISO();
        return http.patch(`/api/leads/${ev.id}`, { followup_at: newStart });
      });
      await Promise.all(updates);
      refreshNow();
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || e?.message || "Failed to move");
    }
  }, [refreshNow]);

  const markDone = useCallback(async () => {
    const api = calRef.current?.getApi();
    if (!api) return;
    const selected = api.getEvents().filter(ev => ev.isSelected && ev.display !== 'background');
    if (selected.length === 0) return window.alert("Select one or more items first (Ctrl/Cmd‑click).");
    try {
      const updates = selected.map(ev => http.patch(`/api/leads/${ev.id}`, { status: "contacted" }));
      await Promise.all(updates);
      refreshNow();
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || e?.message || "Failed to update status");
    }
  }, [refreshNow]);

  /* ----------------------------- Effects ------------------------------- */
  // refetch when filters change
  useEffect(() => {
    if (visibleStartRef.current && visibleEndRef.current) {
      debouncedFetch({ start: visibleStartRef.current, end: visibleEndRef.current });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status, ownerId, priority, timeZone]);

  /* --------------------------- View selector --------------------------- */
  const viewPicker = (
    <select
      className="border rounded px-2 py-1 text-sm"
      value={viewName}
      onChange={(e) => {
        setViewName(e.target.value);
        const api = calRef.current?.getApi();
        if (api) api.changeView(e.target.value);
      }}
    >
      <option value="dayGridMonth">Month</option>
      <option value="timeGridWeek">Week</option>
      <option value="timeGridDay">Day</option>
      <option value="resourceTimeGridDay">Owner • Day</option>
      <option value="resourceTimelineWeek">Timeline • Week</option>
      {/* <option value="listWeek">List • Week</option> */}
    </select>
  );

  /* ------------------------- Top control bar --------------------------- */
  const toolbar = (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => calRef.current?.getApi().today()}
          className="px-3 py-1.5 rounded bg-neutral-800 text-white text-sm"
        >Today</button>
        <button
          onClick={() => calRef.current?.getApi().prev()}
          className="px-2 py-1.5 rounded border text-sm"
          title="Previous"
        >‹</button>
        <button
          onClick={() => calRef.current?.getApi().next()}
          className="px-2 py-1.5 rounded border text-sm"
          title="Next"
        >›</button>
        {viewPicker}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search lead/company/email…"
          className="border rounded px-2 py-1 text-sm w-56"
        />
        <select className="border rounded px-2 py-1 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="new">New</option>
          <option value="working">Working</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
          <option value="stale">Stale</option>
        </select>
        <select className="border rounded px-2 py-1 text-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">All Priority</option>
          <option value="1">P1</option>
          <option value="2">P2</option>
          <option value="3">P3</option>
        </select>
        {/* Owner filter — populated from resources */}
        <select className="border rounded px-2 py-1 text-sm" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
          <option value="">All Owners</option>
          {resources.map(r => (
            <option key={r.id} value={r.id}>{r.title}</option>
          ))}
        </select>
        <select
          className="border rounded px-2 py-1 text-sm"
          value={timeZone}
          onChange={(e) => setTimeZone(e.target.value)}
        >
          {TZ_CHOICES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
        <button onClick={refreshNow} className="px-3 py-1.5 rounded border text-sm">Refresh</button>
      </div>

      <div className="w-full flex items-center gap-2 pt-1">
        <button onClick={() => pushDays(-1)} className="px-2 py-1 rounded border text-sm">−1 day</button>
        <button onClick={() => pushDays(+1)} className="px-2 py-1 rounded border text-sm">+1 day</button>
        <button onClick={markDone} className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm">Mark Contacted</button>
        {loading && <span className="ml-2 text-sm opacity-70">Loading…</span>}
        {error && (
          <span className="ml-2 text-sm text-red-600 cursor-pointer" onClick={resetError} title="Click to dismiss">{error}</span>
        )}
      </div>
    </div>
  );

  /* ------------------------------ Plugins ------------------------------ */
  const plugins = useMemo(() => {
    const arr = [dayGridPlugin, timeGridPlugin, interactionPlugin];
    try { if (resourceTimeGridPlugin) arr.push(resourceTimeGridPlugin); } catch {}
    try { if (resourceTimelinePlugin) arr.push(resourceTimelinePlugin); } catch {}
    // try { if (listPlugin) arr.push(listPlugin); } catch {}
    return arr;
  }, []);

  /* ----------------------------- Calendar ------------------------------ */
  return (
    <div className="p-3">
      {toolbar}
      <FullCalendar
        ref={calRef}
        plugins={plugins}
        initialView={viewName}
        timeZone={timeZone}
        height={height}
        headerToolbar={false}
        weekends={true}
        nowIndicator={true}
        selectable={true}
        selectMirror={true}
        select={handleDateSelect}
        editable={true}
        eventResizableFromStart={true}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        eventClick={handleEventClick}
        eventContent={renderEventContent}
        droppable={false}
        slotMinTime="07:00:00"
        slotMaxTime="21:00:00"
        slotDuration="00:15:00"
        firstDay={1}
        datesSet={handleDatesSet}
        // Data
        events={events}
        resources={resources}
        resourceAreaHeaderContent="Owner"
        resourceLabelContent={(arg) => arg.resource?._resource?.title || arg.resource.title}
        // View options map
        views={{
          dayGridMonth: {
            dayMaxEventRows: 4,
          },
          timeGridWeek: {
            slotEventOverlap: true,
          },
          timeGridDay: {
            slotEventOverlap: true,
          },
          resourceTimeGridDay: {
            // owners by day
            buttonText: "Owner Day",
          },
          resourceTimelineWeek: {
            slotDuration: { days: 1 },
            buttonText: "Timeline Week",
          },
          // listWeek: { noEventsText: "No follow‑ups" },
        }}
        // Selection behavior
        longPressDelay={150}
        eventLongPressDelay={0}
        selectLongPressDelay={0}
      />
    </div>
  );
}
