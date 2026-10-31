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
