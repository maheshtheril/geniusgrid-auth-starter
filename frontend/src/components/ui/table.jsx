import * as React from "react";

/* tiny utility – safe merge */
function cx(...cls){ return cls.filter(Boolean).join(" "); }

export function Table({ className = "", ...props }) {
  return (
    <div className="relative w-full overflow-auto">
      <table
        className={cx(
          "w-full caption-bottom text-sm border-collapse",
          className
        )}
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className = "", ...props }) {
  return <thead className={cx("[&_tr]:border-b", className)} {...props} />;
}

export function TableBody({ className = "", ...props }) {
  return (
    <tbody
      className={cx("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

export function TableFooter({ className = "", ...props }) {
  return (
    <tfoot
      className={cx(
        "bg-muted/30 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  );
}

export function TableRow({ className = "", ...props }) {
  return (
    <tr
      className={cx(
        "border-b transition-colors hover:bg-muted/30 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  );
}

export function TableHead({ className = "", ...props }) {
  return (
    <th
      className={cx(
        "h-10 px-4 text-left align-middle font-medium text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

export function TableCell({ className = "", ...props }) {
  return (
    <td
      className={cx("p-4 align-middle whitespace-nowrap", className)}
      {...props}
    />
  );
}

export function TableCaption({ className = "", ...props }) {
  return (
    <caption
      className={cx("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
