import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import resourceTimeGridPlugin from "@fullcalendar/resource-timegrid"; // premium
import resourceTimelinePlugin from "@fullcalendar/resource-timeline"; // premium
import { DateTime } from "luxon";

// NOTE: In this preview, we mock the backend so you can see the exact UX without your API.
// You can copy just the visual pieces back into your app.

/* ===== Mock Data ===== */
const OWNERS = [
  { id: "u1", title: "Aisha Khan" },
  { id: "u2", title: "Rahul Verma" },
  { id: "u3", title: "Meera Iyer" },
  { id: "u4", title: "John Mathew" },
];
const STAGES = [
  { id: "new", title: "New" },
  { id: "qualified", title: "Qualified" },
  { id: "proposal", title: "Proposal" },
  { id: "negotiation", title: "Negotiation" },
  { id: "won", title: "Won" },
  { id: "lost", title: "Lost/Disq" },
];

function rndBetween(start, end) {
  const s = start.toMillis();
  const e = end.toMillis();
  const t = s + Math.floor(Math.random() * (e - s));
  return DateTime.fromMillis(t);
}

function genEvents(rangeStart, rangeEnd, mode) {
  const out = [];
  const companies = ["Acme Corp", "BlueSky", "Zenith", "Nimbus", "Orbitals"];
  const titles = ["Follow‑up", "Demo", "Negotiation", "Proposal Call", "Intro"];
  for (let i = 0; i < 28; i++) {
    const start = rndBetween(rangeStart, rangeEnd).startOf("hour");
    const end = start.plus({ minutes: [30, 45, 60][Math.floor(Math.random() * 3)] });
    const owner = OWNERS[Math.floor(Math.random() * OWNERS.length)];
    const stage = STAGES[Math.floor(Math.random() * STAGES.length)];
    out.push({
      id: `L${i}`,
      title: titles[Math.floor(Math.random() * titles.length)],
      start: start.toISO(),
      end: end.toISO(),
      allDay: false,
      resourceId: (mode === "owners" || mode === "timeline") ? owner.id : (mode === "stages" ? stage.id : undefined),
      extendedProps: {
        stageName: stage.title,
        ownerUserId: owner.id,
        ownerName: owner.title,
        company: companies[Math.floor(Math.random() * companies.length)],
        recurring: Math.random() < 0.15,
      },
    });
  }
  return out;
}

/* ===== UI Atoms ===== */
const initials = (name = "?") => {
  const parts = (name || "?").trim().split(/\s+/);
  return (parts[0]?.[0] || "?") + (parts[1]?.[0] || "");
};
const Avatar = ({ name }) => (
  <div className="w-6 h-6 rounded-full bg-neutral-700 text-white text-[10px] grid place-items-center">
    {initials(name)}
  </div>
);
const OwnerChip = ({ name }) => (
  <div className="flex items-center gap-2">
    <Avatar name={name} />
    <span className="text-xs opacity-80 truncate max-w-[160px]">{name || "Unassigned"}</span>
  </div>
);
const StageBadge = ({ stage }) => {
  const cls = useMemo(() => {
    const s = (stage || "").toLowerCase();
    if (!s) return "bg-neutral-200 text-neutral-700";
    if (s.includes("new")) return "bg-sky-100 text-sky-700";
    if (s.includes("qual")) return "bg-amber-100 text-amber-700";
    if (s.includes("prop")) return "bg-fuchsia-100 text-fuchsia-700";
    if (s.includes("nego")) return "bg-violet-100 text-violet-700";
    if (s.includes("won")) return "bg-green-100 text-green-700";
    if (s.includes("lost") || s.includes("disq")) return "bg-rose-100 text-rose-700";
    return "bg-neutral-200 text-neutral-700";
  }, [stage]);
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>{stage || "—"}</span>;
};

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
      <div className="mt-1">
        <OwnerChip name={ownerName} />
      </div>
    </div>
  );
}

/* ===== Main Preview Component ===== */
export default function App() {
  const calRef = useRef(null);
  const [mode, setMode] = useState("week"); // week | month | owners | stages | timeline
  const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [showWeekends, setShowWeekends] = useState(true);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // In preview, resources are static
  const resources = useMemo(() => {
    if (mode === "owners" || mode === "timeline") return OWNERS;
    if (mode === "stages") return STAGES;
    return [];
  }, [mode]);

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

  const eventsSrc = useCallback(async (info, success) => {
    setLoading(true);
    // generate consistent sample events for the requested window
    const start = DateTime.fromJSDate(info.start);
    const end = DateTime.fromJSDate(info.end);
    let rows = genEvents(start, end, mode);
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter((r) =>
        r.title.toLowerCase().includes(s) ||
        r.extendedProps.company.toLowerCase().includes(s) ||
        r.extendedProps.ownerName.toLowerCase().includes(s)
      );
    }
    success(rows);
    setLoading(false);
  }, [mode, search]);

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Lead Scheduler — Preview</h1>
          <p className="text-sm opacity-70">Telerik‑style UX with resources, context, and quick actions.</p>
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
          <input
            className="input input-sm input-bordered"
            placeholder="Search title / company / owner"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="opacity-70">Legend:</span>
        <span className="px-1 py-0.5 rounded bg-sky-100 text-sky-700">New</span>
        <span className="px-1 py-0.5 rounded bg-amber-100 text-amber-700">Qualified</span>
        <span className="px-1 py-0.5 rounded bg-fuchsia-100 text-fuchsia-700">Proposal</span>
        <span className="px-1 py-0.5 rounded bg-violet-100 text-violet-700">Negotiation</span>
        <span className="px-1 py-0.5 rounded bg-green-100 text-green-700">Won</span>
        <span className="px-1 py-0.5 rounded bg-rose-100 text-rose-700">Lost/Disq</span>
      </div>

      <div className="rounded-2xl border shadow-sm overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 z-10 bg-base-100/60 backdrop-blur-sm grid place-items-center">
            <div className="animate-pulse text-sm opacity-70">Loading…</div>
          </div>
        )}
        <FullCalendar
          ref={calRef}
          schedulerLicenseKey={"GPL-My-Project-Is-Open-Source"}
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
          dayMaxEvents={true}
          expandRows={true}
          slotEventOverlap={true}
          eventMinHeight={26}
          editable
          droppable
          eventDurationEditable
          eventResizableFromStart
          selectable
          selectMirror
          events={eventsSrc}
          eventContent={(arg) => <EventContent {...arg} />}
          eventDidMount={eventDidMount}
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
        />
      </div>
    </div>
  );
}
