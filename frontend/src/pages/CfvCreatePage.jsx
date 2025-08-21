// src/pages/CfvCreatePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const DEFAULT_BASE = import.meta?.env?.VITE_API_BASE || "";
// For dev you can hardcode:
const DEV_TENANT = "26b7a805-2f6b-4899-b295-d03be045056f"; // <-- your tenant

export default function CfvCreatePage() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE || window.origin);
  const [tenant, setTenant] = useState(DEV_TENANT);
  const [loadingFields, setLoadingFields] = useState(false);
  const [fields, setFields] = useState([]);
  const [q, setQ] = useState("");

  const [recordType, setRecordType] = useState("lead");
  const [recordId, setRecordId] = useState("");

  const [selectedFieldId, setSelectedFieldId] = useState("");
  const selectedField = useMemo(
    () => fields.find(f => f.id === selectedFieldId) || null,
    [fields, selectedFieldId]
  );

  // Value inputs
  const [valueText, setValueText] = useState("");
  const [valueNumber, setValueNumber] = useState("");
  const [valueDate, setValueDate] = useState("");
  const [valueJson, setValueJson] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const api = useMemo(() => {
    return axios.create({
      baseURL: baseUrl.replace(/\/+$/, ""),
      headers: { "x-tenant-id": tenant },
      withCredentials: true,
    });
  }, [baseUrl, tenant]);

  const loadFields = async () => {
    setLoadingFields(true);
    setError("");
    try {
      const { data } = await api.get(`/api/cfv/fields`, { params: { q } });
      setFields(data || []);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Failed to load fields");
    } finally {
      setLoadingFields(false);
    }
  };

  useEffect(() => { loadFields(); /* eslint-disable-next-line */ }, []);

  const fieldType = (selectedField?.field_type || "").toLowerCase();

  const resetValues = () => {
    setValueText(""); setValueNumber(""); setValueDate(""); setValueJson("");
  };

  useEffect(() => { resetValues(); }, [selectedFieldId]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setResult(null);

    if (!tenant) { setError("Tenant is required"); setSubmitting(false); return; }
    if (!selectedFieldId) { setError("Choose a field"); setSubmitting(false); return; }
    if (!recordType) { setError("record_type is required"); setSubmitting(false); return; }
    if (!/^[0-9a-f-]{36}$/i.test(recordId)) { setError("record_id must be a UUID"); setSubmitting(false); return; }

    // Build payload based on field type
    const payload = {
      field_id: selectedFieldId,
      record_type: recordType,
      record_id: recordId,
    };

    try {
      switch (fieldType) {
        case "number":
        case "int":
        case "integer":
        case "float":
        case "decimal":
        case "currency":
          payload.value_number = valueNumber === "" ? null : Number(valueNumber);
          break;
        case "date":
        case "dob":
        case "birthday":
          payload.value_date = valueDate || null;
          break;
        case "json":
        case "object":
        case "array":
        case "multiselect":
        case "multi_select":
        case "checkboxes":
        case "tags":
          if (valueJson.trim() === "") {
            payload.value_json = null;
          } else {
            try {
              payload.value_json = JSON.parse(valueJson);
            } catch {
              // allow csv-like for multiselect
              if (/multi|check|tags/.test(fieldType) && !valueJson.trim().startsWith("[")) {
                payload.value_json = valueJson.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
              } else {
                // store raw text as json string
                payload.value_json = valueJson;
              }
            }
          }
          break;
        default:
          payload.value_text = valueText ?? null;
          break;
      }

      const { data } = await api.post(`/api/cfv`, payload);
      setResult(data);
      resetValues();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Insert failed");
    } finally {
      setSubmitting(false);
    }
  };

  const ValueInput = () => {
    switch (fieldType) {
      case "number":
      case "int":
      case "integer":
      case "float":
      case "decimal":
      case "currency":
        return (
          <input
            type="number" step="any"
            className="border rounded px-3 py-2 w-full"
            placeholder="value_number"
            value={valueNumber}
            onChange={(e) => setValueNumber(e.target.value)}
          />
        );
      case "date":
      case "dob":
      case "birthday":
        return (
          <input
            type="date"
            className="border rounded px-3 py-2 w-full"
            value={valueDate}
            onChange={(e) => setValueDate(e.target.value)}
          />
        );
      case "json":
      case "object":
      case "array":
      case "multiselect":
      case "multi_select":
      case "checkboxes":
      case "tags":
        return (
          <textarea
            className="border rounded px-3 py-2 w-full font-mono"
            rows={6}
            placeholder={
              /multi|check|tags/.test(fieldType)
                ? 'JSON array or CSV lines, e.g.\n["red","green"]\nOR\nred\ngreen'
                : 'JSON value, e.g. {"a":1} or ["x","y"]'
            }
            value={valueJson}
            onChange={(e) => setValueJson(e.target.value)}
          />
        );
      default:
        return (
          <textarea
            className="border rounded px-3 py-2 w-full"
            rows={3}
            placeholder="value_text"
            value={valueText}
            onChange={(e) => setValueText(e.target.value)}
          />
        );
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Insert Custom Field Value</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-sm">
          <div className="mb-1 text-gray-600">API Base URL</div>
          <input
            className="border rounded px-3 py-2 w-full"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://geniusgrid-auth-starter-ddv5.onrender.com"
          />
        </label>
        <label className="text-sm">
          <div className="mb-1 text-gray-600">Tenant ID (x-tenant-id)</div>
          <input
            className="border rounded px-3 py-2 w-full"
            value={tenant}
            onChange={(e) => setTenant(e.target.value)}
            placeholder="tenant uuid"
          />
        </label>
      </div>

      <div className="border rounded p-4 space-y-3">
        <div className="flex items-end gap-2">
          <div className="grow">
            <div className="text-sm text-gray-600 mb-1">Search Fields (by code)</div>
            <input
              className="border rounded px-3 py-2 w-full"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. budget, dob, interests"
            />
          </div>
          <button
            type="button"
            onClick={loadFields}
            className="px-4 py-2 bg-gray-900 text-white rounded"
            disabled={loadingFields}
          >
            {loadingFields ? "Loading..." : "Refresh"}
          </button>
        </div>

        <label className="text-sm block">
          <div className="mb-1 text-gray-600">Choose Field</div>
          <select
            className="border rounded px-3 py-2 w-full"
            value={selectedFieldId}
            onChange={(e) => setSelectedFieldId(e.target.value)}
          >
            <option value="">— select —</option>
            {fields.map(f => (
              <option key={f.id} value={f.id}>
                {f.code || f.id}  ({f.field_type})
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">
            <div className="mb-1 text-gray-600">record_type</div>
            <input
              className="border rounded px-3 py-2 w-full"
              value={recordType}
              onChange={(e) => setRecordType(e.target.value)}
              placeholder="lead"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-gray-600">record_id (UUID)</div>
            <input
              className="border rounded px-3 py-2 w-full"
              value={recordId}
              onChange={(e) => setRecordId(e.target.value)}
              placeholder="uuid of the record (e.g., lead id)"
            />
          </label>
        </div>

        <div className="text-sm text-gray-600">
          Value input for <b>{selectedField?.code || selectedFieldId || "—"}</b>{" "}
          ({fieldType || "text"}):
        </div>
        <ValueInput />

        <div className="flex gap-2">
          <button
            onClick={onSubmit}
            disabled={submitting || !selectedFieldId}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {submitting ? "Inserting..." : "Insert CFV"}
          </button>
          <button
            type="button"
            onClick={() => { resetValues(); setResult(null); setError(""); }}
            className="px-4 py-2 border rounded"
          >
            Reset
          </button>
        </div>

        {error && (
          <div className="text-red-600 text-sm">
            {error}
          </div>
        )}
        {result && (
          <pre className="bg-gray-50 border rounded p-3 text-sm overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>

      <div className="text-xs text-gray-500">
        Tips: Make sure <code>record_type</code> matches your domain (e.g. <code>lead</code>) and
        <code>record_id</code> is a valid UUID of an existing record. For multiselect-like fields,
        you can type JSON <code>["tag1","tag2"]</code> or plain text lines; the API stores as JSON.
      </div>
    </div>
  );
}
