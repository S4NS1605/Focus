import type { Instantanea } from '../data/repositorio';
import { instantaneaVacia } from '../data/repositorio';
import { formatCop } from './formatCop';

/**
 * Sacar los datos y volverlos a meter.
 *
 * Existe porque un libro contable al que no se le puede sacar la información es
 * un libro prestado: si la cuenta de Supabase se cae, la suspenden, o
 * simplemente quieres tus gastos en una hoja de cálculo, sin esto no hay salida.
 */

/** Sube cuando el formato deja de poder leerse tal cual. */
export const VERSION_RESPALDO = 1;

export interface Respaldo {
  version: number;
  /** Cuándo se generó, para saber qué tan viejo es al restaurarlo. */
  generado: string;
  datos: Instantanea;
}

export const armarRespaldo = (datos: Instantanea, generado: string): Respaldo => ({
  version: VERSION_RESPALDO,
  generado,
  datos,
});

export interface ResultadoLectura {
  ok: boolean;
  respaldo: Respaldo | null;
  /** Qué salió mal, en algo que se pueda leer en pantalla. */
  error: string | null;
  /** Qué trae dentro, para poder decirlo ANTES de reemplazar nada. */
  resumen: string | null;
}

const CONTADORES: ReadonlyArray<[keyof Instantanea, string, string]> = [
  ['transacciones', 'movimiento', 'movimientos'],
  ['cajitas', 'cuenta o cajita', 'cuentas y cajitas'],
  ['cajitaMovimientos', 'ajuste', 'ajustes'],
  ['metas', 'meta', 'metas'],
  ['categorias', 'categoría propia', 'categorías propias'],
  ['contactos', 'contacto', 'contactos'],
  ['presupuestos', 'presupuesto', 'presupuestos'],
  ['recurrentes', 'recurrente', 'recurrentes'],
];

/** "34 movimientos · 3 cuentas y cajitas · 1 meta" */
export const resumirRespaldo = (datos: Instantanea): string => {
  const partes = CONTADORES.map(([clave, singular, plural]) => {
    const n = datos[clave]?.length ?? 0;
    return n === 0 ? null : `${n} ${n === 1 ? singular : plural}`;
  }).filter((x): x is string => x !== null);

  return partes.length === 0 ? 'Está vacío' : partes.join(' · ');
};

/**
 * Lee un archivo de respaldo, sin confiar en nada de lo que trae.
 *
 * Un JSON malo aquí no es un error de programa: es alguien a punto de reemplazar
 * su contabilidad entera con basura. Se valida la forma antes de dejar que
 * llegue a la restauración, y cualquier lista que falte se completa vacía en vez
 * de dejar que reviente al leerla.
 */
export const leerRespaldo = (texto: string): ResultadoLectura => {
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return {
      ok: false,
      respaldo: null,
      error: 'Ese archivo no es un respaldo de la app: no se pudo leer como JSON.',
      resumen: null,
    };
  }

  if (typeof crudo !== 'object' || crudo === null) {
    return { ok: false, respaldo: null, error: 'El archivo está vacío o no tiene datos.', resumen: null };
  }

  const obj = crudo as Partial<Respaldo>;
  if (typeof obj.version !== 'number' || obj.datos === undefined || obj.datos === null) {
    return {
      ok: false,
      respaldo: null,
      error: 'Falta la información que identifica al archivo como un respaldo de esta app.',
      resumen: null,
    };
  }

  // Un respaldo del futuro puede traer campos que esta versión no sabe leer, y
  // restaurarlo a medias sería peor que rechazarlo.
  if (obj.version > VERSION_RESPALDO) {
    return {
      ok: false,
      respaldo: null,
      error: `Ese respaldo es de una versión más nueva (${obj.version}) que esta app. Actualiza la app antes de restaurarlo.`,
      resumen: null,
    };
  }

  // Cada lista se toma solo si de verdad es una lista. Lo que falte entra vacío:
  // un respaldo viejo, hecho antes de que existieran los presupuestos, sigue
  // siendo restaurable.
  const vacia = instantaneaVacia();
  const datos = { ...vacia } as Instantanea;
  for (const clave of Object.keys(vacia) as (keyof Instantanea)[]) {
    const valor = (obj.datos as unknown as Record<string, unknown>)[clave];
    if (Array.isArray(valor)) {
      (datos[clave] as unknown[]) = valor;
    }
  }

  return {
    ok: true,
    respaldo: { version: obj.version, generado: obj.generado ?? '', datos },
    error: null,
    resumen: resumirRespaldo(datos),
  };
};

/** Nombre con fecha, para que dos respaldos no se pisen en la carpeta. */
export const nombreDeArchivo = (hoy: string): string => `finanzas-${hoy}.json`;

const escapar = (valor: string): string =>
  /[",\n;]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;

/**
 * Los movimientos como CSV, para abrirlos en una hoja de cálculo.
 *
 * Separado por punto y coma y no por coma: Excel en español interpreta la coma
 * como separador decimal, y un archivo con comas le queda todo en una columna.
 */
export const aCsv = (datos: Instantanea, nombreDeCuenta: (id: string | null) => string): string => {
  const filas = [
    ['Fecha', 'Tipo', 'Monto', 'Categoría', 'Descripción', 'Cuenta'].join(';'),
    ...[...datos.transacciones]
      .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn))
      .map((tx) =>
        [
          tx.occurredOn,
          tx.kind,
          // Sin separadores de miles ni símbolo: una hoja de cálculo necesita un
          // número, no un texto bonito.
          String(tx.amountCop),
          escapar(tx.category),
          escapar(tx.description),
          escapar(nombreDeCuenta(tx.cuentaId)),
        ].join(';'),
      ),
  ];

  return filas.join('\n');
};

/** Cuánto pesa lo que se va a exportar, dicho en algo legible. */
export const pesoAproximado = (texto: string): string => {
  const kb = texto.length / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
};

/** Reexportado para la pantalla, que muestra totales junto al resumen. */
export { formatCop };
