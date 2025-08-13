import { mockProvider } from "./mockProvider.js";
import { pdlProvider } from "./pdlProvider.js";

const PROVIDER = (process.env.AI_PROVIDER || "mock").toLowerCase();

export function getProspectProvider() {
  if (PROVIDER === "pdl") return pdlProvider;
  return mockProvider;
}
