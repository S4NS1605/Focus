import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useBloqueoScroll } from '../data/useBloqueoScroll';

interface HojaPanelProps {
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
}

/**
 * El marco de cualquier cosa que se abra a pantalla completa desde Ajustes o
 * desde el buscador: un título grande, una X para cerrar, y el contenido.
 *
 * Existe para que las nueve pantallas de Ajustes no tengan que repetir cada una
 * su propia cabecera, y sobre todo para que se cierren todas igual. Antes cada
 * una era una pestaña dentro de otra pantalla, así que no había forma de
 * "salir": había que acordarse de a qué pestaña volver.
 */
export const HojaPanel: React.FC<HojaPanelProps> = ({ titulo, onCerrar, children }) => {
  useBloqueoScroll(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ type: 'spring', stiffness: 340, damping: 32 }}
      className="fixed inset-0 z-40 overflow-y-auto overscroll-contain bg-[var(--fin-bg)]"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <div className="mx-auto w-full max-w-[720px] px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+3rem)] lg:max-w-[1100px] 2xl:max-w-[1400px]">
        {/* La cabecera se queda pegada arriba: en una lista larga uno tiene que
 poder cerrar sin volver hasta el principio. */}
        <div className="sticky top-0 z-10 -mx-4 mb-5 flex items-center justify-between gap-3 bg-[var(--fin-bg)] px-4 pb-3 pt-1">
          <h1
            className="min-w-0 truncate text-[var(--fin-ink)]"
            style={{ font: 'var(--fin-t-titulo-xl)', letterSpacing: 'var(--fin-track-titulo-xl)' }}
          >
            {titulo}
          </h1>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]"
          >
            <X className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>

        {children}
      </div>
    </motion.div>
  );
};
