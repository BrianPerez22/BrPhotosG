import { useTheme } from './theme';

export default function AmbientAura() {
  const { config } = useTheme();
  if (!config.aura) return null;

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none">
      {/* Esfera 1 (Superior izquierda) */}
      <div
        className={`absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl opacity-20 dark:opacity-25 transition-all duration-700 animate-float ${
          config.lsd ? 'animate-lsd-hue' : ''
        }`}
        style={{
          background: config.lsd
            ? 'radial-gradient(circle, #ff007f 0%, #00f3ff 60%, transparent 80%)'
            : `radial-gradient(circle, ${config.accent} 0%, transparent 70%)`,
        }}
      />

      {/* Esfera 2 (Inferior derecha) */}
      <div
        className={`absolute -bottom-40 -right-32 h-[30rem] w-[30rem] rounded-full blur-3xl opacity-15 dark:opacity-20 transition-all duration-700 ${
          config.lsd ? 'animate-lsd-hue' : ''
        }`}
        style={{
          background: config.lsd
            ? 'radial-gradient(circle, #00f3ff 0%, #84cc16 60%, transparent 80%)'
            : `radial-gradient(circle, ${config.accent} 0%, transparent 70%)`,
          animationDuration: '7s',
        }}
      />

      {/* Esfera 3 central sutil */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[40rem] w-[40rem] rounded-full blur-3xl opacity-5 dark:opacity-10 transition-opacity"
        style={{
          background: `radial-gradient(circle, ${config.accent} 0%, transparent 75%)`,
        }}
      />
    </div>
  );
}
