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
  // Mercado
  exito: 'mercado', d1: 'mercado', ara: 'mercado', jumbo: 'mercado',
  olimpica: 'mercado', carulla: 'mercado', makro: 'mercado', zapatoca: 'mercado',
  colsubsidio: 'mercado', isimo: 'mercado', macro: 'mercado', alkosto: 'mercado',
  surtimax: 'mercado', merqueo: 'mercado', mercadolibre: 'otros', pricemart: 'mercado',
  megatiendas: 'mercado', supermercado: 'mercado', carniceria: 'mercado',
  fruver: 'mercado', plaza: 'mercado', panamericana: 'otros',
  
  // Comida / Restaurantes
  rappi: 'comida', ifood: 'comida', mcdonalds: 'comida', frisby: 'comida',
  kokoriko: 'comida', juanvaldez: 'comida', starbucks: 'comida', subway: 'comida',
  kfc: 'comida', burgerking: 'comida', elcorral: 'comida', crepes: 'comida',
  waffles: 'comida', crepesywaffles: 'comida', tostao: 'comida', oma: 'comida',
  pizzahut: 'comida', dominospizza: 'comida', dominos: 'comida', papajohns: 'comida',
  wok: 'comida', srwok: 'comida', jenos: 'comida', hornitos: 'comida',
  archies: 'comida', pbc: 'comida', bbc: 'entretenimiento',
  
  // Transporte y Vehículos
  transmilenio: 'transporte', sitp: 'transporte', metro: 'transporte',
  uber: 'transporte', didi: 'transporte', indriver: 'transporte',
  cabify: 'transporte', terpel: 'transporte', primax: 'transporte',
  texaco: 'transporte', esso: 'transporte', biomax: 'transporte',
  picap: 'transporte', peaje: 'transporte', parqueadero: 'transporte',
  soat: 'transporte', tecno: 'transporte', mecanico: 'transporte',
  gasolina: 'transporte', pasajes: 'transporte', tiquetes: 'transporte',
  avianca: 'transporte', latam: 'transporte', wingo: 'transporte',
  
  // Transferencias / Finanzas
  nequi: 'transferencia', daviplata: 'transferencia', bancolombia: 'transferencia',
  davivienda: 'transferencia', bbva: 'transferencia', lulo: 'transferencia',
  nubank: 'transferencia', dale: 'transferencia', uala: 'transferencia',
  cajero: 'transferencia', corresponsal: 'transferencia', cuota: 'otros',
  dmf: 'otros', rtf: 'otros',
  
  // Servicios y Hogar
  claro: 'servicios', movistar: 'servicios', tigo: 'servicios', etb: 'servicios',
  ptm: 'servicios', wom: 'servicios', directv: 'servicios',
  epm: 'servicios', codensa: 'servicios', vanti: 'servicios', enel: 'servicios',
  emcali: 'servicios', triplea: 'servicios', acueducto: 'servicios',
  gas: 'servicios', luz: 'servicios', agua: 'servicios', internet: 'servicios',
  admin: 'hogar', administracion: 'hogar', arriendo: 'servicios',
  homecenter: 'hogar', easy: 'hogar',
  
  // Salud y Cuidado Personal
  farmatodo: 'salud', cruzverde: 'salud', locatel: 'salud',
  copidrogas: 'salud', larebaja: 'salud', pasteur: 'salud',
  smartfit: 'salud', bodytech: 'salud', actionfitness: 'salud',
  sanitas: 'salud', sura: 'salud', compensar: 'salud',
  eps: 'salud', prepagada: 'salud', medico: 'salud', odontologo: 'salud',
  barberia: 'salud', peluqueria: 'salud', unas: 'salud',
  
  // Entretenimiento, Ropa y Salidas
  netflix: 'entretenimiento', spotify: 'entretenimiento', hbo: 'entretenimiento',
  disney: 'entretenimiento', youtube: 'entretenimiento', steam: 'entretenimiento',
  apple: 'entretenimiento', playstore: 'entretenimiento', primevideo: 'entretenimiento',
  cinecolombia: 'entretenimiento', cinemark: 'entretenimiento', procinal: 'entretenimiento',
  zara: 'ropa', hmm: 'ropa', bershka: 'ropa', stradivarius: 'ropa',
  falabella: 'ropa', arturocalle: 'ropa',
  koaj: 'ropa', pullandbear: 'ropa', gef: 'ropa', puntohblanco: 'ropa',
  
  // Educación
  platzi: 'educacion', udemy: 'educacion', domestika: 'educacion',
  
  // Otras tiendas
  dollarcity: 'hogar', miniso: 'hogar', ikea: 'hogar',
  
  // Mascotas
  laika: 'hogar', agrocampo: 'hogar',
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
  elcorral: 'El Corral', smartfit: 'SmartFit', bodytech: 'Bodytech',
  cinecolombia: 'Cine Colombia', dollarcity: 'Dollarcity', miniso: 'Miniso',
};

