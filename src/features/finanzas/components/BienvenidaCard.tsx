import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

interface BienvenidaCardProps {
  onEmpezar: () => void;
}

/**
 * Only for a completely blank book: no cuentas, no movimientos. The moment
 * either exists, the rest of Resumen already has something to show, and a
 * banner urging "empecemos" would be lying about where things stand.
 *
 * Colours are hardcoded rather than pulled from the token set: this is the one
 * surface in the app meant to feel like a spotlight, not a card among cards,
 * the same reasoning behind .fin-aurora using raw hex instead of --fin-* vars.
 */
export const BienvenidaCard: React.FC<BienvenidaCardProps> = ({ onEmpezar }) => (
  <section
    className="relative overflow-hidden rounded-3xl p-6 sm:p-7"
    style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 48%, #fb7185 100%)' }}
  >
    <div
      className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/15 blur-2xl"
      aria-hidden="true"
    />
    <div
      className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-white/10 blur-2xl"
      aria-hidden="true"
    />

    <p className="relative flex items-center gap-2 font-display text-2xl font-extrabold text-white">
      Hola <span aria-hidden="true">👋</span>
    </p>
    <p className="relative mt-0.5 text-xl font-extrabold text-white">Empecemos por lo básico</p>
    <p className="relative mt-1.5 max-w-xs text-[13px] leading-relaxed text-white/85">
      Agrega tu primera cuenta y dile cuánto tienes: la app lleva el resto desde ahí.
    </p>

    <button
      type="button"
      onClick={onEmpezar}
      className="group relative mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-bold text-neutral-900 shadow-sm transition-transform hover:scale-[1.02]"
    >
      <Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
      Empezar
      <ArrowRight
        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
        strokeWidth={2.5}
        aria-hidden="true"
      />
    </button>
  </section>
);
