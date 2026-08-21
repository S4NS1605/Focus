import { describe, it, expect, vi } from 'vitest';
import { crearFetchTolerante, esTokenDelFuturo } from './fetchTolerante';

/** Un token con la forma justa para que se le pueda leer el `iat`. */
const tokenConIat = (iatSegundos: number): string => {
  const carga = btoa(JSON.stringify({ sub: 'u1', iat: iatSegundos }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `cabecera.${carga}.firma`;
};

const rechazo = (fecha?: string) =>
  new Response(JSON.stringify({ message: 'JWT issued at future', code: 'PGRST301' }), {
    status: 401,
    headers: fecha ? { Date: fecha } : undefined,
  });

const bueno = () => new Response(JSON.stringify([{ id: 'c1' }]), { status: 200 });

/** Recoge lo que se durmió en vez de dormirlo, para que el test no espere. */
const relojFalso = () => {
  const esperas: number[] = [];
  return {
    esperas,
    esperar: (ms: number) => {
      esperas.push(ms);
      return Promise.resolve();
    },
  };
};

describe('crearFetchTolerante — el token que llega antes de tiempo', () => {
  it('reintenta y devuelve la respuesta buena, sin que el error salga a la app', async () => {
    // El fallo original: PostgREST rechaza el token recién emitido porque su
    // `iat` va por delante del reloj del servidor, y ese 401 subía crudo hasta
    // el banner rojo — «No se pudieron leer las categorías: JWT issued at
    // future» — dejando además todos los totales en $0.
    const base = vi.fn().mockResolvedValueOnce(rechazo()).mockResolvedValueOnce(bueno());
    const { esperar } = relojFalso();

    const respuesta = await crearFetchTolerante(base as unknown as typeof fetch, { esperar })(
      'https://proyecto.supabase.co/rest/v1/categorias',
    );

    expect(respuesta.status).toBe(200);
    expect(base).toHaveBeenCalledTimes(2);
  });

  it('devuelve un cuerpo todavía legible: el clon no consumió la respuesta', async () => {
    // Mirar el cuerpo para decidir si se reintenta lo CONSUME, y el 401 que no
    // era este error se devuelve tal cual a postgrest-js, que lo primero que
    // hace es leerlo. Sin `clone()` compila igual y revienta en producción con
    // «body stream already read», convirtiendo un error con mensaje en uno sin
    // ninguno. Por eso se comprueba sobre la respuesta que SÍ se devuelve —
    // la descartada da igual si queda consumida.
    const base = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ message: 'JWT expired' }), { status: 401 }));
    const { esperar } = relojFalso();

    const respuesta = await crearFetchTolerante(base as unknown as typeof fetch, { esperar })('/x');

    await expect(respuesta.json()).resolves.toEqual({ message: 'JWT expired' });
  });

  it('calcula la espera con el reloj del propio servidor, no a ojo', async () => {
    // El servidor dice en qué momento vive y el token dice desde cuándo vale:
    // con las dos fechas la espera es un cálculo, no una apuesta.
    const ahoraDelServidor = 'Fri, 21 Aug 2026 04:41:00 GMT';
    const iat = Date.parse(ahoraDelServidor) / 1000 + 3; // el token vale 3 s más tarde
    const base = vi
      .fn()
      .mockResolvedValueOnce(rechazo(ahoraDelServidor))
      .mockResolvedValueOnce(bueno());
    const { esperas, esperar } = relojFalso();

    await crearFetchTolerante(base as unknown as typeof fetch, { esperar })('/x', {
      headers: { Authorization: `Bearer ${tokenConIat(iat)}` },
    });

    // Los 3 s que faltan más el margen por el `Date` truncado al segundo.
    expect(esperas).toEqual([3_400]);
  });

  it('espera a ciegas cuando no hay `iat` que leer', async () => {
    // Un token opaco o una respuesta sin `Date` no pueden dejar el reintento
    // sin hacer: se cae a una espera fija en vez de rendirse.
    const base = vi.fn().mockResolvedValueOnce(rechazo()).mockResolvedValueOnce(bueno());
    const { esperas, esperar } = relojFalso();

    await crearFetchTolerante(base as unknown as typeof fetch, { esperar })('/x');

    expect(esperas).toEqual([400]);
  });

  it('se rinde y devuelve el último 401 en vez de reintentar para siempre', async () => {
    // Un servidor de verdad mal puesto en hora no se arregla esperando. Sin
    // tope, la app se quedaría girando sin decir nunca nada.
    const base = vi.fn().mockImplementation(() => Promise.resolve(rechazo()));
    const { esperas, esperar } = relojFalso();

    const respuesta = await crearFetchTolerante(base as unknown as typeof fetch, { esperar })('/x');

    expect(respuesta.status).toBe(401);
    expect(base).toHaveBeenCalledTimes(4); // el intento original y tres reintentos
    expect(esperas).toEqual([400, 1_200, 2_500]);
  });
});

describe('crearFetchTolerante — lo que NO debe reintentar', () => {
  it('deja pasar una sesión vencida al primer intento', async () => {
    // También es un 401, pero esperar no lo cura: hay que volver a entrar. Si
    // esto se reintentara, el aviso de sesión vencida tardaría 4 s en salir.
    const vencida = new Response(JSON.stringify({ message: 'JWT expired' }), { status: 401 });
    const base = vi.fn().mockResolvedValue(vencida);
    const { esperar } = relojFalso();

    const respuesta = await crearFetchTolerante(base as unknown as typeof fetch, { esperar })('/x');

    expect(respuesta.status).toBe(401);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it('no toca una respuesta correcta', async () => {
    const base = vi.fn().mockResolvedValue(bueno());
    const { esperar } = relojFalso();

    await crearFetchTolerante(base as unknown as typeof fetch, { esperar })('/x');

    expect(base).toHaveBeenCalledTimes(1);
  });
});

describe('esTokenDelFuturo', () => {
  it('reconoce las dos formas en que PostgREST lo dice', () => {
    expect(esTokenDelFuturo('{"message":"JWT issued at future"}')).toBe(true);
    expect(esTokenDelFuturo('{"message":"JWT not yet valid"}')).toBe(true);
  });

  it('no confunde otros fallos de token con este', () => {
    expect(esTokenDelFuturo('{"message":"JWT expired"}')).toBe(false);
    expect(esTokenDelFuturo('{"message":"JWSError JWSInvalidSignature"}')).toBe(false);
  });
});
