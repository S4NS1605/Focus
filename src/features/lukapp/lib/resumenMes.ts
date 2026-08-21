import type { CategoriaClave, Transaction } from '../types';
import type { CategorySlice, MonthTotals } from './aggregate';
import { byCategory, forMonth, monthTotals } from './aggregate';
import type { CambioCategoria } from './tendencias';
import { compararCategorias, promedioMensual, serieMensual, ultimosMeses } from './tendencias';
import { monthKeyLabel, shiftMonth } from './localDate';
import { formatCop } from './formatCop';

/**
 * "Tu resumen": el mes contado como una historia, no como una tabla.
 *
 * Nada aquí es nuevo dato — cada tarjeta reusa una cuenta que la app ya hace
 * en algún otro lado (`aggregate`, `tendencias`) y la empaqueta como un hecho
 * suelto y grande, del tamaño de una pantalla. La regla de `insights.ts` sigue
 * aplicando entera: todo se CALCULA, nada se redacta con un modelo, porque una
 * cifra sobre la plata de alguien tiene que salir de una cuenta repetible.
 *
 * Las tarjetas condicionales se omiten en vez de mostrarse vacías o en cero:
 * un mes sin historial anterior no tiene "lo que más subió", y fingir que sí
 * —mostrando un 0% o un guion— es peor que no mostrar la tarjeta.
 */
export type Tono = 'neutral' | 'bien' | 'atento';

export type TarjetaResumen =
  | { tipo: 'portada'; mes: string }
  | { tipo: 'balance'; totals: MonthTotals }
  | { tipo: 'categoriaEstrella'; slice: CategorySlice }
  | { tipo: 'cambioCategoria'; subida: CambioCategoria | null; bajada: CambioCategoria | null }
  | { tipo: 'gastoMasCaro'; tx: Transaction }
  | { tipo: 'diasActivos'; activos: number; totalDias: number }
  | { tipo: 'racha'; dias: number }
  | {
      tipo: 'comparadoConPromedio';
      gastosMesCop: number;
      promedioCop: number;
      deltaPct: number;
      meses: number;
    }
  | { tipo: 'cierre'; totals: MonthTotals; tono: Tono; frase: string };

