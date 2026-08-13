import {
  dispositivoDeUA,
  esBot,
  fechaBogota,
  hostDeReferente,
  huellaDelDia,
  paisValido,
  rutaLimpia,
} from '../src/lib/analitica';

/**
 * Suma una visita al portafolio, y se olvida de quién la hizo.
 *
 * Vive en el borde de Vercel y no en el Express de Render por tres razones que
 * empujan en la misma dirección:
 *
 * 1. Vercel pone el país en `x-vercel-ip-country`. Se lee de ahí y la IP no se
 *    consulta para nada más: no hay que montar una base GeoIP ni —peor— mandarle
 *    la IP a un tercero para que la traduzca.
 * 2. Es el mismo origen que el portafolio, así que los bloqueadores lo tumban
 *    mucho menos que a un dominio de analítica o al de Render.
 * 3. El servidor de Render solo atiende cosas autenticadas del dueño. Meterle
 *    tráfico anónimo de internet es superficie que no hacía falta abrir.
 *
 * La llave de servicio NO está aquí, y no puede estarlo: escribe con la clave
 * publicable, que solo puede insertar gracias a la política de la migración
 * 0012. La llave de servicio sigue viviendo únicamente en Render.
 */
export const config = { runtime: 'edge' };

const SITIO = 'juliangonzalez.lat';

/** Nunca se le cuenta nada al que llama: ni si funcionó, ni por qué no. */
const LISTO = new Response(null, { status: 204 });

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response(null, { status: 405 });

  const ua = req.headers.get('user-agent') ?? '';

  // Un robot no es una visita. Responde igual que siempre para no enseñarle a
  // un rastreador cómo se ve ser detectado.
  if (esBot(ua)) return LISTO;

  const sal = process.env.VISITAS_SAL;
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const clave =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY;

  // Sin sal no se calcula la huella, y sin huella preferimos no guardar nada
  // antes que guardar algo peor. Un despliegue mal configurado no cuenta mal:
  // no cuenta.
  if (!sal || !url || !clave) return LISTO;

  let cuerpo: { ruta?: unknown; referente?: unknown };
  try {
    cuerpo = (await req.json()) as { ruta?: unknown; referente?: unknown };
  } catch {
    return LISTO;
  }

  // La IP entra al hash y muere en esta función: no se escribe, no se registra
  // y no se manda a ninguna parte.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const visitante = await huellaDelDia(ip, ua, fechaBogota(new Date()), sal);

  const fila = {
    ruta: rutaLimpia(typeof cuerpo.ruta === 'string' ? cuerpo.ruta : '/'),
    referente: hostDeReferente(
      typeof cuerpo.referente === 'string' ? cuerpo.referente : null,
      SITIO,
    ),
    pais: paisValido(req.headers.get('x-vercel-ip-country')),
    dispositivo: dispositivoDeUA(ua),
    visitante,
  };

  try {
    await fetch(`${url}/rest/v1/visitas`, {
      method: 'POST',
      headers: {
        apikey: clave,
        Authorization: `Bearer ${clave}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(fila),
    });
  } catch {
    // Que la analítica falle jamás puede notarse desde el portafolio.
  }

  return LISTO;
}
