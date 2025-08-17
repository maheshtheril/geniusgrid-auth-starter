import Page from "./Page";
export default function Page({ title, toolbar, children }) {
  return (
    <div
      data-page="admin"
      className="w-full  min-w-0 px-4 md:px-6 py-4"
      style={{ maxWidth: 'none' }}
    >
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="text-2xl font-semibold capitalize flex-1">{title}</h1>
        {toolbar}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
