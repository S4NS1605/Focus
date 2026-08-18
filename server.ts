import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';
import { tokenValido } from './server_lib/auth.ts';
import { motivoParaNoBorrar, motivoParaRechazar } from './server_lib/superadmin.ts';
import type { CambiosUsuario } from './server_lib/superadmin.ts';
import { analizarConPlantilla, detectarBanco } from './server_lib/plantillas/index.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
// Limite ampliado a 10MB para PDFs grandes
app.use(express.json({ limit: '10mb' }));

// ----------------------------------------------------------------------
// SEGURIDAD: Rate Limiter en Memoria para APIs
// ----------------------------------------------------------------------
const peticionesPorIp = new Map<string, { count: number; resetTime: number }>();

const rateLimiter = (maxPeticiones = 120, ventanaMs = 60000) => (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const ahora = Date.now();
  const registro = peticionesPorIp.get(ip);

  if (!registro || ahora > registro.resetTime) {
    peticionesPorIp.set(ip, { count: 1, resetTime: ahora + ventanaMs });
    return next();
  }

  registro.count++;
  if (registro.count > maxPeticiones) {
    return res.status(429).json({ error: 'Demasiadas solicitudes. Por favor espera un momento.' });
  }

  return next();
};

app.use('/api', rateLimiter(120, 60000));

// ----------------------------------------------------------------------
// AUDITORÍA: Registro de Actividad para Superadmin
// ----------------------------------------------------------------------
export interface AuditLog {
  id: string;
  timestamp: string;
  adminEmail: string;
  action: string;
  targetUser?: string;
  details?: string;
}

const auditLogs: AuditLog[] = [];

const registrarAuditoria = (
  adminEmail: string,
  action: string,
  targetUser?: string,
  details?: string,
) => {
  auditLogs.unshift({
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    adminEmail,
    action,
    targetUser,
    details,
  });
  if (auditLogs.length > 500) auditLogs.pop();
};

