// ---------- FILE: src/pages/crm/deals/DealsHelp.jsx ----------
import React from "react";
import { useNavigate } from "react-router-dom";
import { HelpCircle, ArrowLeft } from "lucide-react";

export default function DealsHelp() {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm flex items-center gap-3">
        <div className="h-10 w-10 rounded-2xl bg-primary/10 grid place-items-center">
          <HelpCircle className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">Deals & Pipeline — Help</h2>
          <p className="text-sm text-muted-foreground">
            How to use Pipeline/List, create deals, shortcuts, and more.
          </p>
        </div>
        <button
          onClick={() => navigate("/app/crm/deals/pipeline")}
          className="btn btn-secondary gap-2"
        >
          <ArrowLeft className="h-4" /> Back to Deals
        </button>
      </div>

      {/* Content */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="grid md:grid-cols-3 gap-4">
          {/* Quick links */}
          <nav className="md:col-span-1">
            <div className="text-xs uppercase text-muted-foreground mb-2">Quick links</div>
            <ul className="space-y-1 text-sm">
              <li><a href="#overview" className="hover:underline">Overview</a></li>
              <li><a href="#pipeline" className="hover:underline">Pipeline (Kanban)</a></li>
              <li><a href="#list" className="hover:underline">List (Table)</a></li>
              <li><a href="#kpis" className="hover:underline">KPIs & Actions</a></li>
              <li><a href="#create" className="hover:underline">Create a new deal</a></li>
              <li><a href="#drawer" className="hover:underline">Deal Drawer</a></li>
              <li><a href="#shortcuts" className="hover:underline">Keyboard shortcuts</a></li>
              <li><a href="#troubleshoot" className="hover:underline">Troubleshooting</a></li>
            </ul>
          </nav>

          {/* Body */}
          <div className="md:col-span-2 space-y-6">
            <section id="overview">
              <h3 className="text-lg font-semibold">1) Overview</h3>
              <p className="text-sm text-muted-foreground">
                Track opportunities from first contact to won/lost. Use
                <strong> Pipeline</strong> for stage-based flow and <strong>List</strong> for fast filtering & edits.
              </p>
            </section>

            <section id="pipeline">
              <h3 className="text-lg font-semibold">2) Pipeline (Kanban)</h3>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>Drag & drop a card between stages to update stage.</li>
                <li>Columns show count and total value.</li>
                <li>Double-click a card to open the Deal Drawer.</li>
                <li>Use <em>New Deal</em> in the header to add quickly.</li>
              </ul>
            </section>

            <section id="list">
              <h3 className="text-lg font-semibold">3) List (Table)</h3>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>Search title/company; filter by Stage & Owner.</li>
                <li>Sort by clicking column headers.</li>
                <li>Edit core fields inline or open the drawer for full edits.</li>
              </ul>
            </section>

            <section id="kpis">
              <h3 className="text-lg font-semibold">4) KPIs & Actions</h3>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li><strong>Total Pipeline</strong>, <strong>Weighted Value</strong>, <strong>Win Rate</strong>, <strong>Active Deals</strong>.</li>
                <li>Actions: <em>New Deal</em>, <em>Import</em>, <em>Export</em>, <em>Help</em>.</li>
                <li>Global search syncs to the URL (<code>?q=</code>) so both views filter together.</li>
              </ul>
            </section>

            <section id="create">
              <h3 className="text-lg font-semibold">5) Creating a new deal</h3>
              <p className="text-sm">Two patterns:</p>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li><strong>Route-based</strong>: navigate to <code>/app/crm/deals/new</code> and mount the Drawer in create mode.</li>
                <li><strong>Drawer-in-place</strong>: open the Drawer directly from DealsLayout without routing.</li>
              </ul>
            </section>

            <section id="drawer">
              <h3 className="text-lg font-semibold">6) Deal Drawer</h3>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>Fields: Title, Company, Amount, Owner, Stage, Probability, Tags, Next Step, Notes.</li>
                <li>Shortcuts: <kbd>Esc</kbd> closes, <kbd>Ctrl/Cmd</kbd>+<kbd>S</kbd> saves.</li>
              </ul>
            </section>

            <section id="shortcuts">
              <h3 className="text-lg font-semibold">7) Keyboard shortcuts</h3>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li><kbd>/</kbd> focus search</li>
                <li><kbd>N</kbd> new deal</li>
                <li><kbd>Esc</kbd> close drawer</li>
                <li><kbd>Ctrl/Cmd</kbd>+<kbd>S</kbd> save</li>
              </ul>
            </section>

            <section id="troubleshoot">
              <h3 className="text-lg font-semibold">8) Troubleshooting</h3>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>
                  New button does nothing → ensure{" "}
                  <code>{`<Outlet context={{ openNewDeal: () => setShowNew(true) }} />`}</code>{" "}
                  is set in <code>DealsLayout</code> and the Pipeline button calls it.
                </li>
                <li>KPIs are empty → check <code>GET /api/deals/summary</code>.</li>
              </ul>
            </section>

            <div className="text-xs text-muted-foreground">
              Last updated: {new Date().toISOString().slice(0,10)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
