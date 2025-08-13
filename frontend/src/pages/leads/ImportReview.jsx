// src/pages/leads/ImportReview.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api.js";

export default function ImportReview() {
  const { id } = useParams(); // import job id
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await api.get(`/leads/imports/${id}/items`);
      const rows = r?.data?.data || r?.data || [];
      setItems(rows);
      setSel(new Set(rows.map(r => r.id))); // preselect all
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load items");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const toggle = (rid) => {
    setSel(prev => {
      const n = new Set(prev);
      n.has(rid) ? n.delete(rid) : n.add(rid);
      return n;
    });
  };
  const allSelected = useMemo(() => items.length && sel.size === items.length, [items, sel]);

  const setAll = (on) => setSel(new Set(on ? items.map(i => i.id) : []));

  async function commit() {
    setCommitting(true);
    setError("");
    try {
      const itemIds = Array.from(sel);
      await api.post(`/leads/imports/${id}/commit`, { itemIds });
      navigate("/app/leads"); // go to the main Leads list
    } catch (e) {
      setError(e?.response?.data?.message || "Commit failed");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="gg-panel p-3 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Review AI-discovered leads</div>
            <div className="gg-muted text-sm">Import job: <code>{id}</code></div>
          </div>
          <div className="flex items-center gap-2">
            <button className="gg-btn" onClick={() => setAll(true)} disabled={!items.length}>Select all</button>
            <button className="gg-btn" onClick={() => setAll(false)} disabled={!items.length}>Clear</button>
            <button className="gg-btn gg-btn-primary" onClick={commit} disabled={!sel.size || committing}>
              {committing ? "Importing…" : `Import ${sel.size || 0}`}
            </button>
          </div>
        </div>

        {error && <div className="rounded-lg mt-2" style={{background:"rgba(244,63,94,.12)",color:"#fecdd3",padding:"8px 12px"}}>{error}</div>}

        <div className="mt-3 gg-table">
          <div className="gg-thead">
            <div className="gg-tr">
              <div className="gg-th" style={{width:36}}>
                <input type="checkbox" className="gg-checkbox" checked={!!allSelected} onChange={e => setAll(e.target.checked)} />
              </div>
              <div className="gg-th">Name</div>
              <div className="gg-th">Title</div>
              <div className="gg-th">Company</div>
              <div className="gg-th">Email</div>
              <div className="gg-th">Phone</div>
              <div className="gg-th">Location</div>
              <div className="gg-th">Source</div>
            </div>
          </div>
          <div>
            {loading ? (
              <div className="gg-tr"><div className="gg-td">Loading…</div></div>
            ) : items.length ? (
              items.map((r) => (
                <div className="gg-tr" key={r.id}>
                  <div className="gg-td" style={{width:36}}>
                    <input type="checkbox" className="gg-checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} />
                  </div>
                  <div className="gg-td">{r.name || r.full_name || "-"}</div>
                  <div className="gg-td">{r.title || "-"}</div>
                  <div className="gg-td">{r.company || r.org || "-"}</div>
                  <div className="gg-td">{r.email || "-"}</div>
                  <div className="gg-td">{r.phone || "-"}</div>
                  <div className="gg-td">{r.location || r.city || "-"}</div>
                  <div className="gg-td">{r.source || r.provider || "-"}</div>
                </div>
              ))
            ) : (
              <div className="gg-tr"><div className="gg-td">No items</div></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
