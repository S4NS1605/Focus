import type { Meta } from '../data/modelos';
import { daysBetween } from './localDate';

export interface ProgresoMeta {
  ahorradoCop: number;
  objetivoCop: number;
  /** 0..100, capped — a goal can be overshot, a progress bar cannot. */
  pct: number;
  /** Never negative: once the target is met there is nothing left to save. */
  faltaCop: number;
  completada: boolean;
  /** Days until the target date; negative when overdue, null when open-ended. */
  diasRestantes: number | null;
  /**
   * COP per month still needed to land on the date. Null when the goal is
   * open-ended or already met — and, deliberately, when the date has passed:
   * a "required monthly pace" for a deadline in the past is not a number, and
   * showing an enormous one would be worse than showing none.
   */
  ritmoMensualCop: number | null;
}

const DIAS_POR_MES = 30.44; // average civil month, so a 90-day goal reads as ~3

/**
 * Where a goal stands.
 *
 * Progress comes from the linked pocket when there is one, so the figure can
 * never drift from the pocket it claims to describe; `ahorradoCop` on the goal
 * is only consulted for unlinked goals the user maintains by hand.
 */
export const progresoDeMeta = (
  meta: Meta,
  saldosPorCajita: ReadonlyMap<string, number>,
  hoy: string,
): ProgresoMeta => {
  const ahorradoCop =
    meta.cajitaId !== null ? (saldosPorCajita.get(meta.cajitaId) ?? 0) : meta.ahorradoCop;

  const objetivoCop = meta.objetivoCop;
  const faltaCop = Math.max(0, objetivoCop - ahorradoCop);
  const completada = objetivoCop > 0 && ahorradoCop >= objetivoCop;

  const diasRestantes = meta.fechaObjetivo ? daysBetween(hoy, meta.fechaObjetivo) : null;

  let ritmoMensualCop: number | null = null;
  if (!completada && diasRestantes !== null && diasRestantes > 0) {
    ritmoMensualCop = Math.ceil(faltaCop / (diasRestantes / DIAS_POR_MES));
  }

  return {
    ahorradoCop,
    objetivoCop,
    pct: objetivoCop > 0 ? Math.min(100, Math.round((ahorradoCop / objetivoCop) * 1000) / 10) : 0,
    faltaCop,
    completada,
    diasRestantes,
    ritmoMensualCop,
  };
};

export interface MetaConProgreso {
  meta: Meta;
  progreso: ProgresoMeta;
}

/** Live goals first and nearest-deadline first; met goals sink to the bottom. */
export const metasConProgreso = (
  metas: readonly Meta[],
  saldosPorCajita: ReadonlyMap<string, number>,
  hoy: string,
): MetaConProgreso[] =>
  metas
    .map((meta) => ({ meta, progreso: progresoDeMeta(meta, saldosPorCajita, hoy) }))
    .sort((a, b) => {
      if (a.progreso.completada !== b.progreso.completada) {
        return a.progreso.completada ? 1 : -1;
      }
      const diasA = a.progreso.diasRestantes;
      const diasB = b.progreso.diasRestantes;
      // Open-ended goals have no deadline pressure, so they sort after dated ones.
      if (diasA === null && diasB === null) return a.meta.nombre.localeCompare(b.meta.nombre);
      if (diasA === null) return 1;
      if (diasB === null) return -1;
      return diasA - diasB;
    });
