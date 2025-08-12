import React, { useState } from "react";
import { http } from "@/lib/http";

export default function AddCustomFieldModal({ open, onClose, onSuccess }) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState("text");
  const [required, setRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    try {
      setSaving(true);
      await http.post("/leads/custom-fields", { label, type, required });
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error adding custom field", err);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg">Add Custom Field</h3>
        <div className="mt-4 space-y-3">
          <input
            type="text"
            placeholder="Field Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="input input-bordered w-full"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="select select-bordered w-full"
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="select">Select</option>
            <option value="file">File</option>
          </select>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="checkbox"
            />
            Required
          </label>
        </div>
        <div className="modal-action">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className={`btn btn-primary ${saving ? "loading" : ""}`}
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
