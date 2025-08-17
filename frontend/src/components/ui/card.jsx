import React from "react";
const cx = (...a) => a.filter(Boolean).join(" ");

export function Card({ className="", ...p }) {
  return <div className={cx("gg-surface rounded-2xl border border-border shadow-sm", className)} {...p} />;
}
export function CardHeader({ className="", ...p }) {
  return <div className={cx("p-5 border-b border-border", className)} {...p} />;
}
export function CardTitle({ className="", ...p }) {
  return <h3 className={cx("text-lg font-semibold", className)} {...p} />;
}
export function CardDescription({ className="", ...p }) {
  return <p className={cx("text-sm text-muted-foreground", className)} {...p} />;
}
export function CardContent({ className="", ...p }) {
  return <div className={cx("p-5", className)} {...p} />;
}
export function CardFooter({ className="", ...p }) {
  return <div className={cx("p-5 border-t border-border", className)} {...p} />;
}
