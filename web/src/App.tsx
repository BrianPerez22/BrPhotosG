import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
import { Icon } from './icons';
import Login from './Login';
import Gallery from './Gallery';
import Admin from './Admin';
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
    const encoded = raw.slice(2); // quita "/f"
    // Preserva el separador ":" del prefijo de biblioteca al decodificar
    const decoded = encoded.split('/').filter(Boolean).map((seg, i) => {
      // El primer segmento puede ser "LibName:" → no decodificar los ":"
      if (i === 0 && seg.includes('%3A')) {
        const parts = seg.split('%3A');
        return parts.map(decodeURIComponent).join(':');
      }
      return decodeURIComponent(seg);
    }).join('/');
    return { admin: false, path: decoded };
  } catch { return { admin: false, path: '' }; }
}

const toHash = (p: string) => {
  if (!p) return '#/f/';
  // Codifica preservando el ":" del prefijo de biblioteca
  const parts = p.split('/');
  const encoded = parts.map((seg, i) => {
    if (i === 0 && seg.includes(':')) {
      // "LibName:" → codifica solo la parte después de ":"
      const colonIdx = seg.indexOf(':');
      return encodeURIComponent(seg.slice(0, colonIdx)) + ':' + encodeURIComponent(seg.slice(colonIdx + 1));
    }
    return encodeURIComponent(seg);
  }).join('/');
  return '#/f/' + encoded;
};

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [cur, setCur] = useState(''); const [next, setNext] = useState(''); const [msg, setMsg] = useState(''); const [ok, setOk] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try { await api.changePassword(cur, next); setOk(true); setMsg('Contraseña actualizada'); }
    catch (err) { setMsg((err as Error).message); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-label="Cambiar contraseña">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-ink-900">
        <h2 className="mb-4 text-lg font-semibold">Cambiar contraseña</h2>
        <input className="input mb-3" type="password" placeholder="Contraseña actual" value={cur} onChange={(e) => setCur(e.target.value)} required autoComplete="current-password" />
        <input className="input mb-3" type="password" placeholder="Nueva contraseña (mín. 4)" value={next} onChange={(e) => setNext(e.target.value)} required minLength={4} autoComplete="new-password" />
        {msg && <p role="status" className={`mb-3 text-sm ${ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{msg}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>{ok ? 'Cerrar' : 'Cancelar'}</button>{!ok && <button className="btn-solid">Guardar</button>}</div>
      </form>
    </div>
  );
}

export default function App() {
  const [me, setMe]       = useState<Me | null | undefined>(undefined);
  const [route, setRoute] = useState(parseHash);
  const [roots, setRoots] = useState<FolderEntry[]>([]);
  const [libs, setLibs]   = useState<string[]>([]);
  const [menu, setMenu]   = useState(false);
  const [pw, setPw]       = useState(false);

  const loadRoots = useCallback(() => {
    api.browse('').then((d) => {
      setRoots(d.folders);
      setLibs(d.libraries ?? []);
    }).catch(() => { setRoots([]); setLibs([]); });
  }, []);

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
    const h = () => { setRoute(parseHash()); setMenu(false); };
    const u = () => setMe(null);
    window.addEventListener('hashchange', h); window.addEventListener('unauthorized', u);
    return () => { window.removeEventListener('hashchange', h); window.removeEventListener('unauthorized', u); };
  }, []);
  useEffect(() => { if (me) loadRoots(); }, [me, loadRoots]);

  const go = (p: string) => { location.hash = toHash(p); };
  const logout = async () => { await api.logout().catch(() => undefined); setMe(null); setRoots([]); setLibs([]); location.hash = ''; };

  if (me === undefined) return <div className="flex h-full items-center justify-center text-sm text-ink-500">Cargando…</div>;
  if (me === null) return <Login onLogin={setMe} />;

  const item   = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors';
  const active = 'bg-ink-300/50 font-medium dark:bg-ink-700/70';
  const idle   = 'hover:bg-ink-200/60 dark:hover:bg-ink-800';

  // Icono por tipo de biblioteca
  const libIconName = (name: string): 'photo' | 'play' | 'folder' =>
    name.toLowerCase().includes('video') ? 'play'
    : (name.toLowerCase().includes('foto') || name.toLowerCase().includes('imagen')) ? 'photo'
    : 'folder';

  // Detecta qué biblioteca está activa en la ruta actual
  const activeLibName = route.path.includes(':') ? route.path.split(':')[0] : null;

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label="Navegación">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white dark:bg-accent-dark dark:text-ink-950"><Icon name="photo" className="h-4 w-4" /></span>
        <span className="text-base font-semibold tracking-tight">BrPhotos</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        {/* Inicio / todas las bibliotecas */}
        <button
          className={`${item} ${!route.admin && route.path === '' ? active : idle}`}
          onClick={() => go('')}
        >
          <Icon name="photo" className="h-4 w-4" />
          {me.role === 'admin' ? 'Bibliotecas' : 'Mis carpetas'}
        </button>

        {/* Bibliotecas (admin) */}
        {me.role === 'admin' && libs.length > 0 && (
          <>
            <p className="mb-1 mt-4 px-2.5 text-xs text-ink-500">Bibliotecas</p>
            {libs.map((libName) => {
              const libPath = `${libName}:`;
              const on = !route.admin && (route.path === libPath || route.path.startsWith(`${libName}:`));
              return (
                <button key={libName} className={`${item} ${on ? active : idle}`} onClick={() => go(libPath)}>
                  <Icon name={libIconName(libName)} className="h-4 w-4 shrink-0 text-accent dark:text-accent-dark" />
                  <span className="truncate">{libName}</span>
                </button>
              );
            })}
          </>
        )}

        {/* Carpetas compartidas (usuario no-admin) */}
        {me.role !== 'admin' && roots.length > 0 && (
          <>
            <p className="mb-1 mt-4 px-2.5 text-xs text-ink-500">Compartidas contigo</p>
            {roots.map((r) => {
              // El path tiene formato "LibName:rel" — muestra solo la parte rel como nombre de carpeta
              const displayName = r.path.includes(':') ? r.path.split(':').slice(1).join(':') || r.name : r.name;
              const on = !route.admin && (route.path === r.path || route.path.startsWith(r.path + '/'));
              return (
                <button key={r.path} className={`${item} ${on ? active : idle}`} onClick={() => go(r.path)}>
                  <Icon name="folder" className="h-4 w-4 shrink-0 text-accent dark:text-accent-dark" />
                  <span className="truncate">{displayName || r.name}</span>
                </button>
              );
            })}
          </>
        )}

        {/* Gestión (admin) */}
        {me.role === 'admin' && (
          <>
            <p className="mb-1 mt-4 px-2.5 text-xs text-ink-500">Gestión</p>
            <button className={`${item} ${route.admin ? active : idle}`} onClick={() => { location.hash = '#/admin'; }}>
              <Icon name="users" className="h-4 w-4" />Usuarios y permisos
            </button>
          </>
        )}
      </div>
      <div className="border-t border-ink-200 p-2 dark:border-ink-800">
        <p className="truncate px-2.5 py-1 text-sm font-medium">{me.username}<span className="ml-1.5 text-xs font-normal text-ink-500">{me.role === 'admin' ? 'admin' : ''}</span></p>
        <button className={`${item} ${idle}`} onClick={() => setPw(true)}><Icon name="key" className="h-4 w-4" />Cambiar contraseña</button>
        <button className={`${item} ${idle}`} onClick={logout}><Icon name="logout" className="h-4 w-4" />Cerrar sesión</button>
      </div>
    </nav>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden w-60 shrink-0 border-r border-ink-200 bg-ink-100/80 dark:border-ink-800 dark:bg-ink-900/80 md:block">{sidebar}</aside>
      {menu && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMenu(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 left-0 w-64 bg-ink-100 shadow-xl dark:bg-ink-900" onClick={(e) => e.stopPropagation()}>{sidebar}</aside>
        </div>
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        {route.admin && me.role === 'admin'
          ? (<><div className="flex items-center border-b border-ink-200 px-3 py-2 dark:border-ink-800 md:hidden"><button className="btn-ghost px-2" onClick={() => setMenu(true)} aria-label="Menú"><Icon name="menu" /></button></div><Admin me={me} onTreeChange={loadRoots} /></>)
          : <Gallery me={me} path={route.path} go={go} onTreeChange={loadRoots} openMenu={() => setMenu(true)} />}
      </main>
      {pw && <PasswordModal onClose={() => setPw(false)} />}
    </div>
  );
}
