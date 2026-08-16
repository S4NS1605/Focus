import type { Category, TxKind } from '../types';

// Every key in this file MUST be pre-normalized (lowercase, no accents) or it
// can never match a token. `vocabulary.test.ts` asserts that, plus the critical
// invariant that no keyword collides with a numeral word — a keyword like `mil`
// would silently corrupt amounts.

/**
 * Direction phrases, longest sequence first. Order is load-bearing: `me costó`
 * must be tested before any rule that sees a leading `me` and assumes income,
 * because "me costó 80 mil" is an EXPENSE while "me pagaron 80 mil" is income.
 */
export const KIND_PHRASES: ReadonlyArray<{ seq: readonly string[]; kind: TxKind }> = [
  { seq: ['me', 'toco', 'pagar'], kind: 'gasto' },
  { seq: ['me', 'costo'], kind: 'gasto' },
  { seq: ['me', 'salio'], kind: 'gasto' },
  { seq: ['me', 'cobraron'], kind: 'gasto' },
  { seq: ['me', 'descontaron'], kind: 'gasto' },
  { seq: ['me', 'entro'], kind: 'ingreso' },
  { seq: ['me', 'entraron'], kind: 'ingreso' },
  { seq: ['me', 'pagaron'], kind: 'ingreso' },
  { seq: ['me', 'consignaron'], kind: 'ingreso' },
  { seq: ['me', 'llego'], kind: 'ingreso' },
  { seq: ['me', 'llegaron'], kind: 'ingreso' },
  { seq: ['me', 'transfirieron'], kind: 'ingreso' },
  { seq: ['me', 'devolvieron'], kind: 'ingreso' },
  { seq: ['me', 'giraron'], kind: 'ingreso' },
  { seq: ['me', 'abonaron'], kind: 'ingreso' },
  { seq: ['me', 'depositaron'], kind: 'ingreso' },
  { seq: ['me', 'prestaron'], kind: 'ingreso' },

  { seq: ['gaste'], kind: 'gasto' },
  { seq: ['pague'], kind: 'gasto' },
  { seq: ['compre'], kind: 'gasto' },
  { seq: ['merque'], kind: 'gasto' },
  { seq: ['saque'], kind: 'gasto' },
  { seq: ['retire'], kind: 'gasto' },
  { seq: ['inverti'], kind: 'gasto' },
  { seq: ['transferi'], kind: 'gasto' },
  // Colombianism: "cancelé la factura" means PAID it, not annulled it.
  { seq: ['cancele'], kind: 'gasto' },
  { seq: ['abone'], kind: 'gasto' },
  { seq: ['consigne'], kind: 'gasto' },
  { seq: ['recargue'], kind: 'gasto' },
  { seq: ['aporte'], kind: 'gasto' },

  { seq: ['recibi'], kind: 'ingreso' },
  { seq: ['gane'], kind: 'ingreso' },
  { seq: ['cobre'], kind: 'ingreso' },
  { seq: ['vendi'], kind: 'ingreso' },
];

/** Every token that appears anywhere in KIND_PHRASES. */
export const KIND_WORDS: ReadonlySet<string> = new Set(
  KIND_PHRASES.flatMap((p) => p.seq),
);

/** Known Colombian brands and services. Checked before generic keywords. */
export const MERCHANTS: Record<string, Category> = {
  exito: 'mercado', d1: 'mercado', ara: 'mercado', jumbo: 'mercado',
  olimpica: 'mercado', carulla: 'mercado', makro: 'mercado', zapatoca: 'mercado',
  rappi: 'comida', ifood: 'comida', mcdonalds: 'comida', frisby: 'comida',
  kokoriko: 'comida', juanvaldez: 'comida', starbucks: 'comida', subway: 'comida',
  transmilenio: 'transporte', sitp: 'transporte', metro: 'transporte',
  uber: 'transporte', didi: 'transporte', indriver: 'transporte',
  cabify: 'transporte', terpel: 'transporte', primax: 'transporte',
  nequi: 'transferencia', daviplata: 'transferencia', bancolombia: 'transferencia',
  davivienda: 'transferencia', bbva: 'transferencia', lulo: 'transferencia',
  claro: 'servicios', movistar: 'servicios', tigo: 'servicios', etb: 'servicios',
  ptm: 'servicios',
  epm: 'servicios', codensa: 'servicios', vanti: 'servicios', enel: 'servicios',
  farmatodo: 'salud', cruzverde: 'salud', locatel: 'salud', colsubsidio: 'salud',
  netflix: 'entretenimiento', spotify: 'entretenimiento', hbo: 'entretenimiento',
  disney: 'entretenimiento', youtube: 'entretenimiento', steam: 'entretenimiento',
  // App-store billing lines ("COMPRA EN APPLE COM BILL"), alongside the
  // streaming services above rather than under servicios: on a personal
  // statement these are overwhelmingly apps and media, not utilities.
  apple: 'entretenimiento', playstore: 'entretenimiento',
  udemy: 'educacion', platzi: 'educacion', coursera: 'educacion',
  homecenter: 'hogar', falabella: 'ropa', zara: 'ropa', arturocalle: 'ropa',
};

