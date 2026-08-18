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
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) {
    return res.status(500).json({ error: 'Falta configurar SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY' });
  }

  try {
    const acceso = await exigirPermiso(cliente, token, 'crear_usuario');
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    const { email, password, usuario, rol } = req.body;

    const { data: newUser, error: createError } = await cliente.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { usuario: usuario || '' }
    });

    if (createError) throw createError;

    if (rol === 'admin' && newUser.user) {
      const { error: updateError } = await cliente
        .from('perfiles')
        .update({ rol: 'admin' })
        .eq('id', newUser.user.id);

      if (updateError) throw updateError;
    }

    registrarAuditoria(
      acceso.email || 'admin',
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
): Promise<{ userId: string; email: string } | { status: number; error: string }> => {
  const { data: llamador, error } = await cliente.auth.getUser(token);
  if (error || !llamador.user) return { status: 401, error: 'Token inválido' };
  return { userId: llamador.user.id, email: llamador.user.email ?? '' };
};

/**
 * El id del que llama, si tiene el permiso pedido; si no, el estado y mensaje
 * a devolver.
 *
 * 'admin' pasa siempre sin consultar roles personalizados — la misma garantía
 * que `exigirAdmin`: el rol fijo nunca depende de que `permisos_por_rol` esté
 * bien poblada. Para el resto, se busca su rol_personalizado_id y se revisa si
 * ese rol tiene `permiso` marcado.
 */
const exigirPermiso = async (
  cliente: ClienteAdmin,
  token: string,
  permiso: string,
): Promise<{ userId: string; email: string } | { status: number; error: string }> => {
  const { data: llamador, error } = await cliente.auth.getUser(token);
  if (error || !llamador.user) return { status: 401, error: 'Token inválido' };

  const { data: perfil } = await cliente
    .from('perfiles')
    .select('rol, rol_personalizado_id')
    .eq('id', llamador.user.id)
    .single();

  if (perfil?.rol === 'admin') {
    return { userId: llamador.user.id, email: llamador.user.email ?? '' };
  }

  if (perfil?.rol_personalizado_id) {
    const { data: concedido } = await cliente
      .from('permisos_por_rol')
      .select('permiso')
      .eq('rol_id', perfil.rol_personalizado_id)
      .eq('permiso', permiso)
      .maybeSingle();
    if (concedido) return { userId: llamador.user.id, email: llamador.user.email ?? '' };
  }

  return { status: 403, error: 'No tienes permiso para esta acción.' };
};

// ----------------------------------------------------------------------
// TELEMETRÍA: Consumo de Tokens y Métricas de IA
// ----------------------------------------------------------------------
export interface PeticionIA {
  id: string;
  timestamp: string;
  usuarioEmail: string;
  proveedor: string;
  modelo: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  duracionMs: number;
  exito: boolean;
  motivo?: string;
  promptText?: string;
  respuestaTexto?: string;
}

interface MetricasIAStore {
  fechaActual: string;
  tokensHoy: number;
  llamadasHoy: number;
  llamadasExitosasHoy: number;
  llamadasFallbackHoy: number;
  latenciasMs: number[];
  peticionesRecientes: PeticionIA[];
}

const fechaBogotaHoy = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const metricasIA: MetricasIAStore = {
  fechaActual: fechaBogotaHoy(),
  tokensHoy: 0,
  llamadasHoy: 0,
  llamadasExitosasHoy: 0,
  llamadasFallbackHoy: 0,
  latenciasMs: [],
  peticionesRecientes: [],
};

const asegurarDiaActualMetricas = () => {
  const hoy = fechaBogotaHoy();
  if (metricasIA.fechaActual !== hoy) {
    metricasIA.fechaActual = hoy;
    metricasIA.tokensHoy = 0;
    metricasIA.llamadasHoy = 0;
    metricasIA.llamadasExitosasHoy = 0;
    metricasIA.llamadasFallbackHoy = 0;
    metricasIA.latenciasMs = [];
  }
};

