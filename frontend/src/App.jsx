export default function App() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0B0D10",
      color: "#e5e7eb",
      display: "grid",
      placeItems: "center",
      gap: 8,
      fontFamily: "system-ui, sans-serif"
    }}>
      <div style={{fontSize: 28, fontWeight: 700}}>✅ React App mounted</div>
      <div style={{opacity:.75}}>If you see this, routing/components are your next step.</div>
    </div>
  );
}