/** Restores accents and casing that dictation flattens. */
export const MERCHANT_DISPLAY: Record<string, string> = {
  exito: 'Éxito', d1: 'D1', ara: 'Ara', jumbo: 'Jumbo', olimpica: 'Olímpica',
  carulla: 'Carulla', makro: 'Makro', rappi: 'Rappi', mcdonalds: "McDonald's",
  frisby: 'Frisby', kokoriko: 'Kokoriko', juanvaldez: 'Juan Valdez',
  transmilenio: 'TransMilenio', sitp: 'SITP', metro: 'Metro', uber: 'Uber',
  didi: 'DiDi', indriver: 'inDriver', terpel: 'Terpel', primax: 'Primax',
  nequi: 'Nequi', daviplata: 'Daviplata', bancolombia: 'Bancolombia',
  davivienda: 'Davivienda', claro: 'Claro', movistar: 'Movistar', tigo: 'Tigo',
  etb: 'ETB', epm: 'EPM', codensa: 'Codensa', vanti: 'Vanti',
  farmatodo: 'Farmatodo', cruzverde: 'Cruz Verde', locatel: 'Locatel',
  netflix: 'Netflix', spotify: 'Spotify', udemy: 'Udemy', platzi: 'Platzi',
  homecenter: 'Homecenter', falabella: 'Falabella', arturocalle: 'Arturo Calle',
};

const KEYWORDS_BY_CATEGORY: Record<Category, readonly string[]> = {
  mercado: ['mercado', 'supermercado', 'plaza', 'verduras', 'frutas', 'carne',
    'huevos', 'leche', 'arroz', 'granero', 'tienda', 'abarrotes'],
  comida: ['almuerzo', 'desayuno', 'cena', 'comida', 'restaurante', 'domicilio',
    'domicilios', 'pizza', 'hamburguesa', 'empanada', 'empanadas', 'cafe',
    'tinto', 'helado', 'pan', 'panaderia', 'corrientazo', 'bandeja', 'asado',
    'sushi', 'onces', 'algo', 'asados', 'asadero', 'carnes', 'malteada',
    'snack', 'snacks', 'postre', 'dulces', 'dulce'],
  transporte: ['gasolina', 'transporte', 'taxi', 'bus', 'pasaje', 'pasajes',
    'peaje', 'parqueadero', 'parqueo', 'moto', 'carro', 'avion', 'vuelo',
    'tiquete', 'tiquetes', 'soat', 'mecanico', 'llantas', 'lavado'],
  servicios: ['luz', 'agua', 'internet', 'celular', 'factura', 'recibo',
    'arriendo', 'administracion', 'energia', 'telefono', 'datos', 'recarga',
    'servicios', 'acueducto'],
  salud: ['farmacia', 'medicina', 'medicamentos', 'drogueria', 'medico',
    'doctor', 'eps', 'odontologo', 'dentista', 'gym', 'gimnasio', 'examenes',
    'terapia', 'vitaminas', 'droga'],
  hogar: ['muebles', 'ferreteria', 'aseo', 'detergente', 'jabon', 'escoba',
    'bombillo', 'reparacion', 'arreglo', 'herramientas', 'cocina', 'colchon'],
  entretenimiento: ['cine', 'bar', 'cerveza', 'cervezas', 'salida', 'fiesta',
    'concierto', 'juego', 'videojuego', 'suscripcion', 'paseo', 'discoteca',
    'trago', 'tragos', 'rumba', 'entradas'],
  ropa: ['ropa', 'camisa', 'camiseta', 'camisetas', 'pantalon', 'zapatos',
    'tenis', 'chaqueta', 'vestido', 'gorra', 'sudadera'],
  educacion: ['curso', 'libro', 'libros', 'universidad', 'semestre',
    'matricula', 'colegio', 'cuaderno', 'cuadernos', 'utiles', 'clase',
    'clases', 'certificacion', 'diplomado', 'preuniversitario', 'preicfes',
    'instituto', 'academia'],
  transferencia: ['transferencia', 'giro', 'envio', 'retiro', 'cajero',
    'consignacion'],
  ahorro: ['ahorro', 'ahorros', 'cdt', 'inversion', 'fondo'],
  ingreso: ['salario', 'sueldo', 'nomina', 'quincena', 'bono', 'prima',
    'cesantias', 'venta', 'ventas', 'honorarios', 'freelance', 'propina',
    'comision', 'subsidio', 'reembolso'],
  otros: [],
};

