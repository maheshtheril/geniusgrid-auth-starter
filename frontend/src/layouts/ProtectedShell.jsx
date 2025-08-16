import { Outlet } from "react-router-dom";
import AppSidebar from "@/components/AppSidebar";
import AppTopbar from "@/components/AppTopbar";
import { useEnv } from "@/store/useEnv";

export default function ProtectedShell() {
  const { ready } = useEnv();

  // If your app has a loader, you can keep it — but ensure we don’t block forever.
  if (!ready) {
    return (
      <div className="h-screen w-screen grid place-items-center text-gray-300">
        <div className="text-sm opacity-80">Loading workspace…</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col">
      <AppTopbar />

      {/* Body: sidebar + content. min-h-0 is critical so the inner scrollers can work */}
      <div className="flex-1 min-h-0 flex">
        <AppSidebar />
        <main className="flex-1 min-h-0 overflow-auto p-4">
          {/* If Dashboard route is miswired you will still see something here */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
