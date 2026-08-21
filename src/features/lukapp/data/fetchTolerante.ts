/**
 * Reintenta las peticiones que la API rechaza por un token "recién nacido".
 *
 * PostgREST valida el `iat` del access token contra SU PROPIO reloj y responde
 * 401 `JWT issued at future` cuando el token viene fechado por delante. Ese
 * token lo firma Supabase Auth, no este navegador: no es una sesión inválida ni
 * algo que la persona pueda arreglar, es un desfase de segundos entre los
 * relojes de los dos servicios. Aparece justo al entrar y tras cada refresco de
 * token — de ahí que saliera "en momentos random" — y se cura solo esperando.
 *
 * Refrescar la sesión sería exactamente lo contrario de lo que hace falta:
 * daría un token con un `iat` todavía más adelantado. Lo único que sirve es
 * esperar a que el reloj del servidor alcance la fecha del token.
 *
 * Reintentar es seguro incluso en las escrituras. Un 401 lo devuelve PostgREST
 * antes de tocar la base de datos, así que no hay nada aplicado que un segundo
 * intento pueda duplicar.
 */

/** Lo que responde PostgREST cuando el `iat`/`nbf` del token aún no ha llegado. */
export const esTokenDelFuturo = (cuerpo: string): boolean =>
  /issued at future|not yet valid/i.test(cuerpo);

/**
 * Cuánto esperar antes de cada reintento cuando no se puede calcular el desfase
 * exacto. Tres reintentos que suman ~4 s: más que suficiente para el desfase de
 * NTP habitual, y poco como para que la carga inicial no parezca colgada.
 */
const ESPERAS_A_CIEGAS_MS = [400, 1_200, 2_500];

/** Tope duro: un desfase mayor que esto no es NTP, es un servidor mal puesto en hora. */
const ESPERA_MAXIMA_MS = 8_000;

/** El encabezado `Date` viene truncado al segundo, así que se redondea hacia arriba. */
const MARGEN_MS = 400;

const dormir = (ms: number): Promise<void> =>
  new Promise((listo) => setTimeout(listo, Math.max(ms, 0)));

/**
 * El `iat` del token, en milisegundos.
 *
 * Se lee sin verificar la firma a propósito: aquí no se está autorizando nada,
 * solo se mira una fecha para decidir cuánto dormir. Quien valida de verdad es
 * PostgREST, y su veredicto es justo el que se está reintentando.
 */
const iatDelToken = (token: string | null): number | null => {
  if (!token) return null;
  const partes = token.split('.');
  if (partes.length !== 3) return null;

  try {
    // base64url → base64, con el relleno que `atob` exige y el token no trae.
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const carga: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    const iat = (carga as { iat?: unknown }).iat;
    return typeof iat === 'number' ? iat * 1000 : null;
  } catch {
    // Un token opaco o mal formado no es asunto de esta función: se cae a la
    // espera a ciegas, que no necesita leer nada.
    return null;
  }
};

/** El Bearer que iba en la petición, venga en el `Request` o en las opciones. */
const tokenDe = (entrada: RequestInfo | URL, init?: RequestInit): string | null => {
  const cabeceras = new Headers(
    init?.headers ?? (entrada instanceof Request ? entrada.headers : undefined),
  );
  const autorizacion = cabeceras.get('Authorization');
  return autorizacion?.startsWith('Bearer ') ? autorizacion.slice('Bearer '.length) : null;
};

/**
 * Los milisegundos que faltan para que el token sea válido, según el reloj del
 * propio servidor que lo rechazó. `Date` es una cabecera segura para CORS, así
 * que se puede leer aunque la respuesta venga de otro origen — eso convierte la
 * espera en un cálculo en vez de una apuesta.
 *
 * Devuelve `null` cuando falta cualquiera de los dos datos.
 */
const esperaCalculada = (respuesta: Response, token: string | null): number | null => {
  const iat = iatDelToken(token);
  if (iat === null) return null;

  const fecha = respuesta.headers.get('Date');
  const ahoraDelServidor = fecha ? Date.parse(fecha) : Number.NaN;
  if (Number.isNaN(ahoraDelServidor)) return null;

  return Math.min(Math.max(iat - ahoraDelServidor, 0) + MARGEN_MS, ESPERA_MAXIMA_MS);
};

export interface OpcionesTolerante {
  /** Inyectable para que los tests no esperen de verdad. */
  esperar?: (ms: number) => Promise<void>;
}

/**
 * Envuelve un `fetch` para que absorba el desfase de reloj sin que nadie lo vea.
 *
 * Cualquier otra respuesta —incluido un 401 por sesión vencida— se devuelve tal
 * cual y al primer intento: esto reintenta UN fallo concreto y transitorio, no
 * los errores de verdad.
 */
export const crearFetchTolerante = (
  base: typeof fetch,
  { esperar = dormir }: OpcionesTolerante = {},
): typeof fetch => {
  return async (entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    for (let intento = 0; ; intento++) {
      const respuesta = await base(entrada, init);

      if (respuesta.status !== 401 || intento >= ESPERAS_A_CIEGAS_MS.length) return respuesta;

      // `clone()` porque leer el cuerpo lo consume, y si esto no era el error
      // del reloj hay que devolver la respuesta intacta a quien la pidió.
      const cuerpo = await respuesta
        .clone()
        .text()
        .catch(() => '');
      if (!esTokenDelFuturo(cuerpo)) return respuesta;

      await esperar(esperaCalculada(respuesta, tokenDe(entrada, init)) ?? ESPERAS_A_CIEGAS_MS[intento]);
    }
  };
};
