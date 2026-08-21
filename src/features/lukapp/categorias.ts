import {
  Baby,
  Bus,
  Book,
  Cat,
  Coffee,
  DollarSign,
  Dumbbell,
  Film,
  Gamepad2,
  Gift,
  Home,
  Lightbulb,
  Package,
  PawPrint,
  PiggyBank,
  Pill,
  Plane,
  RefreshCw,
  Scissors,
  Shirt,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Utensils,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CATEGORIES, CATEGORY_COLOR, CATEGORY_ICON, CATEGORY_LABELS } from './types';
import type { Category } from './types';

/**
 * What a movement stores in `category`.
 *
 * A plain string rather than the `Category` union, because a movement filed
 * under a category the user invented has to keep that key forever — including
 * after the category is renamed, recoloured, or deleted. The union still exists
 * and still drives everything that has to reason about categories it did not
 * invent: the dictation parser, the statement templates, the signal engine.
 */
export type CategoriaClave = string;

/** A category the user made. Built-ins are not stored — they are code. */
export interface CategoriaPersonal {
  /** Also the value written to `transaccion.category`. */
  id: string;
  nombre: string;
  /** A key in ICONOS_CATEGORIA. */
  icon: string;
  /** `#RRGGBB`. */
  color: string;
  createdAt: string;
  /**
   * Set instead of deleting the row. Movements filed here keep pointing at it,
   * and archiving must never turn last month's spending into "categoría
   * desconocida" — it only takes the category out of the pickers.
   */
  archivedAt: string | null;
}

/**
 * Icons offered when creating a category, listed one by one for the same reason
 * as cajitaIconos.ts: indexing lucide's barrel dynamically keeps all ~1500
 * components in the bundle.
 */
const ICONOS: Record<string, LucideIcon> = {
  ShoppingCart,
  Utensils,
  Coffee,
  Bus,
  Lightbulb,
  Pill,
  Home,
  Film,
  Gamepad2,
  Shirt,
  Book,
  RefreshCw,
  PiggyBank,
  DollarSign,
  Package,
  Dumbbell,
  PawPrint,
  Cat,
  Baby,
  Gift,
  Plane,
  Smartphone,
  Scissors,
  Wrench,
  Sparkles,
};

export const ICONOS_CATEGORIA = Object.keys(ICONOS);

export const iconoDeCategoria = (nombre: string | null | undefined): LucideIcon =>
  (nombre && ICONOS[nombre]) || Package;

/**
 * Palabras que hacen sugerir cada ícono al crear una categoría, en el orden en
 * que se revisan. Es un mapa de palabras clave y no una llamada a un modelo:
 * el catálogo son 24 íconos fijos, así que no hay nada que un LLM adivine
 * mejor que un match de texto, y esto responde al tecleo sin red ni demora.
 * Es solo el punto de partida — `SelectorIcono` deja escogerlo a mano.
 */
const PISTAS_ICONO: Array<{ icono: string; palabras: string[] }> = [
  { icono: 'ShoppingCart', palabras: ['mercado', 'super', 'supermercado', 'compras'] },
  { icono: 'Utensils', palabras: ['comida', 'restaurante', 'almuerzo', 'cena', 'domicilio', 'comer'] },
  { icono: 'Coffee', palabras: ['cafe', 'café', 'snack', 'onces', 'desayuno'] },
  { icono: 'Bus', palabras: ['transporte', 'bus', 'taxi', 'uber', 'gasolina', 'carro', 'metro', 'parqueadero'] },
  { icono: 'Lightbulb', palabras: ['servicios', 'luz', 'agua', 'gas', 'internet', 'recibo', 'energia', 'energía'] },
  { icono: 'Smartphone', palabras: ['celular', 'telefono', 'teléfono', 'plan', 'datos', 'streaming', 'suscripcion', 'suscripción'] },
  { icono: 'Pill', palabras: ['salud', 'medico', 'médico', 'medicina', 'droguer', 'eps', 'doctor', 'clinica', 'clínica'] },
  { icono: 'Dumbbell', palabras: ['gimnasio', 'gym', 'ejercicio', 'deporte'] },
  { icono: 'Home', palabras: ['hogar', 'casa', 'arriendo', 'alquiler', 'administracion', 'administración'] },
  { icono: 'Film', palabras: ['entretenimiento', 'cine', 'pelicula', 'película', 'salida', 'rumba', 'fiesta'] },
  { icono: 'Gamepad2', palabras: ['juego', 'videojuego', 'gaming'] },
  { icono: 'Shirt', palabras: ['ropa', 'zapatos', 'vestido', 'moda'] },
  { icono: 'Scissors', palabras: ['peluqueria', 'peluquería', 'belleza', 'estetica', 'estética', 'manicure', 'barberia', 'barbería'] },
  { icono: 'Book', palabras: ['educacion', 'educación', 'colegio', 'universidad', 'curso', 'libro', 'matricula', 'matrícula'] },
  { icono: 'RefreshCw', palabras: ['transferencia', 'traslado', 'giro'] },
  { icono: 'PiggyBank', palabras: ['ahorro', 'ahorros'] },
  { icono: 'DollarSign', palabras: ['ingreso', 'sueldo', 'salario', 'pago', 'nomina', 'nómina'] },
  { icono: 'PawPrint', palabras: ['mascota', 'perro', 'veterinaria'] },
  { icono: 'Cat', palabras: ['gato'] },
  { icono: 'Baby', palabras: ['bebe', 'bebé', 'hijo', 'hija', 'pañal', 'panal'] },
  { icono: 'Gift', palabras: ['regalo', 'cumpleanos', 'cumpleaños', 'navidad'] },
  { icono: 'Plane', palabras: ['viaje', 'vuelo', 'vacaciones', 'tiquete'] },
  { icono: 'Wrench', palabras: ['reparacion', 'reparación', 'mantenimiento', 'arreglo', 'ferreteria', 'ferretería'] },
];

