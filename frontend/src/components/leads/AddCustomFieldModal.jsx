// 📁 src/components/leads/AddCustomFieldModal.jsx
import React, { useState } from "react";
import { http } from "@/lib/http";

function slugify(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export default function AddCustomFieldModal({ open, onClose, onSuccess }) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState("text");
  const [required, setRequired] = useState(false);

  // ⬇️ dropdown removed; always use "Advance"
  const SECTION = "Advance";

  const [optionsText, setOptionsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  async function handleSave() {
    setErrMsg("");
    if (!label.trim()) {
      setErrMsg("Please enter a label.");
      return;
    }
    try {
      setSaving(true);

      const key = slugify(label);
      const options =
        type === "select"
          ? optionsText
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

      const res = await http.post("/api/leads/custom-fields", {
        label,
        key,          // stable key/code
        type,         // "text" | "number" | "date" | "select" | "file"
        required,
        section: SECTION, // ⬅️ always "Advance"
        options,
      });

      onSuccess?.(res?.data);
      onClose?.();
    } catch (err) {
      console.error("Error adding custom field", err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to save custom field.";
      setErrMsg(msg);
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

          {type === "select" && (
            <input
              type="text"
              placeholder="Options (comma separated)"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              className="input input-bordered w-full"
            />
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="checkbox"
              id="cf-required"
            />
            <label htmlFor="cf-required">Required</label>
          </div>

          {/* ⬇️ Removed the General/Advance dropdown */}
          {/* (section is always "Advance" now) */}

          {errMsg && <div className="text-sm text-rose-500">{errMsg}</div>}
        </div>

        <div className="modal-action">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className={`btn btn-primary ${saving ? "loading" : ""}`}
            onClick={handleSave}
            disabled={saving}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
