// Kept out of FinanzasShell.tsx so that file only exports a component — mixing
// constants with components breaks Fast Refresh, which oxlint flags via
// react/only-export-components.
import { BarChart3, Home, Menu, UserCircle, Wallet } from 'lucide-react';

/**
 * Los cuatro sitios a los que se puede ir. Cuatro, no once.
 *
 * Antes esto declaraba 11 secciones, y encima había 8 sub-pestañas, una hoja
 * "Más" con 6 cosas dentro y un menú lateral que en el computador mostraba
 * unas cosas distintas que el celular. Cuatro sistemas de navegación para las
 * mismas funciones. Nada de eso se borró: se reagrupó por lo que la gente
 * quiere hacer, en vez de por cómo están guardados los datos.
 *
 *   Inicio    — cuánto tengo y qué pasó. Es donde se vive.
 *   Dinero    — dónde está la plata: cuentas, ahorros, deudas y tarjetas.
 *   Mes       — todo lo que se calcula: gráficas, topes, comparaciones.
 *   Ajustes   — todo lo que se configura una vez y no se vuelve a tocar.
 *
 * Sin colores. Antes cada entrada tenía su propio tono (rosa, turquesa,
 * violeta...) repartidos sin ningún criterio: no había forma de explicar por
 * qué Deudas era rosa. El color en esta app significa una sola cosa —verde
 * entró, rojo salió— y gastarlo en decorar el menú le quitaba ese significado.
 * Lo que está activo se ve porque está en blanco fuerte, no porque tenga color.
 */
export const SECTIONS = [
  { id: 'inicio', icon: Home, label: 'Inicio' },
  { id: 'dinero', icon: Wallet, label: 'Dinero' },
  { id: 'mes', icon: BarChart3, label: 'Mes' },
  { id: 'asesor', icon: UserCircle, label: 'Asesor' },
  { id: 'ajustes', icon: Menu, label: 'Más' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

export const sectionLabel = (section: SectionId): string =>
  SECTIONS.find((s) => s.id === section)?.label ?? '';

/**
 * Las cosas que se abren DENTRO de Ajustes, cada una como una hoja a pantalla
 * completa. Antes eran pestañas marcadas `hidden lg:grid`, y eso escondía un
 * problema serio: en el celular la barra de pestañas no se pintaba nunca, así
 * que Categorías, el 4x1000, el Respaldo y el Informe eran literalmente
 * inalcanzables desde un teléfono. Como filas de una lista sí existen en todas
 * partes.
 *
 * El orden no es alfabético, es por frecuencia: lo que más se toca, arriba.
 */
export const PANELES_AJUSTES = [
  { id: 'cuentas', label: 'Cuentas y saldos', ayuda: 'Cuánto tienes en cada una' },
  { id: 'categorias', label: 'Categorías', ayuda: 'Crea las tuyas o cambia las que hay' },
  { id: 'topes', label: 'Topes de gasto', ayuda: 'Te avisa antes de que te pases' },
  { id: 'metas', label: 'Metas de ahorro', ayuda: 'Ponte un objetivo y mira cuánto te falta' },
  { id: 'recurrentes', label: 'Pagos fijos', ayuda: 'Lo que te cobran todos los meses' },
  { id: 'extractos', label: 'Importar extractos', ayuda: 'Sube el PDF que te manda el banco' },
  { id: 'gmf', label: 'Impuesto 4x1000', ayuda: 'Cuánto te está costando y en qué cuenta' },
  {
    id: 'nombres',
    label: 'Nombres repetidos',
    ayuda: 'Une a la misma persona escrita de dos formas',
  },
  { id: 'respaldo', label: 'Copia de seguridad', ayuda: 'Descarga todo, o vuelve a un respaldo' },
] as const;

export type PanelAjustes = (typeof PANELES_AJUSTES)[number]['id'];
