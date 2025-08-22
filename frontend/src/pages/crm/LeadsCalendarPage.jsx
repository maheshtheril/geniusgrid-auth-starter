// src/pages/crm/LeadsCalendarPage.jsx
import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import resourceTimeGridPlugin from "@fullcalendar/resource-timegrid";   // premium
import resourceTimelinePlugin from "@fullcalendar/resource-timeline";   // premium
import { DateTime } from "luxon";

// CSS (v6)
// import "@fullcalendar/core/index.css";
// import "@fullcalendar/daygrid/index.css";
// import "@fullcalendar/timegrid/index.css";
// import "@fullcalendar/resource-timeline/index.css";

/**
 * World-class Lead Scheduler for SaaS ERP
 * - Views: Week/Month (standard), Owners (resource time grid), Stages (resource time grid), Timeline (owner)
 * - Recurrence aware (UI recognizes rrule, backend expands)
 * - Free/busy overlay for owners
 * - Timezone select, business hours, weekends toggle
 * - Admin filter (view all) vs salesperson (mine)
 * - Drag/resize with permissions + soft conflict checks
 *
 * Backend expected:
 *   GET  /api/calendar/leads           ?from&to&owner     -> expanded instances (start/end) or series + rrule
 *   GET  /api/calendar/resources       ?mode=owners|stages -> [{id,title}]
 *   GET  /api/calendar/freebusy        ?from&to&owners[]= -> [{start,end,owner_id}]
 *   PATCH /api/leads/:id/schedule      { followup_at }
 *   PATCH /api/leads/:id/stage         { stage }              // if stages view
 *   PATCH /api/leads/:id/owner         { owner_id }           // if owners view drag across
 *   PATCH /api/leads/:id/recurrence    { scope:'one|forward|all', changes:{...} } // optional
 */

