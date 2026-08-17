import type { Transaction } from '../types';
import { monthKey } from './localDate';

/**
 * El 4x1000 — Gravamen a los Movimientos Financieros.
 *
 * Este módulo calcula ESTIMACIONES, nunca la cifra oficial. Quien liquida y
 * retiene el GMF es el banco, y lo hace con información que esta app no tiene:
 * qué cuentas del usuario están cubiertas por el sistema de control, qué
 * movimientos entran en las otras exenciones del artículo 879, y en qué orden
 * llegaron dentro del mes. Todo lo de aquí sirve para que el usuario entienda
 * de dónde salió una plata, no para discutirle al banco.
 */

/** Tarifa del GMF: cuatro por mil. */
export const TARIFA_GMF = 0.004;

/** Tope mensual exento, en UVT. Artículo 879, numeral 1 del Estatuto Tributario. */
export const TOPE_EXENTO_UVT = 350;

/**
 * El valor de la UVT, que cambia CADA AÑO por resolución de la DIAN.
 *
 * No es una constante del dominio: es un dato con fecha de vencimiento. Se
 * guarda con el año al que corresponde y con la resolución que lo fijó,
 * precisamente para que la pantalla pueda decir de cuándo es el número y el
 * usuario pueda corregirlo en enero sin esperar a que alguien recompile la app.
 */
export interface ValorUvt {
  anio: number;
  pesos: number;
  fuente: string;
}

/**
 * Último valor conocido al escribir esto. Es un punto de partida editable, no
 * una verdad permanente: si el usuario abre la app en 2027 y nadie lo cambió,
 * la pantalla tiene que avisar que está viejo en vez de calcular con él en
 * silencio — para eso está `uvtDesactualizada`.
 */
export const UVT_POR_DEFECTO: ValorUvt = {
  anio: 2026,
  pesos: 52_374,
  fuente: 'Resolución DIAN 000238 del 15 de diciembre de 2025',
};

/** True cuando el valor guardado ya no corresponde al año en curso. */
export const uvtDesactualizada = (uvt: ValorUvt, anioActual: number): boolean =>
  uvt.anio < anioActual;

/** El tope exento del mes, en pesos. */
export const topeExentoCop = (uvt: ValorUvt): number => TOPE_EXENTO_UVT * uvt.pesos;

/** Los depósitos de bajo monto tienen una exención independiente de 65 UVT mensuales. */
export const TOPE_BAJO_MONTO_UVT = 65;
export const topeBajoMontoCop = (uvt: ValorUvt): number => TOPE_BAJO_MONTO_UVT * uvt.pesos;

/** Lo que costaría de GMF un monto que NO esté cubierto por la exención. */
export const gmfDe = (montoCop: number): number => Math.round(Math.abs(montoCop) * TARIFA_GMF);

/**
 * Los dos esquemas del 4x1000 en Colombia.
 *
 * El 13 de diciembre de 2024 entró en vigencia la norma que cambia el cupo a la
 * persona y no a la cuenta. Sin embargo, en la práctica conviven mientras las
 * entidades se conectan al sistema central.
 */
export type RegimenGmf =
  /** El cupo es de la persona y se reparte entre sus cuentas. */
  | 'distribuido'
  /** Solo una cuenta marcada goza del cupo; las demás pagan desde el primer peso. */
  | 'marcada';

export interface ConsumoDelMes {
  mes: string;
  /** Retiros del mes que cuentan contra el cupo exento (350 UVT). */
  baseCop: number;
  topeCop: number;
  /** Cuánto del cupo queda. Nunca negativo. */
  disponibleCop: number;
  /**
   * Retiros de cuentas financieras que NO gozan del cupo.
   *
   * Siempre 0 bajo `distribuido`. Bajo `marcada` es todo lo que salió de las
   * demás cuentas, que paga desde el primer peso.
   */
  sinCupoCop: number;
  /** Lo que excede el cupo y por tanto sí paga, más lo que nunca lo tuvo. */
  gravadoCop: number;
  /** El 4x1000 estimado sobre ese exceso. */
  gmfEstimadoCop: number;
  /** 0..100, para una barra. */
  pctUsado: number;
  /** Detalle del consumo de las cuentas de bajo monto (65 UVT). */
  bajoMonto: {
    totalGravadoCop: number;
  };
}

/**
 * Cuánto del cupo exento consumió un mes.
 *
 * Solo cuentan las SALIDAS: el GMF grava disponer del dinero, no recibirlo, así
 * que un ingreso no consume cupo. Los movimientos sin cuenta asignada quedan
 * fuera a propósito — no se sabe si salieron de una cuenta bancaria o del
 * bolsillo, y contarlos infla el consumo con plata que quizá nunca tocó un banco.
 */
