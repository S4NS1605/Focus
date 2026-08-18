import { fechaBogota, horaBogota } from '../lib/analitica';

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

export interface HoraResumen {
  hora: number;
  etiqueta: string;
  vistas: number;
}

export interface Resumen {
  vistas: number;
  visitantes: number;
  porDia: DiaResumen[];
  porHora: HoraResumen[];
  rutas: Conteo[];
  paises: Conteo[];
  dispositivos: Conteo[];
  referentes: Conteo[];
  fuentes: Conteo[];
}

/** Clasifica un host referente en una categoría legible con icono. */
export const clasificarFuente = (referente: string): { tipo: string; nombre: string; icono: string } => {
  const ref = referente.toLowerCase();
  if (ref === 'directo' || !ref) return { tipo: 'directo', nombre: 'Directo / Marcador', icono: '🌐' };
  if (ref.includes('linkedin')) return { tipo: 'social', nombre: 'LinkedIn', icono: '💼' };
  if (ref.includes('whatsapp') || ref.includes('wa.me')) return { tipo: 'social', nombre: 'WhatsApp', icono: '💬' };
  if (ref.includes('instagram') || ref.includes('ig.me')) return { tipo: 'social', nombre: 'Instagram', icono: '📸' };
  if (ref.includes('twitter') || ref.includes('x.com') || ref.includes('t.co')) return { tipo: 'social', nombre: 'Twitter / X', icono: '🐦' };
  if (ref.includes('facebook') || ref.includes('fb.com')) return { tipo: 'social', nombre: 'Facebook', icono: '👥' };
  if (ref.includes('github')) return { tipo: 'dev', nombre: 'GitHub', icono: '🐱' };
  if (ref.includes('google')) return { tipo: 'search', nombre: 'Google Search', icono: '🔍' };
  if (ref.includes('bing') || ref.includes('yahoo') || ref.includes('duckduckgo')) return { tipo: 'search', nombre: 'Buscador', icono: '🔎' };
  if (ref.includes('vercel') || ref.includes('render')) return { tipo: 'dev', nombre: 'Hosting / Cloud', icono: '☁️' };
  return { tipo: 'web', nombre: ref, icono: '🔗' };
};

/** Los últimos `n` días en Bogotá, del más viejo al más nuevo. */
export const diasHasta = (hoy: Date, n: number): string[] => {
  const dias: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    dias.push(fechaBogota(new Date(hoy.getTime() - i * 86_400_000)));
  }
  return dias;
};

/** De más visto a menos. Empates por orden alfabético. */
const ordenar = (cuenta: Map<string, number>): Conteo[] =>
  [...cuenta.entries()]
    .map(([clave, n]) => ({ clave, n }))
    .sort((a, b) => (b.n !== a.n ? b.n - a.n : a.clave.localeCompare(b.clave, 'es')));

const sumar = (cuenta: Map<string, number>, clave: string): void => {
  cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
};

export const resumir = (visitas: readonly Visita[], dias: readonly string[]): Resumen => {
  const enRango = new Set(dias);

  const rutas = new Map<string, number>();
  const paises = new Map<string, number>();
  const dispositivos = new Map<string, number>();
  const referentes = new Map<string, number>();
  const fuentesMap = new Map<string, number>();

  const porDia = new Map<string, { vistas: number; visitantes: Set<string> }>();
  for (const dia of dias) porDia.set(dia, { vistas: 0, visitantes: new Set() });

  const horasVistas = new Array(24).fill(0);

  for (const v of visitas) {
    const d = new Date(v.creado_en);
    const dia = fechaBogota(d);
    if (!enRango.has(dia)) continue;

    const acumulado = porDia.get(dia);
    if (!acumulado) continue;
    acumulado.vistas += 1;
    acumulado.visitantes.add(v.visitante);

    const h = horaBogota(d);
    horasVistas[h] += 1;

    sumar(rutas, v.ruta);
    sumar(paises, v.pais);
    sumar(dispositivos, v.dispositivo);
    
    const ref = v.referente ?? 'directo';
    sumar(referentes, ref);

    const infoFuente = clasificarFuente(ref);
    sumar(fuentesMap, `${infoFuente.icono} ${infoFuente.nombre}`);
  }

  const serie = dias.map((fecha) => {
    const acumulado = porDia.get(fecha);
    return {
      fecha,
      vistas: acumulado?.vistas ?? 0,
      visitantes: acumulado?.visitantes.size ?? 0,
    };
  });

  const totalVistas = serie.reduce((t, d) => t + d.vistas, 0);

  const porHora: HoraResumen[] = horasVistas.map((vistas, hora) => ({
    hora,
    etiqueta: `${hora.toString().padStart(2, '0')}:00`,
    vistas,
  }));

  return {
    vistas: totalVistas,
    visitantes: serie.reduce((t, d) => t + d.visitantes, 0),
    porDia: serie,
    porHora,
    rutas: ordenar(rutas),
    paises: ordenar(paises),
    dispositivos: ordenar(dispositivos),
    referentes: ordenar(referentes),
    fuentes: ordenar(fuentesMap),
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
