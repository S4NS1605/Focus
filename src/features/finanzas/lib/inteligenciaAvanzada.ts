import { normalizeWord } from './numerals';

export interface ConfianzaGranular {
  monto: number;
  tipo: number;
  categoria: number;
  cuenta: number;
  metodo: number;
}

export interface RecomendacionCategoria {
  categoria: string;
  score: number;
  fuente: string;
}

/** Distancia Levenshtein simple para fuzzy matching. */
export const distanciaLevenshtein = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
};

/** Busca la palabra más similar dentro de un diccionario. */
export const buscarSimilar = (palabra: string, diccionario: readonly string[], umbral = 2): string | null => {
  const norm = normalizeWord(palabra);
  let mejor: string | null = null;
  let distanciaMinima = umbral;
  for (const opcion of diccionario) {
    const dist = distanciaLevenshtein(norm, normalizeWord(opcion));
    if (dist < distanciaMinima) {
      distanciaMinima = dist;
      mejor = opcion;
    }
  }
  return mejor;
};

/** Parsea "hace 3 días", "el viernes pasado", "mañana", etc. Retorna offset de días. */
export const parsearTiempoRelativo = (texto: string): number | null => {
  const norm = normalizeWord(texto);

  // Futuro: "mañana", "el próximo viernes"
  if (/manana/.test(norm)) return 1;
  if (/pasado manana/.test(norm)) return 2;
  if (/proximo|que viene/.test(norm)) return 7;

  // Pasado: "hace 3 días", "ayer", "hace una semana"
  const match = norm.match(/hace (\d+|una|dos|tres) ?(dia|dias|semana|semanas|mes|meses)/);
  if (match) {
    const numStr = match[1];
    const unit = match[2];
    const n = numStr === 'una' ? 1 : numStr === 'dos' ? 2 : numStr === 'tres' ? 3 : parseInt(numStr, 10);
    if (unit.startsWith('dia')) return -n;
    if (unit.startsWith('semana')) return -n * 7;
    if (unit.startsWith('mes')) return -n * 30;
  }
  if (/ayer/.test(norm)) return -1;
  if (/antier/.test(norm)) return -2;

  return null;
};

/** Detecta si hay múltiples montos o categorías en una frase. */
export const detectarMultiplesEntidades = (texto: string): { tipo: 'multi_categoria' | 'multi_monto' | 'ninguno'; count: number } => {
  const norm = texto.toLowerCase();

  // "Netflix + Spotify" o "café y desayuno"
  if (/(.*) ?\+ (.*)|(.*) y (.*)/.test(norm)) {
    return { tipo: 'multi_categoria', count: 2 };
  }

  // "3 cafés" o "dos pizzas"
  if (/(\d+|dos|tres|cuatro|cinco) (cafes|pizzas|hamburguesas|cervezas|almuerzos)/.test(norm)) {
    return { tipo: 'multi_monto', count: 2 };
  }

  return { tipo: 'ninguno', count: 1 };
};

/** Extrae la confianza de cada dimensión por separado. */
export const calcularConfianzaGranular = (
  monto: number | null,
  tipoSeguro: boolean,
  categoriaFuente: string,
  cuentaEncontrada: boolean,
  metodoDetectado: boolean,
): ConfianzaGranular => {
  return {
    monto: monto !== null ? 0.95 : 0.0,
    tipo: tipoSeguro ? 0.9 : 0.5,
    categoria: categoriaFuente === 'usuario' ? 0.95 : categoriaFuente === 'merchant' ? 0.85 : categoriaFuente === 'aprendida' ? 0.7 : 0.4,
    cuenta: cuentaEncontrada ? 0.9 : 0.0,
    metodo: metodoDetectado ? 0.8 : 0.0,
  };
};

/** Promedio ponderado de confianzas dimensionales. */
export const promedioConfianza = (g: ConfianzaGranular): number => {
  const pesos = { monto: 0.25, tipo: 0.25, categoria: 0.3, cuenta: 0.1, metodo: 0.1 };
  return (
    g.monto * pesos.monto +
    g.tipo * pesos.tipo +
    g.categoria * pesos.categoria +
    g.cuenta * pesos.cuenta +
    g.metodo * pesos.metodo
  );
};
