import type { CategoriaPersonal } from '../categorias';
import { normalizeWord } from './numerals';

/**
 * Convierte las categorías que el usuario creó en frases que el parser puede
 * reconocer dentro de lo dictado.
 *
 * El parser de fábrica solo conoce sus trece categorías y un puñado de palabras
 * por cada una. Si tú creaste "Mascotas" o "Cosas de la casa", nada de eso le
 * suena. Esto cierra ese hueco sin listas escritas a mano: el nombre que le
 * pusiste ES el vocabulario.
 */
export interface FraseCategoria {
  /** El nombre normalizado, palabra por palabra. */
  seq: string[];
  /** La clave de la categoría — su id, que es lo que queda escrito en el movimiento. */
  id: string;
}

/**
 * Las categorías activas como frases, de la más larga a la más corta.
 *
 * Más larga primero por la misma razón que las cuentas: "Cosas de la casa" no
 * puede resolverse por un "casa" suelto si ambas existen. Se conserva el nombre
 * completo (incluidas palabras como "de la") y se exige que aparezca consecutivo
 * en lo dictado: es preciso y casi nunca se equivoca. Las variantes sueltas
 * ("cosas para la casa") las irá aprendiendo la segunda parte, la que aprende de
 * tus correcciones.
 *
 * Se matchea contra los tokens que sobreviven a quitar el monto, así que un
 * nombre de categoría que sea un número ("mil") jamás corrompe una cifra: ese
 * token ya se consumió antes de llegar aquí.
 */
export const frasesDeCategorias = (
  categorias: readonly CategoriaPersonal[],
): FraseCategoria[] =>
  categorias
    .filter((c) => c.archivedAt === null)
    .map((c) => ({ id: c.id, seq: c.nombre.split(/\s+/).map(normalizeWord).filter(Boolean) }))
    .filter((f) => f.seq.length > 0)
    .sort((a, b) => b.seq.length - a.seq.length);
