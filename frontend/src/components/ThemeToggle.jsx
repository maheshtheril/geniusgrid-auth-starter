import { useEffect, useState } from 'react';

const STORAGE_KEY = 'gg_theme'; // 'light' | 'dark' | 'system'

export default function ThemeToggle({ className = '' }) {
  const [mode, setMode] = useState(() => localStorage.getItem(STORAGE_KEY) || 'system');

  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    const nextDark = mode === 'dark' || (mode === 'system' && prefersDark);
    root.classList.toggle('dark', nextDark);
    localStorage.setItem(STORAGE_KEY, mode);

    if (mode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e) => root.classList.toggle('dark', e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [mode]);

  return (
    <div className={`inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1 ${className}`}>
      {['light','system','dark'].map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`px-3 py-1 rounded-lg text-sm ${mode===m ? 'bg-[color:var(--brand)] text-white' : 'text-muted hover:bg-card'}`}
          aria-pressed={mode===m}
          title={`Theme: ${m}`}
        >
          {m === 'light' ? '☀️' : m === 'dark' ? '🌙' : '🖥️'}
        </button>
      ))}
    </div>
  );
}
