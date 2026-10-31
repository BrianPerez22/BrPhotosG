import { useEffect, useRef } from 'react';
import { fileUrl, isGif, thumbUrl } from './api';
import { Icon } from './icons';
import type { FileEntry } from './types';

interface Props {
  items: FileEntry[]; index: number; setIndex: (i: number) => void; onClose: () => void;
  canDownload: boolean; canDelete: boolean; onDelete: (f: FileEntry) => void;
}

const src = (f: FileEntry) => (f.type === 'video' || isGif(f) ? fileUrl(f.path) : thumbUrl(f.path, 'lg'));

export default function Lightbox({ items, index, setIndex, onClose, canDownload, canDelete, onDelete }: Props) {
  const f = items[index];
  const touch = useRef<number | null>(null);
  const prev = () => index > 0 && setIndex(index - 1);
  const next = () => index < items.length - 1 && setIndex(index + 1);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  useEffect(() => { // precarga vecinas
    for (const n of [items[index + 1], items[index - 1]]) if (n && n.type === 'image') new Image().src = src(n);
  }, [index, items]);

  if (!f) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white" role="dialog" aria-label={f.name}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touch.current === null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (Math.abs(dx) > 60) (dx > 0 ? prev : next)();
        touch.current = null;
      }}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button className="rounded-full p-2 hover:bg-white/10" onClick={onClose} aria-label="Cerrar"><Icon name="x" /></button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{f.name}</p>
          <p className="text-xs text-white/60">{new Date(f.mtime).toLocaleString('es')} · {index + 1} de {items.length}</p>
        </div>
        {canDownload && <a className="rounded-full p-2 hover:bg-white/10" href={fileUrl(f.path, true)} aria-label="Descargar"><Icon name="download" /></a>}
        {canDelete && <button className="rounded-full p-2 hover:bg-white/10" onClick={() => onDelete(f)} aria-label="Eliminar"><Icon name="trash" /></button>}
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {index > 0 && <button className="absolute left-2 z-10 rounded-full bg-black/40 p-2 hover:bg-white/20" onClick={prev} aria-label="Anterior"><Icon name="left" className="h-6 w-6" /></button>}
        {f.type === 'video'
          ? <video key={f.path} src={fileUrl(f.path)} controls autoPlay className="max-h-full max-w-full" />
          : <img key={f.path} src={src(f)} alt={f.name} className="max-h-full max-w-full object-contain" />}
        {index < items.length - 1 && <button className="absolute right-2 z-10 rounded-full bg-black/40 p-2 hover:bg-white/20" onClick={next} aria-label="Siguiente"><Icon name="right" className="h-6 w-6" /></button>}
      </div>
    </div>
  );
}
