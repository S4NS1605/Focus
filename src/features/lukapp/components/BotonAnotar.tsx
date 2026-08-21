import React, { useCallback, useRef, useState } from 'react';
import { Loader2, Mic, Plus, Search, Square } from 'lucide-react';
import { useDictation } from '../hooks/useDictation';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useAudioFeedback } from '../hooks/useAudioFeedback';
import { RippleButton } from './RippleButton';
import { DictadoOverlay } from './DictadoOverlay';
import type { FaseDictado } from './DictadoOverlay';

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
 * El micrófono tiene TRES estados visibles, y eso es lo importante: quieto,
 * escuchando y transcribiendo. Antes solo se distinguían dos, y como el estado
 * "escuchando" se comparaba contra un valor que el motor nunca devolvía, el
 * botón se quedaba pintado como quieto mientras el micrófono seguía abierto —
 * así que tocarlo otra vez volvía a intentar empezar en vez de parar, y la
 * grabación no terminaba nunca. Se veía exactamente como si se prendiera y se
 * apagara solo.
 */
export const BotonAnotar: React.FC<BotonAnotarProps> = ({ onDictado, onManual, onBuscar }) => {
  const haptic = useHapticFeedback();
  const audio = useAudioFeedback();

  // La pantalla completa se abre sola al empezar a grabar y se cierra sola al
  // terminar de revelar el texto o al cancelar -- nunca queda desincronizada
  // de `dictation.status` porque ambas cosas se disparan desde los mismos
  // toques (ver `alTocarMicrofono`, `cancelarDictado`, `revelarCompleto`).
  const [overlayAbierto, setOverlayAbierto] = useState(false);
  const [textoRevelado, setTextoRevelado] = useState<string | null>(null);
  // Si se cancela justo cuando Whisper ya iba a contestar, la respuesta que
  // llegue tarde se descarta en vez de abrir el confirmador solo.
  const descartadoRef = useRef(false);

  const manejarTextoFinal = useCallback((texto: string) => {
    if (descartadoRef.current) {
      descartadoRef.current = false;
      return;
    }
    setTextoRevelado(texto);
  }, []);

  const dictation = useDictation(manejarTextoFinal);

  const escuchando = dictation.status === 'listening';
  const procesando = dictation.status === 'processing';

  const alTocarMicrofono = () => {
    // Mientras sube el audio no hay nada que empezar ni que parar.
    if (procesando) return;

    if (!dictation.supported) {
      haptic.trigger('light');
      audio.play('click');
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
      setOverlayAbierto(true);
      dictation.start();
    }
  };

  const cancelarDictado = () => {
    haptic.trigger('light');
    audio.play('click');
    descartadoRef.current = true;
    dictation.cancel();
    setTextoRevelado(null);
    setOverlayAbierto(false);
  };

  const confirmarDictado = () => {
    haptic.trigger('medium');
    audio.play('click');
    dictation.stop();
  };

  const revelarCompleto = () => {
    const texto = textoRevelado;
    setTextoRevelado(null);
    setOverlayAbierto(false);
    if (texto) onDictado(texto);
  };

  const faseOverlay: FaseDictado =
    textoRevelado !== null ? 'revelando' : procesando ? 'procesando' : dictation.error ? 'error' : 'escuchando';

  return (
    <div
      // Encima del menú, no encima del borde de la pantalla: antes vivía en
      // bottom-0 y se metía en un hueco que la barra de navegación dejaba
      // vacío abajo, así que quedaba por debajo de "Inicio"/"Dinero"/etc en
      // vez de arriba. Ahora se separa del fondo por la altura de esa barra
      // (`--fin-nav-h`) más su franja segura y un respiro propio.
      className="pointer-events-none fixed inset-x-0 z-30 flex flex-col items-center gap-2"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + var(--fin-nav-h) + 0.75rem)' }}
      aria-hidden={overlayAbierto}
    >
      <DictadoOverlay
        abierto={overlayAbierto}
        fase={faseOverlay}
        nivelAudio={dictation.level}
        // Mientras se escucha o se procesa, lo que se ve es el parcial que
        // useAudioCapture manda a transcribir cada ~1.6s. Apenas Whisper
        // confirma la versión definitiva (`textoRevelado`), esa gana -- el
        // mismo texto, sin ningún salto visible entre una y otra.
        texto={textoRevelado ?? dictation.interim}
        error={dictation.error}
        onCancelar={cancelarDictado}
        onConfirmar={confirmarDictado}
        onRevelado={revelarCompleto}
      />

      {/* `data-guia` ancla el globo de la guía de bienvenida al bloque entero
   —píldora y micrófono—, que es como se explica: los tres botones son
   la misma idea, anotar. */}
      <div data-guia="anotar" className="pointer-events-auto flex items-center gap-2.5">
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

        <div className="relative">
          {dictation.status === 'blocked' && (
            <span
              className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--fin-warn)] text-white text-[10px] font-bold"
              aria-label="Micrófono bloqueado"
              title="Permiso del micrófono denegado"
            >
              ✕
            </span>
          )}
          <RippleButton
            type="button"
            onClick={alTocarMicrofono}
            aria-pressed={escuchando}
            aria-busy={procesando}
            rippleColor="rgba(255,255,255,0.55)"
            aria-label={
              procesando ? 'Transcribiendo' : escuchando ? 'Dejar de escuchar' : 'Anotar hablando'
            }
            // Es el único objeto rojo de la app que no es una cifra, y por eso se
            // reconoce sin leer nada. Mientras escucha late, para que se note que
            // el micrófono está abierto sin tener que decirlo con palabras.
            className={`flex h-16 w-16 items-center justify-center rounded-[var(--fin-r-pill)] text-white shadow-[0_10px_28px_-8px_rgb(190_18_60/0.6)] transition-transform active:scale-95 ${
              escuchando ? 'animate-pulse' : ''
            }`}
            style={{ backgroundColor: 'var(--fin-out)', opacity: procesando || dictation.status === 'blocked' ? 0.5 : 1 }}
          >
          {procesando ? (
            <Loader2 className="h-6 w-6 animate-spin" strokeWidth={2.5} aria-hidden="true" />
          ) : escuchando ? (
            <Square className="h-6 w-6" strokeWidth={3} aria-hidden="true" />
          ) : (
            <Mic className="h-7 w-7" strokeWidth={2.5} aria-hidden="true" />
          )}
          </RippleButton>
        </div>
      </div>
    </div>
  );
};
