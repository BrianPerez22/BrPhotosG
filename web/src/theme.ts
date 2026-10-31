import { useSyncExternalStore } from 'react';

export interface Theme {
  id: string;
  name: string;
  dark: boolean;
  // Colores planos como "R G B"
  bg: string;
  surface: string;
  surface2: string;
  line: string;
  fg: string;
  muted: string;
  accent: string;
}

export const THEMES: Theme[] = [
  { id: 'noche', name: 'Noche', dark: true, bg: '17 17 19', surface: '27 27 30', surface2: '40 40 44', line: '52 52 57', fg: '243 244 246', muted: '156 163 175', accent: '92 124 250' },
  { id: 'claro', name: 'Claro', dark: false, bg: '255 255 255', surface: '244 245 247', surface2: '230 232 236', line: '222 225 230', fg: '17 24 39', muted: '107 114 128', accent: '59 91 219' },
  { id: 'esmeralda', name: 'Esmeralda', dark: true, bg: '10 20 17', surface: '17 30 26', surface2: '26 44 38', line: '38 62 54', fg: '236 253 245', muted: '134 170 155', accent: '5 150 105' },
  { id: 'violeta', name: 'Violeta', dark: true, bg: '18 14 26', surface: '28 22 40', surface2: '40 32 58', line: '56 46 80', fg: '245 243 255', muted: '160 150 190', accent: '147 51 234' },
  { id: 'atardecer', name: 'Atardecer', dark: false, bg: '255 251 245', surface: '250 243 232', surface2: '240 229 211', line: '230 217 195', fg: '41 30 20', muted: '128 108 88', accent: '234 88 12' },
  { id: 'oceano', name: 'Océano', dark: false, bg: '247 251 253', surface: '236 245 250', surface2: '222 237 245', line: '205 226 238', fg: '12 35 50', muted: '84 115 135', accent: '2 132 199' },
  { id: 'rosa', name: 'Rosa', dark: false, bg: '255 250 252', surface: '252 240 245', surface2: '245 224 233', line: '236 205 218', fg: '45 20 32', muted: '135 100 115', accent: '219 39 119' },
  { id: 'ambar', name: 'Ámbar', dark: true, bg: '20 16 8', surface: '32 26 14', surface2: '46 38 22', line: '66 54 32', fg: '254 249 235', muted: '176 160 120', accent: '217 119 6' },
  { id: 'oled', name: 'OLED', dark: true, bg: '0 0 0', surface: '14 14 14', surface2: '28 28 28', line: '44 44 44', fg: '245 245 245', muted: '150 150 150', accent: '14 165 233' },
];

const KEY = 'galeria_theme';
const listeners = new Set<() => void>();

function initial(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    const legacy = v === 'dark' ? 'noche' : v === 'light' ? 'claro' : v;
    const t = THEMES.find((x) => x.id === legacy);
    if (t) return t;
  } catch {
    /* ignorar */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? THEMES[0] : THEMES[1];
}

let current: Theme = initial();

function hex(rgb: string) {
  return '#' + rgb.split(' ').map((n) => Number(n).toString(16).padStart(2, '0')).join('');
}

function apply(t: Theme) {
  const s = document.documentElement.style;
  s.setProperty('--bg', t.bg);
  s.setProperty('--surface', t.surface);
  s.setProperty('--surface2', t.surface2);
  s.setProperty('--line', t.line);
  s.setProperty('--fg', t.fg);
  s.setProperty('--muted', t.muted);
  s.setProperty('--accent', t.accent);
  document.documentElement.classList.toggle('dark', t.dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', hex(t.bg));
}
apply(current);

/** Un clic en la bolita: pasa al siguiente tema de color. */
export function nextTheme() {
  current = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
  try {
    localStorage.setItem(KEY, current.id);
  } catch {
    /* ignorar */
  }
  apply(current);
  listeners.forEach((l) => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current
  );
}