export const consumoDelMes = (
  transacciones: readonly Transaction[],
  mes: string,
  uvt: ValorUvt,
  /** Cuentas cuyos retiros cuentan. Vacío = ninguna, y el consumo da cero. */
  cuentasCubiertas: ReadonlySet<string>,
  opciones: {
    regimen?: RegimenGmf;
    /** Solo se usa bajo `marcada`. Sin ella, ninguna cuenta goza del cupo. */
    cuentaExentaId?: string | null;
    /** Cuentas marcadas como Depósito de Bajo Monto (tienen exención propia de 65 UVT). */
    bajoMontoIds?: ReadonlySet<string>;
  } = {},
): ConsumoDelMes => {
  const regimen = opciones.regimen ?? 'distribuido';
  const cuentaExentaId = opciones.cuentaExentaId ?? null;
  const bajoMontoIds = opciones.bajoMontoIds ?? new Set<string>();

  let baseCop = 0;
  let sinCupoCop = 0;
  const consumoBajoMonto = new Map<string, number>();

  for (const tx of transacciones) {
    if (tx.kind !== 'gasto') continue;
    if (tx.cuentaId === null || !cuentasCubiertas.has(tx.cuentaId)) continue;
    if (monthKey(tx.occurredOn) !== mes) continue;

    // Si es una cuenta de bajo monto, consume su propio tope de 65 UVT, independiente del régimen
    if (bajoMontoIds.has(tx.cuentaId)) {
      consumoBajoMonto.set(tx.cuentaId, (consumoBajoMonto.get(tx.cuentaId) ?? 0) + tx.amountCop);
      continue;
    }

    // Bajo `marcada`, lo que sale de cualquier otra cuenta nunca tuvo cupo: no
    // consume nada, simplemente paga. Meterlo en `baseCop` haría creer que el
    // cupo se agotó cuando en realidad ni siquiera aplicaba.
    if (regimen === 'marcada' && tx.cuentaId !== cuentaExentaId) {
      sinCupoCop += tx.amountCop;
      continue;
    }
    baseCop += tx.amountCop;
  }

  const topeCop = topeExentoCop(uvt);
  const excedidoCop = Math.max(0, baseCop - topeCop);
  
  const topeBajoCop = topeBajoMontoCop(uvt);
  let gravadoBajoMontoCop = 0;
  for (const consumido of consumoBajoMonto.values()) {
    if (consumido > topeBajoCop) {
      gravadoBajoMontoCop += (consumido - topeBajoCop);
    }
  }

  const gravadoCop = excedidoCop + sinCupoCop + gravadoBajoMontoCop;

  return {
    mes,
    baseCop,
    topeCop,
    disponibleCop: Math.max(0, topeCop - baseCop),
    sinCupoCop,
    gravadoCop,
    gmfEstimadoCop: gmfDe(gravadoCop),
    pctUsado: topeCop === 0 ? 0 : Math.min(100, Math.round((baseCop / topeCop) * 1000) / 10),
    bajoMonto: {
      totalGravadoCop: gravadoBajoMontoCop,
    }
  };
};

/** Un dato legal que la pantalla muestra, con de dónde salió y de cuándo es. */
export interface NotaLegal {
  id: string;
  titulo: string;
  cuerpo: string;
  /** Norma o concepto que lo respalda. */
  fundamento: string;
  /** Cuándo se verificó este dato contra la fuente. */
  verificado: string;
}

/**
 * Lo que la app puede afirmar sobre el 4x1000.
 *
 * Cada nota lleva su fundamento y la fecha en que se verificó, porque esto es
 * normativa: envejece, y una afirmación tributaria sin fecha ni fuente es peor
 * que no decir nada. La app informa; quien liquida es el banco y quien
 * interpreta es la DIAN.
 */
export const NOTAS_GMF: readonly NotaLegal[] = [
  {
    id: 'que-es',
    titulo: 'Qué es',
    cuerpo:
      'El 4x1000 es el Gravamen a los Movimientos Financieros. Se cobra cuando dispones de plata que tienes en el sistema financiero: retiros, transferencias, pagos desde tu cuenta. Son $4 por cada $1.000, o sea el 0,4%.',
    fundamento: 'Estatuto Tributario, artículos 870 a 881',
    verificado: '2026-08-12',
  },
  {
    id: 'exencion',
    titulo: 'El cupo exento',
    cuerpo:
      'Cada persona natural tiene exentos hasta 350 UVT al mes en retiros de cuentas de ahorro, depósitos electrónicos o tarjetas prepago. Pasado ese monto, lo que exceda sí paga.',
    fundamento: 'Estatuto Tributario, artículo 879 numeral 1',
    verificado: '2026-08-12',
  },
  {
    id: 'ya-no-se-marca',
    titulo: 'Ya no tienes que marcar una sola cuenta',
    cuerpo:
      'Antes había que decirle al banco cuál era LA cuenta exenta, y usar otra te hacía perder el beneficio. Desde el 13 de diciembre de 2024 el cupo es de la persona, no de la cuenta: se reparte entre tus cuentas, incluso en bancos distintos. El límite sigue siendo 350 UVT en total al mes.',
    fundamento:
      'Estatuto Tributario, artículo 881-1 (Ley 2277 de 2022) — Concepto DIAN 10196 del 30 de julio de 2025',
    verificado: '2026-08-12',
  },
  {
    id: 'bancos-atrasados',
    titulo: 'Por qué tu banco quizá siga cobrando',
    cuerpo:
      'El reparto automático depende de que cada entidad haya montado el sistema de información que exige la norma. Mientras una no lo tenga, puede seguir aplicando el esquema viejo. Si te cobran y crees que no debían, eso se reclama en el banco.',
    fundamento: 'Artículo 881-1, régimen de transición',
    verificado: '2026-08-12',
  },
];

/**
 * Lo que esta app NO hace, dicho en la pantalla.
 *
 * Está en el código y no solo en la cabeza de quien lo escribió porque es la
 * línea entre informar sobre un impuesto y dar asesoría tributaria, y esa línea
 * hay que poder verla al leer el módulo.
 */
export const ADVERTENCIA_GMF =
  'Esto es informativo y son estimaciones. Quien liquida y cobra el 4x1000 es tu banco, y quien interpreta la norma es la DIAN. Si algo no te cuadra, revisa con tu banco antes de dar por buena una cifra de aquí.';
