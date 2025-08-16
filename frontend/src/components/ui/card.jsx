import React from "react";
export function Card({ className="", ...p }){ return <div className={`rounded-2xl border bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] shadow-sm ${className}`} {...p} />; }
export function CardHeader({ className="", ...p }){ return <div className={`py-3 px-4 border-b ${className}`} {...p} />; }
export function CardContent({ className="", ...p }){ return <div className={`p-4 ${className}`} {...p} />; }
export function CardFooter({ className="", ...p }){ return <div className={`p-4 border-t ${className}`} {...p} />; }
export function CardTitle({ className="", ...p }){ return <div className={`text-lg font-semibold ${className}`} {...p} />; }
export default Card;
