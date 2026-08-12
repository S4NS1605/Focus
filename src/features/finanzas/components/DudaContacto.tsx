import React from 'react';
import { Check, Users, X } from 'lucide-react';
import type { Duda } from '../lib/contactos';

interface DudaContactoProps {
  /** The single question to show, or null when there is nothing to ask. */
  duda: Duda | null;
  onUnir: (duda: Duda) => void;
  onSeparar: (duda: Duda) => void;
}

const veces = (n: number) => `${n} movimiento${n === 1 ? '' : 's'}`;

/**
 * One question, or nothing.
 *
 * Deliberately not a queue, a badge or a notification: the app asks about the
 * single most likely pair and then stops until that one is answered. A stack of
 * pending questions turns a small helpful nudge into a chore, and the whole
 * point of merging spellings is that it should cost less attention than living
 * with the mess.
 *
 * Both answers are final and both are recorded — "no" is as useful as "sí",
 * because it is what stops the same pair coming back on the next reload.
 */
export const DudaContacto: React.FC<DudaContactoProps> = ({ duda, onUnir, onSeparar }) => {
  if (duda === null) return null;

  return (
    <section
      aria-label="Contactos parecidos"
      className="mt-3 rounded-2xl border border-dashed border-[var(--fin-line)] bg-[var(--fin-bg)] px-3.5 py-3"
    >
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--fin-ink-faint)]">
        <Users className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
        ¿Son la misma persona?
      </p>

      <div className="mt-2 flex flex-col gap-1">
        {[duda.a, duda.b].map((parte) => (
          <p key={parte.clave} className="text-[12px] font-bold text-[var(--fin-ink)]">
            {parte.nombre}{' '}
            <span className="font-medium text-[var(--fin-ink-faint)]">
              · {veces(parte.movimientos)}
            </span>
          </p>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onUnir(duda)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--fin-accent)] px-3 py-2 text-[11px] font-bold text-[var(--fin-on-accent)]"
        >
          <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
          Sí, únelos
        </button>
        <button
          type="button"
          onClick={() => onSeparar(duda)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[var(--fin-line)] px-3 py-2 text-[11px] font-bold text-[var(--fin-ink-soft)]"
        >
          <X className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
          No, son distintos
        </button>
      </div>
    </section>
  );
};
