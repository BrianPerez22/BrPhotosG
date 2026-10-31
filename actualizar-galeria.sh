#!/usr/bin/env bash
# ============================================================================
#  Actualización de la galería
#   - La bolita ya no es un selector: un clic alterna modo claro / oscuro
#   - Colores 100% planos (sin degradados, sombras, blur ni animaciones)
#   - Sin sonidos ni efectos LSD/glitch/aura
#   - Cuadrícula por columnas (funciona en celular), con botones −/+ y pellizco
#   - Carga progresiva, miniaturas más ligeras y visor más rápido
#
#  Uso:   bash actualizar-galeria.sh [ruta-del-proyecto] [--sin-build] [--sin-reinicio]
#  Si no pasas ruta, usa la carpeta actual.
#  Hace copia de seguridad, compila y, si algo falla, restaura todo solo.
# ============================================================================
set -uo pipefail

SIN_BUILD=0; SIN_REINICIO=0; PROY=""
for a in "$@"; do
  case "$a" in
    --sin-build) SIN_BUILD=1 ;;
    --sin-reinicio) SIN_REINICIO=1 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) PROY="$a" ;;
  esac
done

es_proyecto() { [ -f "$1/web/src/App.tsx" ] && [ -f "$1/server/src/thumbs.ts" ]; }
if [ -z "$PROY" ]; then
  if es_proyecto "$PWD"; then PROY="$PWD"
  elif es_proyecto "$(cd "$(dirname "$0")" && pwd)"; then PROY="$(cd "$(dirname "$0")" && pwd)"
  fi
fi
if [ -z "$PROY" ] || ! es_proyecto "$(cd "$PROY" 2>/dev/null && pwd)"; then
  echo "✗ No encuentro el proyecto. Ejecuta el script dentro de la carpeta del proyecto o pásale la ruta:"
  echo "    bash actualizar-galeria.sh /ruta/al/proyecto"
  exit 1
fi
PROY="$(cd "$PROY" && pwd)"
command -v node >/dev/null || { echo "✗ Hace falta Node.js (>=20)."; exit 1; }

TS="$(date +%Y%m%d-%H%M%S)"
BK="$PROY/.backup-actualizacion-$TS"
NUEVOS=()
mkdir -p "$BK"
echo "▶ Proyecto: $PROY"
echo "▶ Copia de seguridad en: $BK"

backup() { # backup <ruta-relativa>  (solo la primera vez: conserva el original)
  [ -e "$PROY/$1" ] || return 0
  [ -e "$BK/$1" ] && return 0
  mkdir -p "$BK/$(dirname "$1")"
  cp -p "$PROY/$1" "$BK/$1"
}

put() { # put <ruta-relativa>   (contenido por stdin)
  local rel="$1" dest="$PROY/$1"
  mkdir -p "$(dirname "$dest")"
  if [ -e "$dest" ]; then backup "$rel"; else NUEVOS+=("$rel"); fi
  cat > "$dest"
  echo "  ✓ $rel"
}

parchar() { # parchar <ruta-relativa> <texto-a-buscar> <texto-nuevo>
  local rel="$1" dest="$PROY/$1"
  [ -f "$dest" ] || { echo "  ! No existe $rel"; return 0; }
  backup "$rel"
  node -e '
    const fs = require("fs");
    const [f, a, b] = process.argv.slice(1);
    const s = fs.readFileSync(f, "utf8");
    if (s.includes(b)) process.exit(0);
    if (!s.includes(a)) process.exit(2);
    fs.writeFileSync(f, s.replace(a, b));
  ' "$dest" "$2" "$3"
  case $? in
    0) echo "  ✓ $rel (parche)" ;;
    *) echo "  ! No pude parchear $rel (¿ya lo habías cambiado a mano?). Sigo." ;;
  esac
}

quitar() { # quitar <ruta-relativa>
  [ -e "$PROY/$1" ] || return 0
  backup "$1"
  rm -f "$PROY/$1"
  echo "  ✓ eliminado $1"
}

restaurar() {
  echo "↩ Restaurando la copia de seguridad…"
  (cd "$BK" && find . -type f) | while read -r f; do
    mkdir -p "$PROY/$(dirname "$f")"
    cp -p "$BK/$f" "$PROY/$f"
  done
  for n in "${NUEVOS[@]:-}"; do [ -n "$n" ] && rm -f "$PROY/$n"; done
  echo "  Proyecto restaurado a su estado anterior."
}

echo "▶ Escribiendo archivos del frontend…"
put web/tailwind.config.js <<'__BRPHOTOS_EOF__'
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        surface2: 'rgb(var(--surface2) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
__BRPHOTOS_EOF__

put web/src/index.css <<'__BRPHOTOS_EOF__'
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Paleta plana: sin degradados, sin sombras, sin transparencias */
:root {
  --bg: 255 255 255;
  --surface: 244 245 247;
  --surface2: 230 232 236;
  --line: 222 225 230;
  --fg: 17 24 39;
  --muted: 107 114 128;
  --accent: 59 91 219;
  color-scheme: light;
}
:root.dark {
  --bg: 17 17 19;
  --surface: 27 27 30;
  --surface2: 40 40 44;
  --line: 52 52 57;
  --fg: 243 244 246;
  --muted: 156 163 175;
  --accent: 92 124 250;
  color-scheme: dark;
}

html, body, #root { height: 100%; }
body { @apply bg-bg text-fg antialiased; }

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgb(var(--muted) / 0.4); border-radius: 9999px; }

:focus-visible { outline: 2px solid rgb(var(--accent)); outline-offset: 2px; }

/* Evita el zoom del navegador en la cuadrícula para poder usar pellizco */
.pinch-grid { touch-action: pan-y; }

@layer components {
  .btn {
    @apply inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium select-none disabled:opacity-40 disabled:pointer-events-none;
  }
  .btn-ghost { @apply btn text-muted hover:text-fg hover:bg-surface2; }
  .btn-solid { @apply btn bg-accent text-white hover:opacity-90; }
  .btn-flat { @apply btn bg-surface text-fg hover:bg-surface2 border border-line; }
  .btn-danger { @apply btn text-rose-600 hover:bg-rose-500/10 dark:text-rose-400; }
  .input {
    @apply h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg outline-none focus:border-accent;
  }
  .card { @apply rounded-xl border border-line bg-surface; }
  .modal-back { @apply fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4; }
  .modal { @apply w-full rounded-xl border border-line bg-bg p-5; }
  .label { @apply mb-1 block text-xs font-semibold uppercase tracking-wide text-muted; }
}
__BRPHOTOS_EOF__

put web/src/theme.ts <<'__BRPHOTOS_EOF__'
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
__BRPHOTOS_EOF__

put web/src/ThemeOrb.tsx <<'__BRPHOTOS_EOF__'
import { toggleTheme, useMode } from './theme';
import { Icon } from './icons';

/** La bolita: un solo clic alterna entre modo claro y oscuro. Nada más. */
export default function ThemeOrb() {
  const mode = useMode();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={mode === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={mode === 'dark' ? 'Modo claro' : 'Modo oscuro'}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white"
    >
      <Icon name={mode === 'dark' ? 'sun' : 'moon'} className="h-4 w-4" />
    </button>
  );
}
__BRPHOTOS_EOF__

put web/src/icons.tsx <<'__BRPHOTOS_EOF__'
const P: Record<string, string> = {
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 13l4 4L19 7',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  download: 'M12 4v12m0 0l-4-4m4 4l4-4M5 20h14',
  upload: 'M12 16V4m0 0L8 8m4-4l4 4M5 20h14',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  plus: 'M12 5v14M5 12h14',
  users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 19v-1a4 4 0 0 0-3-3.9M15 3.2a3.5 3.5 0 0 1 0 6.6',
  logout: 'M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9',
  menu: 'M4 6h16M4 12h16M4 18h16',
  photo: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  key: 'M14 10a4 4 0 1 1-3.5-4M10.5 9.5L3 17v4h4v-2h2v-2h2l1.5-1.5',
  search: 'M21 21l-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z',
  palette: 'M12 2C6.49 2 2 6.49 2 12c0 3.31 1.61 5.96 4 7.08v.42c0 1.38 1.12 2.5 2.5 2.5h1.75c1.24 0 2.25-1.01 2.25-2.25 0-.58-.22-1.12-.61-1.52-.39-.41-.64-.96-.64-1.58 0-1.24 1.01-2.25 2.25-2.25H16c3.31 0 6-2.69 6-6 0-4.69-4.26-8.4-10-8.4zM6.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
  info: 'M12 16v-4m0-4h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  maximize: 'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3',
  minimize: 'M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  sparkles: 'M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z',
  slider: 'M4 8h16M4 16h16M8 5v6M16 13v6',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  'eye-off': 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  minus: 'M5 12h14',
  select: 'M9 12l2 2 4-4M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
};

