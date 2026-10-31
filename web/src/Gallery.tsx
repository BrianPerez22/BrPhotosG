import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, fileUrl, fmtSize, thumbUrl, uploadFiles } from './api';
import { Icon } from './icons';
import Lightbox from './Lightbox';
import TransferDialog from './TransferDialog';
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
  const [transfer, setTransfer] = useState<{ paths: string[]; label: string; folders: string[] } | null>(null);

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
              {me.perms.upload && (
                <button
                  className="btn-flat px-2.5"
                  disabled={!sel.size}
                  onClick={() => setTransfer({ paths: [...sel], label: `${sel.size} elemento(s)`, folders: [] })}
                >
                  <Icon name="move" className="h-4 w-4" />
                  <span className="hidden sm:inline">Mover / Copiar</span>
                </button>
              )}
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
                        <div className="absolute right-1.5 top-1.5 flex gap-1 md:hidden md:group-hover:flex">
                          <button
                            onClick={() => setTransfer({ paths: [f.path], label: `la carpeta «${f.name}»`, folders: [f.path] })}
                            aria-label={`Mover o copiar carpeta ${f.name}`}
                            className="rounded-full bg-black/70 p-1.5 text-white hover:bg-accent"
                          >
                            <Icon name="move" className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ paths: [f.path], label: `la carpeta «${f.name}» con todo su contenido` })}
                            aria-label={`Eliminar carpeta ${f.name}`}
                            className="rounded-full bg-black/70 p-1.5 text-white hover:bg-rose-600"
                          >
                            <Icon name="trash" className="h-3.5 w-3.5" />
                          </button>
                        </div>
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

      {transfer && (
        <TransferDialog
          me={me}
          startPath={data?.path ?? ''}
          paths={transfer.paths}
          label={transfer.label}
          folders={transfer.folders}
          onClose={() => setTransfer(null)}
          onDone={async (msg) => {
            setTransfer(null);
            endSelection();
            setOpen(null);
            flash(msg);
            await load();
            onTreeChange();
          }}
        />
      )}

      {open !== null && files[open] && (
        <Lightbox
          items={files}
          index={open}
          setIndex={setOpen}
          onClose={() => setOpen(null)}
          canDownload={me.perms.download}
          canDelete={me.perms.delete}
          canTransfer={me.perms.upload}
          onTransfer={(f) => setTransfer({ paths: [f.path], label: `«${f.name}»`, folders: [] })}
          onDelete={(f) => setDeleteConfirm({ paths: [f.path], label: `«${f.name}»` })}
        />
      )}
    </div>
  );
}
