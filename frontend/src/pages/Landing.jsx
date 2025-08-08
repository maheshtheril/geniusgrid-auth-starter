import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { getSelectedModules, setSelectedModules, clearSelectedModules } from '../lib/selection';

export default function Landing() {
  const [modules, setModules] = useState([]);
  const [sel, setSel] = useState(new Set(getSelectedModules()));
  const nav = useNavigate();

  useEffect(() => {
    api.get('/public/modules').then(r => setModules(r.data)).catch(() => {
      // fallback static list if API unreachable
      setModules([
        { code:'crm', name:'CRM', description:'Leads & pipeline' },
        { code:'sales', name:'Sales', description:'Quotes & orders' },
        { code:'inventory', name:'Inventory', description:'Stock & warehouses' },
        { code:'accounting', name:'Accounting', description:'Invoicing & ledger' },
        { code:'purchase', name:'Purchase', description:'Vendors & POs' },
        { code:'manufacturing', name:'Manufacturing', description:'BoM & work orders' },
      ]);
    });
  }, []);

  useEffect(() => { setSelectedModules([...sel]); }, [sel]);

  const toggle = (code) => {
    const next = new Set(sel);
    next.has(code) ? next.delete(code) : next.add(code);
    setSel(next);
  };

  const proceed = () => nav('/signup'); // selection persisted via localStorage

  return (
    <div style={{maxWidth: 960, margin: '40px auto', padding: 16}}>
      <h1 style={{marginBottom: 8}}>Choose your GeniusGrid modules</h1>
      <p style={{color:'#555', marginTop: 0}}>Pick what you need. You can add/remove later.</p>

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px,1fr))', gap: 16}}>
        {modules.map(m => (
          <button key={m.code} onClick={() => toggle(m.code)}
            style={{
              textAlign:'left', border:'1px solid #e5e7eb', borderRadius:12, padding:16, cursor:'pointer',
              background: sel.has(m.code) ? '#eef6ff' : 'white', boxShadow: sel.has(m.code) ? '0 0 0 2px #93c5fd' : 'none'
            }}>
            <div style={{fontWeight:600, marginBottom: 4}}>{m.name}</div>
            <div style={{fontSize:13, color:'#6b7280'}}>{m.description}</div>
          </button>
        ))}
      </div>

      <div style={{marginTop: 20, display:'flex', gap:12}}>
        <button onClick={proceed}
          disabled={sel.size===0}
          style={{padding:'10px 16px', borderRadius:10, border:'none', background:'#2563eb', color:'white',
                  cursor: sel.size ? 'pointer' : 'not-allowed'}}>
          Continue{sel.size ? ` (${sel.size})` : ''}
        </button>
        <button onClick={() => { setSel(new Set()); clearSelectedModules(); }}
          style={{padding:'10px 16px', borderRadius:10, border:'1px solid #e5e7eb', background:'white'}}>
          Clear
        </button>
      </div>
    </div>
  );
}
