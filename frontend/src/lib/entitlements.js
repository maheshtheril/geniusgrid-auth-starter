import { api } from './api';
export async function fetchEntitlements() {
  const { data } = await api.get('/billing/entitlements');
  const enabledModules = new Set(
    data.filter(e => e.scope === 'module' && e.value === 'enabled').map(e => e.code)
  );
  const limits = Object.fromEntries(
    data.filter(e => e.scope === 'limit').map(e => [e.code, e.value])
  );
  return { enabledModules, limits, raw: data };
}
