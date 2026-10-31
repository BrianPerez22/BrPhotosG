import { useEffect, useState } from 'react';

export interface ThemePreset {
  id: string;
  name: string;
  hex: string;
  gradient: string;
  isLsd?: boolean;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'lsd', name: 'LSD Acid Trip', hex: '#ff007f', gradient: 'from-pink-500 via-purple-500 via-cyan-400 to-emerald-400', isLsd: true },
  { id: 'cyberpunk', name: 'Cyberpunk Glitch', hex: '#00f3ff', gradient: 'from-cyan-400 via-fuchsia-500 to-pink-500' },
  { id: 'acid-lime', name: 'Acid Lime', hex: '#84cc16', gradient: 'from-lime-400 to-emerald-500' },
  { id: 'synthwave', name: 'Sunset Synthwave', hex: '#f97316', gradient: 'from-orange-500 via-rose-500 to-purple-600' },
  { id: 'violet', name: 'Electric Violet', hex: '#a855f7', gradient: 'from-violet-500 to-indigo-600' },
  { id: 'emerald', name: 'Matrix Emerald', hex: '#10b981', gradient: 'from-emerald-400 to-teal-600' },
  { id: 'solar', name: 'Solar Flare', hex: '#f59e0b', gradient: 'from-amber-400 to-red-500' },
  { id: 'oceanic', name: 'Oceanic Blue', hex: '#06b6d4', gradient: 'from-cyan-500 to-blue-600' },
  { id: 'slate', name: 'Minimal Slate', hex: '#64748b', gradient: 'from-slate-400 to-slate-700' },
];

export interface ThemeConfig {
  accent: string;
  mode: 'dark' | 'light' | 'oled' | 'system';
  lsd: boolean;
  glitch: boolean;
  aura: boolean;
  sound: boolean;
}

const STORAGE_KEY = 'galeria_theme_config';

function hexToRgb(hex: string): [number, number, number] {
  let c = hex.replace('#', '').trim();
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return [99, 102, 241];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function clamp(n: number, min = 0, max = 255) {
  return Math.max(min, Math.min(max, n));
}

function adjustColor([r, g, b]: [number, number, number], factor: number): [number, number, number] {
  return [clamp(Math.round(r * factor)), clamp(Math.round(g * factor)), clamp(Math.round(b * factor))];
}

export function applyTheme(cfg: ThemeConfig) {
  const root = document.documentElement;
  const body = document.body;
  const [r, g, b] = hexToRgb(cfg.accent);

  root.style.setProperty('--color-accent', `${r} ${g} ${b}`);
  const [hr, hg, hb] = adjustColor([r, g, b], 0.85);
  root.style.setProperty('--color-accent-hover', `${hr} ${hg} ${hb}`);
  const [gr, gg, gb] = adjustColor([r, g, b], 1.25);
  root.style.setProperty('--color-accent-glow', `${gr} ${gg} ${gb}`);
  const [sr, sg, sb] = adjustColor([r, g, b], 1.6);
  root.style.setProperty('--color-accent-soft', `${sr} ${sg} ${sb}`);
  const [dr, dg, db] = adjustColor([r, g, b], 1.35);
  root.style.setProperty('--color-accent-dark', `${dr} ${dg} ${db}`);

  // Modo Oscuro / Claro / OLED
  const isDark = cfg.mode === 'oled' || cfg.mode === 'dark' || (cfg.mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) root.classList.add('dark');
  else root.classList.remove('dark');

  if (cfg.mode === 'oled') {
    body.classList.add('bg-black');
    body.classList.remove('bg-slate-50', 'bg-ink-950');
  } else {
    body.classList.remove('bg-black');
  }

  // Efecto LSD
  if (cfg.lsd) body.classList.add('lsd-mode-active');
  else body.classList.remove('lsd-mode-active');

  // Efecto Glitch
  if (cfg.glitch) body.classList.add('glitch-scanlines');
  else body.classList.remove('glitch-scanlines');
}

export function playAudioPop(type: 'click' | 'switch' | 'delete' = 'click') {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'click') {
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'switch') {
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  } catch {
    // ignorar error de audio (ej: políticas de autoplay del navegador)
  }
}

export function loadThemeConfig(): ThemeConfig {
  const defaults: ThemeConfig = {
    accent: '#6366f1',
    mode: 'dark',
    lsd: false,
    glitch: false,
    aura: true,
    sound: true,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function saveThemeConfig(cfg: ThemeConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // ignorar
  }
  applyTheme(cfg);
}

// Hook de React
export function useTheme() {
  const [config, setConfig] = useState<ThemeConfig>(loadThemeConfig);

  useEffect(() => {
    applyTheme(config);
  }, [config]);

  const update = (partial: Partial<ThemeConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      saveThemeConfig(next);
      if (next.sound) playAudioPop('switch');
      return next;
    });
  };

  return { config, update };
}
