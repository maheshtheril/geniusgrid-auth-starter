// ---------- FILE: src/pages/crm/deals/routes.jsx ----------
import React from "react";
import { Route } from "react-router-dom";
import DealsLayout from "./DealsLayout";
import DealsIndexRedirect from "./IndexRedirect";
import DealsPipeline from "./DealsPipeline";
import DealsList from "./DealsList";

export const dealsRoutes = (
  <Route path="/app/crm/deals" element={<DealsLayout />}> 
    <Route index element={<DealsIndexRedirect />} />
    <Route path="pipeline" element={<DealsPipeline />} />
    <Route path="list" element={<DealsList />} />
  </Route>
);
