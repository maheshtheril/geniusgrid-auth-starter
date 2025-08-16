// src/pages/crm/deals/IndexRedirect.jsx
import React from "react";
import { Navigate } from "react-router-dom";

export default function DealsIndexRedirect() {
  return <Navigate to="pipeline" replace />;
}
