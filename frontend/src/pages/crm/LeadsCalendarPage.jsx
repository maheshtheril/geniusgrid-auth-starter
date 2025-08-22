import React, { useCallback, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

/**
 * Lead Scheduler (Calendar) — world‑class UX, tailored to your schema
 *
 * Expects backend endpoints:
 *   GET  /api/calendar/leads?from&to&owner   -> rows from v_crm_lead_calendar or v_crm_lead_calendar_me
 *   PATCH /api/leads/:id/schedule { followup_at }
 *   PATCH /api/leads/:id/stage    { stage }
 *
 * Your table columns used: id, name, company, stage, status, priority, owner_id, owner_name, followup_at
 * We render: title, time, stage chip, owner chip. Drag & drop reschedules followup_at.
 */

// Dummy HTTP client — replace with your axios/fetch wrapper
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

function initials(name = "?") {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || "?") + (parts[1]?.[0] || "");
}

function OwnerChip({ name }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-full bg-neutral-700 text-white text-xs grid place-items-center">
        {initials(name)}
      </div>
      <span className="text-xs opacity-80 truncate max-w-[120px]">{name || "Unassigned"}</span>
    </div>
  );
}

function StageBadge({ stage }) {
  const palette = useMemo(() => {
    if (!stage) return "badge-neutral";
    const s = stage.toLowerCase();
    if (s.includes("new")) return "badge-info";
    if (s.includes("qual")) return "badge-warning";
    if (s.includes("prop")) return "badge-accent";
    if (s.includes("nego")) return "badge-secondary";
    if (s.includes("won")) return "badge-success";
    if (s.includes("lost") || s.includes("disq")) return "badge-error";
    return "badge-neutral";
  }, [stage]);
  return (
    <span className={`badge ${palette} badge-sm font-medium`}>{stage || "—"}</span>
  );
}

function EventContent(arg) {
  const title = arg.event.title;
  const stage = arg.event.extendedProps.stageName;
  const ownerName = arg.event.extendedProps.ownerName;
  const company = arg.event.extendedProps.company;
  return (
    <div className="p-1.5 leading-tight">
      <div className="flex items-center gap-2">
        <StageBadge stage={stage} />
        <span className="text-[11px] opacity-70">{company || ""}</span>
      </div>
      <div className="text-[12px] font-semibold truncate">{title}</div>
      <div className="mt-1">
        <OwnerChip name={ownerName} />
      </div>
    </div>
  );
}

export default function LeadsCalendarPage({ canViewAll = false, currentUserId = null }) {
  const calRef = useRef(null);
  const [owner, setOwner] = useState(null); // user filter (admin only)
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);

  const fetchUsers = useCallback(async () => {
    if (!canViewAll) return;
    try {
      const data = await httpGet("/api/admin/users", { active: 1 });
      setUsers(data);
    } catch (e) {
      console.error("User list failed", e);
    }
  }, [canViewAll]);

  const eventsSrc = useCallback(
    async (info, success, failure) => {
      try {
        setLoading(true);
        const { startStr, endStr } = info;
        const rows = await httpGet("/api/calendar/leads", {
          from: startStr,
          to: endStr,
          owner: canViewAll ? owner || undefined : undefined,
        });
        const events = rows.map((r) => ({
          id: r.lead_id || r.id,
          title: r.title || r.name,
          start: r.start || r.start_at || r.followup_at,
          end: r.end || r.end_at || (r.followup_at ? new Date(new Date(r.followup_at).getTime() + 30*60*1000).toISOString() : undefined),
          allDay: r.all_day || false,
          extendedProps: {
            stageName: r.stage_name || r.stage || r.status,
            ownerUserId: r.owner_user_id || r.owner_id,
            ownerName: r.owner_name || r.owner || "",
            company: r.company || r.lead_company || "",
          },
        }));
        success(events);
      } catch (e) {
        console.error(e);
        failure(e);
      } finally {
        setLoading(false);
      }
    },
    [owner, canViewAll]
  );

  const onEventDrop = useCallback(async (info) => {
    try {
      const newStart = info.event.start?.toISOString();
      await httpPatch(`/api/leads/${info.event.id}/schedule`, { followup_at: newStart });
    } catch (e) {
      console.error(e);
      info.revert();
    }
  }, []);

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
    // hook your drawer/navigation
    if (window.openLeadDrawer) {
      window.openLeadDrawer(info.event.id);
    } else {
      // fallback: navigate to detail if you have a route
      window.location.href = `/crm/leads/${info.event.id}`;
    }
  }, []);

  // Load admin user list on mount if permitted
  React.useEffect(() => { fetchUsers(); }, [fetchUsers]);

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Lead Scheduler</h1>
          <p className="text-sm opacity-70">Drag to reschedule; click to open. Right‑click (or long‑press) for more actions.</p>
        </div>

        {canViewAll && (
          <div className="flex items-center gap-2">
            <label className="text-sm opacity-75">User</label>
            <select
              className="select select-sm border rounded-md px-2 py-1"
              value={owner || ""}
              onChange={(e) => setOwner(e.target.value || null)}
            >
              <option value="">All</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name || u.display_name || u.email}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="rounded-2xl border shadow-sm overflow-hidden">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: loading ? "Loading…" : "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          height="calc(100vh - 200px)"
          nowIndicator
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          events={eventsSrc}
          editable
          eventDurationEditable
          eventResizableFromStart
          eventContent={(arg) => <EventContent {...arg} />}
          eventDrop={onEventDrop}
          eventResize={onEventResize}
          eventClick={onEventClick}
        />
      </div>
    </div>
  );
}