/** Días del mes 'YYYY-MM', sin depender de qué mes trae `Date` puesto localmente. */
const diasEnMes = (mes: string): number => {
  const [y, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/**
 * Cuántos días del mes ya pasaron, para no contar como "racha" o "actividad"
 * días que todavía no llegan cuando se mira el mes en curso.
 */
const diasTranscurridos = (mes: string, hoy: string): number => {
  const total = diasEnMes(mes);
  if (mes > hoy.slice(0, 7)) return 0;
  if (mes < hoy.slice(0, 7)) return total;
  return Math.min(total, Number(hoy.slice(8, 10)));
};

/** El día del mes (1..31) de una fecha 'YYYY-MM-DD'. */
const diaDe = (fecha: string): number => Number(fecha.slice(8, 10));

const fraseDeCierre = (totals: MonthTotals): { tono: Tono; frase: string } => {
  if (totals.ingresos === 0 && totals.gastos === 0) {
    return { tono: 'neutral', frase: 'Un mes sin movimientos registrados todavía.' };
  }
  if (totals.tasaAhorro !== null && totals.tasaAhorro >= 20) {
    return { tono: 'bien', frase: 'Guardaste una buena tajada este mes.' };
  }
  if (totals.balance < 0) {
    return { tono: 'atento', frase: 'Este mes gastaste más de lo que entró.' };
  }
  return { tono: 'neutral', frase: 'Otro mes más en el libro.' };
};

/** Cuántos meses de historia mirar hacia atrás para el promedio de comparación. */
const MESES_PROMEDIO = 6;

export const resumenDelMes = (
  transacciones: readonly Transaction[],
  mes: string,
  hoy: string,
): readonly TarjetaResumen[] => {
  const delMes = forMonth(transacciones, mes);
  const totals = monthTotals(delMes);
  const tarjetas: TarjetaResumen[] = [{ tipo: 'portada', mes }, { tipo: 'balance', totals }];

  const gastosPorCategoria = byCategory(delMes, 'gasto');
  if (gastosPorCategoria.length > 0) {
    tarjetas.push({ tipo: 'categoriaEstrella', slice: gastosPorCategoria[0] });
  }

  const mesAnterior = shiftMonth(mes, -1);
  if (forMonth(transacciones, mesAnterior).length > 0) {
    const cambios = compararCategorias(transacciones, mes, mesAnterior, 'gasto');
    const subida = cambios.find((c) => c.deltaCop > 0) ?? null;
    const candidataBajada = cambios[cambios.length - 1] ?? null;
    const bajada = candidataBajada && candidataBajada.deltaCop < 0 ? candidataBajada : null;
    if (subida || bajada) tarjetas.push({ tipo: 'cambioCategoria', subida, bajada });
  }

  const gastos = delMes.filter((tx) => tx.kind === 'gasto');
  if (gastos.length > 0) {
    const masCaro = gastos.reduce((max, tx) => (tx.amountCop > max.amountCop ? tx : max));
    tarjetas.push({ tipo: 'gastoMasCaro', tx: masCaro });
  }

  const transcurridos = diasTranscurridos(mes, hoy);
  if (transcurridos > 0) {
    const diasConActividad = new Set(delMes.map((tx) => diaDe(tx.occurredOn)));
    tarjetas.push({ tipo: 'diasActivos', activos: diasConActividad.size, totalDias: transcurridos });

    const diasConGasto = new Set(gastos.map((tx) => diaDe(tx.occurredOn)));
    let racha = 0;
    let mejorRacha = 0;
    for (let dia = 1; dia <= transcurridos; dia++) {
      racha = diasConGasto.has(dia) ? 0 : racha + 1;
      mejorRacha = Math.max(mejorRacha, racha);
    }
    tarjetas.push({ tipo: 'racha', dias: mejorRacha });
  }

  const mesesAnteriores = ultimosMeses(mesAnterior, MESES_PROMEDIO);
  const promedio = promedioMensual(serieMensual(transacciones, mesesAnteriores));
  if (promedio.meses > 0 && promedio.gastos > 0) {
    tarjetas.push({
      tipo: 'comparadoConPromedio',
      gastosMesCop: totals.gastos,
      promedioCop: promedio.gastos,
      deltaPct: Math.round(((totals.gastos - promedio.gastos) / promedio.gastos) * 1000) / 10,
      meses: promedio.meses,
    });
  }

  const { tono, frase } = fraseDeCierre(totals);
  tarjetas.push({ tipo: 'cierre', totals, tono, frase });

  return tarjetas;
};

/** Encuentra la tarjeta de un tipo dado, o `undefined` si el resumen no la trae. */
const buscar = <T extends TarjetaResumen['tipo']>(
  tarjetas: readonly TarjetaResumen[],
  tipo: T,
): Extract<TarjetaResumen, { tipo: T }> | undefined =>
  tarjetas.find((t): t is Extract<TarjetaResumen, { tipo: T }> => t.tipo === tipo);

/**
 * El resumen, en cuatro líneas de texto plano — para el botón "Compartir".
 *
 * `nombreDe` es el mismo patrón que `insightsDelMes`: resolver el nombre de la
 * categoría es cosa del catálogo, que vive en la capa de React, así que se le
 * pasa como función en vez de importar el catálogo aquí y volver este archivo
 * dependiente de React para armar un párrafo.
 */
export const textoParaCompartir = (
  tarjetas: readonly TarjetaResumen[],
  nombreDe: (categoria: CategoriaClave) => string,
): string => {
  const portada = buscar(tarjetas, 'portada');
  const balance = buscar(tarjetas, 'balance');
  const estrella = buscar(tarjetas, 'categoriaEstrella');
  const racha = buscar(tarjetas, 'racha');

  const lineas = [`Mi resumen de ${portada ? monthKeyLabel(portada.mes) : 'el mes'} en LukApp:`];
  if (balance) lineas.push(`Balance: ${formatCop(balance.totals.balance)}`);
  if (estrella) {
    lineas.push(`Categoría estrella: ${nombreDe(estrella.slice.category)} (${formatCop(estrella.slice.total)})`);
  }
  if (racha && racha.dias > 0) {
    lineas.push(`${racha.dias} ${racha.dias === 1 ? 'día seguido' : 'días seguidos'} sin gastar`);
  }

  return lineas.join('\n');
};
