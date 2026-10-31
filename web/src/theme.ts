import { useSyncExternalStore } from 'react';

export type Mode = 'dark' | 'light';
const KEY = 'galeria_theme';
const listeners = new Set<() => void>();

function initial(): Mode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch {
    /* ignorar */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let mode: Mode = initial();

function apply(m: Mode) {
  document.documentElement.classList.toggle('dark', m === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', m === 'dark' ? '#111113' : '#ffffff');
}
apply(mode);

export function toggleTheme() {
  mode = mode === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* ignorar */
  }
  apply(mode);
  listeners.forEach((l) => l());
}

export function useMode(): Mode {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => mode
  );
}
