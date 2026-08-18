import { normalizeWord } from './numerals';

export interface ConfianzaGranular {
  monto: number;
  tipo: number;
  categoria: number;
  cuenta: number;
  metodo: number;
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
