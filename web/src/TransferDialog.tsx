import { useEffect, useState } from 'react';
import { api } from './api';
import { Icon } from './icons';
import type { Listing, Me } from './types';

interface Props {
  me: Me;
  startPath: string;
  paths: string[];
  label: string;
  /** rutas de carpetas que se mueven/copian (no se pueden pegar dentro de sí mismas) */
  folders: string[];
  onClose: () => void;
  onDone: (msg: string) => void | Promise<void>;
}

const parentOf = (p: string) => {
  const i = p.lastIndexOf('/');
  return i >= 0 ? p.slice(0, i) : p.slice(0, p.indexOf(':') + 1);
};

export default function TransferDialog({ me, startPath, paths, label, folders, onClose, onDone }: Props) {
  const canMove = me.perms.delete;
  const [mode, setMode] = useState<'move' | 'copy'>(canMove ? 'move' : 'copy');
  const [cur, setCur] = useState(startPath);
  const [data, setData] = useState<Listing | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    api
      .browse(cur)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [cur]);

  const insideSource = folders.some((f) => cur === f || cur.startsWith(f + '/'));
  const here = data?.path ?? cur;
  const sameFolder = mode === 'move' && paths.every((p) => parentOf(p) === here);
  const canHere = !!data && !data.isLibraryRoot && data.canWrite && !insideSource && !sameFolder;

  async function run() {
    if (!data) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.transfer(paths, data.path, mode);
      const verbo = mode === 'move' ? 'movido(s)' : 'copiado(s)';
      await onDone(r.done ? `${r.done} ${verbo}${r.skipped ? ` · ${r.skipped} omitido(s)` : ''}` : 'No se pudo procesar nada (revisa permisos o destino)');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const seg = (on: boolean) => `flex-1 rounded-md py-1.5 text-xs font-semibold ${on ? 'bg-accent text-white' : 'text-muted hover:text-fg'} disabled:opacity-40`;
  const title = data?.path ? (data.path.includes(':') ? data.path.replace(':', ' / ') : data.path) : 'Inicio';

  return (
    <div className="modal-back" role="dialog" aria-label="Mover o copiar">
      <div className="modal flex max-h-[85vh] max-w-md flex-col">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold">Mover o copiar</h3>
            <p className="truncate text-xs text-muted">{label}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-surface2 hover:text-fg" aria-label="Cerrar">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 flex rounded-lg border border-line bg-surface p-0.5">
          <button className={seg(mode === 'move')} disabled={!canMove} onClick={() => setMode('move')} title={canMove ? '' : 'No tienes permiso para eliminar/mover'}>
            Mover
          </button>
          <button className={seg(mode === 'copy')} onClick={() => setMode('copy')}>
            Copiar
          </button>
        </div>

        <div className="mb-2 flex items-center gap-2">
          <button
            className="btn-flat h-8 shrink-0 px-2 disabled:opacity-30"
            disabled={!data || data.parent == null || cur === ''}
            onClick={() => data?.parent != null && setCur(data.parent)}
            aria-label="Subir un nivel"
          >
            <Icon name="left" className="h-4 w-4" />
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">Destino: {title}</p>
        </div>

        <div className="min-h-[10rem] flex-1 overflow-y-auto rounded-lg border border-line bg-surface p-1">
          {!data && !error && <p className="p-4 text-center text-xs text-muted">Cargando…</p>}
          {data && data.folders.length === 0 && <p className="p-4 text-center text-xs text-muted">No hay subcarpetas aquí.</p>}
          {data?.folders.map((f) => {
            const blocked = folders.some((s) => f.path === s || f.path.startsWith(s + '/'));
            return (
              <button
                key={f.path}
                disabled={blocked}
                onClick={() => setCur(f.path)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-surface2 disabled:opacity-40"
              >
                <Icon name="folder" className="h-4 w-4 shrink-0 text-accent" />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <Icon name="right" className="h-4 w-4 shrink-0 text-muted" />
              </button>
            );
          })}
        </div>

        {data && !canHere && !error && (
          <p className="mt-2 text-xs text-muted">
            {data.isLibraryRoot || !data.canWrite
              ? 'Entra a una carpeta donde puedas guardar.'
              : insideSource
              ? 'No puedes poner una carpeta dentro de sí misma.'
              : 'Los elementos ya están en esta carpeta.'}
          </p>
        )}
        {error && <p className="mt-2 rounded-lg bg-rose-500/10 p-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost text-xs" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-solid text-xs" disabled={!canHere || busy} onClick={run}>
            {busy ? 'Procesando…' : mode === 'move' ? 'Mover aquí' : 'Copiar aquí'}
          </button>
        </div>
      </div>
    </div>
  );
}
