// src/pages/crm/LeadsCalendarPage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import resourceTimeGridPlugin from "@fullcalendar/resource-timegrid"; // premium
import resourceTimelinePlugin from "@fullcalendar/resource-timeline"; // premium
import { DateTime } from "luxon";
import { http } from "@/lib/http"; // <-- uses your axios instance with baseURL + cookies
import "@/styles/fc-tweaks.css";

/* ---------- tiny axios helpers ---------- */
const httpGet = async (url, params = {}) => (await http.get(url, { params })).data;
const httpPatch = async (url, body) => (await http.patch(url, body)).data;

/* ---------- small UI atoms ---------- */
const initials = (name = "?") => {
  const parts = (name || "?").trim().split(/\s+/);
  return (parts[0]?.[0] || "?") + (parts[1]?.[0] || "");
};
const Avatar = ({ name }) => (
  <div className="w-6 h-6 rounded-full bg-neutral-700 text-white text-[10px] grid place-items-center">
    {initials(name)}
  </div>
);
function StageBadge({ stage }) {
  const s = (stage || "").toLowerCase();
  let cls = "bg-neutral-200 text-neutral-700";
  if (s.includes("new")) cls = "bg-sky-100 text-sky-700";
  else if (s.includes("qual")) cls = "bg-amber-100 text-amber-700";
  else if (s.includes("prop")) cls = "bg-fuchsia-100 text-fuchsia-700";
  else if (s.includes("nego")) cls = "bg-violet-100 text-violet-700";
  else if (s.includes("won")) cls = "bg-green-100 text-green-700";
  else if (s.includes("lost") || s.includes("disq")) cls = "bg-rose-100 text-rose-700";
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>{stage || "—"}</span>;
}
function EventContent(arg) {
  const { title, extendedProps } = arg.event;
  const { stageName, ownerName, company, recurring } = extendedProps || {};
  return (
    <div className="p-1.5 leading-tight">
      <div className="flex items-center gap-2">
        <StageBadge stage={stageName} />
        {recurring && <span className="text-[10px] opacity-60">↻</span>}
        {company && <span className="text-[10px] opacity-70 truncate">{company}</span>}
      </div>
      <div className="text-[12px] font-semibold truncate">{title}</div>
      <div className="mt-1 flex items-center gap-2">
        <Avatar name={ownerName || "Unassigned"} />
        <span className="text-xs opacity-80 truncate max-w-[160px]">{ownerName || "Unassigned"}</span>
      </div>
    </div>
  );
}

