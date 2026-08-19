/**
 * Convierte a texto lo que la persona dictó.
 *
 * Vive en Vercel y no en el Express de Render por una razón sencilla: la PWA se
 * sirve desde Vercel, así que `/api/transcribir` tiene que existir AQUÍ. La ruta
 * también está en Render, pero la app instalada nunca la alcanza — pedía a
 * Vercel y recibía un 405, que es justo por lo que el micrófono se apagaba sin
 * transcribir nada.
 *
 * El audio llega como cuerpo crudo, no como multipart. En el borde no hay
 * parser de formularios, y montar uno para un solo archivo sería trabajo extra
 * que puede fallar; el navegador ya sabe el tipo y lo manda en Content-Type.
 */
export const config = { runtime: 'edge' };

/** Lo que la app entiende como "no se pudo, sigue tú a mano". */
const noSePudo = (motivo: string): Response =>
  new Response(JSON.stringify({ offline: true, error: motivo }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Whisper elige el decodificador por la EXTENSIÓN del archivo, no por el tipo
 * MIME, así que un iPhone (que graba mp4) enviado como "audio.webm" se rechaza.
 */
const nombreSegunTipo = (tipo: string): string => {
  if (tipo.includes('mp4') || tipo.includes('m4a')) return 'audio.mp4';
  if (tipo.includes('mpeg') || tipo.includes('mp3')) return 'audio.mp3';
  if (tipo.includes('ogg')) return 'audio.ogg';
  if (tipo.includes('wav')) return 'audio.wav';
  return 'audio.webm';
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response(null, { status: 405 });

  const llave = process.env.OPENAI_API_KEY;
  if (!llave) return noSePudo('Falta OPENAI_API_KEY');

  const audio = await req.blob();
  if (audio.size === 0) return noSePudo('No llegó audio');

  const tipo = req.headers.get('content-type') ?? 'audio/webm';

  const formulario = new FormData();
  formulario.append('file', audio, nombreSegunTipo(tipo));
  formulario.append('model', 'whisper-1');
  formulario.append('language', 'es');

  try {
    const respuesta = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${llave}` },
      body: formulario,
    });

    if (!respuesta.ok) {
      // El cuerpo del error de OpenAI puede traer el audio de vuelta; solo se
      // registra el principio, y nunca se le devuelve a quien llamó.
      const detalle = await respuesta.text();
      console.error(`[transcribir] Whisper ${respuesta.status}: ${detalle.slice(0, 200)}`);
      return noSePudo('No se pudo transcribir');
    }

    const { text } = (await respuesta.json()) as { text?: string };
    return new Response(JSON.stringify({ success: true, text: text ?? '' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[transcribir]', error);
    return noSePudo('No se pudo transcribir');
  }
}
