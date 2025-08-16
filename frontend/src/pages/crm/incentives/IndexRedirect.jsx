// ---------- FILE: src/pages/crm/incentives/IndexRedirect.jsx ----------
import React from "react";
import { Navigate } from "react-router-dom";
export default function IncentivesIndexRedirect(){
  return <Navigate to="/app/crm/incentives/plans" replace />;
}
