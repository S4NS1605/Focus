import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';
import { tokenValido } from './server_lib/auth.ts';
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

app.get('/{*splat}', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => {
  console.log(`✅ Servidor Web/API corriendo en el puerto ${PORT}`);
});
