// src/pages/_dev/DaisyUiProbe.jsx
export default function DaisyUiProbe() {
  return (
    <div className="min-h-screen p-6 space-y-6" data-theme="geniusgrid">
      <h1 className="text-xl font-semibold">DaisyUI Probe</h1>

      <div className="space-x-2">
        <button className="btn">btn</button>
        <button className="btn btn-primary">btn-primary</button>
        <button className="btn btn-outline">btn-outline</button>
        <button className="btn btn-ghost">btn-ghost</button>
      </div>

      <div className="space-x-3">
        <label className="label cursor-pointer gap-2">
          <span className="label-text">Checkbox</span>
          <input type="checkbox" className="checkbox" defaultChecked />
        </label>
        <label className="label cursor-pointer gap-2">
          <span className="label-text">Toggle</span>
          <input type="checkbox" className="toggle" defaultChecked />
        </label>
      </div>

      <div className="space-y-2 max-w-sm">
        <input className="input input-bordered w-full" placeholder="input input-bordered" />
        <select className="select select-bordered w-full">
          <option>select select-bordered</option>
          <option>Option A</option>
        </select>
      </div>

      <pre className="text-xs opacity-70">
        data-theme: {document.documentElement.getAttribute("data-theme")}
      </pre>
    </div>
  );
}
