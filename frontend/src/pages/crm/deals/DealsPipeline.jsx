// ---------- FILE: src/pages/crm/deals/DealsPipeline.jsx ----------
import React, { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { useOutletContext } from "react-router-dom";
import { Plus, Filter } from "lucide-react";
import DealDrawer from "./DealDrawer";
import { STAGES, listDeals, moveDealToStage } from "./mockApi";

/* ---------- UI helpers ---------- */
function Column({ id, title, count, total, children }) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { columnId: id } });
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[260px] rounded-2xl border bg-[hsl(var(--card))]/70 backdrop-blur p-3 shadow-sm transition ${
        isOver ? "ring-2 ring-[hsl(var(--ring))]/50" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-[hsl(var(--muted-foreground))]">
          {count} • ₹{(total / 100000).toFixed(2)}L
        </div>
      </div>
      <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">{children}</div>
    </div>
  );
}

function DealCard({ deal, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { dealId: deal.id },
  });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onDoubleClick={() => onOpen(deal)}
      className={`rounded-xl border bg-[hsl(var(--background))] p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow transition ${
        isDragging ? "opacity-70" : ""
      }`}
    >
      <div className="font-medium truncate">{deal.title}</div>
      <div className="text-xs text-[hsl(var(--muted-foreground))] truncate">
        {deal.company} • Owner: {deal.owner || "—"}
      </div>
      <div className="text-sm tabular-nums mt-1">₹{(deal.amount || 0).toLocaleString("en-IN")}</div>
      <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
        Next: {deal.next_step || "—"}
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function DealsPipeline() {
  const [rows, setRows] = useState([]);
  const [drawer, setDrawer] = useState({ open: false, deal: null });

  // Get opener from DealsLayout (drawer lives there). Fallback: fire a window event.
  const outletCtx = (typeof useOutletContext === "function" ? useOutletContext() : {}) || {};
  const openNewDeal = outletCtx.openNewDeal || (() => window.dispatchEvent(new Event("deals:new")));

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor)
  );

  // Initial load
  useEffect(() => {
    (async () => setRows(await listDeals()))();
  }, []);

  // Refresh when a deal is created via the main drawer
  useEffect(() => {
    const onCreated = async () => setRows(await listDeals());
    window.addEventListener("deals:created", onCreated);
    return () => window.removeEventListener("deals:created", onCreated);
  }, []);

  const byStage = useMemo(() => {
    const m = Object.fromEntries(STAGES.map((s) => [s.id, []]));
    for (const d of rows) (m[d.stage] || (m[d.stage] = [])).push(d);
    return m;
  }, [rows]);

  const totals = useMemo(() => {
    const t = Object.fromEntries(STAGES.map((s) => [s.id, 0]));
    for (const d of rows) t[d.stage] = (t[d.stage] || 0) + (d.amount || 0);
    return t;
  }, [rows]);

  const onDragEnd = async (event) => {
    const id = event.active?.data?.current?.dealId;
    const overCol = event.over?.data?.current?.columnId;
    if (!id || !overCol) return;
    // optimistic stage move
    setRows((prev) => prev.map((d) => (d.id === id ? { ...d, stage: overCol } : d)));
    try {
      await moveDealToStage(id, overCol);
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <div>
      {/* Local header row (doesn't rely on shared Toolbar) */}
      <div className="mb-3">
        <div className="flex items-center gap-2 rounded-2xl border bg-card p-2 pl-3 pr-3 shadow-sm">
          <div className="text-base font-medium">Pipeline</div>
          <div className="flex-1" />
          <button type="button" className="btn btn-ghost gap-2">
            <Filter className="h-4" />
            Filters
          </button>
          <button
            type="button"
            onClick={openNewDeal}
            className="btn btn-primary gap-2 !opacity-100 !pointer-events-auto"
          >
            <Plus className="h-4" />
            New Deal
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div
          className="grid gap-3 md:gap-4"
          style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(260px, 1fr))` }}
        >
          {STAGES.map((s) => (
            <Column
              key={s.id}
              id={s.id}
              title={s.name}
              count={(byStage[s.id] || []).length}
              total={totals[s.id] || 0}
            >
              {(byStage[s.id] || []).map((d) => (
                <DealCard key={d.id} deal={d} onOpen={(deal) => setDrawer({ open: true, deal })} />
              ))}
            </Column>
          ))}
        </div>
      </DndContext>

      {/* Mobile FAB (backup: always visible) */}
      <button
        type="button"
        onClick={openNewDeal}
        className="btn btn-primary fixed bottom-6 right-6 md:hidden shadow-lg gap-2 z-50"
      >
        <Plus className="h-4" />
        New Deal
      </button>

      {/* Local drawer for editing existing deals (double-click a card) */}
      <DealDrawer
        open={drawer.open}
        deal={drawer.deal}
        onClose={() => setDrawer({ open: false, deal: null })}
        onSave={(saved) => {
          setDrawer({ open: false, deal: null });
          if (!saved?.id) return;
          setRows((prev) => prev.map((d) => (d.id === saved.id ? saved : d)));
        }}
      />
    </div>
  );
}