const KEYWORDS_BY_CATEGORY: Record<Category, readonly string[]> = {
  mercado: ['mercado', 'supermercado', 'plaza', 'verduras', 'frutas', 'carne',
    'huevos', 'leche', 'arroz', 'granero', 'tienda', 'abarrotes', 'despensa', 'viveres'],
  comida: ['almuerzo', 'desayuno', 'cena', 'comida', 'restaurante', 'domicilio',
    'domicilios', 'pizza', 'hamburguesa', 'empanada', 'empanadas', 'cafe',
    'tinto', 'helado', 'pan', 'panaderia', 'corrientazo', 'bandeja', 'asado',
    'sushi', 'onces', 'algo', 'asados', 'asadero', 'carnes', 'malteada',
    'snack', 'snacks', 'postre', 'dulces', 'dulce', 'pollo', 'arepa'],
  transporte: ['gasolina', 'transporte', 'taxi', 'bus', 'pasaje', 'pasajes',
    'peaje', 'parqueadero', 'parqueo', 'moto', 'carro', 'avion', 'vuelo',
    'tiquete', 'tiquetes', 'soat', 'mecanico', 'llantas', 'lavado', 'peajes'],
  servicios: ['luz', 'agua', 'internet', 'celular', 'factura', 'recibo',
    'arriendo', 'administracion', 'energia', 'telefono', 'datos', 'recarga',
    'servicios', 'acueducto', 'gas', 'television', 'cable', 'plan'],
  salud: ['farmacia', 'medicina', 'medicamentos', 'drogueria', 'medico',
    'doctor', 'eps', 'odontologo', 'dentista', 'gym', 'gimnasio', 'examenes',
    'terapia', 'vitaminas', 'droga', 'pastillas', 'cita', 'psicologo', 'optica'],
  hogar: ['muebles', 'ferreteria', 'aseo', 'detergente', 'jabon', 'escoba',
    'bombillo', 'reparacion', 'arreglo', 'herramientas', 'cocina', 'colchon',
    'mascota', 'perro', 'gato', 'veterinaria', 'cuido', 'purina'],
  entretenimiento: ['cine', 'bar', 'cerveza', 'cervezas', 'salida', 'fiesta',
    'concierto', 'juego', 'videojuego', 'suscripcion', 'paseo', 'discoteca',
    'trago', 'tragos', 'rumba', 'entradas', 'licor', 'suscripciones', 'apuestas'],
  ropa: ['ropa', 'camisa', 'camiseta', 'camisetas', 'pantalon', 'zapatos',
    'tenis', 'chaqueta', 'vestido', 'gorra', 'sudadera', 'botas', 'pantaloneta', 'jeans'],
  educacion: ['curso', 'libro', 'libros', 'universidad', 'semestre',
    'matricula', 'colegio', 'cuaderno', 'cuadernos', 'utiles', 'clase',
    'clases', 'certificacion', 'diplomado', 'preuniversitario', 'preicfes',
    'instituto', 'academia', 'pension'],
  transferencia: ['transferencia', 'giro', 'envio', 'retiro', 'cajero',
    'consignacion', 'prestamo'],
  ahorro: ['ahorro', 'ahorros', 'cdt', 'inversion', 'fondo', 'fidu'],
  ingreso: ['salario', 'sueldo', 'nomina', 'quincena', 'bono', 'prima',
    'cesantias', 'venta', 'ventas', 'honorarios', 'freelance', 'propina',
    'comision', 'subsidio', 'reembolso', 'ingreso'],
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
