import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Undo2 } from 'lucide-react';

export interface Guardado {
  /** El id del movimiento que se acaba de guardar, para poder deshacerlo. */
  id: string;
  texto: string;
  /** Si el monto se sale de lo normal en esa categoría, la frase que lo dice. */
  aviso?: string | null;
}

interface AvisoGuardadoProps {
  guardado: Guardado | null;
  onDeshacer: (id: string) => void;
  onCerrar: () => void;
}

/** Cuánto se queda el aviso antes de irse solo. */
const SEGUNDOS = 5;

/**
 * El aviso que sale abajo cuando algo se guarda.
 *
 * Antes guardar no decía nada: la hoja se cerraba y ya. Uno se quedaba con la
 * duda de si había quedado o no, y la única forma de saberlo era ir a buscarlo
 * en la lista.
 *
 * Aquí también va el aviso de "este gasto es más alto de lo normal". Antes ese
 * aviso salía JUSTO ENCIMA del botón de guardar, o sea que frenaba a la persona
 * en el último segundo por algo que casi siempre estaba bien. Es información
 * útil, pero no es una razón para parar: se dice después, junto al Deshacer,
 * que es lo que de verdad hace falta si resultó estar mal.
 */
export const AvisoGuardado: React.FC<AvisoGuardadoProps> = ({ guardado, onDeshacer, onCerrar }) => {
  const [restante, setRestante] = useState(SEGUNDOS);

  useEffect(() => {
    if (guardado === null) return;
    setRestante(SEGUNDOS);
    const tic = setInterval(() => setRestante((s) => s - 1), 1000);
    const fin = setTimeout(onCerrar, SEGUNDOS * 1000);
    // Sin esta limpieza, guardar dos cosas seguidas dejaría dos relojes
    // corriendo y el aviso se cerraría antes de tiempo.
    return () => {
      clearInterval(tic);
      clearTimeout(fin);
    };
  }, [guardado, onCerrar]);

  return (
    <AnimatePresence>
      {guardado !== null ? (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          // Va por encima de la barra de anotar para no taparla.
          className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)]"
          role="status"
          aria-live="polite"
        >
          <div className="fin-glass pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] px-4 py-3">
            <Check
              className="h-5 w-5 shrink-0 text-[var(--fin-in)]"
              strokeWidth={3}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-[var(--fin-ink)]">
                {guardado.texto}
              </p>
              {guardado.aviso ? (
                <p className="mt-0.5 flex items-start gap-1.5 text-[13px] text-[var(--fin-warn)]">
                  <AlertTriangle
                    className="mt-px h-3.5 w-3.5 shrink-0"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                  {guardado.aviso}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDeshacer(guardado.id)}
              className="flex shrink-0 items-center gap-1.5 rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--fin-ink)]"
            >
              <Undo2 className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
              Deshacer
              <span className="tabular-nums text-[var(--fin-ink-faint)]">{restante}</span>
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
