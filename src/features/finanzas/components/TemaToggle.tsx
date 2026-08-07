import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Tema } from '../data/useTema';
import { TEMAS } from '../data/useTema';

const ICONO: Record<Tema, LucideIcon> = {
  claro: Sun,
  oscuro: Moon,
  sistema: Monitor,
};

interface TemaToggleProps {
  tema: Tema;
  onCambiar: (tema: Tema) => void;
  className?: string;
}

/**
 * Three explicit options rather than a two-state switch. A binary toggle has no
 * way back to "follow the system" once touched, and that is the state most
 * people actually want.
 */
export const TemaToggle: React.FC<TemaToggleProps> = ({ tema, onCambiar, className = '' }) => (
  <div
    role="radiogroup"
    aria-label="Tema"
    className={`inline-flex items-center gap-0.5 rounded-full border border-[var(--fin-line)] bg-[var(--fin-card)] p-1 ${className}`}
  >
    {TEMAS.map((opcion) => {
      const activo = tema === opcion.id;
      return (
        <button
          key={opcion.id}
          type="button"
          role="radio"
          aria-checked={activo}
          onClick={() => onCambiar(opcion.id)}
          title={opcion.label}
          className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] transition-colors ${
            activo ? 'bg-[var(--fin-soft)]' : 'opacity-45 hover:opacity-100'
          }`}
        >
          {(() => {
            const Icono = ICONO[opcion.id];
            return <Icono className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />;
          })()}
          <span className="sr-only">{opcion.label}</span>
        </button>
      );
    })}
  </div>
);
