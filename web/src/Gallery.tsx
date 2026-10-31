import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, fileUrl, fmtSize, thumbUrl, uploadFiles } from './api';
import { Icon } from './icons';
import Lightbox from './Lightbox';
import { playAudioPop } from './theme';
import type { FileEntry, FolderEntry, Listing, Me } from './types';

interface Props {
  me: Me;
  path: string;
  go: (p: string) => void;
  onTreeChange: () => void;
  openMenu: () => void;
}

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

function dayLabel(ms: number) {
  const d = new Date(ms);
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  const s = d.toLocaleDateString('es', opts);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Cover({ f }: { f: FolderEntry }) {
  const [bad, setBad] = useState(false);
  return f.cover && !bad ? (
    <img
      src={thumbUrl(f.cover)}
      alt=""
      loading="lazy"
      onError={() => setBad(true)}
      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-ink-100 text-ink-400 dark:bg-ink-800/60 dark:text-ink-500">
      <Icon name="folder" className="h-12 w-12 stroke-[1.5]" />
    </div>
  );
}

function Thumb({ f, className = '' }: { f: FileEntry; className?: string }) {
  const [bad, setBad] = useState(false);
  if (f.type === 'image' && !bad) {
    return (
      <img
        src={thumbUrl(f.path)}
        alt={f.name}
        loading="lazy"
        decoding="async"
        onError={() => setBad(true)}
        className={`h-full w-full object-cover select-none transition-transform duration-300 ${className}`}
      />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-ink-900 text-white/80 select-none">
      <Icon name={f.type === 'video' ? 'play' : 'photo'} className="h-8 w-8" />
    </div>
  );
}

const LIB_ICONS: Record<string, string> = {
  Fotos: 'camera',
  Imágenes: 'photo',
  Videos: 'play',
};
function libIcon(name: string): any {
  return LIB_ICONS[name] ?? 'folder';
}

function LibraryHome({ folders, go }: { folders: FolderEntry[]; go: (p: string) => void }) {
  return (
    <div className="px-6 pt-6">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold tracking-tight text-ink-900 dark:text-white">
          Bibliotecas Multimedia
        </h2>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          Selecciona una colección para explorar álbumes y fotografías
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {folders.map((f) => (
          <button
            key={f.path}
            onClick={() => {
              playAudioPop('click');
              go(f.path);
            }}
            className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/70 text-left shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-2xl hover:shadow-accent/20 dark:border-white/10 dark:bg-ink-900/60 dark:hover:border-accent"
          >
            <div className="aspect-[16/10] w-full overflow-hidden bg-ink-200 dark:bg-ink-800">
              {f.cover ? (
                <img
                  src={thumbUrl(f.cover, 'lg')}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-accent/20 to-purple-500/20">
                  <Icon name={libIcon(f.name)} className="h-16 w-16 text-accent" />
                </div>
              )}
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold text-ink-900 dark:text-white group-hover:text-accent transition-colors">
                  {f.name}
                </p>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-all">
                  <Icon name="right" className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                {[
                  f.count ? `${f.count} archivo${f.count > 1 ? 's' : ''}` : '',
                  f.subfolders ? `${f.subfolders} carpeta${f.subfolders > 1 ? 's' : ''}` : '',
                ].filter(Boolean).join(' · ') || 'Sin contenido'}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Gallery({ me, path, go, onTreeChange, openMenu }: Props) {
  const [data, setData] = useState<Listing | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<'grid' | 'list'>(() => (ls('g_view', 'grid') === 'list' ? 'list' : 'grid'));
  const [size, setSize] = useState(() => Number(ls('g_size', '190')) || 190);
  const [sort, setSort] = useState<'date' | 'name'>('date');
  const [searchQuery, setSearchQuery] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<number | null>(null);
  const [up, setUp] = useState<{ done: number; total: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const [toast, setToast] = useState('');
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ paths: string[]; label: string } | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number>();

  const flash = (m: string) => {
    setToast(m);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 4500);
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
    setOpen(null);
    setSearchQuery('');
    load();
  }, [load]);

  // Filtrado y ordenación
  const files = useMemo(() => {
    let f = [...(data?.files ?? [])];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      f = f.filter((item) => item.name.toLowerCase().includes(q));
    }
    if (sort === 'name') return f.sort((a, b) => collator.compare(a.name, b.name));
    return f.sort((a, b) => b.cdate - a.cdate);
  }, [data, sort, searchQuery]);

  // Agrupamiento por fecha real de captura
  const groups = useMemo(() => {
    if (sort !== 'date') return [{ label: '', items: files.map((f, i) => ({ f, i })) }];
    const out: { label: string; items: { f: FileEntry; i: number }[] }[] = [];
    files.forEach((f, i) => {
      const label = dayLabel(f.cdate);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push({ f, i });
      else out.push({ label, items: [{ f, i }] });
    });
    return out;
  }, [files, sort]);

  const canWrite = !!data?.canWrite;
  const canUpload = canWrite && me.perms.upload;
  const isAdmin = me.role === 'admin';
  const isLibraryHome = data?.isLibraryRoot || (data?.path === '' && isAdmin);

  function toggle(p: string) {
    playAudioPop('click');
    setSel((s) => {
      const n = new Set(s);
      n.has(p) ? n.delete(p) : n.add(p);
      return n;
    });
  }

  function pick(i: number) {
    if (sel.size) toggle(files[i].path);
    else {
      playAudioPop('click');
      setOpen(i);
    }
  }

  function selectAll() {
    playAudioPop('switch');
    if (sel.size === files.length) {
      setSel(new Set());
    } else {
      setSel(new Set(files.map((f) => f.path)));
    }
  }

  function selectGroup(items: { f: FileEntry; i: number }[]) {
    playAudioPop('switch');
    setSel((prev) => {
      const n = new Set(prev);
      const allSelected = items.every((x) => n.has(x.f.path));
      if (allSelected) {
        items.forEach((x) => n.delete(x.f.path));
      } else {
        items.forEach((x) => n.add(x.f.path));
      }
      return n;
    });
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
      flash(
        skipped
          ? `Subidos ${list.length - skipped} archivos. ${skipped} se omitieron por formato no soportado.`
          : `✨ Subidos exitosamente ${list.length} archivos con metadatos EXIF preservados`
      );
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
    playAudioPop('delete');
    try {
      const r = await api.remove(deleteConfirm.paths);
      setSel(new Set());
      setOpen(null);
      setDeleteConfirm(null);
      flash(r.deleted ? `Eliminado(s): ${r.deleted} elemento(s)` : 'No se eliminó nada');
      await load();
      onTreeChange();
    } catch (e) {
      flash((e as Error).message);
    }
  }

  function downloadSelected() {
    playAudioPop('click');
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
      {/* Barra de herramientas superior */}
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-ink-200/80 bg-white/70 px-4 py-2.5 backdrop-blur-xl dark:border-white/10 dark:bg-ink-950/70">
        {sel.size > 0 ? (
          /* Barra de acción en masa */
          <div className="flex w-full items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <button
                className="btn-ghost px-2"
                onClick={() => setSel(new Set())}
                aria-label="Cancelar selección"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
              <span className="text-sm font-bold text-accent">
                {sel.size} elemento{sel.size > 1 ? 's' : ''} seleccionado{sel.size > 1 ? 's' : ''}
              </span>
              <button
                onClick={selectAll}
                className="ml-2 text-xs font-semibold text-ink-500 hover:text-ink-900 dark:hover:text-white"
              >
                {sel.size === files.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </button>
            </div>
            <div className="flex items-center gap-2">
              {me.perms.download && (
                <button className="btn-glass" onClick={downloadSelected}>
                  <Icon name="download" className="h-4 w-4" />
                  <span>Descargar</span>
                </button>
              )}
              {me.perms.delete && (
                <button
                  className="btn-danger"
                  onClick={() => setDeleteConfirm({ paths: [...sel], label: `${sel.size} elemento(s)` })}
                >
                  <Icon name="trash" className="h-4 w-4" />
                  <span>Eliminar</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Barra de navegación regular */
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
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

              {/* Breadcrumbs de navegación */}
              <nav className="flex min-w-0 items-center gap-1.5 overflow-x-auto text-sm" aria-label="Ruta">
                <button
                  className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition-all ${
                    atHome
                      ? 'bg-accent/15 text-accent dark:bg-accent/20'
                      : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-ink-800 dark:hover:text-white'
                  }`}
                  onClick={() => go('')}
                >
                  {isAdmin ? 'Bibliotecas' : 'Mis carpetas'}
                </button>

                {activeLib && (
                  <span className="flex items-center gap-1.5">
                    <span className="text-ink-400">/</span>
                    <button
                      className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition-all ${
                        !data?.crumbs.length
                          ? 'bg-accent/15 text-accent dark:bg-accent/20'
                          : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-ink-800 dark:hover:text-white'
                      }`}
                      onClick={() => go(`${activeLib}:`)}
                    >
                      {activeLib}
                    </button>
                  </span>
                )}

                {data?.crumbs.map((c, i) => (
                  <span key={c.path} className="flex items-center gap-1.5">
                    <span className="text-ink-400">/</span>
                    <button
                      className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition-all ${
                        i === data.crumbs.length - 1
                          ? 'bg-accent/15 text-accent dark:bg-accent/20'
                          : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-ink-800 dark:hover:text-white'
                      }`}
                      onClick={() => go(c.path)}
                    >
                      {c.name}
                    </button>
                  </span>
                ))}
              </nav>
            </div>

            {/* Acciones del lado derecho */}
            {!isLibraryHome && (
              <div className="flex items-center gap-2">
                {/* Buscador en tiempo real */}
                <div className="relative hidden sm:block w-36 lg:w-48">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar foto…"
                    className="h-8 w-full rounded-xl border border-ink-200/80 bg-white/60 pl-8 pr-7 text-xs outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 dark:border-white/10 dark:bg-ink-900/60"
                  />
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400">
                    <Icon name="search" className="h-3.5 w-3.5" />
                  </span>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
                    >
                      <Icon name="x" className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Slider de tamaño (solo en cuadrícula) */}
                {view === 'grid' && (
                  <div className="hidden lg:flex items-center gap-2 px-2 text-ink-400">
                    <Icon name="slider" className="h-3.5 w-3.5" />
                    <input
                      type="range"
                      min={120}
                      max={320}
                      value={size}
                      onChange={(e) => {
                        setSize(+e.target.value);
                        lsSet('g_size', e.target.value);
                      }}
                      className="h-1.5 w-20 cursor-pointer rounded-lg bg-ink-200 accent-accent dark:bg-ink-800"
                      aria-label="Tamaño de miniaturas"
                      title="Ajustar tamaño de fotos"
                    />
                  </div>
                )}

                {/* Ordenador */}
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as 'date' | 'name')}
                  className="h-8 rounded-xl border border-ink-200/80 bg-white/60 px-2.5 text-xs font-medium text-ink-700 outline-none hover:border-accent dark:border-white/10 dark:bg-ink-900/60 dark:text-ink-200"
                  aria-label="Ordenar fotos"
                >
                  <option value="date">📅 Por fecha de captura</option>
                  <option value="name">🔤 Por nombre</option>
                </select>

                {/* Switcher Vista Cuadrícula / Lista */}
                <div className="flex rounded-xl border border-ink-200/80 bg-white/50 p-0.5 dark:border-white/10 dark:bg-ink-900/50">
                  <button
                    onClick={() => {
                      setView('grid');
                      lsSet('g_view', 'grid');
                    }}
                    className={`rounded-lg p-1.5 transition-all ${
                      view === 'grid'
                        ? 'bg-accent text-white shadow-sm'
                        : 'text-ink-500 hover:text-ink-900 dark:hover:text-white'
                    }`}
                    aria-label="Cuadrícula"
                    title="Vista de cuadrícula"
                  >
                    <Icon name="grid" className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setView('list');
                      lsSet('g_view', 'list');
                    }}
                    className={`rounded-lg p-1.5 transition-all ${
                      view === 'list'
                        ? 'bg-accent text-white shadow-sm'
                        : 'text-ink-500 hover:text-ink-900 dark:hover:text-white'
                    }`}
                    aria-label="Lista detallada"
                    title="Vista de lista"
                  >
                    <Icon name="list" className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Botón Nueva Carpeta */}
                {canWrite && (
                  <button className="btn-glass text-xs h-8 px-2.5" onClick={() => setNewFolderOpen(true)}>
                    <Icon name="plus" className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Carpeta</span>
                  </button>
                )}

                {/* Botón Subir Fotos */}
                {canUpload && (
                  <button
                    className="btn-solid text-xs h-8 px-3"
                    onClick={() => fileInput.current?.click()}
                  >
                    <Icon name="upload" className="h-3.5 w-3.5" />
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

      {/* Contenido Principal */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-28 pt-4">
        {error && (
          <div
            role="alert"
            className="mx-6 mb-4 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-50/80 p-4 text-sm text-rose-700 backdrop-blur-md dark:bg-rose-950/40 dark:text-rose-300"
          >
            <Icon name="info" className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!data && !error && (
          <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-ink-400">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <p className="text-xs font-medium">Cargando fotografías…</p>
            </div>
          </div>
        )}

        {/* Pantalla de inicio de bibliotecas */}
        {data && isLibraryHome && <LibraryHome folders={data.folders} go={go} />}

        {/* Exploración de archivos y carpetas */}
        {data && !isLibraryHome && (
          <div className="px-6">
            {/* Subcarpetas */}
            {data.folders.length > 0 && (
              <section className="mb-8" aria-label="Carpetas">
                <div className="mb-3 flex items-center gap-2">
                  <Icon name="folder" className="h-4 w-4 text-accent" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-400">
                    Carpetas ({data.folders.length})
                  </h3>
                </div>

                <div
                  className="grid gap-4"
                  style={{
                    gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(size, 160)}px, 1fr))`,
                  }}
                >
                  {data.folders.map((f) => (
                    <div
                      key={f.path}
                      className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/70 p-2 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-xl hover:shadow-accent/15 dark:border-white/10 dark:bg-ink-900/60"
                    >
                      <button onClick={() => go(f.path)} className="block w-full text-left">
                        <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-ink-100 dark:bg-ink-800">
                          <Cover f={f} />
                        </div>
                        <div className="p-2">
                          <p className="truncate text-sm font-bold text-ink-900 dark:text-white group-hover:text-accent transition-colors">
                            {f.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-ink-500">
                            {[
                              f.count ? `${f.count} archivo${f.count > 1 ? 's' : ''}` : '',
                              f.subfolders ? `${f.subfolders} carpeta${f.subfolders > 1 ? 's' : ''}` : '',
                            ]
                              .filter(Boolean)
                              .join(' · ') || 'Vacía'}
                          </p>
                        </div>
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() =>
                            setDeleteConfirm({
                              paths: [f.path],
                              label: `la carpeta «${f.name}» con todo su contenido`,
                            })
                          }
                          aria-label={`Eliminar carpeta ${f.name}`}
                          className="absolute right-3 top-3 hidden rounded-full bg-black/60 p-2 text-white/90 backdrop-blur-md hover:bg-rose-600 group-hover:block transition-all shadow-md"
                        >
                          <Icon name="trash" className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Galería de fotos en Cuadrícula moderna con línea de tiempo */}
            {files.length > 0 && view === 'grid' && (
              <div className="space-y-8">
                {groups.map((g) => (
                  <section key={g.label || 'all'}>
                    {/* Header de fecha pegajoso (Sticky) */}
                    {g.label && (
                      <div className="sticky top-14 z-20 mb-3 flex items-center justify-between rounded-2xl border border-white/60 bg-white/75 px-4 py-2 backdrop-blur-xl dark:border-white/10 dark:bg-ink-950/75 shadow-sm">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-accent/15 text-accent">
                            <Icon name="calendar" className="h-3.5 w-3.5" />
                          </span>
                          <h4 className="text-xs font-bold text-ink-900 dark:text-white">
                            {g.label}
                          </h4>
                          <span className="rounded-full bg-ink-200/60 px-2 py-0.5 text-[10px] font-semibold text-ink-600 dark:bg-ink-800 dark:text-ink-400">
                            {g.items.length} fotos
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => selectGroup(g.items)}
                          className="text-[11px] font-semibold text-accent hover:underline"
                        >
                          {g.items.every((x) => sel.has(x.f.path)) ? 'Deseleccionar día' : 'Seleccionar día'}
                        </button>
                      </div>
                    )}

                    {/* Malla de fotos */}
                    <div
                      className="grid gap-2.5"
                      style={{
                        gridTemplateColumns: `repeat(auto-fill, minmax(${size}px, 1fr))`,
                      }}
                    >
                      {g.items.map(({ f, i }) => {
                        const on = sel.has(f.path);
                        const isVideo = f.type === 'video';
                        const ext = f.name.split('.').pop()?.toUpperCase() || 'IMG';

                        return (
                          <div
                            key={f.path}
                            onClick={() => pick(i)}
                            className={`group relative aspect-square cursor-pointer overflow-hidden rounded-2xl bg-ink-200 shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-accent/20 hover:scale-[1.02] dark:bg-ink-800 ${
                              on
                                ? 'scale-[0.93] ring-4 ring-accent shadow-2xl rounded-3xl'
                                : 'hover:ring-2 hover:ring-accent/70'
                            }`}
                          >
                            <Thumb f={f} className="group-hover:scale-105" />

                            {/* Badge de tipo de archivo */}
                            <span className="absolute top-2 right-2 rounded-lg bg-black/50 px-1.5 py-0.5 text-[9px] font-bold text-white/90 backdrop-blur-md">
                              {ext}
                            </span>

                            {/* Icono de vídeo */}
                            {isVideo && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-md group-hover:scale-110 group-hover:bg-accent transition-all">
                                  <Icon name="play" className="h-5 w-5 fill-current" />
                                </span>
                              </div>
                            )}

                            {/* Checkbox de selección animado */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggle(f.path);
                              }}
                              aria-label={on ? 'Quitar de la selección' : 'Seleccionar'}
                              aria-pressed={on}
                              className={`absolute left-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white/90 transition-all ${
                                on
                                  ? 'bg-accent text-white scale-110 shadow-md'
                                  : 'bg-black/30 opacity-0 group-hover:opacity-100'
                              } ${sel.size ? 'opacity-100' : ''}`}
                            >
                              {on && <Icon name="check" className="h-3.5 w-3.5 stroke-[3]" />}
                            </button>

                            {/* Barra degradada inferior al pasar el cursor */}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <p className="truncate text-[11px] font-semibold text-white drop-shadow-sm">
                                {f.name}
                              </p>
                              <p className="text-[10px] text-white/70">
                                {new Date(f.cdate).toLocaleTimeString('es', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {/* Vista de Lista Detallada */}
            {files.length > 0 && view === 'list' && (
              <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/70 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-ink-900/60">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-ink-200/80 bg-ink-50/70 text-[11px] font-bold uppercase tracking-wider text-ink-500 dark:border-white/10 dark:bg-ink-900/70">
                    <tr>
                      <th className="w-10 px-4 py-3" />
                      <th className="py-3 font-semibold">Archivo</th>
                      <th className="hidden py-3 font-semibold sm:table-cell">Fecha de captura (EXIF)</th>
                      <th className="hidden py-3 font-semibold md:table-cell">Tipo</th>
                      <th className="hidden py-3 text-right font-semibold sm:table-cell pr-6">Tamaño</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-white/5">
                    {files.map((f, i) => (
                      <tr
                        key={f.path}
                        onClick={() => pick(i)}
                        className={`cursor-pointer transition-colors hover:bg-accent/5 ${
                          sel.has(f.path) ? 'bg-accent/10 dark:bg-accent/20' : ''
                        }`}
                      >
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={sel.has(f.path)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggle(f.path)}
                            className="h-4 w-4 rounded accent-accent cursor-pointer"
                          />
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl shadow-sm">
                              <Thumb f={f} />
                            </div>
                            <span className="truncate font-semibold text-ink-900 dark:text-white">
                              {f.name}
                            </span>
                          </div>
                        </td>
                        <td className="hidden py-2 text-xs text-ink-600 dark:text-ink-300 sm:table-cell">
                          {new Date(f.cdate).toLocaleString('es', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="hidden py-2 text-xs uppercase text-ink-500 md:table-cell">
                          <span className="rounded-lg bg-ink-200/60 px-2 py-0.5 text-[10px] font-bold dark:bg-ink-800">
                            {f.name.split('.').pop()}
                          </span>
                        </td>
                        <td className="hidden py-2 text-right text-xs text-ink-500 sm:table-cell pr-6 font-mono">
                          {fmtSize(f.size)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Estado Vacío */}
            {files.length === 0 && data.folders.length === 0 && (
              <div className="my-16 flex flex-col items-center justify-center rounded-3xl border border-dashed border-ink-300 bg-white/40 p-12 text-center backdrop-blur-md dark:border-ink-800 dark:bg-ink-900/30">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <Icon name="photo" className="h-8 w-8" />
                </div>
                <h4 className="text-lg font-bold text-ink-900 dark:text-white">
                  {atHome && !isAdmin ? 'Aún no tienes álbumes asignados' : 'Esta carpeta está vacía'}
                </h4>
                <p className="mt-1 max-w-sm text-sm text-ink-500">
                  {canUpload
                    ? 'Arrastra fotos directamente a esta ventana o pulsa «Subir» para añadir recuerdos con sus metadatos reales.'
                    : atHome && !isAdmin
                    ? 'Comunícate con el administrador para que te otorgue permisos a colecciones fotográficas.'
                    : 'No hay elementos para mostrar.'}
                </p>
                {canUpload && (
                  <button
                    onClick={() => fileInput.current?.click()}
                    className="btn-solid mt-4"
                  >
                    <Icon name="upload" className="h-4 w-4" />
                    <span>Subir fotos ahora</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Overlay holográfico al arrastrar archivos */}
      {drag && (
        <div className="pointer-events-none fixed inset-4 z-50 flex flex-col items-center justify-center rounded-3xl border-4 border-dashed border-accent bg-accent/20 backdrop-blur-xl animate-pulse-glow">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-accent text-white shadow-2xl">
            <Icon name="upload" className="h-10 w-10 animate-bounce" />
          </div>
          <p className="mt-4 text-2xl font-black text-ink-900 dark:text-white">
            ¡Suelta las fotos aquí!
          </p>
          <p className="mt-1 text-sm font-medium text-accent">
            Se leerán y preservarán automáticamente los metadatos de captura EXIF
          </p>
        </div>
      )}

      {/* Toast y Barra de Progreso de Subida */}
      {(up || toast) && (
        <div
          className="fixed bottom-6 left-1/2 z-50 w-[min(92%,26rem)] -translate-x-1/2 rounded-2xl border border-white/20 bg-ink-950/90 p-4 text-white shadow-2xl backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-4 duration-300"
          role="status"
        >
          {up ? (
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-2">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Subiendo fotografías…
                </span>
                <span className="font-mono text-accent">
                  {Math.round((up.done / up.total) * 100)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-accent to-pink-500 transition-all duration-200"
                  style={{ width: `${(up.done / up.total) * 100}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-white/60">
                {fmtSize(up.done)} de {fmtSize(up.total)}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-accent text-white">
                ✨
              </span>
              <span className="flex-1 text-xs font-medium">{toast}</span>
              <button
                onClick={() => setToast('')}
                className="rounded-full p-1 text-white/60 hover:text-white"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal para Crear Carpeta */}
      {newFolderOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
          role="dialog"
        >
          <form
            onSubmit={submitNewFolder}
            className="w-full max-w-sm rounded-3xl border border-white/80 bg-white/90 p-6 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-ink-900/90 animate-in fade-in zoom-in-95"
          >
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 text-accent">
                <Icon name="folder" className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-ink-900 dark:text-white">Nueva Carpeta</h3>
                <p className="text-xs text-ink-500">Organiza tus fotos en un nuevo álbum</p>
              </div>
            </div>

            <input
              type="text"
              className="input mb-4"
              placeholder="Nombre del álbum (ej: Vacaciones 2024)"
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
                Crear carpeta
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal para Confirmar Eliminación */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
          role="dialog"
        >
          <div className="w-full max-w-sm rounded-3xl border border-rose-500/20 bg-white/90 p-6 shadow-2xl backdrop-blur-2xl dark:border-rose-500/20 dark:bg-ink-900/90 animate-in fade-in zoom-in-95">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-500">
                <Icon name="trash" className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-ink-900 dark:text-white">¿Mover a la papelera?</h3>
                <p className="text-xs text-ink-500">Se eliminará {deleteConfirm.label}</p>
              </div>
            </div>

            <p className="mb-5 text-xs text-ink-600 dark:text-ink-400">
              Los archivos se moverán a la papelera de la biblioteca en el servidor y podrán ser recuperados si es necesario.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeDelete}
                className="btn bg-rose-600 text-white hover:bg-rose-700 text-xs shadow-md shadow-rose-600/30"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Visor de pantalla completa */}
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
