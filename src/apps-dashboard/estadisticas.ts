import { fechaBogota } from '../lib/analitica';

/** Una fila cruda de `visitas`, tal como la devuelve Supabase. */
export interface Visita {
  ruta: string;
  referente: string | null;
  pais: string;
  dispositivo: string;
  visitante: string;
  creado_en: string;
}

export interface Conteo {
  clave: string;
  n: number;
}

export interface DiaResumen {
  fecha: string;
  vistas: number;
  visitantes: number;
}

export interface Resumen {
  vistas: number;
  /**
   * Suma de los visitantes distintos de cada día, NO personas distintas del
   * periodo.
   *
   * No es un atajo: la huella rota a medianoche justo para que nadie pueda ser
   * seguido entre días, así que la misma persona el lunes y el martes son dos
   * huellas y no hay forma —ni debe haberla— de saber que era la misma. El
   * número honesto es "visitantes por día, sumados", y así se nombra en la
   * pantalla.
   */
  visitantes: number;
  porDia: DiaResumen[];
  rutas: Conteo[];
  paises: Conteo[];
  dispositivos: Conteo[];
  referentes: Conteo[];
}

/** Los últimos `n` días en Bogotá, del más viejo al más nuevo. */
export const diasHasta = (hoy: Date, n: number): string[] => {
  const dias: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    dias.push(fechaBogota(new Date(hoy.getTime() - i * 86_400_000)));
  }
  return dias;
};

/** De más visto a menos. Empates por orden alfabético, para que no bailen. */
const ordenar = (cuenta: Map<string, number>): Conteo[] =>
  [...cuenta.entries()]
    .map(([clave, n]) => ({ clave, n }))
    .sort((a, b) => (b.n !== a.n ? b.n - a.n : a.clave.localeCompare(b.clave, 'es')));

const sumar = (cuenta: Map<string, number>, clave: string): void => {
  cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
};

/**
 * Lo que el panel muestra, calculado desde las filas crudas.
 *
 * `dias` llega desde afuera y no se deduce de los datos a propósito: un día sin
 * una sola visita tiene que aparecer como cero en la gráfica. Si se dedujera de
 * las filas, los días vacíos desaparecerían y la línea mentiría diciendo que el
 * tráfico fue parejo.
 */
export const resumir = (visitas: readonly Visita[], dias: readonly string[]): Resumen => {
  const enRango = new Set(dias);

  const rutas = new Map<string, number>();
  const paises = new Map<string, number>();
  const dispositivos = new Map<string, number>();
  const referentes = new Map<string, number>();

  const porDia = new Map<string, { vistas: number; visitantes: Set<string> }>();
  for (const dia of dias) porDia.set(dia, { vistas: 0, visitantes: new Set() });

  for (const v of visitas) {
    const dia = fechaBogota(new Date(v.creado_en));
    if (!enRango.has(dia)) continue;

    const acumulado = porDia.get(dia);
    if (!acumulado) continue;
    acumulado.vistas += 1;
    acumulado.visitantes.add(v.visitante);

    sumar(rutas, v.ruta);
    sumar(paises, v.pais);
    sumar(dispositivos, v.dispositivo);
    // "Directo" no es un dominio, es la ausencia de uno: alguien que escribió
    // la dirección o la tenía guardada. Merece su fila igual.
    sumar(referentes, v.referente ?? 'directo');
  }

  const serie = dias.map((fecha) => {
    const acumulado = porDia.get(fecha);
    return {
      fecha,
      vistas: acumulado?.vistas ?? 0,
      visitantes: acumulado?.visitantes.size ?? 0,
    };
  });

  return {
    vistas: serie.reduce((t, d) => t + d.vistas, 0),
    visitantes: serie.reduce((t, d) => t + d.visitantes, 0),
    porDia: serie,
    rutas: ordenar(rutas),
    paises: ordenar(paises),
    dispositivos: ordenar(dispositivos),
    referentes: ordenar(referentes),
  };
};

/** Nombres de país en español, para los que de verdad van a aparecer. */
const PAISES: Record<string, string> = {
  CO: 'Colombia',
  US: 'Estados Unidos',
  MX: 'México',
  ES: 'España',
  AR: 'Argentina',
  CL: 'Chile',
  PE: 'Perú',
  EC: 'Ecuador',
  BR: 'Brasil',
  VE: 'Venezuela',
  CA: 'Canadá',
  DE: 'Alemania',
  FR: 'Francia',
  GB: 'Reino Unido',
  IT: 'Italia',
  PT: 'Portugal',
  NL: 'Países Bajos',
  IN: 'India',
  XX: 'Sin determinar',
};

export const nombreDePais = (codigo: string): string => PAISES[codigo] ?? codigo;

/** Bandera por código ISO, armada con los caracteres regionales de Unicode. */
export const banderaDePais = (codigo: string): string => {
  if (codigo === 'XX' || !/^[A-Z]{2}$/.test(codigo)) return '🌐';
  return String.fromCodePoint(
    ...[...codigo].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 'A'.charCodeAt(0))),
  );
};