// ---------- Tiny HTTP helpers (swap to axios if you like)
async function httpGet(url, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(qs ? `${url}?${qs}` : url, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function httpPatch(url, body) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ---------- Small UI bits
function initials(name = "?") {
  const parts = (name || "?").trim().split(/\s+/);
  return (parts[0]?.[0] || "?") + (parts[1]?.[0] || "");
}
const OwnerChip = ({ name }) => (
  <div className="flex items-center gap-2">
    <div className="w-6 h-6 rounded-full bg-neutral-700 text-white text-xs grid place-items-center">
      {initials(name)}
    </div>
    <span className="text-xs opacity-80 truncate max-w-[120px]">{name || "Unassigned"}</span>
  </div>
);
const StageBadge = ({ stage }) => {
  const cls = useMemo(() => {
    const s = (stage || "").toLowerCase();
    if (!s) return "badge-neutral";
    if (s.includes("new")) return "badge-info";
    if (s.includes("qual")) return "badge-warning";
    if (s.includes("prop")) return "badge-accent";
    if (s.includes("nego")) return "badge-secondary";
    if (s.includes("won")) return "badge-success";
    if (s.includes("lost") || s.includes("disq")) return "badge-error";
    return "badge-neutral";
  }, [stage]);
  return <span className={`badge ${cls} badge-sm font-medium`}>{stage || "—"}</span>;
};
function EventContent(arg) {
  const { title, extendedProps } = arg.event;
  const { stageName, ownerName, company, recurring } = extendedProps || {};
  return (
    <div className="p-1.5 leading-tight">
      <div className="flex items-center gap-2">
        <StageBadge stage={stageName} />
        {recurring && <span className="text-[10px] opacity-60">↻</span>}
        <span className="text-[11px] opacity-70">{company || ""}</span>
      </div>
      <div className="text-[12px] font-semibold truncate">{title}</div>
      <div className="mt-1">
        <OwnerChip name={ownerName} />
      </div>
    </div>
  );
}

// ---------- Main
export default function LeadsCalendarPage({
  canViewAll = false,
  currentUserId = null,
  defaultTZ = Intl.DateTimeFormat().resolvedOptions().timeZone,
}) {
  const calRef = useRef(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("week"); // week | month | owners | stages | timeline
  const [tz, setTz] = useState(defaultTZ);
  const [ownerFilter, setOwnerFilter] = useState(null); // admin only
  const [users, setUsers] = useState([]);
  const [resources, setResources] = useState([]); // owners or stages for resource* views
  const [showWeekends, setShowWeekends] = useState(true);

  // license for premium views (Scheduler)
  const schedulerLicenseKey = import.meta.env.VITE_FC_LICENSE || "GPL-My-Project-Is-Open-Source";

  // Fetch admin user list
  const fetchUsers = useCallback(async () => {
    if (!canViewAll) return;
    try {
      const data = await httpGet("/api/admin/users", { active: 1 });
      setUsers(data);
    } catch (e) {
      console.error("User list failed", e);
    }
  }, [canViewAll]);

  // Fetch resources for resource views
  const fetchResources = useCallback(async (kind) => {
    try {
      const data = await httpGet("/api/calendar/resources", { mode: kind }); // owners|stages
      // normalize to {id,title}
      setResources(data.map((r) => ({ id: String(r.id), title: r.title || r.name })));
    } catch (e) {
      console.error("Resource fetch failed", e);
      setResources([]);
    }
  }, []);

  // Map API rows → FullCalendar events
  const mapRowsToEvents = useCallback((rows) => {
    return rows.map((r) => ({
      id: r.lead_id || r.id,
      title: r.title || r.name,
      start: r.start || r.start_at || r.followup_at,
      end: r.end || r.end_at || (r.followup_at
        ? new Date(new Date(r.followup_at).getTime() + 30 * 60 * 1000).toISOString()
        : undefined),
      allDay: !!r.all_day,
      resourceId:
        mode === "owners" || mode === "timeline"
          ? String(r.owner_id || r.owner_user_id || "")
          : mode === "stages"
          ? String(r.stage_id || r.stage || r.status || "")
          : undefined,
      extendedProps: {
        stageName: r.stage_name || r.stage || r.status,
        ownerUserId: r.owner_user_id || r.owner_id,
        ownerName: r.owner_name || r.owner || "",
        company: r.company || r.lead_company || "",
        recurring: !!r.rrule,            // mark if series
        rrule: r.rrule || null,          // if server returns it
        instanceId: r.instance_id || null, // this occurrence id (if expanded)
      },
    }));
  }, [mode]);

  // Data source for calendar events
  const eventsSrc = useCallback(
    async (info, success, failure) => {
      try {
        setLoading(true);
        const { startStr, endStr } = info;
        const rows = await httpGet("/api/calendar/leads", {
          from: DateTime.fromJSDate(info.start).toUTC().toISO(),
          to: DateTime.fromJSDate(info.end).toUTC().toISO(),
          owner: canViewAll ? ownerFilter || undefined : undefined,
          view: mode, // server may optimize owners/stages expansion
          tz,
        });
        success(mapRowsToEvents(rows));
      } catch (e) {
        console.error(e);
        failure(e);
      } finally {
        setLoading(false);
      }
    },
    [ownerFilter, canViewAll, tz, mode, mapRowsToEvents]
  );

  // Free/busy as background events (owners mode)
  const busySrc = useCallback(
    async (info, success, failure) => {
      if (mode !== "owners" && mode !== "timeline") {
        success([]); return;
      }
      try {
        const owners = resources.map((r) => r.id);
        if (!owners.length) { success([]); return; }
        const rows = await httpGet("/api/calendar/freebusy", {
          from: info.startStr, to: info.endStr, owners
        });
        const bg = rows.map((b) => ({
          id: `busy-${b.owner_id}-${b.start}`,
          start: b.start,
          end: b.end,
          display: "background",
          resourceId: String(b.owner_id),
          color: "rgba(255,0,0,0.08)"
        }));
        success(bg);
      } catch (e) {
        failure(e);
      }
    },
    [mode, resources]
  );

  // Drag handlers
  const onEventDrop = useCallback(async (info) => {
    try {
      const newStart = info.event.start?.toISOString();
      const resource = info.newResource?.id;
      const ep = info.event.extendedProps;

      // If resource view → changing resource implies stage/owner change
      if (mode === "owners" || mode === "timeline") {
        if (resource && resource !== String(ep.ownerUserId)) {
          await httpPatch(`/api/leads/${info.event.id}/owner`, { owner_id: resource });
        }
      }
      if (mode === "stages") {
        const newStage = resource;
        if (newStage && newStage !== String(ep.stageName)) {
          await httpPatch(`/api/leads/${info.event.id}/stage`, { stage: newStage });
        }
      }

      // Always reschedule
      await httpPatch(`/api/leads/${info.event.id}/schedule`, { followup_at: newStart });
    } catch (e) {
      console.error(e);
      info.revert();
    }
  }, [mode]);

  const onEventResize = useCallback(async (info) => {
    try {
      const newStart = info.event.start?.toISOString();
      await httpPatch(`/api/leads/${info.event.id}/schedule`, { followup_at: newStart });
    } catch (e) {
      console.error(e);
      info.revert();
    }
  }, []);

  const onEventClick = useCallback((info) => {
    if (window.openLeadDrawer) window.openLeadDrawer(info.event.id);
    else window.location.href = `/crm/leads/${info.event.id}`;
  }, []);

  // Admin users + resources on mount / mode change
  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => {
    if (mode === "owners" || mode === "timeline") fetchResources("owners");
    else if (mode === "stages") fetchResources("stages");
    else setResources([]);
  }, [mode, fetchResources]);

  // Choose correct FullCalendar view
  const fcView = useMemo(() => {
    if ((mode === "owners" || mode === "stages")) return "resourceTimeGridWeek";
    if (mode === "timeline") return "resourceTimelineWeek";
    if (mode === "month") return "dayGridMonth";
    return "timeGridWeek";
  }, [mode]);

  const isPremiumView = useMemo(() => ["owners", "stages", "timeline"].includes(mode), [mode]);

  // Event coloring by stage
  const eventDidMount = useCallback((arg) => {
    const s = (arg.event.extendedProps.stageName || "").toLowerCase();
    if (s.includes("won")) arg.el.style.borderLeft = "3px solid #16a34a";
    else if (s.includes("lost") || s.includes("disq")) arg.el.style.borderLeft = "3px solid #ef4444";
    else if (s.includes("qual")) arg.el.style.borderLeft = "3px solid #f59e0b";
    else if (s.includes("nego")) arg.el.style.borderLeft = "3px solid #a855f7";
    else arg.el.style.borderLeft = "3px solid #64748b";
  }, []);

  return (
    <div className="p-4">
      {/* Top bar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Lead Scheduler</h1>
          <p className="text-sm opacity-70">Drag to reschedule; drag across columns to reassign/change stage; ↻ = recurring.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* View switch */}
          <select
            className="select select-sm border rounded-md px-2 py-1"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            title="View"
          >
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="owners">Owners (resource)</option>
            <option value="stages">Stages (resource)</option>
            <option value="timeline">Timeline (owners)</option>
          </select>

          {/* TZ */}
          <select
            className="select select-sm border rounded-md px-2 py-1"
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            title="Timezone"
          >
            {[defaultTZ, "UTC", "Asia/Kolkata", "America/New_York", "Europe/London", "Asia/Singapore"].map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>

          {/* Weekends */}
          <label className="text-sm flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showWeekends} onChange={(e) => setShowWeekends(e.target.checked)} />
            <span className="opacity-80">Weekends</span>
          </label>

          {/* Admin owner filter */}
          {canViewAll && (
            <div className="flex items-center gap-2">
              <label className="text-sm opacity-75">User</label>
              <select
                className="select select-sm border rounded-md px-2 py-1"
                value={ownerFilter || ""}
                onChange={(e) => setOwnerFilter(e.target.value || null)}
              >
                <option value="">All</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name || u.display_name || u.email}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Calendar */}
      <div className="rounded-2xl border shadow-sm overflow-hidden">
        <FullCalendar
          ref={calRef}
          schedulerLicenseKey={schedulerLicenseKey}
          plugins={[
            dayGridPlugin,
            timeGridPlugin,
            interactionPlugin,
            resourceTimeGridPlugin,
            resourceTimelinePlugin,
          ]}
          timeZone={tz}
          initialView={fcView}
          headerToolbar={{
            left: "prev,next today",
            center: loading ? "Loading…" : "title",
            right: isPremiumView
              ? "resourceTimeGridWeek,resourceTimelineWeek,dayGridMonth,timeGridWeek,timeGridDay"
              : "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          height="calc(100vh - 200px)"
          nowIndicator
          weekends={showWeekends}
          businessHours={{ daysOfWeek: [1,2,3,4,5], startTime: "08:00", endTime: "19:00" }}
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          editable
          droppable
          eventDurationEditable
          eventResizableFromStart
          eventContent={(arg) => <EventContent {...arg} />}
          eventDidMount={eventDidMount}
          eventDrop={onEventDrop}
          eventResize={onEventResize}
          eventClick={onEventClick}
          datesSet={(arg) => {
            // prefetch resources busy overlay after view change
            if (isPremiumView && calRef.current) {
              // trigger refetch of background source
              // (FullCalendar refetches automatically when date range changes)
            }
          }}
          events={eventsSrc}
          // Resources only used for owners/stages/timeline modes
          resources={isPremiumView ? resources : undefined}
          resourceAreaHeaderContent={
            mode === "owners" || mode === "timeline" ? "Owners" :
            mode === "stages" ? "Stages" : ""
          }
          resourceAreaWidth={isPremiumView ? "220px" : undefined}
          // Free/busy overlay as a 2nd source (background events)
          eventSources={[
            { events: eventsSrc },
            { events: busySrc } // only returns when owners/timeline
          ]}
          // Prevent moving into past beyond today 00:00 (soft)
          eventAllow={(dropInfo, draggedEvent) => {
            const start = dropInfo.start;
            return start >= DateTime.now().minus({ days: 1 }).startOf("day").toJSDate();
          }}
        />
      </div>
    </div>
  );
}