export type IconName = keyof typeof P | 'play';

export function Icon({ name, className = 'h-5 w-5', fill = false }: { name: IconName; className?: string; fill?: boolean }) {
  if (name === 'play') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M8 5v14l11-7z" />
      </svg>
    );
  }
  const path = P[name] ?? P.photo;
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}
__BRPHOTOS_EOF__

put web/src/main.tsx <<'__BRPHOTOS_EOF__'
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
__BRPHOTOS_EOF__

put web/src/Login.tsx <<'__BRPHOTOS_EOF__'
import { useState, type FormEvent } from 'react';
import { api } from './api';
import { Icon } from './icons';
import ThemeOrb from './ThemeOrb';
import type { Me } from './types';

export default function Login({ onLogin }: { onLogin: (m: Me) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(await api.login(username, password));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-full items-center justify-center p-4">
      <div className="absolute right-4 top-4">
        <ThemeOrb />
      </div>

      <form onSubmit={submit} className="card w-full max-w-sm p-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white">
            <Icon name="camera" className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">Galería</h1>
          <p className="mt-1 text-sm text-muted">Inicia sesión para ver tus fotos</p>
        </div>

        {error && (
          <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2.5 text-sm text-rose-600 dark:text-rose-400">
            <Icon name="info" className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="label">Usuario</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="label">Contraseña</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                <Icon name={showPassword ? 'eye-off' : 'eye'} className="h-4 w-4" />
              </button>
            </div>
          </div>

          <button type="submit" disabled={busy} className="btn-solid h-11 w-full text-base">
            {busy ? 'Accediendo…' : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  );
}
__BRPHOTOS_EOF__

put web/src/App.tsx <<'__BRPHOTOS_EOF__'
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
import { Icon } from './icons';
import Login from './Login';
import Gallery from './Gallery';
import Admin from './Admin';
import ThemeOrb from './ThemeOrb';
import type { FolderEntry, Me } from './types';

// Rutas por hash:
//   #/                        → raíz (selección de biblioteca)
//   #/f/Fotos:/2024/Enero     → carpeta dentro de una biblioteca
//   #/admin                   → panel de administración
function parseHash(): { admin: boolean; path: string } {
  const raw = location.hash.replace(/^#/, '');
  if (raw === '/admin') return { admin: true, path: '' };
  if (!raw.startsWith('/f')) return { admin: false, path: '' };
  try {
    const encoded = raw.slice(2);
    const decoded = encoded
      .split('/')
      .filter(Boolean)
      .map((seg, i) => {
        if (i === 0 && seg.includes('%3A')) {
          const parts = seg.split('%3A');
          return parts.map(decodeURIComponent).join(':');
        }
        return decodeURIComponent(seg);
      })
      .join('/');
    return { admin: false, path: decoded };
  } catch {
    return { admin: false, path: '' };
  }
}

const toHash = (p: string) => {
  if (!p) return '#/f/';
  const parts = p.split('/');
  const encoded = parts
    .map((seg, i) => {
      if (i === 0 && seg.includes(':')) {
        const colonIdx = seg.indexOf(':');
        return encodeURIComponent(seg.slice(0, colonIdx)) + ':' + encodeURIComponent(seg.slice(colonIdx + 1));
      }
      return encodeURIComponent(seg);
    })
    .join('/');
  return '#/f/' + encoded;
};

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      await api.changePassword(cur, next);
      setOk(true);
      setMsg('Contraseña actualizada con éxito');
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-back" role="dialog" aria-label="Cambiar contraseña">
      <form onSubmit={submit} className="modal max-w-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <Icon name="key" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold">Cambiar contraseña</h2>
            <p className="text-xs text-muted">Actualiza tus credenciales de acceso</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">Contraseña actual</label>
            <input className="input" type="password" value={cur} onChange={(e) => setCur(e.target.value)} required autoComplete="current-password" />
          </div>
          <div>
            <label className="label">Nueva contraseña</label>
            <input className="input" type="password" placeholder="Mínimo 4 caracteres" value={next} onChange={(e) => setNext(e.target.value)} required minLength={4} autoComplete="new-password" />
          </div>
        </div>

        {msg && (
          <p role="status" className={`mt-4 rounded-lg p-3 text-xs font-medium ${ok ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
            {msg}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost text-xs" onClick={onClose}>
            {ok ? 'Cerrar' : 'Cancelar'}
          </button>
          {!ok && (
            <button type="submit" disabled={busy} className="btn-solid text-xs">
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [route, setRoute] = useState(parseHash);
  const [roots, setRoots] = useState<FolderEntry[]>([]);
  const [libs, setLibs] = useState<string[]>([]);
  const [menu, setMenu] = useState(false);
  const [pw, setPw] = useState(false);

  const loadRoots = useCallback(() => {
    api
      .browse('')
      .then((d) => {
        setRoots(d.folders);
        setLibs(d.libraries ?? []);
      })
      .catch(() => {
        setRoots([]);
        setLibs([]);
      });
  }, []);

  useEffect(() => {
    api
      .me()
      .then(setMe)
      .catch(() => setMe(null));
    const h = () => {
      setRoute(parseHash());
      setMenu(false);
    };
    const u = () => setMe(null);
    window.addEventListener('hashchange', h);
    window.addEventListener('unauthorized', u);
    return () => {
      window.removeEventListener('hashchange', h);
      window.removeEventListener('unauthorized', u);
    };
  }, []);

  useEffect(() => {
    if (me) loadRoots();
  }, [me, loadRoots]);

  const go = (p: string) => {
    location.hash = toHash(p);
  };

  const logout = async () => {
    await api.logout().catch(() => undefined);
    setMe(null);
    setRoots([]);
    setLibs([]);
    location.hash = '';
  };

  if (me === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-muted">Cargando…</p>
        </div>
      </div>
    );
  }

  if (me === null) return <Login onLogin={setMe} />;

  const itemBase = 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium';
  const itemActive = 'bg-accent text-white';
  const itemIdle = 'text-muted hover:bg-surface2 hover:text-fg';

  const libIconName = (name: string): any =>
    name.toLowerCase().includes('video')
      ? 'play'
      : name.toLowerCase().includes('foto') || name.toLowerCase().includes('imagen')
      ? 'camera'
      : 'folder';

  const sidebar = (
    <nav className="flex h-full flex-col justify-between overflow-y-auto p-3 select-none" aria-label="Navegación">
      <div>
        {/* Marca y bolita de tema */}
        <div className="mb-4 flex items-center justify-between px-2 pt-2 pb-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white">
              <Icon name="camera" className="h-5 w-5" />
            </span>
            <div>
              <span className="text-base font-bold">Galería</span>
            </div>
          </div>

          <ThemeOrb />
        </div>

        {/* Lista de enlaces principales */}
        <div className="space-y-1">
          <button
            className={`${itemBase} ${!route.admin && route.path === '' ? itemActive : itemIdle}`}
            onClick={() => go('')}
          >
            <Icon name="photo" className="h-4 w-4 shrink-0" />
            <span>{me.role === 'admin' ? 'Bibliotecas' : 'Mis carpetas'}</span>
          </button>
        </div>

        {/* Bibliotecas para Admin */}
        {me.role === 'admin' && libs.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wide text-muted">
              Bibliotecas
            </p>
            <div className="space-y-1">
              {libs.map((libName) => {
                const libPath = `${libName}:`;
                const on = !route.admin && (route.path === libPath || route.path.startsWith(`${libName}:`));
                return (
                  <button
                    key={libName}
                    className={`${itemBase} ${on ? itemActive : itemIdle}`}
                    onClick={() => go(libPath)}
                  >
                    <Icon name={libIconName(libName)} className="h-4 w-4 shrink-0" />
                    <span className="truncate">{libName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Carpetas para Usuario */}
        {me.role !== 'admin' && roots.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wide text-muted">
              Álbumes asignados
            </p>
            <div className="space-y-1">
              {roots.map((r) => {
                const displayName = r.path.includes(':') ? r.path.split(':').slice(1).join(':') || r.name : r.name;
                const on = !route.admin && (route.path === r.path || route.path.startsWith(r.path + '/'));
                return (
                  <button
                    key={r.path}
                    className={`${itemBase} ${on ? itemActive : itemIdle}`}
                    onClick={() => go(r.path)}
                  >
                    <Icon name="folder" className="h-4 w-4 shrink-0" />
                    <span className="truncate">{displayName || r.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Panel de administración */}
        {me.role === 'admin' && (
          <div className="mt-5">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wide text-muted">
              Administración
            </p>
            <button
              className={`${itemBase} ${route.admin ? itemActive : itemIdle}`}
              onClick={() => {
                location.hash = '#/admin';
              }}
            >
              <Icon name="users" className="h-4 w-4 shrink-0" />
              <span>Usuarios y accesos</span>
            </button>
          </div>
        )}
      </div>

      {/* Tarjeta de Usuario inferior */}
      <div className="card mt-4 p-3">
        <div className="mb-2.5 flex items-center gap-2.5 px-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 font-bold text-accent text-sm uppercase">
            {me.username.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold">
              {me.username}
            </p>
            <span className="inline-block rounded bg-accent/15 px-1.5 text-[9px] font-bold uppercase text-accent">
              {me.role === 'admin' ? 'Administrador' : 'Usuario'}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface2 hover:text-fg"
            onClick={() => setPw(true)}
          >
            <Icon name="key" className="h-3.5 w-3.5" />
            <span>Cambiar contraseña</span>
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
            onClick={logout}
          >
            <Icon name="logout" className="h-3.5 w-3.5" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar fijo en escritorio */}
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface md:block">
        {sidebar}
      </aside>

      {/* Drawer responsivo para móvil */}
      {menu && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMenu(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <aside
            className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebar}
          </aside>
        </div>
      )}

      {/* Contenido principal */}
      <main className="flex min-w-0 flex-1 flex-col">
        {route.admin && me.role === 'admin' ? (
          <>
            <div className="flex items-center gap-2 border-b border-line bg-bg px-3 py-2 md:hidden">
              <button
                className="btn-ghost px-2"
                onClick={() => setMenu(true)}
                aria-label="Abrir menú"
              >
                <Icon name="menu" className="h-5 w-5" />
              </button>
              <span className="flex-1 text-sm font-bold">Administración</span>
              <ThemeOrb />
            </div>
            <Admin me={me} onTreeChange={loadRoots} />
          </>
        ) : (
          <Gallery
            me={me}
            path={route.path}
            go={go}
            onTreeChange={loadRoots}
            openMenu={() => setMenu(true)}
          />
        )}
      </main>

      {pw && <PasswordModal onClose={() => setPw(false)} />}
    </div>
  );
}
__BRPHOTOS_EOF__

put web/src/Gallery.tsx <<'__BRPHOTOS_EOF__'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, fileUrl, fmtSize, thumbUrl, uploadFiles } from './api';
import { Icon } from './icons';
import Lightbox from './Lightbox';
import ThemeOrb from './ThemeOrb';
import type { FileEntry, FolderEntry, Listing, Me } from './types';

interface Props {
  me: Me;
  path: string;
  go: (p: string) => void;
  onTreeChange: () => void;
  openMenu: () => void;
}

type ThumbSize = 'xs' | 'sm';

const MIN_COLS = 1;
const MAX_COLS = 10;
const PAGE = 240; // fotos que se pintan por tanda (carga progresiva)

const ls = (k: string, d: string) => {
  try {
    return localStorage.getItem(k) ?? d;
  } catch {
    return d;
  }
};
const lsSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignorar */
  }
};
const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

function defaultCols() {
  const w = window.innerWidth;
  return w < 640 ? 3 : w < 1024 ? 5 : 7;
}

function dayLabel(ms: number) {
  const d = new Date(ms);
  const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  const s = d.toLocaleDateString('es', opts);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Cover({ f }: { f: FolderEntry }) {
  const [bad, setBad] = useState(false);
  return f.cover && !bad ? (
    <img src={thumbUrl(f.cover, 'sm')} alt="" loading="lazy" decoding="async" onError={() => setBad(true)} className="h-full w-full object-cover" />
  ) : (
    <div className="flex h-full w-full items-center justify-center text-muted">
      <Icon name="folder" className="h-10 w-10" />
    </div>
  );
}

function Thumb({ f, size }: { f: FileEntry; size: ThumbSize }) {
  const [bad, setBad] = useState(false);
  if (f.type === 'image' && !bad) {
    return (
      <img
        src={thumbUrl(f.path, size)}
        alt={f.name}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setBad(true)}
        className="h-full w-full select-none object-cover"
      />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-surface2 text-muted select-none">
      <Icon name={f.type === 'video' ? 'play' : 'photo'} className="h-8 w-8" />
    </div>
  );
}

const LIB_ICONS: Record<string, string> = { Fotos: 'camera', Imágenes: 'photo', Videos: 'play' };
const libIcon = (name: string): any => LIB_ICONS[name] ?? 'folder';

function LibraryHome({ folders, go }: { folders: FolderEntry[]; go: (p: string) => void }) {
  return (
    <div className="px-3 pt-3 sm:px-5 sm:pt-5">
      <div className="mb-5">
        <h2 className="text-2xl font-bold">Bibliotecas</h2>
        <p className="mt-1 text-sm text-muted">Selecciona una colección para explorar</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {folders.map((f) => (
          <button key={f.path} onClick={() => go(f.path)} className="card overflow-hidden text-left hover:border-accent">
            <div className="aspect-[16/10] w-full bg-surface2">
              {f.cover ? (
                <img src={thumbUrl(f.cover, 'sm')} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-accent">
                  <Icon name={libIcon(f.name)} className="h-14 w-14" />
                </div>
              )}
            </div>
            <div className="flex items-center justify-between p-3">
              <div className="min-w-0">
                <p className="truncate font-bold">{f.name}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {[f.count ? `${f.count} archivo${f.count > 1 ? 's' : ''}` : '', f.subfolders ? `${f.subfolders} carpeta${f.subfolders > 1 ? 's' : ''}` : '']
                    .filter(Boolean)
                    .join(' · ') || 'Sin contenido'}
                </p>
              </div>
              <Icon name="right" className="h-4 w-4 shrink-0 text-muted" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

interface TileProps {
  f: FileEntry;
  i: number;
  on: boolean;
  selecting: boolean;
  size: ThumbSize;
  onPick: (i: number) => void;
  onToggle: (path: string) => void;
}

// memo: al seleccionar una foto solo se vuelve a pintar esa baldosa
const Tile = memo(function Tile({ f, i, on, selecting, size, onPick, onToggle }: TileProps) {
  return (
    <div
      onClick={() => onPick(i)}
      className={`group relative aspect-square cursor-pointer overflow-hidden rounded-sm ${on ? 'bg-accent/30' : 'bg-surface2'}`}
    >
      <div className={on ? 'h-full w-full scale-[0.86]' : 'h-full w-full'}>
        <Thumb f={f} size={size} />
      </div>

      {f.type === 'video' && (
        <span className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white">
          <Icon name="play" className="h-3 w-3" />
        </span>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(f.path);
        }}
        aria-label={on ? 'Quitar de la selección' : 'Seleccionar'}
        aria-pressed={on}
        className={`absolute left-1 top-1 h-6 w-6 items-center justify-center rounded-full border-2 border-white ${
          on ? 'flex bg-accent text-white' : selecting ? 'flex bg-black/40' : 'hidden bg-black/40 md:group-hover:flex'
        }`}
      >
        {on && <Icon name="check" className="h-3.5 w-3.5 stroke-[3]" />}
      </button>
    </div>
  );
});

const touchDist = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

export default function Gallery({ me, path, go, onTreeChange, openMenu }: Props) {
  const [data, setData] = useState<Listing | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<'grid' | 'list'>(() => (ls('g_view', 'grid') === 'list' ? 'list' : 'grid'));
  const [cols, setCols] = useState(() => {
    const n = Number(ls('g_cols', ''));
    return n >= MIN_COLS && n <= MAX_COLS ? n : defaultCols();
  });
  const [vw, setVw] = useState(() => window.innerWidth);
  const [sort, setSort] = useState<'date' | 'name'>('date');
  const [searchQuery, setSearchQuery] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [up, setUp] = useState<{ done: number; total: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const [toast, setToast] = useState('');
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ paths: string[]; label: string } | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number>();
  const pinch = useRef<number | null>(null);

  const flash = (m: string) => {
    setToast(m);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 4000);
  };

  const load = useCallback(async () => {
    try {
      setError('');
      setData(await api.browse(path));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [path]);

  useEffect(() => {
    setData(null);
    setSel(new Set());
    setSelectMode(false);
    setOpen(null);
    setSearchQuery('');
    setLimit(PAGE);
    load();
  }, [load]);

  useEffect(() => {
    setLimit(PAGE);
  }, [searchQuery, sort]);

  useEffect(() => {
    let t: number | undefined;
    const h = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => setVw(window.innerWidth), 150);
    };
    window.addEventListener('resize', h);
    return () => {
      window.removeEventListener('resize', h);
      window.clearTimeout(t);
    };
  }, []);

  const changeCols = useCallback((delta: number) => {
    setCols((c) => {
      const n = Math.max(MIN_COLS, Math.min(MAX_COLS, c + delta));
      if (n !== c) lsSet('g_cols', String(n));
      return n;
    });
  }, []);

  // Filtrado y ordenación
  const files = useMemo(() => {
    let f = [...(data?.files ?? [])];
    const q = searchQuery.toLowerCase().trim();
    if (q) f = f.filter((item) => item.name.toLowerCase().includes(q));
    return sort === 'name' ? f.sort((a, b) => collator.compare(a.name, b.name)) : f.sort((a, b) => b.cdate - a.cdate);
  }, [data, sort, searchQuery]);

  // Carga progresiva: solo se pintan `limit` fotos; el resto al acercarse al final
  const shown = useMemo(() => files.slice(0, limit), [files, limit]);

  const groups = useMemo(() => {
    if (sort !== 'date') return [{ label: '', items: shown.map((f, i) => ({ f, i })) }];
    const out: { label: string; items: { f: FileEntry; i: number }[] }[] = [];
    shown.forEach((f, i) => {
      const label = dayLabel(f.cdate);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push({ f, i });
      else out.push({ label, items: [{ f, i }] });
    });
    return out;
  }, [shown, sort]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || limit >= files.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setLimit((l) => l + PAGE);
      },
      { root: scroller.current, rootMargin: '1500px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [limit, files.length, view, data]);

  const canWrite = !!data?.canWrite;
  const canUpload = canWrite && me.perms.upload;
  const isAdmin = me.role === 'admin';
  const isLibraryHome = data?.isLibraryRoot || (data?.path === '' && isAdmin);
  const selecting = selectMode || sel.size > 0;

  // Miniaturas más ligeras cuando la baldosa es pequeña
  const avail = vw - (vw >= 768 ? 240 : 0);
  const thumbSize: ThumbSize = avail / cols <= 190 ? 'xs' : 'sm';

  const toggle = useCallback((p: string) => {
    setSel((s) => {
      const n = new Set(s);
      n.has(p) ? n.delete(p) : n.add(p);
      return n;
    });
  }, []);

  const pickRef = useRef<(i: number) => void>(() => undefined);
  pickRef.current = (i: number) => {
    if (selecting) toggle(files[i].path);
    else setOpen(i);
  };
  const onPick = useCallback((i: number) => pickRef.current(i), []);

  function selectAll() {
    setSel(sel.size === files.length ? new Set() : new Set(files.map((f) => f.path)));
  }

  function selectGroup(items: { f: FileEntry; i: number }[]) {
    setSel((prev) => {
      const n = new Set(prev);
      const all = items.every((x) => n.has(x.f.path));
      items.forEach((x) => (all ? n.delete(x.f.path) : n.add(x.f.path)));
      return n;
    });
  }

  function endSelection() {
    setSel(new Set());
    setSelectMode(false);
  }

  async function doUpload(list: File[]) {
    if (!list.length || !data) return;
    const total = list.reduce((a, f) => a + f.size, 0);
    const batches: File[][] = [];
    let cur: File[] = [];
    let curSize = 0;
    for (const f of list) {
      if (cur.length && curSize + f.size > 90 * 1024 * 1024) {
        batches.push(cur);
        cur = [];
        curSize = 0;
      }
      cur.push(f);
      curSize += f.size;
    }
    if (cur.length) batches.push(cur);

    let done = 0,
      skipped = 0;
    setUp({ done: 0, total });
    try {
      for (const b of batches) {
        const bs = b.reduce((a, f) => a + f.size, 0);
        const r = await uploadFiles(data.path, b, (l) => setUp({ done: done + Math.min(l, bs), total }));
        done += bs;
        skipped += r.skipped.length;
      }
      flash(skipped ? `Subidos ${list.length - skipped} archivos. ${skipped} omitidos por formato no soportado.` : `Subidos ${list.length} archivos`);
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setUp(null);
      load();
      onTreeChange();
    }
  }

  async function submitNewFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim() || !data) return;
    try {
      await api.mkdir(data.path, newFolderName.trim());
      setNewFolderOpen(false);
      setNewFolderName('');
      await load();
      onTreeChange();
      flash('Carpeta creada');
    } catch (e) {
      flash((e as Error).message);
    }
  }

  async function executeDelete() {
    if (!deleteConfirm) return;
    try {
      const r = await api.remove(deleteConfirm.paths);
      endSelection();
      setOpen(null);
      setDeleteConfirm(null);
      flash(r.deleted ? `Eliminados: ${r.deleted}` : 'No se eliminó nada');
      await load();
      onTreeChange();
    } catch (e) {
      flash((e as Error).message);
    }
  }

  function downloadSelected() {
    [...sel].forEach((p, i) =>
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = fileUrl(p, true);
        a.download = '';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 350)
    );
  }

  const atHome = !data || data.path === '';
  const activeLib = data?.path.includes(':') ? data.path.split(':')[0] : null;

  const crumb = (active: boolean) =>
    `shrink-0 rounded-lg px-2 py-1 text-xs font-semibold ${active ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-surface2 hover:text-fg'}`;
  const iconBtn = (active: boolean) => `flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${active ? 'bg-accent text-white' : 'text-muted hover:text-fg'}`;

  return (
    <div
      className="relative flex h-full min-w-0 flex-1 flex-col"
      onDragOver={(e) => {
        if (canUpload && e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDrag(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDrag(false);
      }}
      onDrop={(e) => {
        if (!canUpload) return;
        e.preventDefault();
        setDrag(false);
        doUpload([...e.dataTransfer.files]);
      }}
    >
      {/* Barra superior */}
      <header className="shrink-0 border-b border-line bg-bg px-2 py-2 sm:px-3">
        {selecting ? (
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <button className="btn-ghost px-2" onClick={endSelection} aria-label="Cancelar selección">
                <Icon name="x" className="h-4 w-4" />
              </button>
              <span className="truncate text-sm font-bold text-accent">
                {sel.size ? `${sel.size} seleccionado${sel.size > 1 ? 's' : ''}` : 'Toca para seleccionar'}
              </span>
              <button onClick={selectAll} className="ml-1 shrink-0 text-xs font-semibold text-muted hover:text-fg">
                {sel.size === files.length ? 'Ninguno' : 'Todo'}
              </button>
            </div>
            <div className="flex items-center gap-1">
              {me.perms.download && (
                <button className="btn-flat px-2.5" onClick={downloadSelected} disabled={!sel.size}>
                  <Icon name="download" className="h-4 w-4" />
                  <span className="hidden sm:inline">Descargar</span>
                </button>
              )}
              {me.perms.delete && (
                <button className="btn-danger px-2.5" disabled={!sel.size} onClick={() => setDeleteConfirm({ paths: [...sel], label: `${sel.size} elemento(s)` })}>
                  <Icon name="trash" className="h-4 w-4" />
                  <span className="hidden sm:inline">Eliminar</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <button className="btn-ghost px-2 md:hidden" onClick={openMenu} aria-label="Menú">
                <Icon name="menu" className="h-5 w-5" />
              </button>
              <button
                className="btn-ghost px-2 disabled:opacity-20"
                disabled={atHome || data?.parent == null}
                onClick={() => data?.parent != null && go(data.parent)}
                aria-label="Subir un nivel"
                title="Subir un nivel"
              >
                <Icon name="left" className="h-4 w-4" />
              </button>

              <nav className="flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="Ruta">
                <button className={crumb(atHome)} onClick={() => go('')}>
                  {isAdmin ? 'Bibliotecas' : 'Mis carpetas'}
                </button>
                {activeLib && (
                  <>
                    <span className="shrink-0 text-muted">/</span>
                    <button className={crumb(!data?.crumbs.length)} onClick={() => go(`${activeLib}:`)}>
                      {activeLib}
                    </button>
                  </>
                )}
                {data?.crumbs.map((c, i) => (
                  <span key={c.path} className="flex shrink-0 items-center gap-1">
                    <span className="text-muted">/</span>
                    <button className={`${crumb(i === data.crumbs.length - 1)} whitespace-nowrap`} onClick={() => go(c.path)}>
                      {c.name}
                    </button>
                  </span>
                ))}
              </nav>
            </div>

            <div className="md:hidden">
              <ThemeOrb />
            </div>

            {!isLibraryHome && (
              <div className="flex w-full items-center gap-1.5 overflow-x-auto sm:w-auto">
                <div className="relative hidden w-36 shrink-0 sm:block lg:w-44">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar…"
                    className="h-8 w-full rounded-lg border border-line bg-surface pl-8 pr-7 text-xs outline-none focus:border-accent"
                  />
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
                    <Icon name="search" className="h-3.5 w-3.5" />
                  </span>
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted" aria-label="Limpiar búsqueda">
                      <Icon name="x" className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Tamaño de la cuadrícula: más / menos fotos por fila */}
                {view === 'grid' && (
                  <div className="flex shrink-0 items-center rounded-lg border border-line bg-surface p-0.5">
                    <button
                      onClick={() => changeCols(-1)}
                      disabled={cols <= MIN_COLS}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-fg disabled:opacity-30"
                      aria-label="Menos fotos por fila (más grandes)"
                      title="Fotos más grandes"
                    >
                      <Icon name="minus" className="h-4 w-4" />
                    </button>
                    <span className="flex min-w-[2.75rem] items-center justify-center gap-1 text-xs font-bold" title="Fotos por fila">
                      <Icon name="grid" className="h-3.5 w-3.5 text-muted" />
                      {cols}
                    </span>
                    <button
                      onClick={() => changeCols(1)}
                      disabled={cols >= MAX_COLS}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-fg disabled:opacity-30"
                      aria-label="Más fotos por fila (más pequeñas)"
                      title="Fotos más pequeñas"
                    >
                      <Icon name="plus" className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as 'date' | 'name')}
                  className="h-8 shrink-0 rounded-lg border border-line bg-surface px-2 text-xs font-medium text-fg outline-none"
                  aria-label="Ordenar fotos"
                >
                  <option value="date">Fecha</option>
                  <option value="name">Nombre</option>
                </select>

                <div className="flex shrink-0 rounded-lg border border-line bg-surface p-0.5">
                  <button
                    onClick={() => {
                      setView('grid');
                      lsSet('g_view', 'grid');
                    }}
                    className={iconBtn(view === 'grid')}
                    aria-label="Cuadrícula"
                    title="Cuadrícula"
                  >
                    <Icon name="grid" className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setView('list');
                      lsSet('g_view', 'list');
                    }}
                    className={iconBtn(view === 'list')}
                    aria-label="Lista"
                    title="Lista"
                  >
                    <Icon name="list" className="h-4 w-4" />
                  </button>
                </div>

                {files.length > 0 && (
                  <button className="btn-flat h-8 shrink-0 px-2" onClick={() => setSelectMode(true)} aria-label="Seleccionar" title="Seleccionar">
                    <Icon name="select" className="h-4 w-4" />
                  </button>
                )}

                {canWrite && (
                  <button className="btn-flat h-8 shrink-0 px-2" onClick={() => setNewFolderOpen(true)} aria-label="Nueva carpeta" title="Nueva carpeta">
                    <Icon name="plus" className="h-4 w-4" />
                    <span className="hidden lg:inline text-xs">Carpeta</span>
                  </button>
                )}

                {canUpload && (
                  <button className="btn-solid h-8 shrink-0 px-2.5 text-xs" onClick={() => fileInput.current?.click()}>
                    <Icon name="upload" className="h-4 w-4" />
                    <span>Subir</span>
                  </button>
                )}

                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  hidden
                  onChange={(e) => {
                    doUpload([...(e.target.files ?? [])]);
                    e.target.value = '';
                  }}
                />
              </div>
            )}
          </div>
        )}
      </header>

      {/* Contenido */}
      <div
        ref={scroller}
        className={`min-h-0 flex-1 overflow-y-auto pb-24 pt-3 ${view === 'grid' ? 'pinch-grid' : ''}`}
        onTouchStart={(e) => {
          if (view === 'grid' && e.touches.length === 2) pinch.current = touchDist(e.touches);
        }}
        onTouchMove={(e) => {
          if (view !== 'grid' || pinch.current === null || e.touches.length !== 2) return;
          const d = touchDist(e.touches);
          const r = d / pinch.current;
          if (r > 1.3) {
            changeCols(-1);
            pinch.current = d;
          } else if (r < 0.77) {
            changeCols(1);
            pinch.current = d;
          }
        }}
        onTouchEnd={() => {
          pinch.current = null;
        }}
      >
        {error && (
          <div role="alert" className="mx-3 mb-4 flex items-center gap-3 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
            <Icon name="info" className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!data && !error && <p className="py-16 text-center text-sm text-muted">Cargando…</p>}

        {data && isLibraryHome && <LibraryHome folders={data.folders} go={go} />}

        {data && !isLibraryHome && (
          <div className="px-2 sm:px-4">
            {/* Subcarpetas */}
            {data.folders.length > 0 && (
              <section className="mb-6" aria-label="Carpetas">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
                  <Icon name="folder" className="h-4 w-4 text-accent" />
                  Carpetas ({data.folders.length})
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                  {data.folders.map((f) => (
                    <div key={f.path} className="card group relative overflow-hidden hover:border-accent">
                      <button onClick={() => go(f.path)} className="block w-full text-left">
                        <div className="aspect-[4/3] w-full bg-surface2">
                          <Cover f={f} />
                        </div>
                        <div className="p-2">
                          <p className="truncate text-sm font-semibold">{f.name}</p>
                          <p className="text-[11px] text-muted">
                            {[f.count ? `${f.count} archivo${f.count > 1 ? 's' : ''}` : '', f.subfolders ? `${f.subfolders} carpeta${f.subfolders > 1 ? 's' : ''}` : '']
                              .filter(Boolean)
                              .join(' · ') || 'Vacía'}
                          </p>
                        </div>
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => setDeleteConfirm({ paths: [f.path], label: `la carpeta «${f.name}» con todo su contenido` })}
                          aria-label={`Eliminar carpeta ${f.name}`}
                          className="absolute right-1.5 top-1.5 flex rounded-full bg-black/70 p-1.5 text-white hover:bg-rose-600 md:hidden md:group-hover:flex"
                        >
                          <Icon name="trash" className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Cuadrícula por días */}
            {files.length > 0 && view === 'grid' && (
              <div className="space-y-4">
                {groups.map((g) => (
                  <section key={g.label || 'all'}>
                    {g.label && (
                      <div className="sticky top-0 z-10 flex items-center justify-between bg-bg py-1.5">
                        <h4 className="min-w-0 truncate text-sm font-bold">
                          {g.label} <span className="ml-1 text-xs font-medium text-muted">{g.items.length}</span>
                        </h4>
                        <button type="button" onClick={() => selectGroup(g.items)} className="shrink-0 pl-2 text-xs font-semibold text-accent">
                          {g.items.every((x) => sel.has(x.f.path)) ? 'Quitar día' : 'Seleccionar día'}
                        </button>
                      </div>
                    )}
                    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                      {g.items.map(({ f, i }) => (
                        <Tile key={f.path} f={f} i={i} on={sel.has(f.path)} selecting={selecting} size={thumbSize} onPick={onPick} onToggle={toggle} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {/* Lista */}
            {files.length > 0 && view === 'list' && (
              <ul className="card divide-y divide-line overflow-hidden">
                {shown.map((f, i) => (
                  <li
                    key={f.path}
                    onClick={() => onPick(i)}
                    className={`flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface2 ${sel.has(f.path) ? 'bg-accent/10' : ''}`}
                  >
                    {selecting && (
                      <input
                        type="checkbox"
                        checked={sel.has(f.path)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggle(f.path)}
                        className="h-4 w-4 shrink-0 cursor-pointer accent-accent"
                      />
                    )}
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-surface2">
                      <Thumb f={f} size="xs" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{f.name}</p>
                      <p className="text-xs text-muted">
                        {new Date(f.cdate).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })} · {fmtSize(f.size)}
                      </p>
                    </div>
                    <span className="hidden shrink-0 rounded bg-surface2 px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted sm:inline">
                      {f.name.split('.').pop()}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {limit < files.length && <div ref={sentinel} className="h-10" />}

            {/* Vacío */}
            {files.length === 0 && data.folders.length === 0 && (
              <div className="my-12 flex flex-col items-center justify-center rounded-xl border border-dashed border-line p-10 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <Icon name="photo" className="h-7 w-7" />
                </div>
                <h4 className="text-lg font-bold">{atHome && !isAdmin ? 'Aún no tienes álbumes asignados' : 'Esta carpeta está vacía'}</h4>
                <p className="mt-1 max-w-sm text-sm text-muted">
                  {canUpload
                    ? 'Arrastra fotos a esta ventana o pulsa «Subir».'
                    : atHome && !isAdmin
                    ? 'Pide al administrador que te asigne carpetas.'
                    : 'No hay elementos para mostrar.'}
                </p>
                {canUpload && (
                  <button onClick={() => fileInput.current?.click()} className="btn-solid mt-4">
                    <Icon name="upload" className="h-4 w-4" />
                    <span>Subir fotos</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {drag && (
        <div className="pointer-events-none fixed inset-3 z-50 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-accent bg-bg/90">
          <Icon name="upload" className="h-10 w-10 text-accent" />
          <p className="mt-3 text-xl font-bold">Suelta las fotos aquí</p>
        </div>
      )}

      {(up || toast) && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[min(92%,24rem)] -translate-x-1/2 rounded-lg bg-fg p-3 text-bg" role="status">
          {up ? (
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                <span>Subiendo…</span>
                <span className="font-mono">{Math.round((up.done / up.total) * 100)}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg/30">
                <div className="h-full bg-accent" style={{ width: `${(up.done / up.total) * 100}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] opacity-70">
                {fmtSize(up.done)} de {fmtSize(up.total)}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm">
              <span className="flex-1 text-xs font-medium">{toast}</span>
              <button onClick={() => setToast('')} className="opacity-70 hover:opacity-100" aria-label="Cerrar aviso">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {newFolderOpen && (
        <div className="modal-back" role="dialog">
          <form onSubmit={submitNewFolder} className="modal max-w-sm">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <Icon name="folder" className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-bold">Nueva carpeta</h3>
                <p className="text-xs text-muted">Organiza tus fotos en un álbum</p>
              </div>
            </div>
            <input
              type="text"
              className="input mb-4"
              placeholder="Nombre (ej: Vacaciones 2024)"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
              required
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => {
                  setNewFolderOpen(false);
                  setNewFolderName('');
                }}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-solid text-xs">
                Crear
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteConfirm && (
        <div className="modal-back" role="dialog">
          <div className="modal max-w-sm">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/15 text-rose-500">
                <Icon name="trash" className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-bold">¿Mover a la papelera?</h3>
                <p className="text-xs text-muted">Se eliminará {deleteConfirm.label}</p>
              </div>
            </div>
            <p className="mb-5 text-xs text-muted">Los archivos van a la papelera del servidor y se pueden recuperar a mano.</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost text-xs" onClick={() => setDeleteConfirm(null)}>
                Cancelar
              </button>
              <button type="button" onClick={executeDelete} className="btn bg-rose-600 text-xs text-white hover:bg-rose-700">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {open !== null && files[open] && (
        <Lightbox
          items={files}
          index={open}
          setIndex={setOpen}
          onClose={() => setOpen(null)}
          canDownload={me.perms.download}
          canDelete={me.perms.delete}
          onDelete={(f) => setDeleteConfirm({ paths: [f.path], label: `«${f.name}»` })}
        />
      )}
    </div>
  );
}
__BRPHOTOS_EOF__

put web/src/Lightbox.tsx <<'__BRPHOTOS_EOF__'
import { useEffect, useRef, useState } from 'react';
import { fileUrl, fmtSize, isGif, thumbUrl } from './api';
import { Icon } from './icons';
import type { FileEntry } from './types';

interface Props {
  items: FileEntry[];
  index: number;
  setIndex: (i: number) => void;
  onClose: () => void;
  canDownload: boolean;
  canDelete: boolean;
  onDelete: (f: FileEntry) => void;
}

const src = (f: FileEntry) => (f.type === 'video' || isGif(f) ? fileUrl(f.path) : thumbUrl(f.path, 'lg'));
const STRIP = 20; // miniaturas visibles a cada lado en la tira inferior

export default function Lightbox({ items, index, setIndex, onClose, canDownload, canDelete, onDelete }: Props) {
  const f = items[index];
  const touch = useRef<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(false);
  const strip = useRef<HTMLDivElement>(null);

  const go = (i: number) => {
    if (i < 0 || i >= items.length) return;
    setIndex(i);
    setZoom(false);
  };
  const prev = () => go(index - 1);
  const next = () => go(index + 1);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showInfo) setShowInfo(false);
        else onClose();
      } else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      else if (e.key === 'i' || e.key === 'I') setShowInfo((v) => !v);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  // Precarga de las fotos vecinas
  useEffect(() => {
    for (const n of [items[index + 1], items[index - 1]]) {
      if (n && n.type === 'image') new Image().src = src(n);
    }
  }, [index, items]);

  // Tira de miniaturas con ventana: no se pintan miles de botones
  const start = Math.max(0, index - STRIP);
  const end = Math.min(items.length, index + STRIP + 1);

  useEffect(() => {
    const el = strip.current?.children[index - start] as HTMLElement | undefined;
    el?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [index, start]);

  if (!f) return null;

  const dateStr = new Date(f.cdate).toLocaleString('es', { dateStyle: 'full', timeStyle: 'medium' });
  const tb = 'flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black text-white select-none"
      role="dialog"
      aria-label={f.name}
      onTouchStart={(e) => {
        touch.current = e.touches.length === 1 ? e.touches[0].clientX : null;
      }}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 60) (dx > 0 ? prev : next)();
        touch.current = null;
      }}
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 px-3">
        <div className="flex min-w-0 items-center gap-3">
          <button className={tb} onClick={onClose} aria-label="Cerrar visor" title="Cerrar (Esc)">
            <Icon name="x" className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{f.name}</p>
            <p className="text-xs text-white/60">
              {new Date(f.cdate).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })} · {index + 1} de {items.length}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setShowInfo(!showInfo)}
            aria-label="Información de la foto"
            title="Información (I)"
            className={`${tb} ${showInfo ? '!bg-accent' : ''}`}
          >
            <Icon name="info" className="h-5 w-5" />
          </button>
          <button onClick={toggleFullscreen} aria-label="Pantalla completa" title="Pantalla completa (F)" className={`${tb} hidden sm:flex`}>
            <Icon name={isFullscreen ? 'minimize' : 'maximize'} className="h-5 w-5" />
          </button>
          {canDownload && (
            <a className={tb} href={fileUrl(f.path, true)} aria-label="Descargar archivo" title="Descargar original">
              <Icon name="download" className="h-5 w-5" />
            </a>
          )}
          {canDelete && (
            <button className={`${tb} !bg-rose-600/30 !text-rose-200 hover:!bg-rose-600/50`} onClick={() => onDelete(f)} aria-label="Eliminar foto" title="Eliminar">
              <Icon name="trash" className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {index > 0 && (
          <button className="absolute left-2 z-20 hidden h-12 w-12 items-center justify-center rounded-full bg-black/70 text-white hover:bg-white/20 sm:flex" onClick={prev} aria-label="Foto anterior">
            <Icon name="left" className="h-6 w-6" />
          </button>
        )}

        <div className="flex max-h-full max-w-full items-center justify-center overflow-hidden">
          {f.type === 'video' ? (
            <video key={f.path} src={fileUrl(f.path)} controls autoPlay playsInline className="max-h-[78vh] max-w-full" />
          ) : (
            <img
              key={f.path}
              src={src(f)}
              alt={f.name}
              onClick={() => setZoom(!zoom)}
              className={`max-h-[78vh] max-w-full object-contain ${zoom ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'}`}
            />
          )}
        </div>

        {index < items.length - 1 && (
          <button className="absolute right-2 z-20 hidden h-12 w-12 items-center justify-center rounded-full bg-black/70 text-white hover:bg-white/20 sm:flex" onClick={next} aria-label="Foto siguiente">
            <Icon name="right" className="h-6 w-6" />
          </button>
        )}

        {showInfo && (
          <div className="absolute right-2 top-2 z-30 w-72 max-w-[calc(100%-1rem)] rounded-xl border border-white/10 bg-neutral-900 p-4">
            <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
              <h4 className="text-sm font-bold">Detalles</h4>
              <button onClick={() => setShowInfo(false)} className="text-white/60 hover:text-white" aria-label="Cerrar detalles">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Nombre</p>
                <p className="mt-0.5 break-all font-medium">{f.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Fecha de captura</p>
                <p className="mt-0.5 font-medium text-accent">{dateStr}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Tamaño</p>
                  <p className="mt-0.5 font-medium">{fmtSize(f.size)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Tipo</p>
                  <p className="mt-0.5 font-medium uppercase">{f.name.split('.').pop()}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/50">Ruta</p>
                <p className="mt-0.5 break-all rounded-md bg-white/5 p-2 font-mono text-[11px] text-white/70">{f.path}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tira de miniaturas (solo en pantallas medianas y grandes) */}
      <div className="hidden h-20 shrink-0 px-3 py-2 sm:block">
        <div ref={strip} className="flex h-full items-center gap-1.5 overflow-x-auto overflow-y-hidden">
          {items.slice(start, end).map((it, k) => {
            const i = start + k;
            return (
              <button
                key={it.path}
                onClick={() => go(i)}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 ${i === index ? 'border-accent' : 'border-transparent opacity-60 hover:opacity-100'}`}
              >
                {it.type === 'image' ? (
                  <img src={thumbUrl(it.path, 'xs')} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-neutral-800 text-white/80">
                    <Icon name="play" className="h-4 w-4" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
__BRPHOTOS_EOF__

put web/src/Admin.tsx <<'__BRPHOTOS_EOF__'
import { useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
import { Icon } from './icons';
import type { Me, Perms } from './types';

const PERM_LABELS: [keyof Perms, string][] = [
  ['view', 'Ver fotos'],
  ['download', 'Descargar'],
  ['upload', 'Subir'],
  ['delete', 'Eliminar'],
];

function depth(p: string): number {
  const rel = p.includes(':') ? p.slice(p.indexOf(':') + 1) : p;
  return rel ? rel.split('/').length : 0;
}

function folderLabel(f: string, filter: boolean): string {
  if (filter) return f;
  if (f.includes(':')) {
    const [lib, rel] = f.split(':');
    if (!rel) return lib;
    return rel.split('/').pop() ?? f;
  }
  return f.split('/').pop() ?? f;
}

function UserForm({
  user,
  folders,
  onClose,
  onSaved,
}: {
  user: Me | null;
  folders: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [username, setUsername] = useState(user?.username ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>(user?.role ?? 'user');
  const [perms, setPerms] = useState<Perms>(
    user?.perms ?? { view: true, download: true, upload: false, delete: false }
  );
  const [chosen, setChosen] = useState<Set<string>>(new Set(user?.folders ?? []));
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = {
        username,
        role,
        perms,
        folders: [...chosen],
        ...(password ? { password } : {}),
      };
      if (user) await api.updateUser(user.id, body);
      else await api.createUser({ ...body, password });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const shown = folders.filter((f) => f.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="modal-back" role="dialog" aria-label={user ? 'Editar usuario' : 'Nuevo usuario'}>
      <form
        onSubmit={submit}
        className="modal flex max-h-[90vh] max-w-lg flex-col"
      >
        <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <Icon name="users" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold">
                {user ? `Editar a ${user.username}` : 'Crear nuevo usuario'}
              </h2>
              <p className="text-xs text-muted">Configuración de credenciales y permisos</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted hover:bg-surface2 hover:text-fg"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">
                Nombre de usuario
              </label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label">
                {user ? 'Nueva contraseña' : 'Contraseña inicial'}
              </label>
              <input
                className="input"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!user}
                placeholder={user ? 'Dejar en blanco para no cambiar' : ''}
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <label className="label">
              Rol del usuario
            </label>
            <select
              className="input font-medium"
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
            >
              <option value="user">Usuario estándar (solo carpetas asignadas)</option>
              <option value="admin">Administrador (acceso total)</option>
            </select>
          </div>

          {role === 'user' && (
            <>
              <div>
                <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  Permisos de operaciones
                </legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PERM_LABELS.map(([k, label]) => {
                    const on = perms[k];
                    return (
                      <label
                        key={k}
                        className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border p-2 text-xs font-semibold select-none ${
                          on
                            ? 'border-accent bg-accent/15 text-accent'
                            : 'border-line text-muted hover:bg-surface2'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-accent"
                          checked={on}
                          onChange={(e) => setPerms({ ...perms, [k]: e.target.checked })}
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Carpetas Visibles ({chosen.size})
                  </legend>
                  <span className="text-[11px] text-muted">Incluyen automáticamente subcarpetas</span>
                </div>

                <div className="relative mb-2">
                  <input
                    className="input h-9 pl-8 text-xs"
                    placeholder="Filtrar carpetas… (ej: Fotos:2024)"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
                    <Icon name="search" className="h-3.5 w-3.5" />
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto rounded-lg border border-line bg-surface p-2">
                  {shown.length === 0 && (
                    <p className="p-3 text-center text-xs text-muted">No se encontraron carpetas.</p>
                  )}
                  {shown.map((f) => (
                    <label
                      key={f}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-surface2"
                      style={{ paddingLeft: `${8 + (filter ? 0 : depth(f)) * 14}px` }}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded accent-accent"
                        checked={chosen.has(f)}
                        onChange={(e) =>
                          setChosen((s) => {
                            const n = new Set(s);
                            e.target.checked ? n.add(f) : n.delete(f);
                            return n;
                          })
                        }
                      />
                      <Icon name="folder" className="h-4 w-4 text-accent shrink-0" />
                      <span className="truncate">{folderLabel(f, !!filter)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
            <Icon name="info" className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2 border-t border-line pt-3">
          <button type="button" className="btn-ghost text-xs" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-solid text-xs" disabled={busy}>
            {user ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Admin({ me, onTreeChange }: { me: Me; onTreeChange: () => void }) {
  const [users, setUsers] = useState<Me[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [edit, setEdit] = useState<Me | 'new' | null>(null);
  const [msg, setMsg] = useState('');
  const [parent, setParent] = useState('');
  const [name, setName] = useState('');

  const load = () =>
    Promise.all([api.users(), api.allFolders()])
      .then(([u, f]) => {
        setUsers(u);
        setFolders(f);
      })
      .catch((e) => setMsg(e.message));

  useEffect(() => {
    load();
  }, []);

  async function remove(u: Me) {
    if (!confirm(`¿Eliminar al usuario «${u.username}»? Sus fotos no se borran.`)) return;
    try {
      await api.deleteUser(u.id);
      load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function mkdir(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const r = await api.mkdir(parent, name.trim());
      setMsg(`Carpeta creada con éxito: ${r.path}`);
      setName('');
      load();
      onTreeChange();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  const foldersByLib: Record<string, string[]> = {};
  for (const f of folders) {
    const lib = f.includes(':') ? f.split(':')[0] : '(sin biblioteca)';
    if (!foldersByLib[lib]) foldersByLib[lib] = [];
    foldersByLib[lib].push(f);
  }

  return (
    <div className="h-full overflow-y-auto px-3 py-5 md:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header con estadísticas rápidas */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                Panel de Administración
              </h2>
              <p className="mt-1 text-sm text-muted">
                Gestiona usuarios, permisos de acceso y estructura de carpetas
              </p>
            </div>
            <button
              className="btn-solid"
              onClick={() => setEdit('new')}
            >
              <Icon name="plus" className="h-4 w-4" />
              <span>Nuevo usuario</span>
            </button>
          </div>

          {/* Tarjetas de Métricas */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="card p-4">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Usuarios Registrados
              </span>
              <p className="mt-1 text-2xl font-bold">
                {users.length}
              </p>
            </div>
            <div className="card p-4">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Bibliotecas Activas
              </span>
              <p className="mt-1 text-2xl font-bold text-accent">
                {Object.keys(foldersByLib).length}
              </p>
            </div>
            <div className="card p-4">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted">
                Total Carpetas
              </span>
              <p className="mt-1 text-2xl font-bold">
                {folders.length}
              </p>
            </div>
          </div>
        </div>

        {msg && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-lg bg-accent/10 p-3 text-xs font-semibold text-accent"
          >
            <Icon name="info" className="h-4 w-4 shrink-0" />
            <span>{msg}</span>
          </div>
        )}

        {/* Lista de Usuarios */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted">
              Cuentas de usuario ({users.length})
            </h3>
          </div>

          <div className="card overflow-hidden">
            <ul className="divide-y divide-line">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-surface2"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-sm font-bold text-accent uppercase">
                      {u.username.slice(0, 2)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold">{u.username}</p>
                        {u.id === me.id && (
                          <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold text-accent">
                            Tú
                          </span>
                        )}
                        <span className="rounded bg-surface2 px-1.5 py-0.5 text-[10px] font-bold text-muted">
                          {u.role === 'admin' ? 'Administrador' : 'Usuario'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {u.role === 'admin'
                          ? 'Acceso total sin restricciones'
                          : `${
                              PERM_LABELS.filter(([k]) => u.perms[k])
                                .map(([, l]) => l)
                                .join(', ') || 'Sin permisos'
                            } · ${
                              u.folders.length
                                ? `${u.folders.length} carpeta(s) asignada(s)`
                                : 'sin carpetas'
                            }`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      className="btn-flat text-xs h-8 px-3"
                      onClick={() => setEdit(u)}
                    >
                      <Icon name="edit" className="h-3.5 w-3.5" />
                      <span>Editar</span>
                    </button>
                    {u.id !== me.id && (
                      <button
                        className="btn-danger text-xs h-8 px-2.5"
                        onClick={() => remove(u)}
                        aria-label={`Eliminar ${u.username}`}
                        title="Eliminar usuario"
                      >
                        <Icon name="trash" className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Crear Carpeta en Biblioteca */}
        <section>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
            Crear Carpeta en el Sistema
          </h3>
          <form
            onSubmit={mkdir}
            className="flex flex-wrap items-center gap-3 card p-4"
          >
            <div className="flex-1 min-w-[200px]">
              <select
                className="input text-xs font-semibold"
                value={parent}
                onChange={(e) => setParent(e.target.value)}
                aria-label="Carpeta padre"
              >
                <option value="">— Selecciona carpeta destino —</option>
                {Object.entries(foldersByLib).map(([lib, flds]) => (
                  <optgroup key={lib} label={lib}>
                    {flds.map((f) => {
                      const rel = f.includes(':') ? f.slice(f.indexOf(':') + 1) : f;
                      const indent = '\u2003'.repeat(rel ? rel.split('/').length - 1 : 0);
                      return (
                        <option key={f} value={f}>
                          {indent}
                          {f.split('/').pop() ?? f}
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <input
                className="input text-xs font-medium"
                placeholder="Nombre de la nueva carpeta"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-solid text-xs h-10 px-5">
              <Icon name="plus" className="h-4 w-4" />
              <span>Crear carpeta</span>
            </button>
          </form>
        </section>
      </div>

      {edit && (
        <UserForm
          user={edit === 'new' ? null : edit}
          folders={folders}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            load();
          }}
        />
      )}
    </div>
  );
}
__BRPHOTOS_EOF__

echo "▶ Aplicando parches pequeños…"
parchar web/src/api.ts \
  "size: 'sm' | 'lg' = 'sm'" \
  "size: 'xs' | 'sm' | 'lg' = 'sm'"
parchar web/index.html \
  '<meta name="color-scheme" content="light dark" />' \
  '<meta name="color-scheme" content="light dark" />
    <meta name="theme-color" content="#111113" />'
parchar server/src/thumbs.ts \
  "export const SIZES = { sm: 480, lg: 1800 } as const;" \
  "export const SIZES = { xs: 320, sm: 480, lg: 1800 } as const;"
parchar server/src/thumbs.ts \
  ".webp({ quality: size === 'sm' ? 72 : 82 })" \
  ".webp({ quality: size === 'lg' ? 82 : 72 })"
parchar server/src/routes-files.ts \
  "const size: SizeKey = req.query.s === 'lg' ? 'lg' : 'sm';" \
  "const size: SizeKey = req.query.s === 'lg' ? 'lg' : req.query.s === 'xs' ? 'xs' : 'sm';"

echo "▶ Quitando archivos que ya no se usan…"
quitar web/src/MagicOrb.tsx
quitar web/src/AmbientAura.tsx

# Que git ignore las copias de seguridad
if [ -f "$PROY/.gitignore" ] && ! grep -q '^\.backup-actualizacion-' "$PROY/.gitignore"; then
  printf '\n# Copias de seguridad del script de actualización\n.backup-actualizacion-*/\n' >> "$PROY/.gitignore"
fi

# ---------------------------------------------------------------- compilar
if [ "$SIN_BUILD" -eq 0 ]; then
  cd "$PROY" || exit 1
  if [ ! -d web/node_modules ] || [ ! -d server/node_modules ]; then
    echo "▶ Instalando dependencias (primera vez)…"
    npm run install:all || { echo "✗ Falló la instalación."; restaurar; exit 1; }
  fi
  echo "▶ Compilando (frontend + backend)…"
  if ! npm run build; then
    echo "✗ La compilación falló."
    restaurar
    echo "▶ Recompilando la versión anterior…"
    npm run build >/dev/null 2>&1 || true
    echo "  Nada cambió. La copia sigue en: $BK"
    exit 1
  fi
  echo "  ✓ Compilación correcta"
else
  echo "▶ (omitido) Compilación. Ejecuta luego:  cd \"$PROY\" && npm run build"
fi

# ---------------------------------------------------------------- reiniciar
if [ "$SIN_REINICIO" -eq 0 ] && [ "$SIN_BUILD" -eq 0 ]; then
  REINICIADO=0
  if command -v pm2 >/dev/null 2>&1; then
    NOMBRE="$(pm2 jlist 2>/dev/null | node -e '
      let d = ""; process.stdin.on("data", c => d += c).on("end", () => {
        try {
          const root = process.argv[1];
          const p = JSON.parse(d).find(x => x.pm2_env && [x.pm2_env.pm_cwd, x.pm2_env.pm_exec_path].some(v => v && v.startsWith(root)));
          if (p) console.log(p.name);
        } catch (e) {}
      });' "$PROY" 2>/dev/null)"
    if [ -n "$NOMBRE" ]; then
      echo "▶ Reiniciando con pm2: $NOMBRE"
      pm2 restart "$NOMBRE" && REINICIADO=1
    fi
  fi
  if [ "$REINICIADO" -eq 0 ]; then
    UNIDAD="$(systemctl list-units --type=service --all --no-legend 2>/dev/null | awk '{print $1}' | grep -iE 'galeria|brphotos|photos' | head -1 || true)"
    if [ -n "$UNIDAD" ]; then
      echo "▶ Reinicia el servicio con:  sudo systemctl restart $UNIDAD"
    else
      echo "▶ Reinicia el servidor para cargar los cambios (detén el actual y ejecuta: npm start)."
    fi
  fi
fi

echo
echo "✅ Listo. Abre la galería y recarga con Ctrl+Shift+R (en el celular, cierra y abre la pestaña)."
echo "   Las miniaturas pequeñas ('xs') se generan al verlas por primera vez."
echo "   Si algo no te gusta, tu versión anterior está en: $BK"
