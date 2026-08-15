import type { Transaction } from '../types';

export interface AnálisisAnomalia {
  esAnomalía: boolean;
  percentil: number;
  promedio: number;
  desv: number;
}

export interface SenalRecurrencia {
  patrón: 'diario' | 'semanal' | 'mensual' | 'anual' | 'ninguno';
  confianza: number;
}

export const analizarAnomalias = (
  transacciones: readonly Transaction[],
  categoria: string,
  montoActual: number,
): AnálisisAnomalia => {
  const porCategoria = transacciones.filter((t) => t.category === categoria);
  if (porCategoria.length === 0) {
    return { esAnomalía: false, percentil: 50, promedio: 0, desv: 0 };
  }

  const montos = porCategoria.map((t) => t.amountCop).sort((a, b) => a - b);
  const promedio = montos.reduce((a, b) => a + b, 0) / montos.length;

  let desv = 0;
  for (const m of montos) {
    desv += (m - promedio) ** 2;
  }
  desv = Math.sqrt(desv / montos.length);

  const percentil = Math.round(
    (montos.filter((m) => m <= montoActual).length / montos.length) * 100
  );

  // Anomalia si está fuera de ±2σ (95% de confianza)
  const esAnomalía = Math.abs(montoActual - promedio) > 2 * desv && desv > 0;

  return { esAnomalía, percentil, promedio, desv };
};

export const detectarRecurrencia = (texto: string): SenalRecurrencia => {
  const norm = texto.toLowerCase();
  let patrón: 'diario' | 'semanal' | 'mensual' | 'anual' | 'ninguno' = 'ninguno';
  let confianza = 0;

  if (/diario|todos los d[ií]as|cada d[ií]a|d[ií]a a d[ií]a/.test(norm)) {
    patrón = 'diario';
    confianza = 0.8;
  } else if (/semanal|cada semana|todos los.*d[ií]as?|por semana/.test(norm)) {
    patrón = 'semanal';
    confianza = 0.75;
  } else if (/mensual|cada mes|todos los meses|por mes/.test(norm)) {
    patrón = 'mensual';
    confianza = 0.9;
  } else if (/anual|cada a[ñn]o|todos los a[ñn]os|por a[ñn]o/.test(norm)) {
    patrón = 'anual';
    confianza = 0.85;
  }

  return { patrón, confianza };
};
