import React from "react";
import Page from "./Page";

export default function Users() {
  return (
    <Page title="Users">
      <div className="rounded-lg border p-4">
        <div className="text-sm opacity-80">
          Replace this block with real content for <strong>Users</strong>.
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[720px] text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-4">Column A</th>
                <th className="py-2 pr-4">Column B</th>
                <th className="py-2 pr-4">Column C</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 pr-4">…</td>
                <td className="py-2 pr-4">…</td>
                <td className="py-2 pr-4 text-right">…</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Page>
  );
}
