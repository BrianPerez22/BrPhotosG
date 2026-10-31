import { useEffect, useRef, useState } from 'react';
import { fileUrl, fmtSize, isGif, thumbUrl } from './api';
import { Icon } from './icons';
import { playAudioPop } from './theme';
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

export default function Lightbox({
  items,
  index,
  setIndex,
  onClose,
  canDownload,
  canDelete,
  onDelete,
}: Props) {
  const f = items[index];
  const touch = useRef<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(false);
  const filmstripRef = useRef<HTMLDivElement>(null);

  const prev = () => {
    if (index > 0) {
      playAudioPop('switch');
      setIndex(index - 1);
      setZoom(false);
    }
  };
  const next = () => {
    if (index < items.length - 1) {
      playAudioPop('switch');
      setIndex(index + 1);
      setZoom(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Atajos de teclado
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

  // Precarga de fotos vecinas
  useEffect(() => {
    for (const n of [items[index + 1], items[index - 1]]) {
      if (n && n.type === 'image') new Image().src = src(n);
    }
  }, [index, items]);

  // Centrar miniatura activa en el filmstrip
  useEffect(() => {
    if (!filmstripRef.current) return;
    const activeEl = filmstripRef.current.children[index] as HTMLElement | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [index]);

  if (!f) return null;

  const dateStr = new Date(f.cdate).toLocaleString('es', {
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white backdrop-blur-3xl select-none"
      role="dialog"
      aria-label={f.name}
      onTouchStart={(e) => {
        touch.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 60) (dx > 0 ? prev : next)();
        touch.current = null;
      }}
    >
      {/* Resplandor ambiental de fondo que toma los colores de la foto */}
      {f.type === 'image' && (
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-30 blur-3xl scale-125 transition-all duration-700"
          style={{
            backgroundImage: `url(${thumbUrl(f.path, 'sm')})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}

      {/* Barra superior con controles estilizados */}
      <div className="flex h-16 items-center justify-between gap-4 px-4 py-2 border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="flex items-center gap-3 min-w-0">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white/90 hover:bg-white/20 hover:scale-105 active:scale-95 transition-all"
            onClick={onClose}
            aria-label="Cerrar visor"
            title="Cerrar (Esc)"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-white/95">{f.name}</p>
            <p className="text-xs text-white/60">
              {new Date(f.cdate).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })} · {index + 1} de {items.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Botón Info / Metadatos */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            aria-label="Información de la foto"
            title="Información y Metadatos (I)"
            className={`flex h-10 w-10 items-center justify-center rounded-2xl transition-all ${
              showInfo ? 'bg-accent text-white shadow-lg shadow-accent/40' : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
            }`}
          >
            <Icon name="info" className="h-5 w-5" />
          </button>

          {/* Botón Pantalla Completa */}
          <button
            onClick={toggleFullscreen}
            aria-label="Pantalla completa"
            title="Pantalla completa (F)"
            className="hidden sm:flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all"
          >
            <Icon name={isFullscreen ? 'minimize' : 'maximize'} className="h-5 w-5" />
          </button>

          {/* Botón Descargar */}
          {canDownload && (
            <a
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all"
              href={fileUrl(f.path, true)}
              aria-label="Descargar archivo"
              title="Descargar archivo original"
            >
              <Icon name="download" className="h-5 w-5" />
            </a>
          )}

          {/* Botón Eliminar */}
          {canDelete && (
            <button
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-300 hover:bg-rose-500/40 hover:text-rose-100 transition-all"
              onClick={() => onDelete(f)}
              aria-label="Eliminar foto"
              title="Eliminar foto"
            >
              <Icon name="trash" className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Contenedor principal de visualización */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-2"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        {/* Flecha Anterior */}
        {index > 0 && (
          <button
            className="absolute left-4 z-20 flex h-12 w-12 items-center justify-center rounded-2xl bg-black/50 text-white/90 backdrop-blur-xl border border-white/10 hover:bg-white/20 hover:scale-110 active:scale-95 transition-all shadow-xl"
            onClick={prev}
            aria-label="Foto anterior"
            title="Anterior (Flecha izquierda)"
          >
            <Icon name="left" className="h-6 w-6" />
          </button>
        )}

        {/* Elemento Multimedia Central */}
        <div className="relative flex max-h-full max-w-full items-center justify-center overflow-hidden">
          {f.type === 'video' ? (
            <video
              key={f.path}
              src={fileUrl(f.path)}
              controls
              autoPlay
              className="max-h-[75vh] max-w-full rounded-2xl shadow-2xl"
            />
          ) : (
            <img
              key={f.path}
              src={src(f)}
              alt={f.name}
              onClick={() => setZoom(!zoom)}
              className={`max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl transition-all duration-300 select-none ${
                zoom ? 'scale-125 cursor-zoom-out' : 'cursor-zoom-in'
              }`}
            />
          )}
        </div>

        {/* Flecha Siguiente */}
        {index < items.length - 1 && (
          <button
            className="absolute right-4 z-20 flex h-12 w-12 items-center justify-center rounded-2xl bg-black/50 text-white/90 backdrop-blur-xl border border-white/10 hover:bg-white/20 hover:scale-110 active:scale-95 transition-all shadow-xl"
            onClick={next}
            aria-label="Foto siguiente"
            title="Siguiente (Flecha derecha)"
          >
            <Icon name="right" className="h-6 w-6" />
          </button>
        )}

        {/* Panel emergente de Metadatos EXIF */}
        {showInfo && (
          <div className="absolute right-4 top-4 z-30 w-80 rounded-3xl border border-white/10 bg-black/80 p-5 shadow-2xl backdrop-blur-2xl animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Icon name="camera" className="h-5 w-5 text-accent" />
                <h4 className="text-sm font-bold text-white">Detalles de captura</h4>
              </div>
              <button
                onClick={() => setShowInfo(false)}
                className="rounded-full p-1 text-white/60 hover:text-white"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <p className="font-semibold text-white/50 uppercase tracking-wider text-[10px]">Nombre</p>
                <p className="mt-0.5 font-medium text-white break-all">{f.name}</p>
              </div>

              <div>
                <p className="font-semibold text-white/50 uppercase tracking-wider text-[10px]">Fecha real de captura</p>
                <p className="mt-0.5 font-medium text-accent font-mono">{dateStr}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="font-semibold text-white/50 uppercase tracking-wider text-[10px]">Tamaño</p>
                  <p className="mt-0.5 font-medium text-white">{fmtSize(f.size)}</p>
                </div>
                <div>
                  <p className="font-semibold text-white/50 uppercase tracking-wider text-[10px]">Tipo</p>
                  <p className="mt-0.5 font-medium text-white uppercase">{f.type === 'video' ? 'Vídeo MP4' : f.name.split('.').pop()}</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-white/50 uppercase tracking-wider text-[10px]">Ruta en biblioteca</p>
                <p className="mt-0.5 font-mono text-[11px] text-white/70 break-all bg-white/5 p-2 rounded-xl border border-white/5">
                  {f.path}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filmstrip (carrusel de miniaturas inferior) */}
      <div className="h-20 shrink-0 border-t border-white/10 bg-black/60 px-4 py-2.5 backdrop-blur-xl">
        <div
          ref={filmstripRef}
          className="flex h-full items-center gap-2 overflow-x-auto overflow-y-hidden scrollbar-none py-1"
        >
          {items.map((it, i) => {
            const isCur = i === index;
            return (
              <button
                key={it.path}
                onClick={() => {
                  playAudioPop('click');
                  setIndex(i);
                  setZoom(false);
                }}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-200 hover:scale-105 ${
                  isCur ? 'border-accent ring-2 ring-accent/50 scale-105 shadow-lg' : 'border-white/10 opacity-60 hover:opacity-100'
                }`}
              >
                {it.type === 'image' ? (
                  <img
                    src={thumbUrl(it.path, 'sm')}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-ink-900 text-white/80">
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