const registrarUsoIA = (
  peticion: Omit<PeticionIA, 'id' | 'timestamp'>,
  cliente?: ClienteAdmin | null,
  userId?: string,
) => {
  asegurarDiaActualMetricas();
  const registro: PeticionIA = {
    id: `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    ...peticion,
  };

  metricasIA.llamadasHoy += 1;
  if (peticion.exito) {
    metricasIA.llamadasExitosasHoy += 1;
    metricasIA.tokensHoy += peticion.totalTokens;
    metricasIA.latenciasMs.push(peticion.duracionMs);
    if (metricasIA.latenciasMs.length > 50) metricasIA.latenciasMs.shift();
  } else {
    metricasIA.llamadasFallbackHoy += 1;
  }

  metricasIA.peticionesRecientes.unshift(registro);
  if (metricasIA.peticionesRecientes.length > 50) metricasIA.peticionesRecientes.pop();

  // Persistencia en Supabase: si la tabla existe, el historial sobrevive a cualquier reinicio del servidor
  if (cliente) {
    void cliente
      .from('telemetria_ia')
      .insert({
        id: registro.id,
        usuario_id: userId || null,
        usuario_email: registro.usuarioEmail,
        proveedor: registro.proveedor,
        modelo: registro.modelo,
        prompt_tokens: registro.promptTokens,
        completion_tokens: registro.completionTokens,
        total_tokens: registro.totalTokens,
        duracion_ms: registro.duracionMs,
        exito: registro.exito,
        motivo: registro.motivo || null,
        prompt_texto: registro.promptText || null,
        respuesta_texto: registro.respuestaTexto || null,
        creado_en: registro.timestamp,
      })
      .then(({ error }) => {
        if (error) {
          // Si la tabla aún no se ha creado en Supabase, no rompe nada (continúa con memoria local)
          console.warn('[telemetria_ia] Aviso al persistir en Supabase:', error.message);
        }
      })
      .catch((err) => {
        console.warn('[telemetria_ia] Error de red al persistir en Supabase:', err);
      });
  }
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
    const acceso = await exigirPermiso(cliente, token, 'editar_usuario');
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    const { userId, email, usuario, password, rol, rolPersonalizadoId } = req.body ?? {};
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
    // null quita el rol personalizado asignado; string lo cambia; ausente no
    // lo toca — la misma distinción que el resto de campos de arriba.
    if (rolPersonalizadoId === null || typeof rolPersonalizadoId === 'string') {
      cambios.rolPersonalizadoId = rolPersonalizadoId;
    }

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
    if (cambios.rolPersonalizadoId !== undefined) perfilUpdate.rol_personalizado_id = cambios.rolPersonalizadoId;

    if (Object.keys(perfilUpdate).length > 0) {
      const { error } = await cliente.from('perfiles').update(perfilUpdate).eq('id', userId);
      if (error) {
        // Un usuario repetido choca contra el índice único; un rol
        // personalizado inexistente choca contra la referencia — los dos se
        // traducen a un mensaje que se entiende, no al error crudo de Postgres.
        const dup = error.code === '23505';
        const rolInexistente = error.code === '23503';
        return res.status(dup || rolInexistente ? 409 : 500).json({
          error: dup
            ? 'Ese nombre de usuario ya está tomado.'
            : rolInexistente
              ? 'Ese rol personalizado ya no existe.'
              : error.message,
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
    const acceso = await exigirPermiso(cliente, token, 'eliminar_usuario');
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
    const acceso = await exigirPermiso(cliente, token, 'impersonar_usuario');
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

  const acceso = await exigirPermiso(cliente, token, 'ver_auditoria');
  if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

  return res.status(200).json({ success: true, logs: auditLogs });
});

// ----------------------------------------------------------------------
// ENDPOINT: Métricas de IA y Consumo de Tokens (Superadmin)
// ----------------------------------------------------------------------
app.get('/api/metricas-ia', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configuración de Supabase' });

  const acceso = await exigirPermiso(cliente, token, 'ver_metricas_ia');
  if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

  asegurarDiaActualMetricas();

  const groqKey = Boolean(process.env.GROQ_API_KEY);
  const openaiKey = Boolean(process.env.OPENAI_API_KEY);
  const geminiKey = Boolean(process.env.GEMINI_API_KEY);
  const anthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const deepseekKey = Boolean(process.env.DEEPSEEK_API_KEY);

  let proveedorPrincipal = 'Ninguno (Modo Local)';
  let modeloPrincipal = 'Motor de Reglas Heurístico';
  let limiteDiarioTokens = 0;
  let limiteDiarioLlamadas = 0;

  if (groqKey) {
    proveedorPrincipal = 'Groq Cloud';
    modeloPrincipal = 'openai/gpt-oss-120b';
    limiteDiarioTokens = 500000;
    limiteDiarioLlamadas = 14400;
  } else if (openaiKey) {
    proveedorPrincipal = 'OpenAI';
    modeloPrincipal = 'gpt-4o-mini';
    limiteDiarioTokens = 200000;
    limiteDiarioLlamadas = 5000;
  } else if (geminiKey) {
    proveedorPrincipal = 'Google Gemini';
    modeloPrincipal = 'gemini-1.5-flash';
    limiteDiarioTokens = 1000000;
    limiteDiarioLlamadas = 1500;
  } else if (anthropicKey) {
    proveedorPrincipal = 'Anthropic';
    modeloPrincipal = 'claude-3-5-sonnet';
    limiteDiarioTokens = 100000;
    limiteDiarioLlamadas = 1000;
  } else if (deepseekKey) {
    proveedorPrincipal = 'DeepSeek';
    modeloPrincipal = 'deepseek-chat';
    limiteDiarioTokens = 500000;
    limiteDiarioLlamadas = 10000;
  }

  let tokensHoy = metricasIA.tokensHoy;
  let llamadasHoy = metricasIA.llamadasHoy;
  let llamadasExitosasHoy = metricasIA.llamadasExitosasHoy;
  let llamadasFallbackHoy = metricasIA.llamadasFallbackHoy;
  let latenciasMs = metricasIA.latenciasMs;
  let peticionesRecientes = metricasIA.peticionesRecientes;

  // Cargar datos persistentes de Supabase si existen
  try {
    const inicioHoyIso = `${metricasIA.fechaActual}T00:00:00-05:00`;
    const { data: filasHoy, error: errHoy } = await cliente
      .from('telemetria_ia')
      .select('*')
      .gte('creado_en', inicioHoyIso)
      .order('creado_en', { ascending: false })
      .limit(200);

    if (!errHoy && filasHoy && filasHoy.length > 0) {
      llamadasHoy = filasHoy.length;
      llamadasExitosasHoy = filasHoy.filter((f) => f.exito).length;
      llamadasFallbackHoy = filasHoy.filter((f) => !f.exito).length;
      tokensHoy = filasHoy.filter((f) => f.exito).reduce((acc, f) => acc + (f.total_tokens || 0), 0);
      latenciasMs = filasHoy.filter((f) => f.exito && f.duracion_ms).map((f) => f.duracion_ms);
      peticionesRecientes = filasHoy.slice(0, 50).map((f) => ({
        id: f.id,
        timestamp: f.creado_en,
        usuarioEmail: f.usuario_email,
        proveedor: f.proveedor,
        modelo: f.modelo,
        promptTokens: f.prompt_tokens,
        completionTokens: f.completion_tokens,
        totalTokens: f.total_tokens,
        duracionMs: f.duracion_ms,
        exito: f.exito,
        motivo: f.motivo || undefined,
        promptText: f.prompt_texto || undefined,
        respuestaTexto: f.respuesta_texto || undefined,
      }));
    } else if (!errHoy && filasHoy && filasHoy.length === 0) {
      // Si hoy aún no hay consultas, traer las más recientes para mantener el historial visible
      const { data: ultimas, error: errUltimas } = await cliente
        .from('telemetria_ia')
        .select('*')
        .order('creado_en', { ascending: false })
        .limit(50);

      if (!errUltimas && ultimas && ultimas.length > 0) {
        peticionesRecientes = ultimas.map((f) => ({
          id: f.id,
          timestamp: f.creado_en,
          usuarioEmail: f.usuario_email,
          proveedor: f.proveedor,
          modelo: f.modelo,
          promptTokens: f.prompt_tokens,
          completionTokens: f.completion_tokens,
          totalTokens: f.total_tokens,
          duracionMs: f.duracion_ms,
          exito: f.exito,
          motivo: f.motivo || undefined,
          promptText: f.prompt_texto || undefined,
          respuestaTexto: f.respuesta_texto || undefined,
        }));
      }
    }
  } catch (err) {
    console.warn('[metricas-ia] Usando memoria local por error de consulta:', err);
  }

  const latenciaPromedio = latenciasMs.length > 0
    ? Math.round(latenciasMs.reduce((a, b) => a + b, 0) / latenciasMs.length)
    : 0;

  const tokensRestantes = limiteDiarioTokens > 0 ? Math.max(0, limiteDiarioTokens - tokensHoy) : 0;
  const llamadasRestantes = limiteDiarioLlamadas > 0 ? Math.max(0, limiteDiarioLlamadas - llamadasHoy) : 0;
  const porcentajeTokens = limiteDiarioTokens > 0 ? Number(((tokensHoy / limiteDiarioTokens) * 100).toFixed(2)) : 0;
  const porcentajeLlamadas = limiteDiarioLlamadas > 0 ? Number(((llamadasHoy / limiteDiarioLlamadas) * 100).toFixed(2)) : 0;

  return res.status(200).json({
    success: true,
    fecha: metricasIA.fechaActual,
    proveedor: proveedorPrincipal,
    modelo: modeloPrincipal,
    hayIA: Boolean(groqKey || openaiKey || geminiKey || anthropicKey || deepseekKey),
    tokensHoy,
    tokensRestantes,
    limiteDiarioTokens,
    porcentajeTokens,
    llamadasHoy,
    llamadasExitosas: llamadasExitosasHoy,
    llamadasFallback: llamadasFallbackHoy,
    llamadasRestantes,
    limiteDiarioLlamadas,
    porcentajeLlamadas,
    latenciaPromedioMs: latenciaPromedio,
    costoEstimadoCop: 0,
    peticionesRecientes,
  });
});

// ----------------------------------------------------------------------
// ROLES PERSONALIZADOS
//
// Gestionar el catálogo de roles es admin-only puro (exigirAdmin, no
// exigirPermiso): si se delegara con un permiso, alguien con `editar_usuario`
// podría crearse un rol con todo marcado y auto-asignárselo, escalando sus
// propios privilegios. Solo /api/mis-permisos usa exigirUsuario, porque ahí
// cada quien solo puede leer lo suyo.
// ----------------------------------------------------------------------

app.get('/api/roles', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configuración de Supabase' });

  const acceso = await exigirAdmin(cliente, token);
  if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

  const [{ data: roles, error: errRoles }, { data: permisos, error: errPermisos }] = await Promise.all([
    cliente.from('roles').select('id, nombre, descripcion, permisos_por_rol(permiso)').order('nombre'),
    cliente.from('permisos').select('clave, descripcion').order('clave'),
  ]);
  if (errRoles) return res.status(500).json({ error: errRoles.message });
  if (errPermisos) return res.status(500).json({ error: errPermisos.message });

  return res.status(200).json({
    success: true,
    roles: (roles ?? []).map((r: any) => ({
      id: r.id,
      nombre: r.nombre,
      descripcion: r.descripcion,
      permisos: (r.permisos_por_rol ?? []).map((p: any) => p.permiso),
    })),
    catalogoPermisos: permisos ?? [],
  });
});

app.post('/api/crear-rol', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configuración de Supabase' });

  const acceso = await exigirAdmin(cliente, token);
  if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

  const { nombre, descripcion, permisos } = req.body ?? {};
  if (typeof nombre !== 'string' || nombre.trim() === '') {
    return res.status(400).json({ error: 'El rol necesita un nombre.' });
  }
  const permisosLimpios: string[] = Array.isArray(permisos) ? permisos.filter((p) => typeof p === 'string') : [];

  const id = `rol-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const { error: errCrear } = await cliente
    .from('roles')
    .insert({ id, nombre: nombre.trim(), descripcion: typeof descripcion === 'string' ? descripcion : null });
  if (errCrear) {
    const dup = errCrear.code === '23505';
    return res.status(dup ? 409 : 500).json({ error: dup ? 'Ya existe un rol con ese nombre.' : errCrear.message });
  }

  if (permisosLimpios.length > 0) {
    const { error: errPermisos } = await cliente
      .from('permisos_por_rol')
      .insert(permisosLimpios.map((permiso) => ({ rol_id: id, permiso })));
    if (errPermisos) return res.status(500).json({ error: errPermisos.message });
  }

  registrarAuditoria(acceso.email, 'Creó rol', nombre, `Permisos: ${permisosLimpios.join(', ') || 'ninguno'}`);
  return res.status(200).json({ success: true, id });
});

