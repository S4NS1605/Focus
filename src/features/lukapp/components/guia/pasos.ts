import type { SectionId } from '../../sections';

/**
 * Lo que dice la guía, separado de lo que la pinta.
 *
 * Cada paso apunta a un elemento real de la app por `data-guia`. Ese atributo
 * es el contrato: la guía no sabe nada de la estructura de ninguna vista, solo
 * busca una marca. Así se puede reordenar una pantalla entera sin que la guía
 * se entere, y si la marca desaparece el paso se salta solo en vez de tumbar
 * la app.
 */
export interface PasoGuia {
  /** El valor de `data-guia` del elemento al que apunta. */
  ancla: string;
  titulo: string;
  texto: string;
  /** Cuánto se separa el recorte del elemento. Las píldoras piden menos aire. */
  aire?: number;
  /** El radio del recorte, para que abrace la forma de lo que ilumina. */
  radio?: number;
}

/**
 * EL RECORRIDO BÁSICO — sale una sola vez, al terminar la bienvenida.
 *
 * Son cuatro y no diez a propósito. Lo que alguien necesita para no estar
 * perdido el primer día es saber qué número está mirando, cómo se mete algo, y
 * dónde está el resto. Todo lo demás se explica cuando llegue.
 */
export const PASOS_BASICOS: PasoGuia[] = [
  {
    ancla: 'saldo',
    titulo: 'Lo que tienes',
    texto:
      'La suma de todas tus cuentas, ahorros y efectivo. Es el único número grande de la app, y por eso es el que importa.',
    aire: 10,
    radio: 14,
  },
  {
    ancla: 'anotar',
    titulo: 'Anota hablando',
    texto:
      'Toca el micrófono y dilo como se lo dirías a un amigo: «gasté 45 mil en almuerzo». Se entiende el monto, la categoría y qué fue. El + es para escribirlo y la lupa para buscar.',
    aire: 10,
    radio: 999,
  },
  {
    ancla: 'nav',
    titulo: 'Cinco sitios',
    texto:
      'Inicio es donde vives. Dinero es dónde está la plata. Mes es lo que se calcula. Asesor responde preguntas sobre tus números. Y Más es todo lo que se configura.',
    aire: 6,
    radio: 18,
  },
  {
    ancla: 'nav-ajustes',
    titulo: 'Aquí está lo demás',
    texto:
      'Cuentas, categorías propias, topes de gasto, metas de ahorro, pagos fijos, los extractos del banco y el 4x1000. Es la puerta que menos se ve y la que más guarda.',
    aire: 4,
    radio: 14,
  },
];

/**
 * LOS GLOBOS DE EXPLORACIÓN — uno por sitio, la primera vez que se entra.
 *
 * Van anclados a la pestaña y no al contenido de la vista, y es una decisión
 * deliberada: alguien que acaba de registrarse tiene Dinero casi vacío, así que
 * cualquier ancla dentro de la pantalla puede no existir todavía. La pestaña
 * está siempre.
 */
export const PASOS_POR_SECCION: Partial<Record<SectionId, PasoGuia>> = {
  dinero: {
    ancla: 'nav-dinero',
    titulo: 'Dónde está tu plata',
    texto:
      'Cada cuenta, ahorro, deuda y tarjeta con su saldo. Las Cajitas te dejan apartar plata para algo concreto sin sacarla del banco.',
    aire: 4,
    radio: 14,
  },
  mes: {
    ancla: 'nav-mes',
    titulo: 'Lo que se calcula',
    texto:
      'En qué se te fue el mes por categoría, cómo va contra los meses anteriores y si te estás pasando de los topes que te pusiste.',
    aire: 4,
    radio: 14,
  },
  asesor: {
    ancla: 'nav-asesor',
    titulo: 'Pregúntale a tus números',
    texto:
      'Escríbele como a una persona: «¿en qué gasté más este mes?». Responde con tus movimientos, no con consejos genéricos de internet.',
    aire: 4,
    radio: 14,
  },
};