// ----------------------------------------------------------------------
// ENDPOINT: Crear Usuario (Superadmin)
// ----------------------------------------------------------------------
app.post('/api/crear-usuario', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Falta configurar VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' });
  }

  const adminAuthClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { email, password, usuario, rol } = req.body;

    // Verificar JWT del llamador
    const { data: adminUser, error: adminError } = await adminAuthClient.auth.getUser(token);
    if (adminError || !adminUser.user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Comprobar rol en base de datos
    const { data: adminProfile } = await adminAuthClient
      .from('perfiles')
      .select('rol')
      .eq('id', adminUser.user.id)
      .single();

    if (adminProfile?.rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permisos de administrador' });
    }

    // Crear usuario
    const { data: newUser, error: createError } = await adminAuthClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { usuario: usuario || '' }
    });

    if (createError) throw createError;

    // Actualizar rol
    if (rol === 'admin' && newUser.user) {
      const { error: updateError } = await adminAuthClient
        .from('perfiles')
        .update({ rol: 'admin' })
        .eq('id', newUser.user.id);
        
      if (updateError) throw updateError;
    }

    registrarAuditoria(
      adminUser.user.email ?? 'admin',
      'Creó usuario',
      email,
      `Usuario: ${usuario || '-'}, Rol: ${rol || 'usuario'}`,
    );

    return res.status(200).json({ success: true, user: newUser.user });
  } catch (error: any) {
    console.error('Error creando usuario:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

// ----------------------------------------------------------------------
// Cliente admin + comprobación de que quien llama es administrador.
// ----------------------------------------------------------------------
const clienteAdmin = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

type ClienteAdmin = NonNullable<ReturnType<typeof clienteAdmin>>;

/** El id y correo del que llama si es admin; si no, el estado y mensaje a devolver. */
const exigirAdmin = async (
  cliente: ClienteAdmin,
  token: string,
): Promise<{ userId: string; email: string } | { status: number; error: string }> => {
  const { data: llamador, error } = await cliente.auth.getUser(token);
  if (error || !llamador.user) return { status: 401, error: 'Token inválido' };

  const { data: perfil } = await cliente
    .from('perfiles')
    .select('rol')
    .eq('id', llamador.user.id)
    .single();

  if (perfil?.rol !== 'admin') return { status: 403, error: 'No tienes permisos de administrador' };
  return { userId: llamador.user.id, email: llamador.user.email ?? '' };
};

/**
 * El id del que llama, si su sesión es de verdad.
 *
 * A diferencia de `exigirAdmin` no mira el rol: para hablar con el asesor basta
 * con haber iniciado sesión. Lo que cierra es que la ruta quede abierta a
 * cualquiera que sepa la URL — y detrás de esa ruta hay una llave de un modelo
 * con cuota, así que sin esta comprobación se la gasta un extraño.
 */
const exigirUsuario = async (
  cliente: ClienteAdmin,
  token: string,
): Promise<{ userId: string } | { status: number; error: string }> => {
  const { data: llamador, error } = await cliente.auth.getUser(token);
  if (error || !llamador.user) return { status: 401, error: 'Token inválido' };
  return { userId: llamador.user.id };
};

/** Rol actual del objetivo y cuántos admins hay, para las guardas de bloqueo. */
const contextoDe = async (cliente: ClienteAdmin, objetivoId: string) => {
  const { data: objetivo } = await cliente
    .from('perfiles')
    .select('rol')
    .eq('id', objetivoId)
    .single();

  const { count } = await cliente
    .from('perfiles')
    .select('id', { count: 'exact', head: true })
    .eq('rol', 'admin');

  return {
    objetivoRol: (objetivo?.rol === 'admin' ? 'admin' : 'usuario') as 'admin' | 'usuario',
    totalAdmins: count ?? 0,
    existe: objetivo !== null,
  };
};

// ----------------------------------------------------------------------
// ENDPOINT: Editar Usuario (Superadmin)
// ----------------------------------------------------------------------
app.post('/api/editar-usuario', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) {
    return res.status(500).json({ error: 'Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' });
  }

  try {
    const acceso = await exigirAdmin(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    const { userId, email, usuario, password, rol } = req.body ?? {};
    if (typeof userId !== 'string' || userId === '') {
      return res.status(400).json({ error: 'Falta el usuario a editar.' });
    }

    // Solo se manda a la guarda lo que de verdad viene: no tocar un campo es
    // distinto de vaciarlo, y las reglas dependen de esa diferencia.
    const cambios: CambiosUsuario = {};
    if (typeof email === 'string') cambios.email = email;
    if (typeof usuario === 'string') cambios.usuario = usuario;
    if (typeof password === 'string') cambios.password = password;
    if (rol === 'admin' || rol === 'usuario') cambios.rol = rol;

    const ctx = await contextoDe(cliente, userId);
    if (!ctx.existe) return res.status(404).json({ error: 'Ese usuario ya no existe.' });

    const motivo = motivoParaRechazar(cambios, {
      editorId: acceso.userId,
      objetivoId: userId,
      objetivoRol: ctx.objetivoRol,
      totalAdmins: ctx.totalAdmins,
    });
    if (motivo) return res.status(400).json({ error: motivo });

    // El correo y la contraseña viven en auth; el usuario, el correo y el rol
    // se reflejan en `perfiles`, que es lo que lee el panel. El usuario va a la
    // metadata de auth además, para que el trigger de alta no lo pierda.
    const authUpdate: Record<string, unknown> = {};
    if (cambios.email !== undefined) authUpdate.email = cambios.email;
    if (cambios.password !== undefined) authUpdate.password = cambios.password;
    if (cambios.usuario !== undefined) authUpdate.user_metadata = { usuario: cambios.usuario };

    if (Object.keys(authUpdate).length > 0) {
      const { error } = await cliente.auth.admin.updateUserById(userId, authUpdate);
      if (error) throw error;
    }

    const perfilUpdate: Record<string, unknown> = {};
    if (cambios.usuario !== undefined) perfilUpdate.usuario = cambios.usuario.trim();
    if (cambios.email !== undefined) perfilUpdate.email = cambios.email;
    if (cambios.rol !== undefined) perfilUpdate.rol = cambios.rol;

    if (Object.keys(perfilUpdate).length > 0) {
      const { error } = await cliente.from('perfiles').update(perfilUpdate).eq('id', userId);
      // Un usuario repetido choca contra el índice único: se traduce a un
      // mensaje que se entiende, no al error crudo de Postgres.
      if (error) {
        const dup = error.code === '23505';
        return res.status(dup ? 409 : 500).json({
          error: dup ? 'Ese nombre de usuario ya está tomado.' : error.message,
        });
      }
    }

    registrarAuditoria(
      acceso.email,
      'Editó usuario',
      cambios.email || userId,
      Object.keys(cambios).join(', '),
    );

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error editando usuario:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINT: Eliminar Usuario (Superadmin)
// ----------------------------------------------------------------------
app.post('/api/eliminar-usuario', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) {
    return res.status(500).json({ error: 'Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' });
  }

  try {
    const acceso = await exigirAdmin(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    const { userId } = req.body ?? {};
    if (typeof userId !== 'string' || userId === '') {
      return res.status(400).json({ error: 'Falta el usuario a eliminar.' });
    }

    const ctx = await contextoDe(cliente, userId);
    if (!ctx.existe) return res.status(404).json({ error: 'Ese usuario ya no existe.' });

    const motivo = motivoParaNoBorrar({
      editorId: acceso.userId,
      objetivoId: userId,
      objetivoRol: ctx.objetivoRol,
      totalAdmins: ctx.totalAdmins,
    });
    if (motivo) return res.status(400).json({ error: motivo });

    // Borra la cuenta de auth; la fila de `perfiles` se va sola por la llave
    // foránea con `on delete cascade` contra auth.users.
    const { error } = await cliente.auth.admin.deleteUser(userId);
    if (error) throw error;

    registrarAuditoria(
      acceso.email,
      'Eliminó usuario',
      userId,
      `Rol: ${ctx.objetivoRol}`,
    );

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error eliminando usuario:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINT: Impersonar Usuario (Superadmin)
// Usa auth.admin.generateLink para obtener un token_hash. El frontend lo
// intercambia via supabase.auth.verifyOtp() — llamada pura a la API de
// Supabase, sin abrir ninguna URL ni redirigir al localhost.
// ----------------------------------------------------------------------
app.post('/api/impersonar-usuario', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) {
    return res.status(500).json({ error: 'Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' });
  }

  try {
    const acceso = await exigirAdmin(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    const { userId } = req.body ?? {};
    if (typeof userId !== 'string' || userId === '') {
      return res.status(400).json({ error: 'Falta el userId del usuario a impersonar.' });
    }

    if (userId === acceso.userId) {
      return res.status(400).json({ error: 'No puedes impersonarte a ti mismo.' });
    }

    // Obtener datos del usuario objetivo
    const { data: userTarget, error: getUserError } = await cliente.auth.admin.getUserById(userId);
    if (getUserError || !userTarget.user) {
      return res.status(404).json({ error: 'El usuario objetivo no existe.' });
    }

    // Generar magic link para obtener el token_hash.
    const { data: linkData, error: linkError } = await cliente.auth.admin.generateLink({
      type: 'magiclink',
      email: userTarget.user.email!,
    });

    if (linkError || !linkData?.properties?.action_link) {
      return res.status(500).json({ error: linkError?.message || 'No se pudo generar el token de acceso.' });
    }

    const tokenHash = linkData.properties.hashed_token
      || (() => {
          const u = new URL(linkData.properties.action_link);
          return u.searchParams.get('token');
        })();

    if (!tokenHash) {
      return res.status(500).json({ error: 'No se pudo extraer el token del link generado.' });
    }

    registrarAuditoria(
      acceso.email,
      'Inició sesión de asesoría (Impersonación)',
      userTarget.user.email,
      `ID: ${userId}`,
    );

    return res.status(200).json({
      success: true,
      tokenHash,
      email: userTarget.user.email,
      usuario: userTarget.user.user_metadata?.usuario || userTarget.user.email,
    });
  } catch (error: any) {
    console.error('Error impersonando usuario:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

// ----------------------------------------------------------------------
// ENDPOINT: Obtener Logs de Auditoría (Superadmin)
// ----------------------------------------------------------------------
app.get('/api/auditoria-logs', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configuración de Supabase' });

  const acceso = await exigirAdmin(cliente, token);
  if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

  return res.status(200).json({ success: true, logs: auditLogs });
});

// ----------------------------------------------------------------------
// ENDPOINT: Analizar Extracto Bancario
// ----------------------------------------------------------------------
const MAX_BYTES_PDF = 4 * 1024 * 1024; // 4MB

app.post('/api/analizar-extracto', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!tokenValido(authHeader, process.env.ANALISTA_TOKEN)) {
    return res.status(401).json({ ok: false, codigo: 'sin-autorizacion', mensaje: 'Token inválido o ausente.' });
  }

  const { pdfBase64 } = req.body;
  if (typeof pdfBase64 !== 'string' || pdfBase64.length === 0) {
    return res.status(400).json({ ok: false, codigo: 'pdf-invalido', mensaje: 'No llegó el contenido del PDF.' });
  }

  const bytesReales = Math.floor((pdfBase64.length * 3) / 4);
  if (bytesReales > MAX_BYTES_PDF) {
    return res.status(413).json({
      ok: false,
      codigo: 'pdf-muy-grande',
      mensaje: `El PDF pesa ${(bytesReales / 1024 / 1024).toFixed(1)} MB y el límite es 4 MB.`,
    });
  }

  let textoCrudo: string;
  try {
    const parser = new PDFParse({ data: new Uint8Array(Buffer.from(pdfBase64, 'base64')) });
    const resultado = await parser.getText();
    textoCrudo = resultado.text;
    await parser.destroy();
  } catch {
    return res.status(422).json({
      ok: false,
      codigo: 'pdf-invalido',
      mensaje: 'No se pudo leer el texto del PDF. Puede estar corrupto o protegido con contraseña.',
    });
  }

  if (!textoCrudo.trim()) {
    return res.status(422).json({
      ok: false,
      codigo: 'pdf-invalido',
      mensaje: 'El PDF no tiene texto extraíble — probablemente es un escaneo sin capa de texto.',
    });
  }

  if (!detectarBanco(textoCrudo)) {
    return res.status(422).json({
      ok: false,
      codigo: 'banco-no-soportado',
      mensaje: 'Este extracto no coincide con ninguna plantilla soportada (Nequi, Nu, Bancolombia, Davivienda).',
    });
  }

  const resultado = analizarConPlantilla(textoCrudo);
  if (!resultado) {
    return res.status(422).json({
      ok: false,
      codigo: 'sin-movimientos',
      mensaje: 'Se reconoció el banco pero no se pudo leer ningún movimiento de este extracto.',
    });
  }

  return res.status(200).json({ ok: true, resultado });
});

// ----------------------------------------------------------------------
// ENDPOINT: Asesor Financiero con Inteligencia Artificial (LLM)
// Soporta OpenAI, Anthropic Claude, Google Gemini, Groq y DeepSeek.
// Si no hay key configurada, responde { offline: true } para usar el motor local.
// ----------------------------------------------------------------------
/**
 * Señal de vida del servicio, y si hay un modelo detrás.
 *
 * Sin autenticación a propósito: es lo que pinga el keep-alive para que el plan
 * gratuito de Render no duerma el servicio, y no revela nada — solo dice si hay
 * alguna llave configurada, nunca cuál ni su valor.
 *
 * No llama al modelo: mirar `process.env` cuesta cero y no gasta cuota, así que
 * el chat puede consultarlo al abrirse sin penalización.
 */
app.get('/api/salud', (_req, res) => {
  const hayIA = Boolean(
    process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY ||
    process.env.ANTHROPIC_API_KEY || process.env.DEEPSEEK_API_KEY,
  );
  return res.status(200).json({ ok: true, ia: hayIA });
});

app.post('/api/asesor-ia', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  // Que la cabecera venga no dice nada: hay que comprobar que la sesión existe.
  // Sin esto bastaba con mandar cualquier texto en `Authorization` para entrar,
  // y detrás hay una llave de modelo con cuota que paga otro.
  const cliente = clienteAdmin();
  if (!cliente) {
    return res.status(500).json({ error: 'Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' });
  }
  const quienLlama = await exigirUsuario(cliente, token);
  if ('status' in quienLlama) {
    return res.status(quienLlama.status).json({ error: quienLlama.error });
  }

  const { prompt, history, finanzasContext } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Falta el prompt del usuario' });
  }

  // Detectar proveedor de IA disponible
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;

  if (!groqKey && !openaiKey && !geminiKey && !anthropicKey && !deepseekKey) {
    return res.status(200).json({ offline: true });
  }

  const systemPrompt = `Eres un asesor financiero personal experto para Colombia dentro de la aplicación Focus Finanzas.
Tu tono es empático, profesional, claro y directo.
Tienes acceso al resumen financiero real del usuario:
${finanzasContext ? JSON.stringify(finanzasContext, null, 2) : 'No hay datos financieros registrados aún.'}

Reglas clave:
1. Responde de forma concisa usando Markdown estructurado (negritas, viñetas).
2. Si el usuario pregunta por sus gastos o ingresos, usa los datos del contexto financiero en Pesos Colombianos (COP).
3. Da recomendaciones realistas y accionables (ahorro, CDT, recorte de gastos hormiga, presupuestos por categoría, manejo de deudas).
4. No des recomendaciones de inversión de alto riesgo sin advertencias.
5. Mantén las respuestas breves y directas al grano (máximo 2 a 4 párrafos).`;

  try {
    let respuestaTexto = '';
    let proveedor = '';
    // Por qué no contestó cada proveedor. Sin esto, "no hay llave" y "la llave
    // falló" devuelven lo mismo desde fuera y no hay forma de distinguirlos.
    const fallos: string[] = [];

    // 1. Groq (rápido y sin costo en el plan gratuito).
    //
    // El identificador del modelo NO es estable: Groq retira modelos y entonces
    // responde 404 model_not_found. Aquí vivía `llama-3.3-70b-versatile` hasta
    // que lo dieron de baja, y el fallo pasó inadvertido porque no se miraba el
    // error. Si vuelve a dar 404, contrasta con console.groq.com/docs/models
    // antes de cambiarlo — el log ya dice el motivo exacto.
    if (groqKey) {
      proveedor = 'Groq (GPT-OSS 120B)';
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          messages: [
            { role: 'system', content: systemPrompt },
            ...(Array.isArray(history) ? history.slice(-6).map((m: any) => ({
              role: m.role === 'bot' ? 'assistant' : 'user',
              content: m.text || m.content || '',
            })) : []),
            { role: 'user', content: prompt },
          ],
          temperature: 0.6,
          max_tokens: 600,
        }),
      });
      if (groqRes.ok) {
        const data = await groqRes.json();
        respuestaTexto = data.choices?.[0]?.message?.content || '';
      } else {
        // Groq responde 400 cuando el modelo fue retirado y 401 con llave mala.
        // Antes esto se perdía en silencio y parecía "no hay IA configurada".
        const detalle = await groqRes.text().catch(() => '');
        console.error(`[asesor] Groq ${groqRes.status}: ${detalle.slice(0, 400)}`);
        fallos.push(`groq:${groqRes.status}`);
      }
    }

    // 2. OpenAI (GPT-4o mini)
    if (!respuestaTexto && openaiKey) {
      proveedor = 'OpenAI (GPT-4o)';
      const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...(Array.isArray(history) ? history.slice(-6).map((m: any) => ({
              role: m.role === 'bot' ? 'assistant' : 'user',
              content: m.text || m.content || '',
            })) : []),
            { role: 'user', content: prompt },
          ],
          temperature: 0.6,
          max_tokens: 600,
        }),
      });
      if (oaiRes.ok) {
        const data = await oaiRes.json();
        respuestaTexto = data.choices?.[0]?.message?.content || '';
      }
    }

    // 3. Google Gemini (1.5 Flash)
    if (!respuestaTexto && geminiKey) {
      proveedor = 'Google Gemini';
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [
            ...(Array.isArray(history) ? history.slice(-6).map((m: any) => ({
              role: m.role === 'bot' ? 'model' : 'user',
              parts: [{ text: m.text || m.content || '' }],
            })) : []),
            { role: 'user', parts: [{ text: prompt }] },
          ],
          generationConfig: { maxOutputTokens: 600, temperature: 0.6 },
        }),
      });
      if (geminiRes.ok) {
        const data = await geminiRes.json();
        respuestaTexto = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
    }

    // 4. Anthropic Claude
    if (!respuestaTexto && anthropicKey) {
      proveedor = 'Claude 3.5';
      const clRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          system: systemPrompt,
          messages: [
            ...(Array.isArray(history) ? history.slice(-6).map((m: any) => ({
              role: m.role === 'bot' ? 'assistant' : 'user',
              content: m.text || m.content || '',
            })) : []),
            { role: 'user', content: prompt },
          ],
          max_tokens: 600,
        }),
      });
      if (clRes.ok) {
        const data = await clRes.json();
        respuestaTexto = data.content?.[0]?.text || '';
      }
    }

    // 5. DeepSeek
    if (!respuestaTexto && deepseekKey) {
      proveedor = 'DeepSeek V3';
      const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            ...(Array.isArray(history) ? history.slice(-6).map((m: any) => ({
              role: m.role === 'bot' ? 'assistant' : 'user',
              content: m.text || m.content || '',
            })) : []),
            { role: 'user', content: prompt },
          ],
          max_tokens: 600,
        }),
      });
      if (dsRes.ok) {
        const data = await dsRes.json();
        respuestaTexto = data.choices?.[0]?.message?.content || '';
      }
    }

    if (respuestaTexto) {
      return res.status(200).json({
        success: true,
        text: respuestaTexto,
        provider: proveedor,
        offline: false,
      });
    }

    // `motivo` separa dos casos que antes se veían idénticos desde el cliente:
    // que no haya ninguna llave configurada, o que la haya y el proveedor la
    // rechazara. Sin esto no se puede diagnosticar sin entrar al servidor.
    const motivo = fallos.length > 0 ? fallos.join(',') : 'sin-llave-configurada';
    console.error(`[asesor] Ningún proveedor respondió — motivo: ${motivo}`);
    return res.status(200).json({ offline: true, motivo });
  } catch (error: any) {
    console.error('Error en asesor IA:', error);
    return res.status(200).json({ offline: true, error: error.message });
  }
});

// ----------------------------------------------------------------------
// RENDER STATICS (PRODUCCIÓN)
// ----------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'dist')));

// Express 5 upgraded to path-to-regexp v8, which REJECTS unnamed wildcards: the
// old '/ecosistema*' and '*' throw "Missing parameter name" at startup, taking
// the whole server down before it can listen. The replacement syntax is a named
// wildcard, and `{...}` makes the segment optional so one route still covers
// both the bare path and everything under it — '/ecosistema/*splat' alone would
// not match a plain '/ecosistema'.
const shellEcosistema = (_req: express.Request, res: express.Response) =>
  res.sendFile(path.join(__dirname, 'dist', 'ecosistema', 'index.html'));

app.get('/ecosistema{/*splat}', shellEcosistema);
app.get('/finanzas{/*splat}', shellEcosistema);
app.get('/superadmin{/*splat}', shellEcosistema);
app.get('/estadisticas{/*splat}', shellEcosistema);

app.get('/{*splat}', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => {
  console.log(`✅ Servidor Web/API corriendo en el puerto ${PORT}`);
});
