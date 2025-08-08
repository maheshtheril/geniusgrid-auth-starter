import React from 'react';

export default function TextInput({ label, type='text', value, onChange, placeholder, required=true }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <div style={{ fontSize: 14, marginBottom: 4 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{ width: '100%', padding: 10, border: '1px solid #ccc', borderRadius: 6 }}
      />
    </label>
  );
}
