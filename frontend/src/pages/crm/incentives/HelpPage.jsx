// ---------- FILE: src/pages/crm/incentives/HelpPage.jsx ----------
import React from "react";
import { ExternalLink } from "lucide-react";
import { Panel } from "@/pages/crm/_shared/Surface";

export function IncentivesHelpPage() {
  return (
    <div className="p-3 md:p-4">
      <div className="flex items-center gap-2 justify-between mb-3">
        <div className="text-sm text-muted-foreground">
          Need a tour? Open the admin guide below or launch the teleprompter for recording.
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/help/incentives-teleprompter.html"
            target="_blank"
            rel="noreferrer"
            className="gg-btn"
            title="Open teleprompter in a new tab"
          >
            Teleprompter <ExternalLink className="h-4 w-4 ml-1" />
          </a>
          <a
            href="/help/incentives-video-script.md"
            className="gg-btn"
            download
            title="Download presenter script (Markdown)"
          >
            Script.md
          </a>
          <a
            href="/help/incentives-admin-guide.html"
            target="_blank"
            rel="noreferrer"
            className="gg-btn gg-btn--primary"
            title="Open the guide in a new tab"
          >
            Open Full Guide <ExternalLink className="h-4 w-4 ml-1" />
          </a>
        </div>
      </div>

      <Panel className="p-0">
        {/* Embedded guide */}
        <iframe
          title="GeniusGrid Incentives — Admin Guide"
          src="/help/incentives-admin-guide.html"
          className="w-full"
          style={{ height: "calc(100vh - 260px)", border: 0, borderRadius: "0.75rem" }}
        />
      </Panel>
    </div>
  );
}