app.post('/api/editar-rol', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configuración de Supabase' });

  const acceso = await exigirAdmin(cliente, token);
  if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

  const { id, nombre, descripcion, permisos } = req.body ?? {};
  if (typeof id !== 'string' || id === '') return res.status(400).json({ error: 'Falta el rol a editar.' });

  const cambiosRol: Record<string, unknown> = {};
  if (typeof nombre === 'string' && nombre.trim() !== '') cambiosRol.nombre = nombre.trim();
  if (typeof descripcion === 'string' || descripcion === null) cambiosRol.descripcion = descripcion;

  if (Object.keys(cambiosRol).length > 0) {
    const { error } = await cliente.from('roles').update(cambiosRol).eq('id', id);
    if (error) {
      const dup = error.code === '23505';
      return res.status(dup ? 409 : 500).json({ error: dup ? 'Ya existe un rol con ese nombre.' : error.message });
    }
  }

  // Los permisos se reemplazan enteros cuando vienen en el body: borrar todo
  // y volver a insertar es más simple y menos propenso a errores que calcular
  // el diff entre lo que había y lo que se marcó ahora.
  if (Array.isArray(permisos)) {
    const permisosLimpios: string[] = permisos.filter((p) => typeof p === 'string');
    const { error: errBorrar } = await cliente.from('permisos_por_rol').delete().eq('rol_id', id);
    if (errBorrar) return res.status(500).json({ error: errBorrar.message });

    if (permisosLimpios.length > 0) {
      const { error: errInsertar } = await cliente
        .from('permisos_por_rol')
        .insert(permisosLimpios.map((permiso) => ({ rol_id: id, permiso })));
      if (errInsertar) return res.status(500).json({ error: errInsertar.message });
    }
  }

  registrarAuditoria(acceso.email, 'Editó rol', nombre || id);
  return res.status(200).json({ success: true });
});

