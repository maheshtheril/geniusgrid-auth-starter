// src/mocks/installTopbarMocks.js
export function installTopbarMocks() {
  const originalFetch = window.fetch.bind(window);

  const ok = (data) =>
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;

    // ---- Menus shown in "Modules" (adjust as you like)
    if (url.includes("/api/tenant/menus")) {
      return ok([
        { id: "sales", name: "Sales", path: "/sales" },
        { id: "crm", name: "CRM", path: "/crm" },
        { id: "reports", name: "Reports", path: "/reports" },
      ]);
    }

    // ---- Quick actions for the Create button
    if (url.includes("/api/tenant/quick-actions")) {
      return ok([
        { label: "New Lead", path: "/leads/new" },
        { label: "New Contact", path: "/contacts/new" },
        { label: "New Deal", path: "/deals/new" },
      ]);
    }

    // ---- Notifications summary
    if (url.includes("/api/notifications/summary")) {
      const now = new Date().toISOString();
      return ok({
        unread_count: 2,
        items: [
          { id: "n1", title: "Welcome to GeniusGrid", created_at: now, href: "/getting-started" },
          { id: "n2", title: "You have 3 tasks due today", created_at: now, href: "/tasks" },
        ],
      });
    }

    // ---- Notifications list (fallback path)
    if (url.includes("/api/notifications")) {
      const now = new Date().toISOString();
      return ok({
        unread_count: 2,
        items: [
          { id: "n1", title: "Welcome to GeniusGrid", created_at: now, href: "/getting-started" },
          { id: "n2", title: "You have 3 tasks due today", created_at: now, href: "/tasks" },
        ],
      });
    }

    // For everything else, fall back to real fetch
    return originalFetch(input, init);
  };
}
