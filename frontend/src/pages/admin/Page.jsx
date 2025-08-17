export default function Page({ title, toolbar, children }) {
  return (
    <div className="w-full max-w-none min-w-0 space-y-4 p-4 md:p-6">
      {(title || toolbar) && (
        <div className="flex flex-wrap items-center gap-2">
          {title && <h1 className="text-2xl font-semibold capitalize">{title}</h1>}
          <div className="flex-1" />
          {toolbar}
        </div>
      )}
      {children}
    </div>
  );
}
