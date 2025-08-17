import React from "react";
const cx = (...a) => a.filter(Boolean).join(" ");

export const Label = React.forwardRef(function Label({ className="", ...p }, ref){
  return <label ref={ref} className={cx("text-sm font-medium", className)} {...p} />;
});