app.post('/api/eliminar-rol', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configuración de Supabase' });

  const acceso = await exigirAdmin(cliente, token);
  if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

  const { id } = req.body ?? {};
  if (typeof id !== 'string' || id === '') return res.status(400).json({ error: 'Falta el rol a eliminar.' });

  // Quien lo tuviera asignado queda sin rol personalizado (on delete set null
  // en perfiles.rol_personalizado_id) -- vuelve a comportarse como 'usuario'
  // sin ningún permiso, no como si el borrado fallara a medias.
  const { error } = await cliente.from('roles').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });

  registrarAuditoria(acceso.email, 'Eliminó rol', id);
  return res.status(200).json({ success: true });
});

/**
 * Los permisos efectivos del que llama, para que el frontend sepa qué
 * mostrar. 'admin' no necesita listar sus permisos uno por uno -- el
 * frontend ya lo trata aparte -- así que viaja con `permisos: []` y `rol:
 * 'admin'` alcanza para que sepa que puede todo.
 *
 * Sin este endpoint, la única forma de que alguien con un rol personalizado
 * viera sus propios permisos sería abrir RLS de lectura en permisos_por_rol a
 * cualquier autenticado -- y con eso cualquiera podría listar el catálogo
 * entero de roles del sistema. El cliente de service-role evita ese trueque.
 */
