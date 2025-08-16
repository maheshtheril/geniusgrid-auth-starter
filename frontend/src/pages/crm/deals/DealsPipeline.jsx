// ---------- FILE: src/pages/crm/deals/DealsPipeline.jsx ----------
import React, { useEffect, useMemo, useState } from "react";
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { Toolbar } from "./_shared/Toolbar";
import DealDrawer from "./DealDrawer";
import { STAGES, listDeals, moveDealToStage, createDeal } from "./mockApi";

function Column({ id, title, count, total, children }){
  const { setNodeRef, isOver } = useDroppable({ id, data: { columnId: id } });
  return (
    <div ref={setNodeRef} className={`flex-1 min-w-[260px] bg-muted/40 rounded-2xl p-3 border ${isOver ? 'ring-2 ring-primary/50' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{count} • ₹{(total/100000).toFixed(2)}L</div>
      </div>
      <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
        {children}
      </div>
    </div>
  );
}

function DealCard({ deal, onOpen }){
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id, data: { dealId: deal.id } });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={`rounded-xl border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-70' : ''}`}
      onDoubleClick={() => onOpen(deal)}>
      <div className="font-medium truncate">{deal.title}</div>
      <div className="text-xs text-muted-foreground truncate">{deal.company} • Owner: {deal.owner}</div>
      <div className="text-sm mt-1">₹{deal.amount.toLocaleString('en-IN')}</div>
      <div className="text-xs text-muted-foreground">Next: {deal.next_step || '-'}</div>
    </div>
  );
}

export default function DealsPipeline(){
  const [rows, setRows] = useState([]);
  const [drawer, setDrawer] = useState({ open: false, deal: null });

  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor));

  useEffect(() => { (async () => setRows(await listDeals()))(); }, []);

  const byStage = useMemo(() => {
    const m = Object.fromEntries(STAGES.map(s => [s.id, []]));
    for (const d of rows) (m[d.stage] || (m[d.stage]=[])).push(d);
    return m;
  }, [rows]);

  const totals = useMemo(() => {
    const t = Object.fromEntries(STAGES.map(s => [s.id, 0]));
    for (const d of rows) t[d.stage] = (t[d.stage]||0) + (d.amount||0);
    return t;
  }, [rows]);

  const onDragEnd = async (event) => {
    const id = event.active?.data?.current?.dealId;
    const overCol = event.over?.data?.current?.columnId;
    if (!id || !overCol) return;
    setRows(prev => prev.map(d => d.id === id ? { ...d, stage: overCol } : d)); // optimistic
    await moveDealToStage(id, overCol);
  };

  const addDeal = async () => {
    const d = await createDeal({ title: 'New Deal', company: 'Acme', amount: 100000, owner: 'You', next_step: 'Define' });
    setRows(prev => [d, ...prev]);
  };

  return (
    <div>
      <Toolbar title="Pipeline" onAdd={addDeal} onFilter={() => {}} />
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid gap-3 md:gap-4" style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(260px, 1fr))` }}>
          {STAGES.map(s => (
            <Column key={s.id} id={s.id} title={s.name} count={(byStage[s.id]||[]).length} total={totals[s.id] || 0}>
              {(byStage[s.id]||[]).map(d => (
                <DealCard key={d.id} deal={d} onOpen={(deal)=> setDrawer({ open: true, deal })} />
              ))}
            </Column>
          ))}
        </div>
      </DndContext>

      <DealDrawer open={drawer.open} deal={drawer.deal} onClose={() => setDrawer({ open:false, deal:null })} onSave={(saved)=> {
        setDrawer({ open:false, deal:null });
        if (!saved?.id) return;
        setRows(prev => prev.map(d => d.id === saved.id ? saved : d));
      }} />
    </div>
  );
}
