import React, { useState, useEffect } from 'react';
import { ArrowLeft, ShieldAlert, Edit2, Trash2, Plus, Search, Loader2, X, AlertTriangle, Eye, LogIn } from 'lucide-react';
import { TemaToggle } from '../features/finanzas/components/TemaToggle';
import type { Tema } from '../features/finanzas/data/useTema';
import { obtenerSupabase } from '../features/finanzas/data/supabase';
import { useBloqueoScroll } from '../features/finanzas/data/useBloqueoScroll';
import { apiUrl } from '../lib/api';

interface SuperadminPanelProps {
  onBack: () => void;
  tema: Tema;
  onCambiarTema: (tema: Tema) => void;
}

interface Perfil {
  id: string;
  email: string;
  usuario: string | null;
  rol: 'admin' | 'usuario';
  created_at: string;
}

export const SuperadminPanel: React.FC<SuperadminPanelProps> = ({ onBack, tema, onCambiarTema }) => {
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editando, setEditando] = useState<Perfil | null>(null);
  const [borrando, setBorrando] = useState<Perfil | null>(null);

  // Impersonation states
  const [impersonando, setImpersonando] = useState<Perfil | null>(null);
  const [impersonacionCargando, setImpersonacionCargando] = useState(false);

  useBloqueoScroll(isModalOpen || borrando !== null || impersonando !== null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoUsuario, setNuevoUsuario] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [nuevoRol, setNuevoRol] = useState<'admin' | 'usuario'>('usuario');

  const fetchUsuarios = async () => {
    setLoading(true);
    const cliente = obtenerSupabase();
    if (!cliente) return;

    const { data, error } = await cliente
      .from('perfiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (data && !error) {
      setUsuarios(data as Perfil[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const abrirCrear = () => {
    setEditando(null);
    setNuevoEmail('');
    setNuevoUsuario('');
    setNuevaPassword('');
    setNuevoRol('usuario');
    setFormError(null);
    setIsModalOpen(true);
  };

  const abrirEditar = (perfil: Perfil) => {
    setEditando(perfil);
    setNuevoEmail(perfil.email);
    setNuevoUsuario(perfil.usuario ?? '');
    setNuevaPassword(''); // En blanco = déjala como está, no la vacíes.
    setNuevoRol(perfil.rol);
    setFormError(null);
    setIsModalOpen(true);
  };

  const abrirImpersonar = (perfil: Perfil) => {
    setImpersonando(perfil);
    setFormError(null);
  };

  const handleImpersonar = async () => {
    if (!impersonando) return;
    setImpersonacionCargando(true);
    setFormError(null);
    try {
      const cliente = obtenerSupabase();
      if (!cliente) throw new Error('No hay cliente Supabase');

      // 1. Guardar sesión actual del admin para poder volver
      const { data: { session: adminSession } } = await cliente.auth.getSession();
      if (!adminSession) throw new Error('No hay sesión activa');

      localStorage.setItem('__admin_session_backup__', JSON.stringify({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
        usuario: adminSession.user.user_metadata?.usuario || adminSession.user.email,
        email: adminSession.user.email,
      }));

      // 2. Pedir al backend los tokens directos (sin magic link, sin redirect)
      const res = await fetch(apiUrl('/api/impersonar-usuario'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminSession.access_token}`,
        },
        body: JSON.stringify({ userId: impersonando.id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al crear sesión de impersonación');

      // 3. Intercambiar el token_hash por una sesión real del usuario objetivo.
      // verifyOtp() es una llamada pura a la API de Supabase — NO abre
      // ninguna URL en el navegador ni redirige a localhost.
      const { error: otpError } = await cliente.auth.verifyOtp({
        token_hash: result.tokenHash,
        type: 'magiclink',
      });

      if (otpError) throw new Error(otpError.message);

      // 4. Sesión activa → navegar a Finanzas
      setImpersonando(null);
      window.location.href = '/finanzas';
    } catch (err: any) {
      setFormError(err.message);
      localStorage.removeItem('__admin_session_backup__');
    } finally {
      setImpersonacionCargando(false);
    }
  };

  /** El token de la sesión actual, o revienta si no hay sesión. */
  const tokenSesion = async (): Promise<string> => {
    const cliente = obtenerSupabase();
    const { data: { session } } = await cliente!.auth.getSession();
    if (!session) throw new Error('No hay sesión activa');
    return session.access_token;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const token = await tokenSesion();

      if (editando) {
        // Solo viaja lo que cambió. Igualar contra el perfil original evita
        // reescribir un correo con el mismo correo, o chocar el usuario contra
        // su propio índice único.
        const cambios: Record<string, unknown> = { userId: editando.id };
        if (nuevoEmail !== editando.email) cambios.email = nuevoEmail;
        if (nuevoUsuario !== (editando.usuario ?? '')) cambios.usuario = nuevoUsuario;
        if (nuevaPassword !== '') cambios.password = nuevaPassword;
        if (nuevoRol !== editando.rol) cambios.rol = nuevoRol;

        const res = await fetch(apiUrl('/api/editar-usuario'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(cambios),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Error al editar usuario');
      } else {
        const res = await fetch(apiUrl('/api/crear-usuario'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            email: nuevoEmail,
            usuario: nuevoUsuario,
            password: nuevaPassword,
            rol: nuevoRol,
          }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Error al crear usuario');
      }

      setIsModalOpen(false);
      setEditando(null);
      fetchUsuarios();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEliminar = async () => {
    if (!borrando) return;
    setFormError(null);
    setIsSubmitting(true);

    try {
      const token = await tokenSesion();
      const res = await fetch(apiUrl('/api/eliminar-usuario'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: borrando.id }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al eliminar usuario');

      setBorrando(null);
      fetchUsuarios();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsuarios = usuarios.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.usuario && u.usuario.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-[100dvh] bg-[var(--fin-bg)] text-[var(--fin-ink)] transition-colors duration-300 font-sans flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[var(--fin-line)] bg-[var(--fin-bg)]/80 px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-4 transition-colors">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-card)] hover:text-[var(--fin-ink)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">Superadmin</h1>
          </div>
        </div>
        
        <TemaToggle tema={tema} onCambiar={onCambiarTema} />
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-8 sm:p-10">
        <div className="mx-auto max-w-5xl">
          
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Gestión de Usuarios</h2>
              <p className="mt-2 text-sm text-[var(--fin-ink-soft)]">
                Administra los accesos al ecosistema, roles y permisos.
              </p>
            </div>
            
            <button
              onClick={abrirCrear}
              className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition-all hover:bg-purple-700 hover:shadow-purple-500/40 hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" />
              Nuevo Usuario
            </button>
          </div>

          <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] shadow-sm overflow-hidden">
            
            <div className="border-b border-[var(--fin-line)] p-4 sm:px-6 flex items-center justify-between">
               <div className="relative w-full max-w-sm">
                 <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--fin-ink-faint)]">
                   <Search className="h-4 w-4" />
                 </div>
                 <input
                   type="text"
                   placeholder="Buscar por correo o usuario..."
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                   className="block w-full rounded-xl border-none bg-[var(--fin-soft)] py-2.5 pl-10 pr-4 text-base text-[var(--fin-ink)] placeholder-[var(--fin-ink-faint)] focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                 />
               </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                 <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-[var(--fin-ink-faint)]" />
                 </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--fin-soft)]/50 text-[11px] font-semibold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                    <tr>
                      <th className="px-6 py-4">Usuario</th>
                      <th className="px-6 py-4">Rol</th>
                      <th className="px-6 py-4">Fecha de Registro</th>
                      <th className="px-6 py-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--fin-line)]">
                    {filteredUsuarios.map((u) => (
                      <tr key={u.id} className="transition-colors hover:bg-[var(--fin-soft)]/30">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 text-gray-600 dark:text-gray-300 font-bold uppercase shadow-inner">
                              {u.email.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold">{u.usuario || 'Sin nombre'}</p>
                              <p className="text-[12px] text-[var(--fin-ink-soft)]">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                            u.rol === 'admin' 
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300' 
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                          }`}>
                            {u.rol === 'admin' && <ShieldAlert className="h-3 w-3" />}
                            {u.rol}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[var(--fin-ink-soft)]">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => abrirImpersonar(u)}
                              aria-label={`Ver sesión de ${u.usuario || u.email}`}
                              className="rounded-lg p-2 text-[var(--fin-ink-faint)] transition-colors hover:bg-[var(--fin-soft)] hover:text-amber-500"
                              title="Acceder como este usuario"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => abrirEditar(u)}
                              aria-label={`Editar a ${u.usuario || u.email}`}
                              className="rounded-lg p-2 text-[var(--fin-ink-faint)] transition-colors hover:bg-[var(--fin-soft)] hover:text-blue-500"
                              title="Editar"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => { setFormError(null); setBorrando(u); }}
                              aria-label={`Eliminar a ${u.usuario || u.email}`}
                              className="rounded-lg p-2 text-[var(--fin-ink-faint)] transition-colors hover:bg-[var(--fin-soft)] hover:text-red-500"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsuarios.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-[var(--fin-ink-soft)]">
                          No se encontraron usuarios que coincidan con la búsqueda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
            
          </div>
        </div>
      </main>

      {/* Modal Crear / Editar Usuario */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm transition-all duration-300">
          <div className="w-full max-w-md scale-100 overflow-hidden rounded-3xl bg-[var(--fin-card)] shadow-2xl shadow-purple-500/10">
            <div className="flex items-center justify-between border-b border-[var(--fin-line)] px-6 py-4">
              <h3 className="text-lg font-bold tracking-tight">
                {editando ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-2 text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {formError && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-[var(--fin-out-bg)] px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fin-out)]" />
                  <p className="text-sm font-medium text-[var(--fin-out-ink)]">{formError}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[var(--fin-ink-soft)]">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    value={nuevoEmail}
                    onChange={(e) => setNuevoEmail(e.target.value)}
                    className="block w-full rounded-xl border border-[var(--fin-line)] bg-transparent px-4 py-2.5 text-base transition-colors focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="ejemplo@correo.com"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[var(--fin-ink-soft)]">Nombre de Usuario</label>
                  <input
                    type="text"
                    required
                    value={nuevoUsuario}
                    onChange={(e) => setNuevoUsuario(e.target.value)}
                    className="block w-full rounded-xl border border-[var(--fin-line)] bg-transparent px-4 py-2.5 text-base transition-colors focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="MiUsuario"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[var(--fin-ink-soft)]">
                    Contraseña
                    {editando && (
                      <span className="ml-1 font-normal text-[var(--fin-ink-faint)]">
                        · déjala en blanco para no cambiarla
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    // Al crear es obligatoria; al editar, en blanco significa
                    // "no la toques", así que no puede ser requerida.
                    required={!editando}
                    minLength={6}
                    value={nuevaPassword}
                    onChange={(e) => setNuevaPassword(e.target.value)}
                    className="block w-full rounded-xl border border-[var(--fin-line)] bg-transparent px-4 py-2.5 text-base transition-colors focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder={editando ? 'Sin cambios' : 'Mínimo 6 caracteres'}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[var(--fin-ink-soft)]">Rol</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNuevoRol('usuario')}
                      className={`rounded-xl border py-2.5 text-sm font-bold transition-all ${
                        nuevoRol === 'usuario' 
                          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300' 
                          : 'border-[var(--fin-line)] text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]'
                      }`}
                    >
                      Usuario Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => setNuevoRol('admin')}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-bold transition-all ${
                        nuevoRol === 'admin' 
                          ? 'border-purple-500 bg-purple-50 text-purple-700 dark:border-purple-400 dark:bg-purple-900/30 dark:text-purple-300' 
                          : 'border-[var(--fin-line)] text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]'
                      }`}
                    >
                      <ShieldAlert className="h-4 w-4" />
                      Admin
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl px-5 py-2.5 text-sm font-bold text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition-all hover:bg-purple-700 hover:shadow-purple-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {editando ? 'Guardando...' : 'Creando...'}
                    </>
                  ) : (
                    editando ? 'Guardar cambios' : 'Crear Usuario'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmar eliminación. Aparte del modal de editar porque borrar es
          irreversible: se lleva la cuenta y, en cascada, todo lo suyo. */}
      {borrando && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-[var(--fin-card)] shadow-2xl">
            <div className="p-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/15 text-red-500">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold tracking-tight">Eliminar usuario</h3>
              <p className="mt-2 text-sm text-[var(--fin-ink-soft)]">
                Vas a borrar la cuenta de{' '}
                <span className="font-bold text-[var(--fin-ink)]">
                  {borrando.usuario || borrando.email}
                </span>{' '}
                y todo lo que tiene guardado. Esto no se puede deshacer.
              </p>

              {formError && (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-[var(--fin-out-bg)] px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fin-out)]" />
                  <p className="text-sm font-medium text-[var(--fin-out-ink)]">{formError}</p>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setBorrando(null)}
                  disabled={isSubmitting}
                  className="rounded-xl px-5 py-2.5 text-sm font-bold text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleEliminar}
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-500/25 transition-all hover:bg-red-700 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Acceder como usuario (Impersonación) */}
      {impersonando && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-[var(--fin-card)] shadow-2xl shadow-amber-500/10">
            <div className="flex items-center justify-between border-b border-[var(--fin-line)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                  <Eye className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">Acceder como usuario</h3>
                  <p className="text-xs text-[var(--fin-ink-soft)]">{impersonando.usuario || impersonando.email}</p>
                </div>
              </div>
              <button
                onClick={() => setImpersonando(null)}
                className="rounded-lg p-2 text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-soft)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {/* Info del usuario */}
              <div className="mb-5 rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-soft)]/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-amber-200 to-orange-300 dark:from-amber-800 dark:to-orange-900 text-amber-800 dark:text-amber-200 font-bold uppercase text-lg shadow-inner">
                    {impersonando.email.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-base">{impersonando.usuario || 'Sin nombre'}</p>
                    <p className="text-sm text-[var(--fin-ink-soft)]">{impersonando.email}</p>
                    <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      impersonando.rol === 'admin'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                    }`}>
                      {impersonando.rol === 'admin' && <ShieldAlert className="h-3 w-3" />}
                      {impersonando.rol}
                    </span>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber-200/50 bg-amber-50/80 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-900/10">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Tu sesión de admin quedará guardada. Entrarás directamente como este usuario y podrás volver a tu cuenta con el banner que aparecerá en la app.
                </p>
              </div>

              {formError && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-[var(--fin-out-bg)] px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fin-out)]" />
                  <p className="text-sm font-medium text-[var(--fin-out-ink)]">{formError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setImpersonando(null)}
                  disabled={impersonacionCargando}
                  className="flex-1 rounded-xl border border-[var(--fin-line)] px-4 py-3 text-sm font-bold text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-soft)] disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImpersonar}
                  disabled={impersonacionCargando}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/25 transition-all hover:bg-amber-600 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {impersonacionCargando ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Entrando...</>
                  ) : (
                    <><LogIn className="h-4 w-4" /> Entrar como {impersonando.usuario || impersonando.email}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