app.get('/api/mis-permisos', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configuración de Supabase' });

  const quien = await exigirUsuario(cliente, token);
  if ('error' in quien) return res.status(quien.status).json({ error: quien.error });

  const { data: perfil } = await cliente
    .from('perfiles')
    .select('rol, rol_personalizado_id')
    .eq('id', quien.userId)
    .single();

  const rol = perfil?.rol === 'admin' ? 'admin' : 'usuario';
  let permisos: string[] = [];

  if (rol !== 'admin' && perfil?.rol_personalizado_id) {
    const { data } = await cliente
      .from('permisos_por_rol')
      .select('permiso')
      .eq('rol_id', perfil.rol_personalizado_id);
    permisos = (data ?? []).map((p) => p.permiso);
  }

  return res.status(200).json({ rol, permisos });
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

  const systemPrompt = `Eres un asesor financiero personal experto para Colombia dentro de la aplicación Finanzas.
Tu tono es empático, profesional, claro y directo.
Tienes acceso al resumen financiero real del usuario:
${finanzasContext ? JSON.stringify(finanzasContext, null, 2) : 'No hay datos financieros registrados aún.'}

Reglas clave:
1. Responde de forma concisa usando Markdown estructurado (negritas, viñetas).
2. Si el usuario pregunta por sus gastos o ingresos, usa los datos del contexto financiero en Pesos Colombianos (COP).
3. Da recomendaciones realistas y accionables (ahorro, CDT, recorte de gastos hormiga, presupuestos por categoría, manejo de deudas).
4. No des recomendaciones de inversión de alto riesgo sin advertencias.
5. Mantén las respuestas breves y directas al grano (máximo 2 a 4 párrafos).`;

  const inicio = Date.now();
  try {
    let respuestaTexto = '';
    let proveedor = '';
    let modelo = 'desconocido';
    // Por qué no contestó cada proveedor. Sin esto, "no hay llave" y "la llave
    // falló" devuelven lo mismo desde fuera y no hay forma de distinguirlos.
    const fallos: string[] = [];

    // 1. Groq (rápido y sin costo en el plan gratuito).
    if (groqKey) {
      proveedor = 'Groq (GPT-OSS 120B)';
      modelo = 'openai/gpt-oss-120b';
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
        const detalle = await groqRes.text().catch(() => '');
        console.error(`[asesor] Groq ${groqRes.status}: ${detalle.slice(0, 400)}`);
        fallos.push(`groq:${groqRes.status}`);
      }
    }

    // 2. OpenAI (GPT-4o mini)
    if (!respuestaTexto && openaiKey) {
      proveedor = 'OpenAI (GPT-4o)';
      modelo = 'gpt-4o-mini';
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
      modelo = 'gemini-1.5-flash';
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
      modelo = 'claude-3-5-sonnet-20241022';
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
      modelo = 'deepseek-chat';
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

    const duracionMs = Date.now() - inicio;
    const promptTokens = Math.ceil(((prompt?.length || 0) + JSON.stringify(finanzasContext || {}).length + systemPrompt.length) / 3.8);
    const completionTokens = Math.ceil((respuestaTexto?.length || 0) / 3.8);
    const totalTokens = promptTokens + completionTokens;

    if (respuestaTexto) {
      registrarUsoIA(
        {
          usuarioEmail: quienLlama.email || 'usuario',
          proveedor,
          modelo,
          promptTokens,
          completionTokens,
          totalTokens,
          duracionMs,
          exito: true,
          promptText: prompt,
          respuestaTexto,
        },
        cliente,
        quienLlama.userId,
      );

      return res.status(200).json({
        success: true,
        text: respuestaTexto,
        provider: proveedor,
        offline: false,
      });
    }

    const motivo = fallos.length > 0 ? fallos.join(',') : 'sin-llave-configurada';
    registrarUsoIA(
      {
        usuarioEmail: quienLlama.email || 'usuario',
        proveedor: proveedor || 'Ninguno',
        modelo: modelo || 'local',
        promptTokens,
        completionTokens: 0,
        totalTokens: promptTokens,
        duracionMs,
        exito: false,
        motivo,
        promptText: prompt,
        respuestaTexto: `[Consulta respondida por el motor local heurístico: ${motivo}]`,
      },
      cliente,
      quienLlama.userId,
    );

    console.error(`[asesor] Ningún proveedor respondió — motivo: ${motivo}`);
    return res.status(200).json({ offline: true, motivo });
  } catch (error: any) {
    const duracionMs = Date.now() - inicio;
    registrarUsoIA(
      {
        usuarioEmail: quienLlama.email || 'usuario',
        proveedor: 'Error',
        modelo: 'error',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        duracionMs,
        exito: false,
        motivo: error.message,
        promptText: typeof prompt === 'string' ? prompt : undefined,
        respuestaTexto: `[Error al procesar consulta: ${error.message}]`,
      },
      cliente,
      quienLlama.userId,
    );

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
