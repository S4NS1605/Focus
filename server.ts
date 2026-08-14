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

    return res.status(200).json({ success: true, user: newUser.user });
  } catch (error: any) {
    console.error('Error creando usuario:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

// ----------------------------------------------------------------------
// Cliente admin + comprobación de que quien llama es administrador.
//
// Los tres endpoints de superadmin hacen exactamente lo mismo al entrar: armar
// el cliente con la llave de servicio, verificar el JWT del que llama y mirar su
// rol en `perfiles`. Repetirlo tres veces era invitar a que una copia se
// quedara sin una de las comprobaciones. La llave de servicio se salta RLS, así
// que este es justo el lugar donde el rol se revisa de verdad, no en el navegador.
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

/** El id del que llama si es admin; si no, el estado y mensaje a devolver. */
const exigirAdmin = async (
  cliente: ClienteAdmin,
  token: string,
): Promise<{ userId: string } | { status: number; error: string }> => {
  const { data: llamador, error } = await cliente.auth.getUser(token);
  if (error || !llamador.user) return { status: 401, error: 'Token inválido' };

  const { data: perfil } = await cliente
    .from('perfiles')
    .select('rol')
    .eq('id', llamador.user.id)
    .single();

  if (perfil?.rol !== 'admin') return { status: 403, error: 'No tienes permisos de administrador' };
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

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Error eliminando usuario:', error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
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