const sinTildes = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Adivina el ícono a partir del nombre que se está tecleando. `Package` si nada calza. */
export const sugerirIconoCategoria = (nombre: string): string => {
  const texto = sinTildes(nombre.trim());
  if (texto === '') return 'Package';
  for (const { icono, palabras } of PISTAS_ICONO) {
    if (palabras.some((palabra) => texto.includes(sinTildes(palabra)))) return icono;
  }
  return 'Package';
};

/**
 * Colours offered in the picker. These are the same hues the built-in
 * categories use, which were chosen so neighbours in a sorted breakdown never
 * read as the same colour. Reusing them keeps a custom category visually part
 * of the set instead of an outlier.
 */
export const COLORES_CATEGORIA = [
  '#F59E0B',
  '#F97316',
  '#EF4444',
  '#EC4899',
  '#C084FC',
  '#A78BFA',
  '#6366F1',
  '#3B82F6',
  '#38BDF8',
  '#14B8A6',
  '#10B981',
  '#84CC16',
] as const;

/** One category, resolved — whatever its origin, whatever its state. */
export interface EntradaCategoria {
  clave: CategoriaClave;
  nombre: string;
  Icono: LucideIcon;
  color: string;
  /** True when the user created it, which is what makes it editable. */
  propia: boolean;
  archivada: boolean;
}

const deBase = (c: Category): EntradaCategoria => ({
  clave: c,
  nombre: CATEGORY_LABELS[c],
  Icono: CATEGORY_ICON[c],
  color: CATEGORY_COLOR[c],
  propia: false,
  archivada: false,
});

const dePersonal = (c: CategoriaPersonal): EntradaCategoria => ({
  clave: c.id,
  nombre: c.nombre,
  Icono: iconoDeCategoria(c.icon),
  color: c.color,
  propia: true,
  archivada: c.archivedAt !== null,
});

export interface Catalogo {
  /** Built-ins then active custom ones — what a picker should show. */
  lista: EntradaCategoria[];
  /** Every category a movement could currently point at, archived included. */
  todas: EntradaCategoria[];
  /** Always answers. Never throws, never returns undefined. */
  de(clave: CategoriaClave): EntradaCategoria;
}

/**
 * A key that resolves to nothing — a category deleted outright in the database,
 * or a slug from an older version. Rendering it as its own bare key is worse
 * than useless, so it degrades to the neutral built-in while keeping the key,
 * which means the movement still counts, still groups, and can be re-filed.
 */
const desconocida = (clave: CategoriaClave): EntradaCategoria => ({
  ...deBase('otros'),
  clave,
});

export const hacerCatalogo = (personales: readonly CategoriaPersonal[] = []): Catalogo => {
  const base = CATEGORIES.map(deBase);
  const propias = [...personales]
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .map(dePersonal);

  const todas = [...base, ...propias];
  const porClave = new Map(todas.map((e) => [e.clave, e]));

  return {
    lista: [...base, ...propias.filter((c) => !c.archivada)],
    todas,
    de: (clave) => porClave.get(clave) ?? desconocida(clave),
  };
};

/** The empty catalogue, for code paths that never got user categories. */
export const CATALOGO_BASE = hacerCatalogo([]);

/**
 * A stable key for a new category. Prefixed so it can never collide with a
 * built-in slug, now or when a built-in is added later.
 */
export const nuevaClaveCategoria = (): string =>
  `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const ES_CLAVE_PROPIA = (clave: CategoriaClave): boolean => clave.startsWith('p-');
