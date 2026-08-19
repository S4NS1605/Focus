import React from 'react';
import { Mic, Plus, Search, Square } from 'lucide-react';
import { useDictation } from '../hooks/useDictation';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useAudioFeedback } from '../hooks/useAudioFeedback';

interface BotonAnotarProps {
  /** Se llama con lo que la persona dijo, ya transcrito. */
  onDictado: (texto: string) => void;
  /** Abrir la pantalla de anotar en blanco, para escribir a mano. */
  onManual: () => void;
  /** Abrir el buscador. */
  onBuscar: () => void;
}

/**
 * La barra flotante de abajo: anotar a mano, buscar, y el micrófono.
 *
 * Vive aquí, en el armazón de la app, y no dentro de una sección. Antes el
 * bloque de registrar solo existía en Resumen y en Movimientos, así que desde
 * las otras nueve secciones no había forma de anotar un gasto sin navegar
 * primero. Ahora el botón está siempre en el mismo sitio, se ve sin mirar y se
 * alcanza con el pulgar.
 *
 * El micrófono SIEMPRE está, y esa es la parte importante:
 * antes se escondía cuando `dictation.supported` era falso — y eso pasa
 * justamente cuando la app está instalada en la pantalla de inicio, o sea en el
 * uso real. La gente aprendía un gesto que luego desaparecía.
 * Ahora es un solo botón con dos caminos por debajo: si el navegador sabe
 * escuchar, escucha; si no, abre la pantalla de anotar con el teclado listo
 * (y ahí la tecla del micrófono del teclado hace el resto).
 */
export const BotonAnotar: React.FC<BotonAnotarProps> = ({ onDictado, onManual, onBuscar }) => {
  const dictation = useDictation(onDictado);
  const haptic = useHapticFeedback();
  const audio = useAudioFeedback();
  const escuchando = dictation.status === 'listening';

  const alTocarMicrofono = () => {
    haptic.trigger('medium');
    audio.play('click');
    if (!dictation.supported) {
      onManual();
      return;
    }
    if (escuchando) {
      haptic.trigger('light');
      audio.play('click');
      dictation.stop();
    } else {
      haptic.trigger('heavy');
      audio.play('warning');
      dictation.start();
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="pointer-events-auto flex items-center gap-2.5">
        <div className="fin-glass flex gap-1 rounded-[var(--fin-r-pill)] bg-[var(--fin-card)] p-1.5">
          <button
            type="button"
            onClick={() => {
              haptic.trigger('light');
              audio.play('click');
              onManual();
            }}
            aria-label="Anotar a mano"
            className="flex h-11 w-11 items-center justify-center rounded-[var(--fin-r-pill)] text-[var(--fin-ink)] transition-transform active:scale-90"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              haptic.trigger('light');
              audio.play('click');
              onBuscar();
            }}
            aria-label="Buscar un movimiento"
            className="flex h-11 w-11 items-center justify-center rounded-[var(--fin-r-pill)] text-[var(--fin-ink)] transition-transform active:scale-90"
          >
            <Search className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          onClick={alTocarMicrofono}
          aria-pressed={escuchando}
          aria-label={escuchando ? 'Dejar de escuchar' : 'Anotar hablando'}
          // Es el único objeto rojo de la app que no es una cifra, y por eso se
          // reconoce sin leer nada. Mientras escucha late, para que se note que
          // el micrófono está abierto sin tener que decirlo con palabras.
          className={`flex h-16 w-16 items-center justify-center rounded-[var(--fin-r-pill)] text-white shadow-[0_10px_28px_-8px_rgb(190_18_60/0.6)] transition-transform active:scale-95 ${
            escuchando ? 'animate-pulse' : ''
          }`}
          style={{ backgroundColor: 'var(--fin-out)' }}
        >
          {escuchando ? (
            <Square className="h-6 w-6" strokeWidth={3} aria-hidden="true" />
          ) : (
            <Mic className="h-7 w-7" strokeWidth={2.5} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
};
