import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, fileUrl, fmtSize, thumbUrl, uploadFiles } from './api';
import { Icon } from './icons';
import Lightbox from './Lightbox';
import type { FileEntry, FolderEntry, Listing, Me } from './types';

interface Props { me: Me; path: string; go: (p: string) => void; onTreeChange: () => void; openMenu: () => void }

const ls    = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignorar */ } };
const collator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

function dayLabel(ms: number) {
  const d = new Date(ms), now = new Date();
  const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  const s = d.toLocaleDateString('es', opts);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Cover({ f }: { f: FolderEntry }) {
  const [bad, setBad] = useState(false);
  return f.cover && !bad
    ? <img src={thumbUrl(f.cover)} alt="" loading="lazy" onError={() => setBad(true)} className="h-full w-full object-cover" />
    : <div className="flex h-full w-full items-center justify-center text-ink-400"><Icon name="folder" className="h-12 w-12" /></div>;
}

function Thumb({ f, className = '' }: { f: FileEntry; className?: string }) {
  const [bad, setBad] = useState(false);
  if (f.type === 'image' && !bad)
    return <img src={thumbUrl(f.path)} alt={f.name} loading="lazy" decoding="async" onError={() => setBad(true)} className={`h-full w-full object-cover ${className}`} />;
  return <div className="flex h-full w-full items-center justify-center bg-ink-800 text-white/80"><Icon name={f.type === 'video' ? 'play' : 'photo'} className="h-8 w-8" /></div>;
}

// Iconos para las bibliotecas
const LIB_ICONS: Record<string, string> = {
  Fotos: 'photo',
  Imágenes: 'photo',
  Videos: 'play',
};
function libIcon(name: string): string {
  return LIB_ICONS[name] ?? 'folder';
}

// Pantalla de selección de biblioteca (raíz global para admin)
function LibraryHome({ folders, go }: { folders: FolderEntry[]; go: (p: string) => void }) {
  return (
    <div className="px-6 pt-8">
      <h2 className="mb-6 text-2xl font-semibold tracking-tight">Bibliotecas</h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {folders.map((f) => (
          <button
            key={f.path}
            onClick={() => go(f.path)}
            className="group flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-ink-50 text-left transition hover:border-accent hover:shadow-md dark:border-ink-800 dark:bg-ink-900 dark:hover:border-accent-dark"
          >
            <div className="aspect-video w-full overflow-hidden bg-ink-200 dark:bg-ink-800">
              {f.cover
                ? <img src={thumbUrl(f.cover)} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                : <div className="flex h-full w-full items-center justify-center">
                    <Icon name={libIcon(f.name) as any} className="h-14 w-14 text-ink-400" />
                  </div>
              }
            </div>
            <div className="px-4 py-3">
              <p className="text-base font-semibold">{f.name}</p>
              <p className="mt-0.5 text-sm text-ink-500">
                {[
                  f.count ? `${f.count} archivo${f.count > 1 ? 's' : ''}` : '',
                  f.subfolders ? `${f.subfolders} carpeta${f.subfolders > 1 ? 's' : ''}` : '',
                ].filter(Boolean).join(' · ') || 'Vacía'}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Gallery({ me, path, go, onTreeChange, openMenu }: Props) {
  const [data, setData]   = useState<Listing | null>(null);
  const [error, setError] = useState('');
  const [view, setView]   = useState<'grid' | 'list'>(() => (ls('g_view', 'grid') === 'list' ? 'list' : 'grid'));
  const [size, setSize]   = useState(() => Number(ls('g_size', '190')) || 190);
  const [sort, setSort]   = useState<'date' | 'name'>('date');
  const [sel, setSel]     = useState<Set<string>>(new Set());
  const [open, setOpen]   = useState<number | null>(null);
  const [up, setUp]       = useState<{ done: number; total: number } | null>(null);
  const [drag, setDrag]   = useState(false);
  const [toast, setToast] = useState('');
  const fileInput   = useRef<HTMLInputElement>(null);
  const toastTimer  = useRef<number>();

  const flash = (m: string) => { setToast(m); window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(''), 4000); };

  const load = useCallback(async () => {
    try { setError(''); setData(await api.browse(path)); }
    catch (e) { setError((e as Error).message); }
  }, [path]);
  useEffect(() => { setData(null); setSel(new Set()); setOpen(null); load(); }, [load]);

  const files = useMemo(() => {
    const f = [...(data?.files ?? [])];
    if (sort === 'name') return f.sort((a, b) => collator.compare(a.name, b.name));
    // Ordenar por fecha de captura real (EXIF) descendente
    return f.sort((a, b) => b.cdate - a.cdate);
  }, [data, sort]);

  const groups = useMemo(() => {
    if (sort !== 'date') return [{ label: '', items: files.map((f, i) => ({ f, i })) }];
    const out: { label: string; items: { f: FileEntry; i: number }[] }[] = [];
    files.forEach((f, i) => {
      // Agrupa por fecha de captura real
      const label = dayLabel(f.cdate);
      const last  = out[out.length - 1];
      if (last && last.label === label) last.items.push({ f, i }); else out.push({ label, items: [{ f, i }] });
    });
    return out;
  }, [files, sort]);

  const canWrite  = !!data?.canWrite;
  const canUpload = canWrite && me.perms.upload;
  const isAdmin   = me.role === 'admin';

  // Pantalla raíz de admin (selección de biblioteca)
  const isLibraryHome = data?.isLibraryRoot || (data?.path === '' && isAdmin);

  function toggle(p: string) { setSel((s) => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; }); }
  function pick(i: number)   { sel.size ? toggle(files[i].path) : setOpen(i); }

  async function doUpload(list: File[]) {
    if (!list.length || !data) return;
    const total = list.reduce((a, f) => a + f.size, 0);
    const batches: File[][] = []; let cur: File[] = []; let curSize = 0;
    for (const f of list) {
      if (cur.length && curSize + f.size > 90 * 1024 * 1024) { batches.push(cur); cur = []; curSize = 0; }
      cur.push(f); curSize += f.size;
    }
    if (cur.length) batches.push(cur);
    let done = 0, skipped = 0;
    setUp({ done: 0, total });
    try {
      for (const b of batches) {
        const bs = b.reduce((a, f) => a + f.size, 0);
        const r = await uploadFiles(data.path, b, (l) => setUp({ done: done + Math.min(l, bs), total }));
        done += bs; skipped += r.skipped.length;
      }
      flash(skipped ? `Subidos ${list.length - skipped} archivos. ${skipped} no son fotos ni vídeos y se omitieron.` : `Subidos ${list.length} archivos`);
    } catch (e) { flash((e as Error).message); }
    finally { setUp(null); load(); onTreeChange(); }
  }

  async function newFolder() {
    const name = prompt('Nombre de la carpeta nueva');
    if (!name?.trim() || !data) return;
    try { await api.mkdir(data.path, name.trim()); await load(); onTreeChange(); }
    catch (e) { flash((e as Error).message); }
  }

  async function del(paths: string[], label: string) {
    if (!confirm(`¿Eliminar ${label}? Se moverá a la papelera del servidor.`)) return;
    try {
      const r = await api.remove(paths);
      setSel(new Set()); setOpen(null);
      flash(r.deleted ? `Eliminado: ${r.deleted}` : 'No se eliminó nada');
      await load(); onTreeChange();
    } catch (e) { flash((e as Error).message); }
  }

  function downloadSelected() {
    [...sel].forEach((p, i) => setTimeout(() => {
      const a = document.createElement('a'); a.href = fileUrl(p, true); a.download = ''; document.body.appendChild(a); a.click(); a.remove();
    }, i * 400));
  }

  const atHome = !data || data.path === '';

  // Título: "Fotos", "Imágenes:2024/Viaje", etc.
  function pageTitle() {
    if (isLibraryHome) return 'Bibliotecas';
    if (atHome) return me.role === 'admin' ? 'Inicio' : 'Mis carpetas';
    return data!.crumbs[data!.crumbs.length - 1]?.name ?? '';
  }
  const title = pageTitle();

  // Nombre de la biblioteca activa (extrae el prefijo "LibName:")
  const activeLib = data?.path.includes(':') ? data.path.split(':')[0] : null;

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col"
      onDragOver={(e) => { if (canUpload && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false); }}
      onDrop={(e) => { if (!canUpload) return; e.preventDefault(); setDrag(false); doUpload([...e.dataTransfer.files]); }}>

      {/* Barra superior */}
      <header className="flex min-h-14 flex-wrap items-center gap-x-2 gap-y-1 border-b border-ink-200 px-3 py-2 dark:border-ink-800">
        {sel.size > 0 ? (
          <>
            <button className="btn-ghost px-2" onClick={() => setSel(new Set())} aria-label="Cancelar selección"><Icon name="x" /></button>
            <span className="text-sm font-medium">{sel.size} seleccionada{sel.size > 1 ? 's' : ''}</span>
            <div className="flex-1" />
            {me.perms.download && <button className="btn-ghost" onClick={downloadSelected}><Icon name="download" className="h-4 w-4" />Descargar</button>}
            {me.perms.delete  && <button className="btn-danger" onClick={() => del([...sel], `${sel.size} elemento(s)`)}><Icon name="trash" className="h-4 w-4" />Eliminar</button>}
          </>
        ) : (
          <>
            <button className="btn-ghost px-2 md:hidden" onClick={openMenu} aria-label="Menú"><Icon name="menu" /></button>
            <button
              className="btn-ghost px-2 disabled:opacity-30"
              disabled={atHome || data?.parent == null}
              onClick={() => data?.parent != null && go(data.parent)}
              aria-label="Subir un nivel"
            ><Icon name="left" /></button>
            <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap text-sm" aria-label="Ruta">
              <button
                className={`rounded px-1.5 py-1 hover:bg-ink-100 dark:hover:bg-ink-800 ${atHome ? 'font-semibold' : 'text-ink-500'}`}
                onClick={() => go('')}
              >{isAdmin ? 'Bibliotecas' : 'Mis carpetas'}</button>
              {activeLib && (
                <span className="flex items-center gap-1">
                  <span className="text-ink-400">/</span>
                  <button
                    className={`rounded px-1.5 py-1 hover:bg-ink-100 dark:hover:bg-ink-800 ${!data?.crumbs.length ? 'font-semibold' : 'text-ink-500'}`}
                    onClick={() => go(`${activeLib}:`)}
                  >{activeLib}</button>
                </span>
              )}
              {data?.crumbs.map((c, i) => (
                <span key={c.path} className="flex items-center gap-1">
                  <span className="text-ink-400">/</span>
                  <button
                    className={`rounded px-1.5 py-1 hover:bg-ink-100 dark:hover:bg-ink-800 ${i === data.crumbs.length - 1 ? 'font-semibold' : 'text-ink-500'}`}
                    onClick={() => go(c.path)}
                  >{c.name}</button>
                </span>
              ))}
            </nav>
            {!isLibraryHome && <>
              {view === 'grid' && <input type="range" min={110} max={320} value={size} onChange={(e) => { setSize(+e.target.value); lsSet('g_size', e.target.value); }} className="hidden w-24 accent-accent sm:block" aria-label="Tamaño de miniaturas" />}
              <select value={sort} onChange={(e) => setSort(e.target.value as 'date' | 'name')} className="h-9 rounded-lg border border-ink-200 bg-transparent px-2 text-sm dark:border-ink-700" aria-label="Ordenar">
                <option value="date">Por fecha</option><option value="name">Por nombre</option>
              </select>
              <div className="flex rounded-lg border border-ink-200 p-0.5 dark:border-ink-700">
                {(['grid', 'list'] as const).map((v) => (
                  <button key={v} onClick={() => { setView(v); lsSet('g_view', v); }} aria-label={v === 'grid' ? 'Cuadrícula' : 'Lista'} aria-pressed={view === v}
                    className={`rounded-md p-1.5 ${view === v ? 'bg-ink-200 dark:bg-ink-700' : 'text-ink-500'}`}><Icon name={v} className="h-4 w-4" /></button>
                ))}
              </div>
              {canWrite  && <button className="btn-ghost" onClick={newFolder}><Icon name="plus" className="h-4 w-4" />Carpeta</button>}
              {canUpload && <button className="btn-solid" onClick={() => fileInput.current?.click()}><Icon name="upload" className="h-4 w-4" />Subir</button>}
              <input ref={fileInput} type="file" multiple accept="image/*,video/*" hidden onChange={(e) => { doUpload([...(e.target.files ?? [])]); e.target.value = ''; }} />
            </>}
          </>
        )}
      </header>

      {/* Contenido */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-24 pt-4">
        {error && <p role="alert" className="mx-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        {!data && !error && <p className="px-4 text-sm text-ink-500">Cargando…</p>}

        {/* Pantalla de selección de biblioteca */}
        {data && isLibraryHome && <LibraryHome folders={data.folders} go={go} />}

        {/* Pantalla normal de carpeta / archivos */}
        {data && !isLibraryHome && (
          <div className="px-4">
            <h2 className="mb-4 text-2xl font-semibold tracking-tight">{title}</h2>

            {data.folders.length > 0 && (
              <section className="mb-8" aria-label="Carpetas">
                {view === 'grid' ? (
                  <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(size, 150)}px, 1fr))` }}>
                    {data.folders.map((f) => (
                      <div key={f.path} className="group relative">
                        <button onClick={() => go(f.path)} className="block w-full text-left">
                          <div className="aspect-[4/3] overflow-hidden rounded-xl border border-ink-200 bg-ink-100 transition group-hover:border-accent dark:border-ink-800 dark:bg-ink-900"><Cover f={f} /></div>
                          <p className="mt-2 truncate text-sm font-medium">{f.name}</p>
                          <p className="text-xs text-ink-500">{[f.count ? `${f.count} archivo${f.count > 1 ? 's' : ''}` : '', f.subfolders ? `${f.subfolders} carpeta${f.subfolders > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ') || 'Vacía'}</p>
                        </button>
                        {isAdmin && <button onClick={() => del([f.path], `la carpeta «${f.name}» con todo su contenido`)} aria-label={`Eliminar carpeta ${f.name}`}
                          className="absolute right-2 top-2 hidden rounded-full bg-black/55 p-1.5 text-white hover:bg-red-600 group-hover:block"><Icon name="trash" className="h-4 w-4" /></button>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                    {data.folders.map((f) => (
                      <li key={f.path} className="flex items-center gap-3 py-2">
                        <button onClick={() => go(f.path)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          <Icon name="folder" className="h-6 w-6 shrink-0 text-accent dark:text-accent-dark" />
                          <span className="truncate text-sm font-medium">{f.name}</span>
                          <span className="ml-auto text-xs text-ink-500">{f.count} archivos</span>
                        </button>
                        {isAdmin && <button onClick={() => del([f.path], `la carpeta «${f.name}»`)} className="btn-danger px-2" aria-label="Eliminar carpeta"><Icon name="trash" className="h-4 w-4" /></button>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {files.length > 0 && view === 'grid' && groups.map((g) => (
              <section key={g.label || 'all'} className="mb-6">
                {g.label && <h3 className="mb-2 text-sm font-medium text-ink-600 dark:text-ink-300">{g.label}</h3>}
                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${size}px, 1fr))` }}>
                  {g.items.map(({ f, i }) => {
                    const on = sel.has(f.path);
                    return (
                      <div key={f.path} className={`group relative aspect-square cursor-pointer overflow-hidden bg-ink-200 transition-all dark:bg-ink-800 ${on ? 'scale-[0.9] rounded-xl' : 'rounded-md'}`} onClick={() => pick(i)}>
                        <Thumb f={f} className="transition-transform duration-300 group-hover:scale-[1.04]" />
                        {f.type === 'video' && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 p-1 text-white"><Icon name="play" className="h-3 w-3" /></span>}
                        <button onClick={(e) => { e.stopPropagation(); toggle(f.path); }} aria-label={on ? 'Quitar de la selección' : 'Seleccionar'} aria-pressed={on}
                          className={`absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-white transition ${on ? 'bg-accent opacity-100' : 'bg-black/30 opacity-0 group-hover:opacity-100 focus-visible:opacity-100'} ${sel.size ? 'opacity-100' : ''}`}>
                          {on && <Icon name="check" className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}

            {files.length > 0 && view === 'list' && (
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-ink-500"><tr><th className="w-8 py-2" /><th className="py-2 font-medium">Nombre</th><th className="hidden py-2 font-medium sm:table-cell">Fecha (captura)</th><th className="hidden py-2 text-right font-medium sm:table-cell">Tamaño</th></tr></thead>
                <tbody>
                  {files.map((f, i) => (
                    <tr key={f.path} onClick={() => pick(i)} className={`cursor-pointer border-t border-ink-100 hover:bg-ink-50 dark:border-ink-800 dark:hover:bg-ink-900 ${sel.has(f.path) ? 'bg-accent-soft/60 dark:bg-accent/20' : ''}`}>
                      <td className="py-1.5 pr-2"><input type="checkbox" checked={sel.has(f.path)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(f.path)} className="accent-accent" aria-label={`Seleccionar ${f.name}`} /></td>
                      <td className="py-1.5"><div className="flex items-center gap-3"><div className="h-10 w-10 shrink-0 overflow-hidden rounded"><Thumb f={f} /></div><span className="truncate">{f.name}</span></div></td>
                      <td className="hidden py-1.5 text-ink-500 sm:table-cell">
                        {new Date(f.cdate).toLocaleDateString('es')}
                        {f.cdate !== f.mtime && <span className="ml-1 text-xs opacity-50" title="Fecha de captura EXIF">📷</span>}
                      </td>
                      <td className="hidden py-1.5 text-right text-ink-500 sm:table-cell">{fmtSize(f.size)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {files.length === 0 && data.folders.length === 0 && (
              <div className="py-24 text-center text-ink-500">
                <Icon name="photo" className="mx-auto mb-3 h-10 w-10" />
                <p className="font-medium text-ink-700 dark:text-ink-200">{atHome && !isAdmin ? 'Aún no tienes carpetas compartidas' : 'Esta carpeta está vacía'}</p>
                <p className="mt-1 text-sm">{canUpload ? 'Arrastra fotos aquí o usa «Subir».' : atHome && !isAdmin ? 'Pide al administrador que te dé acceso a una carpeta.' : ''}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {drag && <div className="pointer-events-none absolute inset-2 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-accent/10 text-lg font-medium text-accent dark:border-accent-dark dark:text-accent-dark">Suelta las fotos para subirlas a «{title}»</div>}

      {(up || toast) && (
        <div className="absolute bottom-4 left-1/2 z-40 w-[min(92%,24rem)] -translate-x-1/2 rounded-xl bg-ink-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-ink-100 dark:text-ink-900" role="status">
          {up ? (<><p className="mb-2">Subiendo… {Math.round((up.done / up.total) * 100)}% ({fmtSize(up.done)} de {fmtSize(up.total)})</p><div className="h-1.5 overflow-hidden rounded bg-white/20 dark:bg-black/10"><div className="h-full bg-accent-dark dark:bg-accent" style={{ width: `${(up.done / up.total) * 100}%` }} /></div></>) : toast}
        </div>
      )}

      {open !== null && files[open] && (
        <Lightbox items={files} index={open} setIndex={setOpen} onClose={() => setOpen(null)} canDownload={me.perms.download} canDelete={me.perms.delete}
          onDelete={(f) => del([f.path], `«${f.name}»`)} />
      )}
    </div>
  );
}
