import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
import { Icon } from './icons';
import Login from './Login';
import Gallery from './Gallery';
import Admin from './Admin';
import MagicOrb from './MagicOrb';
import AmbientAura from './AmbientAura';
import { playAudioPop } from './theme';
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
    playAudioPop('click');
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
      role="dialog"
      aria-label="Cambiar contraseña"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-3xl border border-white/80 bg-white/90 p-6 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-ink-900/90 animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/20 text-accent">
            <Icon name="key" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-ink-900 dark:text-white">Cambiar contraseña</h2>
            <p className="text-xs text-ink-500">Actualiza tus credenciales de acceso</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
              Contraseña actual
            </label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={cur}
              onChange={(e) => setCur(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
              Nueva contraseña
            </label>
            <input
              className="input"
              type="password"
              placeholder="Mínimo 4 caracteres"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              minLength={4}
              autoComplete="new-password"
            />
          </div>
        </div>

        {msg && (
          <p
            role="status"
            className={`mt-4 rounded-xl p-3 text-xs font-medium ${
              ok
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
            }`}
          >
            {msg}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost text-xs" onClick={onClose}>
            {ok ? 'Cerrar' : 'Cancelar'}
          </button>
          {!ok && (
            <button type="submit" disabled={busy} className="btn-solid text-xs">
              {busy ? 'Guardando…' : 'Guardar nueva contraseña'}
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
    playAudioPop('click');
    location.hash = toHash(p);
  };

  const logout = async () => {
    playAudioPop('switch');
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
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-accent border-t-transparent" />
          <p className="text-xs font-semibold text-ink-500">Iniciando galería…</p>
        </div>
      </div>
    );
  }

  if (me === null) return <Login onLogin={setMe} />;

  const itemBase =
    'flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-xs font-semibold transition-all duration-200';
  const itemActive =
    'bg-accent text-white shadow-md shadow-accent/25 scale-[1.02]';
  const itemIdle =
    'text-ink-600 hover:bg-white/80 hover:text-ink-950 dark:text-ink-300 dark:hover:bg-ink-800/80 dark:hover:text-white';

  const libIconName = (name: string): any =>
    name.toLowerCase().includes('video')
      ? 'play'
      : name.toLowerCase().includes('foto') || name.toLowerCase().includes('imagen')
      ? 'camera'
      : 'folder';

  const sidebar = (
    <nav className="flex h-full flex-col justify-between p-3 select-none" aria-label="Navegación">
      <div>
        {/* Header con Marca y Bolita Mágica */}
        <div className="mb-4 flex items-center justify-between px-2 pt-2 pb-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-accent to-pink-500 text-white shadow-lg shadow-accent/30">
              <Icon name="camera" className="h-5 w-5" />
            </span>
            <div>
              <span className="text-base font-black tracking-tight text-ink-900 dark:text-white">
                Galería
              </span>
              <span className="block text-[10px] font-bold text-accent uppercase tracking-wider">
                Pro
              </span>
            </div>
          </div>

          {/* La Bolita en el sidebar */}
          <div title="Personalizar tema, colores y efectos">
            <MagicOrb />
          </div>
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
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-ink-400">
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
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-ink-400">
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
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-ink-400">
              Administración
            </p>
            <button
              className={`${itemBase} ${route.admin ? itemActive : itemIdle}`}
              onClick={() => {
                playAudioPop('switch');
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
      <div className="mt-4 rounded-3xl border border-white/60 bg-white/70 p-3 shadow-md backdrop-blur-xl dark:border-white/10 dark:bg-ink-900/60">
        <div className="mb-2.5 flex items-center gap-2.5 px-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-accent/20 font-black text-accent text-sm uppercase">
            {me.username.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-ink-900 dark:text-white">
              {me.username}
            </p>
            <span className="inline-block rounded-md bg-accent/15 px-1.5 py-0.2 text-[9px] font-extrabold uppercase text-accent">
              {me.role === 'admin' ? 'Administrador' : 'Usuario'}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <button
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-ink-600 hover:bg-white hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800/80 dark:hover:text-white transition-colors"
            onClick={() => setPw(true)}
          >
            <Icon name="key" className="h-3.5 w-3.5" />
            <span>Cambiar contraseña</span>
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors"
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
    <div className="relative flex h-full overflow-hidden selection:bg-accent selection:text-white">
      {/* Fondo ambiental reactivo */}
      <AmbientAura />

      {/* Sidebar fijo en escritorio */}
      <aside className="hidden w-64 shrink-0 border-r border-ink-200/80 bg-white/40 backdrop-blur-2xl dark:border-white/10 dark:bg-ink-950/40 md:block">
        {sidebar}
      </aside>

      {/* Drawer responsivo para móvil */}
      {menu && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMenu(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />
          <aside
            className="absolute inset-y-0 left-0 w-72 border-r border-white/10 bg-white/90 shadow-2xl backdrop-blur-2xl dark:bg-ink-950/90 animate-in slide-in-from-left duration-300"
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
            <div className="flex items-center border-b border-ink-200/80 bg-white/60 px-4 py-2.5 backdrop-blur-xl dark:border-white/10 dark:bg-ink-950/60 md:hidden">
              <button
                className="btn-ghost px-2"
                onClick={() => setMenu(true)}
                aria-label="Abrir menú"
              >
                <Icon name="menu" className="h-5 w-5" />
              </button>
              <span className="ml-2 text-sm font-bold">Administración</span>
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