/** Flattened keyword -> category lookup, for O(1) token-equality matching. */
export const CATEGORY_KEYWORDS: Record<string, Category> = {};
for (const category of Object.keys(KEYWORDS_BY_CATEGORY) as Category[]) {
  for (const word of KEYWORDS_BY_CATEGORY[category]) {
    CATEGORY_KEYWORDS[word] = category;
  }
}

/**
 * Words that imply income on their own, with no direction verb present:
 * "el salario de este mes" needs no "me entró" to be understood.
 */
export const INCOME_IMPLIED: ReadonlySet<string> = new Set([
  'salario', 'sueldo', 'nomina', 'quincena', 'bono', 'prima', 'cesantias',
  'venta', 'ventas', 'honorarios', 'freelance', 'propina', 'comision',
  'subsidio', 'reembolso',
]);

/**
 * Nouns that make a preceding number a QUANTITY rather than an amount, so
 * "compré 2 pizzas por 30 mil" picks 30000 and not 2.
 */
export const COUNT_NOUNS: ReadonlySet<string> = new Set([
  'pizzas', 'unidades', 'personas', 'horas', 'dias', 'semanas', 'meses',
  'anos', 'veces', 'kilos', 'libras', 'cajas', 'cafes', 'tintos', 'pasajes',
  'litros', 'galones', 'paquetes', 'bolsas', 'docenas', 'panes', 'empanadas',
  'cervezas', 'tragos', 'entradas', 'tiquetes', 'camisetas', 'pares',
  'almuerzos', 'clases', 'cuadernos', 'libros', 'meses',
]);

/** A number right after one of these is very likely the amount. */
export const AMOUNT_CUES: ReadonlySet<string> = new Set([
  'por', 'de', 'en', 'a', 'vale', 'valen', 'cuesta', 'cuestan', 'costo',
  'salio', 'son', '$', 'cuanto', 'valor'
]);

/** Dropped when building the description. May overlap numeral words freely —
 *  this set is only consulted after the amount span has been removed. */
export const STOPWORDS: ReadonlySet<string> = new Set([
  'en', 'de', 'por', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'del', 'al', 'pesos', 'peso', 'plata', 'para', 'con', 'que', 'hoy', 'me',
  'se', 'lo', 'mi', 'y', 'a', 'e', 'o', 'es', 'fue', 'este', 'esta', 'ya',
  'solo', 'como', 'mas',
]);

/** Payment methods the parser recognizes. */
export const PAYMENT_METHODS: Record<string, string> = {
  tarjeta: 'tarjeta_credito',
  tarjetacredito: 'tarjeta_credito',
  credito: 'tarjeta_credito',
  debito: 'tarjeta_debito',
  nequi: 'billetera_digital',
  daviplata: 'billetera_digital',
  bancolombia: 'transferencia_bancaria',
  transferencia: 'transferencia_bancaria',
  transferi: 'transferencia_bancaria',
  efectivo: 'efectivo',
  cheque: 'cheque',
  bitcoin: 'cripto',
  crypto: 'cripto',
};
