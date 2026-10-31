import { useState, useRef, useEffect } from 'react';
import { THEME_PRESETS, useTheme, playAudioPop } from './theme';
import { Icon } from './icons';

interface Props {
  floating?: boolean;
}

export default function MagicOrb({ floating = false }: Props) {
  const { config, update } = useTheme();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'colors' | 'fx'>('colors');
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);

  // Cierra el menú al presionar Escape o hacer clic afuera
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (open && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Manejo de arrastre de la bolita flotante
  const onMouseDown = (e: React.MouseEvent) => {
    if (!floating) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, initX: pos.x, initY: pos.y };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPos({ x: dragRef.current.initX + dx, y: dragRef.current.initY + dy });
    };
    const onMouseUp = () => {
      setDragging(false);
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging]);

  const activePreset = THEME_PRESETS.find((p) => p.hex.toLowerCase() === config.accent.toLowerCase());

  return (
    <div
      ref={menuRef}
      className={floating ? 'fixed z-50 bottom-6 right-6 select-none' : 'relative select-none'}
      style={floating && (pos.x !== 0 || pos.y !== 0) ? { transform: `translate(${pos.x}px, ${pos.y}px)` } : undefined}
    >
      {/* Botón de la Bolita Mágica */}
      <button
        type="button"
        onClick={() => {
          if (config.sound) playAudioPop('click');
          setOpen((v) => !v);
        }}
        onMouseDown={onMouseDown}
        aria-label="Abrir panel de temas y efectos"
        title="La Bolita: Cambia colores, glitch y modo LSD"
        className="group relative flex items-center justify-center p-1.5 transition-transform duration-300 hover:scale-110 active:scale-95 focus:outline-none"
      >
        {/* Halo resplandeciente externo */}
        <div
          className={`absolute inset-0 rounded-full blur-md opacity-70 group-hover:opacity-100 transition-opacity ${
            config.lsd ? 'animate-lsd-hue' : ''
          }`}
          style={{
            background: config.lsd
              ? 'radial-gradient(circle, #ff007f 0%, #00f3ff 50%, #84cc16 100%)'
              : `radial-gradient(circle, ${config.accent} 0%, transparent 75%)`,
          }}
        />

        {/* Esfera 3D interactiva (La Bolita) */}
        <div
          className={`relative h-9 w-9 rounded-full shadow-lg transition-all duration-300 ${
            config.lsd ? 'animate-lsd-hue' : ''
          } ${config.glitch ? 'animate-glitch-1' : 'animate-pulse-glow'}`}
          style={{
            background: config.lsd
              ? 'linear-gradient(135deg, #ff007f 0%, #a855f7 35%, #00f3ff 70%, #10b981 100%)'
              : `linear-gradient(135deg, ${config.accent} 0%, rgba(255,255,255,0.4) 30%, ${config.accent} 70%, rgba(0,0,0,0.5) 100%)`,
            boxShadow: `0 0 15px ${config.accent}80, inset 0 2px 4px rgba(255,255,255,0.7), inset 0 -3px 6px rgba(0,0,0,0.4)`,
          }}
        >
          {/* Brillo especular superior */}
          <div className="absolute top-1 left-2 h-2.5 w-3 rounded-full bg-white/70 blur-[0.6px] -rotate-45" />

          {/* Mini icono central */}
          <div className="absolute inset-0 flex items-center justify-center text-white/90 drop-shadow-sm group-hover:rotate-45 transition-transform duration-300">
            <Icon name="palette" className="h-4 w-4" />
          </div>
        </div>

        {/* Tooltip / Badge de estado */}
        {config.lsd && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500" />
          </span>
        )}
      </button>

      {/* Menú flotante del Estudio de Temas y Efectos */}
      {open && (
        <div
          className={`absolute z-50 w-80 rounded-3xl p-4 shadow-2xl backdrop-blur-2xl transition-all animate-in fade-in zoom-in-95 duration-200 border ${
            floating ? 'bottom-12 right-0' : 'top-12 right-0'
          } bg-white/90 dark:bg-ink-950/90 border-ink-200/80 dark:border-white/10`}
          style={{
            boxShadow: `0 20px 40px -10px rgba(0,0,0,0.4), 0 0 25px ${config.accent}30`,
          }}
        >
          {/* Header del menú */}
          <div className="mb-3 flex items-center justify-between border-b border-ink-200/60 pb-2.5 dark:border-white/10">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-accent">
                <Icon name="palette" className="h-3.5 w-3.5" />
              </span>
              <div>
                <h3 className="text-sm font-bold tracking-tight text-ink-900 dark:text-white">Estudio Visual</h3>
                <p className="text-[11px] text-ink-500">Personaliza colores y animaciones</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-200"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>

          {/* Selector de pestañas */}
          <div className="mb-3.5 flex rounded-xl bg-ink-100/80 p-1 dark:bg-ink-900/80">
            <button
              type="button"
              onClick={() => setActiveTab('colors')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'colors'
                  ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-800 dark:text-white'
                  : 'text-ink-500 hover:text-ink-900 dark:hover:text-ink-200'
              }`}
            >
              Colores & Temas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('fx')}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'fx'
                  ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-800 dark:text-white'
                  : 'text-ink-500 hover:text-ink-900 dark:hover:text-ink-200'
              }`}
            >
              Efectos LSD & Glitch
            </button>
          </div>

          {activeTab === 'colors' ? (
            <div className="space-y-3.5">
              {/* Presets de Color */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Paletas populares</p>
                <div className="grid grid-cols-3 gap-2">
                  {THEME_PRESETS.map((p) => {
                    const isSelected = config.accent.toLowerCase() === p.hex.toLowerCase();
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          update({
                            accent: p.hex,
                            lsd: p.isLsd ?? config.lsd,
                          });
                        }}
                        className={`group relative flex flex-col items-center rounded-xl p-2 text-center transition-all duration-200 ${
                          isSelected
                            ? 'bg-ink-200/70 ring-2 ring-accent dark:bg-ink-800/80'
                            : 'hover:bg-ink-100 dark:hover:bg-ink-900/60'
                        }`}
                      >
                        <div
                          className={`mb-1.5 h-6 w-6 rounded-full shadow-sm transition-transform duration-200 group-hover:scale-110 bg-gradient-to-tr ${p.gradient}`}
                          style={{ boxShadow: `0 2px 8px ${p.hex}60` }}
                        />
                        <span className="text-[10px] font-medium leading-tight text-ink-700 dark:text-ink-300">
                          {p.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selector personalizado */}
              <div className="flex items-center justify-between rounded-2xl border border-ink-200/80 bg-ink-50/60 p-2.5 dark:border-white/5 dark:bg-ink-900/50">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.accent}
                    onChange={(e) => update({ accent: e.target.value })}
                    className="h-7 w-7 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                  />
                  <div>
                    <p className="text-xs font-semibold text-ink-800 dark:text-ink-200">Color personalizado</p>
                    <p className="font-mono text-[11px] text-ink-500 uppercase">{config.accent}</p>
                  </div>
                </div>
                <span
                  className="h-4 w-4 rounded-full border border-white/40 shadow-sm"
                  style={{ backgroundColor: config.accent }}
                />
              </div>

              {/* Modo de visualización (Oscuro / Claro / OLED) */}
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Modo de pantalla</p>
                <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-ink-100/70 p-1 dark:bg-ink-900/70">
                  {(['dark', 'light', 'oled'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => update({ mode: m })}
                      className={`rounded-lg py-1 text-xs font-medium capitalize transition-all ${
                        config.mode === m
                          ? 'bg-white text-ink-950 shadow-sm dark:bg-ink-800 dark:text-white'
                          : 'text-ink-500 hover:text-ink-900 dark:hover:text-ink-300'
                      }`}
                    >
                      {m === 'dark' ? 'Oscuro' : m === 'light' ? 'Claro' : 'OLED'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Toggle Modo LSD */}
              <div className="flex items-center justify-between rounded-2xl border border-ink-200/80 bg-ink-50/70 p-3 dark:border-white/5 dark:bg-ink-900/50">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 text-white shadow-md shadow-pink-500/20">
                    🌀
                  </span>
                  <div>
                    <p className="text-xs font-bold text-ink-900 dark:text-white">Modo LSD Psicodélico</p>
                    <p className="text-[10px] text-ink-500">Ciclo de color cromático continuo</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update({ lsd: !config.lsd })}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    config.lsd ? 'bg-gradient-to-r from-pink-500 to-purple-500' : 'bg-ink-300 dark:bg-ink-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      config.lsd ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Toggle Efecto Glitch */}
              <div className="flex items-center justify-between rounded-2xl border border-ink-200/80 bg-ink-50/70 p-3 dark:border-white/5 dark:bg-ink-900/50">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-400 to-fuchsia-600 text-white shadow-md shadow-cyan-400/20">
                    ⚡
                  </span>
                  <div>
                    <p className="text-xs font-bold text-ink-900 dark:text-white">Efecto Glitch & Scanlines</p>
                    <p className="text-[10px] text-ink-500">Aberración cromática y CRT retro</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update({ glitch: !config.glitch })}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    config.glitch ? 'bg-cyan-500' : 'bg-ink-300 dark:bg-ink-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      config.glitch ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Toggle Aura Neón Ambiental */}
              <div className="flex items-center justify-between rounded-2xl border border-ink-200/80 bg-ink-50/70 p-3 dark:border-white/5 dark:bg-ink-900/50">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/20 text-accent">
                    ✨
                  </span>
                  <div>
                    <p className="text-xs font-bold text-ink-900 dark:text-white">Aura Neón Ambiental</p>
                    <p className="text-[10px] text-ink-500">Esferas de luz flotantes de fondo</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update({ aura: !config.aura })}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    config.aura ? 'bg-accent' : 'bg-ink-300 dark:bg-ink-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      config.aura ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Toggle Efectos de Sonido */}
              <div className="flex items-center justify-between rounded-2xl border border-ink-200/80 bg-ink-50/70 p-3 dark:border-white/5 dark:bg-ink-900/50">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink-200 text-ink-700 dark:bg-ink-800 dark:text-ink-300">
                    🔊
                  </span>
                  <div>
                    <p className="text-xs font-bold text-ink-900 dark:text-white">Retroalimentación Táctil</p>
                    <p className="text-[10px] text-ink-500">Sonidos sutiles al pulsar botones</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => update({ sound: !config.sound })}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    config.sound ? 'bg-accent' : 'bg-ink-300 dark:bg-ink-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      config.sound ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Footer del menú */}
          <div className="mt-3.5 flex items-center justify-between border-t border-ink-200/60 pt-2 text-[11px] text-ink-400 dark:border-white/10">
            <span>Tema activo: <b className="text-ink-700 dark:text-ink-200">{activePreset?.name || 'Personalizado'}</b></span>
            {config.lsd && <span className="font-mono text-pink-500 font-bold">LSD ON</span>}
          </div>
        </div>
      )}
    </div>
  );
}
