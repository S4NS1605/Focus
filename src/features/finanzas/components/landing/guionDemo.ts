import type { Transaction } from '../../types';
import { bogotaDate, shiftDays } from '../../lib/localDate';

/**
 * El guion del teléfono de la portada: lo que "alguien" va anotando mientras
 * el visitante mira. Cada paso es una frase dicha y el movimiento en que se
 * convierte.
 *
 * Las cifras son de cuantía creíble para Colombia y cuentan una historia
 * coherente —un independiente que cobra un proyecto y va gastando el mes—
 * porque un mockup con cifras al azar se nota y deja de vender.
 */
export interface PasoDemo {
  /** Lo que se "dicta", tecleado letra por letra en la barra del micrófono. */
  frase: string;
  kind: 'gasto' | 'ingreso';
  amountCop: number;
  category: string;
  description: string;
}

export const GUION: readonly PasoDemo[] = [
  {
    frase: 'gasté 45 mil en almuerzo',
    kind: 'gasto',
    amountCop: 45_000,
    category: 'comida',
    description: 'Almuerzo',
  },
  {
    frase: 'me pagaron el proyecto, 2 millones y medio',
    kind: 'ingreso',
    amountCop: 2_500_000,
    category: 'ingreso',
    description: 'Pago de cliente',
  },
  {
    frase: 'uber a la oficina 15.300',
    kind: 'gasto',
    amountCop: 15_300,
    category: 'transporte',
    description: 'Uber a la oficina',
  },
  {
    frase: 'mercado en el éxito 184 mil',
    kind: 'gasto',
    amountCop: 184_200,
    category: 'mercado',
    description: 'Mercado en el Éxito',
  },
  {
    frase: 'netflix 38900',
    kind: 'gasto',
    amountCop: 38_900,
    category: 'entretenimiento',
    description: 'Netflix',
  },
  {
    frase: 'pagué la luz, 92 lucas',
    kind: 'gasto',
    amountCop: 92_400,
    category: 'servicios',
    description: 'Luz',
  },
  {
    frase: 'tanqueé 120 mil',
    kind: 'gasto',
    amountCop: 120_000,
    category: 'transporte',
    description: 'Gasolina',
  },
  {
    frase: 'cita con el odontólogo 180 mil',
    kind: 'gasto',
    amountCop: 180_000,
    category: 'salud',
    description: 'Odontólogo',
  },
];

/** Con lo que arranca la pantalla: el mes ya empezado, no una app en blanco. */
export const SALDO_INICIAL = 3_180_000;
export const GASTOS_INICIALES = 1_842_600;
export const INGRESOS_INICIALES = 4_100_000;

const hoy = bogotaDate();
const ayer = shiftDays(hoy, -1);

const movimiento = (
  id: string,
  kind: 'gasto' | 'ingreso',
  amountCop: number,
  category: string,
  description: string,
  occurredOn: string,
  orden: number,
): Transaction => ({
  id,
  kind,
  amountCop,
  category,
  description,
  occurredOn,
  cuentaId: null,
  rawTranscript: description,
  // El orden dentro del día lo decide createdAt, así que se fabrica creciente
  // para que la lista quede en el orden en que se escribió el guion.
  createdAt: `${occurredOn}T${String(8 + orden).padStart(2, '0')}:00:00.000Z`,
});

/** Lo que ya estaba anotado antes de que el visitante llegara. */
export const MOVIMIENTOS_BASE: readonly Transaction[] = [
  movimiento('b1', 'gasto', 32_000, 'comida', 'Desayuno con Ana', ayer, 3),
  movimiento('b2', 'gasto', 210_000, 'hogar', 'Arreglo de la lavadora', ayer, 2),
  movimiento('b3', 'gasto', 18_500, 'transporte', 'Taxi al centro', ayer, 1),
];

/** El paso N del guion, convertido en movimiento de hoy. */
export const movimientoDelPaso = (paso: PasoDemo, i: number): Transaction =>
  movimiento(`g${i}`, paso.kind, paso.amountCop, paso.category, paso.description, hoy, i + 1);

export const MES_ACTUAL = hoy.slice(0, 7);
