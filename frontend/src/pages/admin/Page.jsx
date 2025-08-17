export default function Page({ title, toolbar, children }) {
  return (
    <div className="w-full max-w-none min-w-0 px-4 md:px-6">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {title && <h1 className="text-2xl font-semibold">{title}</h1>}
        <div className="flex-1" />
        {toolbar}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
