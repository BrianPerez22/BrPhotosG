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
