// All dates are Bogota calendar days, never UTC timestamps. The transaction list
// groups by day, so using UTC would file everything dictated after 7 PM local
// under tomorrow — visibly wrong the moment you use the app in the evening.

const BOGOTA = 'America/Bogota';

const PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: BOGOTA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Bogota calendar day as 'YYYY-MM-DD'. */
export const bogotaDate = (now: Date = new Date()): string => {
  const parts = PARTS.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const HORA = new Intl.DateTimeFormat('en-US', {
  timeZone: BOGOTA,
  hour: '2-digit',
  hour12: false,
});

/** Hora del día en Bogotá, 0..23. */
export const bogotaHora = (now: Date = new Date()): number => {
  const valor = HORA.formatToParts(now).find((p) => p.type === 'hour')?.value ?? '0';
  // En hour12:false la medianoche sale como '24' en algunos entornos.
  return Number(valor) % 24;
};

/** Desde qué hora, y hasta cuál, se mantiene despierto el servidor del asesor. */
export const ASESOR_DESDE = 7;
export const ASESOR_HASTA = 21;

/**
 * Si el asesor está dentro de su horario de servicio.
 *
 * El servidor vive en el plan gratuito de Render, que duerme por inactividad. Un
 * ping programado lo mantiene despierto solo de día, porque tenerlo 24/7 se
 * comería casi toda la cuota mensual. Fuera de ese rango no está caído: está
 * descansando, y la interfaz lo dice con esas palabras.
 *
 * El límite superior es inclusivo: a las 9 p.m. en punto todavía es horario.
 */
export const asesorEnHorario = (now: Date = new Date()): boolean => {
  const h = bogotaHora(now);
  return h >= ASESOR_DESDE && h <= ASESOR_HASTA;
};

const MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];
const MONTHS_LONG = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Shifts a 'YYYY-MM-DD' string by whole days without touching timezones. */
export const shiftDays = (isoDate: string, days: number): string => {
  const [y, m, d] = isoDate.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  return bogotaDateFromUtcParts(utc);
};

const bogotaDateFromUtcParts = (date: Date): string => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Whole days from `desde` to `hasta`, negative when `hasta` is earlier.
 *
 * Built on Date.UTC rather than local Date construction so it can never be off
 * by one across a DST boundary — Colombia has no DST, but the browser running
 * this might be anywhere.
 */
export const daysBetween = (desde: string, hasta: string): number => {
  const [y1, m1, d1] = desde.split('-').map(Number);
  const [y2, m2, d2] = hasta.split('-').map(Number);
  const MS_POR_DIA = 86_400_000;
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / MS_POR_DIA);
};

/** "Hoy" / "Ayer" / "28 jul" for a day header. */
export const dayLabel = (isoDate: string, today: string = bogotaDate()): string => {
  if (isoDate === today) return 'Hoy';
  if (isoDate === shiftDays(today, -1)) return 'Ayer';

  const [, m, d] = isoDate.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
};

/** "julio 2026" for the balance header. */
export const monthLabel = (isoDate: string): string => {
  const [y, m] = isoDate.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
};

/** 'YYYY-MM' key, for filtering a month's transactions. */
export const monthKey = (isoDate: string): string => isoDate.slice(0, 7);

/** Shifts a 'YYYY-MM' key by whole months, rolling the year over. */
export const shiftMonth = (month: string, delta: number): string => {
  const [y, m] = month.split('-').map(Number);
  // Work in a 0-based absolute month count so December -> January needs no
  // special case in either direction.
  const absolute = y * 12 + (m - 1) + delta;
  const year = Math.floor(absolute / 12);
  const monthIndex = absolute - year * 12;
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
};

/** "julio 2026" from a 'YYYY-MM' key. */
export const monthKeyLabel = (month: string): string => {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
};
