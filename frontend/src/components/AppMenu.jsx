import { useEffect, useState } from 'react';
import { fetchEntitlements } from '../lib/entitlements';

export default function AppMenu() {
  const [mods, setMods] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const ent = await fetchEntitlements();
        const enabled = Array.from(ent.enabledModules);
        setMods(enabled);
      } catch { setMods([]); }
    })();
  }, []);

  return (
    <nav style={{padding:12, borderBottom:'1px solid #eee', marginBottom:12}}>
      <strong>Modules:</strong>{' '}
      {mods.length ? mods.join(' · ') : '—'}
    </nav>
  );
}
