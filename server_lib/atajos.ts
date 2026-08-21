import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { categorizarDescripcion } from './plantillas/categorizar.ts';

/**
 * El puente entre un pago con el teléfono y una fila del libro.
 *
 * Lo que pasa por fuera de este fichero: el iPhone dispara un Atajo cuando se
 * hace un pago con Apple Pay, el Atajo lee monto, comercio y fecha, y los manda
 * por `POST` a `/api/atajo/movimiento`. Aquí está lo único de eso que tiene
 * lógica de verdad —validar la llave, entender el monto, fijar el día— y está
 * separado del Express para poder probarlo sin levantar un servidor.
 *
 * Todo lo de aquí es puro salvo `generarLlave`, que necesita azar.
 */

/** Marca el texto como una llave de esta app cuando aparece suelto en un log. */
export const PREFIJO_LLAVE = 'atj_';

/**
 * Una llave nueva. 32 bytes de azar criptográfico en base64url.
 *
 * Va en una cabecera HTTP y el usuario la pega a mano en el Atajo, así que
 * base64url y no hex: mismo número de bits en dos tercios de los caracteres, y
 * sin `+`, `/` ni `=` que se rompan al copiar o al ir en una URL.
 */
export const generarLlave = (): string => PREFIJO_LLAVE + randomBytes(32).toString('base64url');

/**
 * Lo único que se guarda de una llave.
 *
 * La tabla nunca ve el texto de la llave: guarda esto. Es sha256 pelado y no un
 * bcrypt/argon a propósito — lo que protege a una contraseña de un ataque de
 * diccionario es que la contraseña es adivinable, y estas son 256 bits de azar
 * uniforme. No hay diccionario que las alcance, y sha256 se puede calcular en
 * cada petición sin volver lenta una ruta que el teléfono llama al pagar.
 */
export const hashLlave = (llave: string): string =>
  createHash('sha256').update(llave.trim(), 'utf8').digest('hex');

/** Los últimos cuatro caracteres: lo justo para reconocerla en una lista. */
export const pistaDeLlave = (llave: string): string => llave.trim().slice(-4);

/**
 * La llave que trae la petición, venga como venga.
 *
 * Se acepta `Bearer <llave>` y también la llave pelada. No es dejadez: en la
 * app Atajos las cabeceras se escriben en dos campitos de texto, y escribir
 * "Bearer " delante del valor es justo el paso que la gente se salta. Rechazar
 * por eso sería fallar por una formalidad que aquí no distingue nada.
 */
export const llaveDeCabecera = (encabezado: string | null | undefined): string | null => {
  if (!encabezado) return null;
  const limpio = encabezado.trim();
  const sinPrefijo = /^bearer\s+/i.test(limpio) ? limpio.replace(/^bearer\s+/i, '').trim() : limpio;
  return sinPrefijo.length > 0 ? sinPrefijo : null;
};

/** Más allá de esto no hay pago, hay un dedo que se quedó pegado en el 0. */
const MAX_PESOS = 999_999_999_999;

/**
 * Cuántos pesos son, escríbalo como lo escriba el teléfono.
 *
 * El problema real: el monto llega como texto ya formateado, y ni Apple ni la
 * app Atajos prometen en qué formato. Según la región del teléfono, veinticuatro
 * mil pesos puede salir como `24000`, `24.000`, `$24,000.00`, `24.000,00` o
 * `COP 24,000`. Y el punto es lo peligroso: en Colombia `24.000` son veinticuatro
 * mil, en Estados Unidos son veinticuatro.
 *
 * La regla que desempata: el ÚLTIMO separador es decimal solo si le siguen
 * exactamente dos dígitos. Con eso `24.000` y `24,000` son miles —tres dígitos—
 * y `24,000.00` y `24.000,00` son veinticuatro mil con centavos. El resto de
 * separadores son de miles y se van.
 *
 * El resultado se redondea a pesos enteros porque la columna es `bigint` y el
 * peso no tiene fracción en la práctica.
 */
export const montoEnPesos = (valor: unknown): number | null => {
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) return null;
    const pesos = Math.round(valor);
    return pesos > 0 && pesos <= MAX_PESOS ? pesos : null;
  }

  if (typeof valor !== 'string') return null;

  // Fuera el símbolo de moneda, el código ISO, los espacios (incluido el
  // espacio duro que mete el formateador de iOS) y cualquier otra letra.
  const crudo = valor.replace(/[^\d.,-]/g, '');
  if (!/\d/.test(crudo)) return null;
  // Un menos en cualquier posición: una devolución, no un gasto. No se le
  // cambia el signo y se le pasa la mano — se rechaza y se dice por qué.
  if (crudo.includes('-')) return null;

  const ultimoPunto = crudo.lastIndexOf('.');
  const ultimaComa = crudo.lastIndexOf(',');
  const corte = Math.max(ultimoPunto, ultimaComa);

  let texto: string;
  if (corte === -1) {
    texto = crudo;
  } else {
    const decimales = crudo.slice(corte + 1);
    texto =
      decimales.length === 2 && /^\d{2}$/.test(decimales)
        ? `${crudo.slice(0, corte).replace(/[.,]/g, '')}.${decimales}`
        : crudo.replace(/[.,]/g, '');
  }

  const numero = Number(texto);
  if (!Number.isFinite(numero)) return null;
  const pesos = Math.round(numero);
  return pesos > 0 && pesos <= MAX_PESOS ? pesos : null;
};

const BOGOTA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** El día de hoy en Bogotá, 'YYYY-MM-DD'. */
export const diaBogotaHoy = (ahora: Date = new Date()): string => BOGOTA.format(ahora);

