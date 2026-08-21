import type { CategoriaClave, Category } from '../types';

/**
 * Chart colours, separate from the identity colours in `types.ts`.
 *
 * Those are chips and icons, where the label sits right beside the colour and
 * carries the meaning on its own. A chart has no such backup: the segment IS the
 * data, so its palette has to actually survive being looked at.
 *
 * The app's identity palette does not. Run through the validator, `#F59E0B`
 * (Mercado) and `#F97316` (Comida) come out at ΔE 9.6 — below the 15 floor, which
 * means they are hard to tell apart *with full colour vision*, never mind
 * colour-blindness. Those are two of the most frequent categories on a real
 * statement.
 *
 * These eight are the reference palette's categorical theme, verified with
 * `validate_palette.js` on the adjacent pairlist a stacked bar actually uses:
 * light — CVD ΔE 9.1, normal-vision 19.6; dark — CVD 8.4, normal-vision 19.3.
 * Both modes pass every hard gate.
 *
 * Dark is not a flip of light. Each step was chosen against the dark surface,
 * which is why the greens differ but `#008300` repeats: it already sits correctly
 * on both.
 */
interface Paso {
  claro: string;
  oscuro: string;
}

const SLOTS: readonly Paso[] = [
  { claro: '#2a78d6', oscuro: '#3987e5' }, // 1 azul
  { claro: '#eb6834', oscuro: '#d95926' }, // 2 naranja
  { claro: '#1baf7a', oscuro: '#199e70' }, // 3 aqua
  { claro: '#eda100', oscuro: '#c98500' }, // 4 amarillo
  { claro: '#e87ba4', oscuro: '#d55181' }, // 5 magenta
  { claro: '#008300', oscuro: '#008300' }, // 6 verde
  { claro: '#4a3aa7', oscuro: '#9085e9' }, // 7 violeta
  { claro: '#e34948', oscuro: '#e66767' }, // 8 rojo
];

/**
 * Category to slot.
 *
 * Fixed per category, never assigned by rank: if a colour followed "biggest this
 * month", every category would change colour as the month moved, and the chart
 * would stop being readable across months.
 *
 * Thirteen categories exceed what colour can carry — past about seven, adjacent
 * classes blur no matter which hues are picked. The chart never shows more than
 * six segments (top five plus "Otros"), so the slots repeat only among
 * categories that rarely appear together, and every segment is directly
 * labelled regardless.
 */
const SLOT_DE: Record<Category, number> = {
  transporte: 0,
  comida: 1,
  salud: 2,
  mercado: 3,
  entretenimiento: 4,
  ingreso: 5,
  educacion: 6,
  servicios: 7,
  // Lower-frequency categories reuse slots. They almost never share a chart with
  // their twin, and the direct label resolves it when they do.
  hogar: 2,
  ropa: 4,
  ahorro: 5,
  transferencia: 0,
  otros: 6,
};

/**
 * A slot for a category this file has never heard of — one the user created.
 *
 * Derived from the key rather than from position in the list, for the same
 * reason the built-in table is fixed: a colour that followed rank would repaint
 * every chart as the month changed. The key never changes, so neither does the
 * colour.
 *
 * The category's own colour, the one picked when creating it, is not used here.
 * That colour identifies it on chips and icons; charts draw from this validated
 * ramp instead, exactly as the built-in categories already do — a chart whose
 * hues came from thirteen independent choices is where adjacent segments start
 * reading as the same colour.
 */
const slotDerivado = (clave: string): number => {
  let h = 0;
  for (let i = 0; i < clave.length; i += 1) h = (h * 31 + clave.charCodeAt(i)) | 0;
  return Math.abs(h) % SLOTS.length;
};

export const colorDeCategoria = (categoria: CategoriaClave, oscuro: boolean): string => {
  const indice = categoria in SLOT_DE ? SLOT_DE[categoria as Category] : slotDerivado(categoria);
  const slot = SLOTS[indice];
  return oscuro ? slot.oscuro : slot.claro;
};

/** Neutral for the folded tail, deliberately outside the categorical theme. */
export const COLOR_OTROS = { claro: '#8a8a80', oscuro: '#9a9a90' };