/* ---------- main ---------- */
export default function LeadsCalendarPage({
  canViewAll = false,
  currentUserId = null,
  defaultTZ = Intl.DateTimeFormat().resolvedOptions().timeZone,
}) {
  const calRef = useRef(null);

  // UI + state
  const [mode, setMode] = useState("week"); // week | month | owners | stages | timeline
  const [tz, setTz] = useState(defaultTZ);
  const [showWeekends, setShowWeekends] = useState(true);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // admin/user filters
  const [users, setUsers] = useState([]);
  const [ownerFilter, setOwnerFilter] = useState(null);
  const [myOnly, setMyOnly] = useState(!canViewAll && !!currentUserId);

  // resources for premium views
  const [resources, setResources] = useState([]); // owners or stages
  const schedulerLicenseKey =
    import.meta.env.VITE_FC_LICENSE || "GPL-My-Project-Is-Open-Source";

  /* ----- data loaders ----- */
  const fetchUsers = useCallback(async () => {
    if (!canViewAll) return;
    try {
      const data = await httpGet("/api/admin/users", { active: 1 });
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("User list failed", e);
    }
  }, [canViewAll]);

  const fetchResources = useCallback(async (kind) => {
    try {
      const data = await httpGet("/api/calendar/resources", { mode: kind }); // owners|stages
      const normalized = (data || []).map((r) => ({
        id: String(r.id ?? r.code ?? r.title ?? r.name),
        title: r.title || r.name || r.label || String(r.id),
      }));
      setResources(normalized);
    } catch (e) {
      console.error("Resource fetch failed", e);
      setResources([]);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => {
    if (mode === "owners" || mode === "timeline") fetchResources("owners");
    else if (mode === "stages") fetchResources("stages");
    else setResources([]);
  }, [mode, fetchResources]);

  /* ----- mapping ----- */
  const mapRowsToEvents = useCallback((rows) => {
    const s = search.trim().toLowerCase();
    return (rows || [])
      .filter((r) => {
        if (!s) return true;
        const title = (r.title || r.name || "").toLowerCase();
        const company = (r.company || r.lead_company || "").toLowerCase();
        const owner = (r.owner_name || r.owner || "").toLowerCase();
        return title.includes(s) || company.includes(s) || owner.includes(s);
      })
      .map((r) => ({
        id: String(r.lead_id || r.id),
        title: r.title || r.name || "Follow-up",
        start: r.start || r.start_at || r.followup_at,
        end:
          r.end ||
          r.end_at ||
          (r.followup_at
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
          recurring: !!r.rrule,
          rrule: r.rrule || null,
          instanceId: r.instance_id || null,
        },
      }));
  }, [mode, search]);

  /* ----- event sources ----- */
  const eventsSrc = useCallback(
    async (info, success, failure) => {
      try {
        setLoading(true);
        const rows = await httpGet("/api/calendar/leads", {
          from: DateTime.fromJSDate(info.start).toUTC().toISO(),
          to: DateTime.fromJSDate(info.end).toUTC().toISO(),
          tz,
          view: mode,
          owner: canViewAll
            ? ownerFilter || (myOnly ? currentUserId || undefined : undefined)
            : myOnly
            ? currentUserId || undefined
            : undefined,
        });
        success(mapRowsToEvents(rows));
      } catch (e) {
        console.error(e);
        failure?.(e);
      } finally {
        setLoading(false);
      }
    },
    [tz, mode, canViewAll, ownerFilter, currentUserId, myOnly, mapRowsToEvents]
  );

  // Free/busy overlay for owners/timeline
  const busySrc = useCallback(
    async (info, success, failure) => {
      if (!(mode === "owners" || mode === "timeline")) {
        success([]); return;
      }
      try {
        const owners = resources.map((r) => r.id);
        if (!owners.length) { success([]); return; }
        const rows = await httpGet("/api/calendar/freebusy", {
          from: info.startStr, to: info.endStr, owners
        });
        success(
          (rows || []).map((b) => ({
            id: `busy-${b.owner_id}-${b.start}`,
            start: b.start,
            end: b.end,
            display: "background",
            resourceId: String(b.owner_id),
            color: "rgba(239,68,68,0.08)", // soft red bg
          }))
        );
      } catch (e) {
        failure?.(e);
      }
    },
    [mode, resources]
  );

  /* ----- interactions ----- */
  const onEventDrop = useCallback(
    async (info) => {
      try {
        const newStart = info.event.start?.toISOString();
        const ep = info.event.extendedProps;
        const newRes = info.newResource?.id;

        if (mode === "owners" || mode === "timeline") {
          if (newRes && newRes !== String(ep.ownerUserId)) {
            await httpPatch(`/api/leads/${info.event.id}/owner`, { owner_id: newRes });
          }
        } else if (mode === "stages") {
          if (newRes && newRes !== String(ep.stageName)) {
            await httpPatch(`/api/leads/${info.event.id}/stage`, { stage: newRes });
          }
        }

        await httpPatch(`/api/leads/${info.event.id}/schedule`, { followup_at: newStart });
      } catch (e) {
        console.error(e);
        info.revert();
      }
    },
    [mode]
  );

  const onEventResize = useCallback(async (info) => {
    try {
      await httpPatch(`/api/leads/${info.event.id}/schedule`, {
        followup_at: info.event.start?.toISOString(),
      });
    } catch (e) {
      console.error(e);
      info.revert();
    }
  }, []);

  const onEventClick = useCallback((info) => {
    if (window.openLeadDrawer) window.openLeadDrawer(info.event.id);
    else window.location.href = `/crm/leads/${info.event.id}`;
  }, []);

  /* ----- view selection & styles ----- */
  const fcView = useMemo(() => {
    if (mode === "owners" || mode === "stages") return "resourceTimeGridWeek";
    if (mode === "timeline") return "resourceTimelineWeek";
    if (mode === "month") return "dayGridMonth";
    return "timeGridWeek";
  }, [mode]);
  const isPremiumView = useMemo(() => ["owners", "stages", "timeline"].includes(mode), [mode]);

  const eventDidMount = useCallback((arg) => {
    const s = (arg.event.extendedProps.stageName || "").toLowerCase();
    if (s.includes("won")) arg.el.style.borderLeft = "3px solid #16a34a";
    else if (s.includes("lost") || s.includes("disq")) arg.el.style.borderLeft = "3px solid #ef4444";
    else if (s.includes("qual")) arg.el.style.borderLeft = "3px solid #f59e0b";
    else if (s.includes("nego")) arg.el.style.borderLeft = "3px solid #8b5cf6";
    else arg.el.style.borderLeft = "3px solid #64748b";
  }, []);

  return (
    <div className="p-4">
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Lead Scheduler</h1>
          <p className="text-sm opacity-70">Drag to reschedule; drag across columns to reassign/change stage; ↻ = series.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select className="select select-sm select-bordered" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="owners">Owners (resource)</option>
            <option value="stages">Stages (resource)</option>
            <option value="timeline">Timeline (owners)</option>
          </select>

          <select className="select select-sm select-bordered" value={tz} onChange={(e) => setTz(e.target.value)}>
            {[tz, "UTC", "Asia/Kolkata", "America/New_York", "Europe/London", "Asia/Singapore"].map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>

          <label className="text-sm flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showWeekends} onChange={(e) => setShowWeekends(e.target.checked)} />
            <span className="opacity-80">Weekends</span>
          </label>

          <label className="text-sm flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={myOnly} onChange={(e) => setMyOnly(e.target.checked)} />
            <span className="opacity-80">My leads</span>
          </label>

          {canViewAll && (
            <div className="flex items-center gap-2">
              <label className="text-sm opacity-75">User</label>
              <select
                className="select select-sm select-bordered"
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

          <input
            className="input input-sm input-bordered"
            placeholder="Search title / company / owner"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="opacity-70">Legend:</span>
        <span className="px-1 py-0.5 rounded bg-sky-100 text-sky-700">New</span>
        <span className="px-1 py-0.5 rounded bg-amber-100 text-amber-700">Qualified</span>
        <span className="px-1 py-0.5 rounded bg-fuchsia-100 text-fuchsia-700">Proposal</span>
        <span className="px-1 py-0.5 rounded bg-violet-100 text-violet-700">Negotiation</span>
        <span className="px-1 py-0.5 rounded bg-green-100 text-green-700">Won</span>
        <span className="px-1 py-0.5 rounded bg-rose-100 text-rose-700">Lost/Disq</span>
      </div>

      {/* Calendar */}
      <div className="rounded-2xl border shadow-sm overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 z-10 bg-base-100/60 backdrop-blur-sm grid place-items-center">
            <div className="animate-pulse text-sm opacity-70">Loading…</div>
          </div>
        )}
        <FullCalendar
          ref={calRef}
          schedulerLicenseKey={schedulerLicenseKey}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, resourceTimeGridPlugin, resourceTimelinePlugin]}
          timeZone={tz}
          initialView={fcView}
          headerToolbar={{
            left: "prev,next today",
            center: loading ? "Loading…" : "title",
            right: isPremiumView
              ? "resourceTimeGridWeek,resourceTimelineWeek,dayGridMonth,timeGridWeek,timeGridDay"
              : "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          height="calc(100vh - 220px)"
          nowIndicator
          weekends={showWeekends}
          businessHours={{ daysOfWeek: [1,2,3,4,5], startTime: "08:00", endTime: "19:00" }}
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          stickyHeaderDates
          dayMaxEvents
          expandRows
          slotEventOverlap
          eventMinHeight={26}
          editable
          droppable
          eventDurationEditable
          eventResizableFromStart
          selectable
          selectMirror
          eventContent={(arg) => <EventContent {...arg} />}
          eventDidMount={eventDidMount}
          eventDrop={onEventDrop}
          eventResize={onEventResize}
          eventClick={onEventClick}
          // sources: real events + free/busy overlay
          eventSources={[{ events: eventsSrc }, { events: busySrc }]}
          resources={isPremiumView ? resources : undefined}
          resourceAreaHeaderContent={
            mode === "owners" || mode === "timeline" ? "Owners" :
            mode === "stages" ? "Stages" : ""
          }
          resourceAreaWidth={isPremiumView ? "240px" : undefined}
          resourceLabelContent={(arg) => (
            <div className="flex items-center gap-2">
              {(mode === "owners" || mode === "timeline") && <Avatar name={arg.resource.title} />}
              <span className="text-xs">{arg.resource.title}</span>
            </div>
          )}
          resourceOrder="title"
          // prevent hard-dragging too far into the past (soft)
          eventAllow={(dropInfo) => {
            const start = dropInfo.start;
            return start >= DateTime.now().minus({ days: 1 }).startOf("day").toJSDate();
          }}
        />
      </div>
    </div>
  );
}
