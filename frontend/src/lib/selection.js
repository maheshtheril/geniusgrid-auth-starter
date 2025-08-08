const KEY = 'gg_selected_modules';

export function getSelectedModules() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
export function setSelectedModules(arr) {
  localStorage.setItem(KEY, JSON.stringify(Array.from(new Set(arr))));
}
export function clearSelectedModules() {
  localStorage.removeItem(KEY);
}