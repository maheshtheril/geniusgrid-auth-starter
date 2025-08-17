import React, { useEffect, useMemo, useState } from "react";
import { Toolbar } from "../_shared/Toolbar";
import ContactDrawer from "./ContactDrawer";
import { listContacts, createContact, updateContact } from "./mockApi";

export default function ContactsList() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    (async () => setRows(await listContacts()))();
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (!q) return true;
        const s = q.toLowerCase();
        return (
          r.name.toLowerCase().includes(s) ||
          r.company.toLowerCase().includes(s) ||
          r.email.toLowerCase().includes(s)
        );
      }),
    [rows, q]
  );

  const save = async (data) => {
    if (editing) {
      const saved = await updateContact(editing.id, data);
      setRows((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
    } else {
      const created = await createContact(data);
      setRows((prev) => [created, ...prev]);
    }
    setOpen(false);
    setEditing(null);
  };

  return (
    <div>
      <Toolbar
        title="Contacts"
        addLabel="New Contact"
        onAdd={() => {
          setEditing(null);
          setOpen(true);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name/company/email…"
          aria-label="Search contacts"
          className="h-9 px-3 rounded-lg border bg-background"
        />
      </Toolbar>

      <div className="overflow-auto rounded-xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              {[
                "Name",
                "Company",
                "Email",
                "Phone",
                "Title",
                "Status",
                "Actions",
              ].map((h) => (
                <th key={h} className="px-3 py-2 font-medium text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  No contacts
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2 whitespace-nowrap">{r.name}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.company}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.email}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.phone}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.title || "-"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{r.status}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <button
                    type="button"
                    className="h-8 px-2 rounded-lg border text-xs"
                    onClick={() => {
                      setEditing(r);
                      setOpen(true);
                    }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ContactDrawer
        open={open}
        contact={editing}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
        onSave={save}
      />
    </div>
  );
}
