// Kept out of FinanzasShell.tsx so that file only exports a component — mixing
// constants with components breaks Fast Refresh, which oxlint flags via
// react/only-export-components.
import {
  BarChart2,
  Landmark,
  CreditCard,
  FileText,
  HardDriveDownload,
  MoreHorizontal,
  PiggyBank,
  ReceiptText,
  Settings2,
  Tag,
  Target,
  TrendingUp,
  Users,
  Repeat,
} from 'lucide-react';

/**
 * Every section the app has. Pockets and goals share "Ahorro" because a goal's
 * progress is usually just a pocket's balance, and debts share "Deudas" with
 * cards for the same reason: they are one subject read the same way.
 */
export const SECTIONS = [
  { id: 'resumen', icon: BarChart2, label: 'Resumen', color: 'text-sky-500 dark:text-sky-400' },
  { id: 'movimientos', icon: ReceiptText, label: 'Movimientos', color: 'text-amber-500 dark:text-amber-400' },
  { id: 'asesor', icon: FileText, label: 'Asesor', color: 'text-fuchsia-500 dark:text-fuchsia-400' },
  { id: 'cuentas', icon: Landmark, label: 'Cuentas', color: 'text-sky-500 dark:text-sky-400' },
  { id: 'ahorro', icon: PiggyBank, label: 'Ahorro', color: 'text-emerald-500 dark:text-emerald-400' },
  { id: 'deudas', icon: CreditCard, label: 'Deudas', color: 'text-rose-500 dark:text-rose-400' },
  { id: 'recurrentes', icon: Repeat, label: 'Recurrentes', color: 'text-orange-500 dark:text-orange-400' },
  { id: 'contactos', icon: Users, label: 'Contactos', color: 'text-teal-500 dark:text-teal-400' },
  { id: 'tendencias', icon: TrendingUp, label: 'Tendencias', color: 'text-violet-500 dark:text-violet-400' },
  { id: 'analista', icon: FileText, label: 'Analista', color: 'text-blue-500 dark:text-blue-400' },
  { id: 'configuracion', icon: Settings2, label: 'Configuración', color: 'text-stone-500 dark:text-stone-400' },
] as const;

/**
 * What the phone's bottom bar shows. Five is the ceiling — past that the targets
 * get too narrow to hit and the labels stop being readable — so the rest live
 * behind "Más". The desktop sidebar has room for all of them and shows the lot.
 */
export const SECCIONES_BARRA: readonly SectionId[] = [
  'resumen',
  'movimientos',
  'asesor',
  'cuentas',
  'ahorro',
];

export const SECCIONES_MAS: readonly SectionId[] = [
  'deudas',
  'recurrentes',
  'contactos',
  'tendencias',
  'analista',
  'configuracion',
];

/**
 * El sidebar de escritorio esconde estas -- viven como pestañas dentro de
 * Configuración en su lugar, para no crecer a 11 filas: con el texto agrandado
 * de Windows (125-150%) eso se vuelve una barra lateral gigantesca.
 *
 * El celular no cambia: su barra inferior y la hoja "Más" ya resuelven el
 * desbordamiento de otra forma, así que Contactos y Tendencias se quedan como
 * sus propias entradas ahí, exactamente igual que hoy.
 */
export const OCULTAS_EN_SIDEBAR_ESCRITORIO: readonly SectionId[] = ['contactos', 'tendencias'];

export type SectionId = typeof SECTIONS[number]['id'];

export const sectionLabel = (section: SectionId): string =>
  SECTIONS.find((s) => s.id === section)?.label ?? '';

/** The two halves of the Ahorro section. */
export const PESTANAS_AHORRO = [
  { id: 'cajitas', icon: PiggyBank, label: 'Cajitas', color: 'text-emerald-500 dark:text-emerald-400' },
  { id: 'metas', icon: Target, label: 'Metas', color: 'text-violet-500 dark:text-violet-400' },
] as const;

export type PestanaAhorro = typeof PESTANAS_AHORRO[number]['id'];

/**
 * Las seis caras de Configuración en escritorio -- solo ahí: en el celular
 * esta sección sigue mostrando nada más que Ajustes (saldos), como siempre.
 * Categorías, 4x1000 y Respaldo vivían apiladas una debajo de otra dentro de
 * ConfiguracionView; Contactos y Tendencias se alcanzan en el celular por su
 * propio botón en "Más". Las cinco se separan en pestañas iguales aquí.
 */
export const PESTANAS_CONFIGURACION = [
  { id: 'ajustes', icon: Settings2, label: 'Ajustes', color: 'text-stone-500 dark:text-stone-400' },
  { id: 'categorias', icon: Tag, label: 'Categorías', color: 'text-amber-500 dark:text-amber-400' },
  { id: 'gmf', icon: Landmark, label: '4x1000', color: 'text-rose-500 dark:text-rose-400' },
  { id: 'respaldo', icon: HardDriveDownload, label: 'Respaldo', color: 'text-sky-500 dark:text-sky-400' },
  { id: 'contactos', icon: Users, label: 'Contactos', color: 'text-teal-500 dark:text-teal-400' },
  { id: 'tendencias', icon: TrendingUp, label: 'Tendencias', color: 'text-violet-500 dark:text-violet-400' },
] as const;

export type PestanaConfiguracion = typeof PESTANAS_CONFIGURACION[number]['id'];


export const ICONO_MAS = MoreHorizontal;