const ES_DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * El día calendario en Bogotá al que pertenece la fecha que mandó el teléfono.
 *
 * Sin fecha, hoy: el Atajo se dispara en el momento del pago, así que hoy no es
 * una suposición, es el caso normal.
 *
 * Con una fecha que no se entiende devuelve `null`, y quien llama responde 400.
 * Es a propósito, y es la decisión menos obvia de este fichero: lo cómodo sería
 * caer en hoy y seguir. Pero un 400 lo ve la persona —Atajos enseña el error en
 * la pantalla— y caer en hoy calladamente no lo ve nadie, así que si algún día
 * iOS cambia el formato de la fecha, la diferencia está entre enterarse el
 * primer día y descubrir en diciembre que llevas meses con los días corridos.
 */
export const diaBogota = (valor: unknown, ahora: Date = new Date()): string | null => {
  if (valor === undefined || valor === null || valor === '') return diaBogotaHoy(ahora);
  if (typeof valor !== 'string') return null;

  const limpio = valor.trim();
  if (ES_DIA.test(limpio)) {
    // El formato correcto todavía puede ser un día que no existe. `Date` acepta
    // '2026-02-31' y lo corre a marzo, así que hay que comprobar que vuelva.
    const fecha = new Date(`${limpio}T12:00:00Z`);
    return Number.isNaN(fecha.getTime()) || BOGOTA.format(fecha) !== limpio ? null : limpio;
  }

  const fecha = new Date(limpio);
  return Number.isNaN(fecha.getTime()) ? null : BOGOTA.format(fecha);
};

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un texto que el teléfono manda como descripción: sin saltos y sin novela. */
const limpiarTexto = (valor: unknown, maximo: number): string =>
  typeof valor === 'string' ? valor.replace(/\s+/g, ' ').trim().slice(0, maximo) : '';

export interface CuerpoAtajo {
  monto?: unknown;
  comercio?: unknown;
  fecha?: unknown;
  tipo?: unknown;
  cuentaId?: unknown;
  id?: unknown;
}

/** La fila tal cual entra a `public.transacciones`. */
export interface FilaMovimiento {
  id: string;
  user_id: string;
  kind: 'gasto' | 'ingreso';
  amount_cop: number;
  category: string;
  description: string;
  occurred_on: string;
  raw_transcript: string;
  cuenta_id: string | null;
}

export type ResultadoAtajo = { fila: FilaMovimiento } | { error: string };

/**
 * De lo que mandó el Atajo a la fila que se guarda.
 *
 * `raw_transcript` se queda con el nombre del comercio y NADA más — ni "Apple
 * Pay", ni el monto, ni una etiqueta de origen. No es cosmético: ese campo es
 * el material del que `aprenderDe` saca qué categoría sueles darle a cada
 * palabra, así que meterle "apple pay" a todos los movimientos automáticos le
 * enseñaría que esas dos palabras significan lo que más pagues con el teléfono.
 * Dejando solo el comercio, cada pago en "Juan Valdez" enseña justo lo que
 * tiene que enseñar.
 */
export const movimientoDesdeAtajo = (
  cuerpo: CuerpoAtajo,
  userId: string,
  ahora: Date = new Date(),
): ResultadoAtajo => {
  const comercio = limpiarTexto(cuerpo.comercio, 120);
  if (!comercio) return { error: 'Falta el comercio' };

  const amount = montoEnPesos(cuerpo.monto);
  if (amount === null) return { error: 'El monto no se entiende o no es positivo' };

  const occurredOn = diaBogota(cuerpo.fecha, ahora);
  if (occurredOn === null) return { error: 'La fecha no se entiende' };

  const tipo = cuerpo.tipo === undefined || cuerpo.tipo === null || cuerpo.tipo === '' ? 'gasto' : cuerpo.tipo;
  if (tipo !== 'gasto' && tipo !== 'ingreso') return { error: 'El tipo tiene que ser gasto o ingreso' };

  if (cuerpo.cuentaId !== undefined && cuerpo.cuentaId !== null && cuerpo.cuentaId !== '') {
    if (typeof cuerpo.cuentaId !== 'string' || !ES_UUID.test(cuerpo.cuentaId)) {
      return { error: 'La cuenta no es un id válido' };
    }
  }

  // El id lo puede poner el teléfono, y cuando lo pone, repetir la petición no
  // duplica el gasto: la clave primaria lo impide y quien llama lo trata como
  // "ya estaba". Es la única defensa posible contra un reintento de Atajos,
  // que reintenta sin avisar cuando la red va y viene.
  if (cuerpo.id !== undefined && cuerpo.id !== null && cuerpo.id !== '') {
    if (typeof cuerpo.id !== 'string' || !ES_UUID.test(cuerpo.id)) {
      return { error: 'El id no es un UUID válido' };
    }
  }

  const id = typeof cuerpo.id === 'string' && ES_UUID.test(cuerpo.id) ? cuerpo.id.toLowerCase() : randomUUID();
  const cuentaId =
    typeof cuerpo.cuentaId === 'string' && ES_UUID.test(cuerpo.cuentaId)
      ? cuerpo.cuentaId.toLowerCase()
      : null;

  return {
    fila: {
      id,
      user_id: userId,
      kind: tipo,
      amount_cop: amount,
      // Un ingreso que entra por aquí es un reembolso o un cobro, no un gasto
      // que adivinar: la lista de comercios solo sabe de gastos.
      category: tipo === 'ingreso' ? 'ingreso' : categorizarDescripcion(comercio),
      description: comercio,
      occurred_on: occurredOn,
      raw_transcript: comercio,
      cuenta_id: cuentaId,
    },
  };
};
