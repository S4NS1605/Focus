import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  ShieldAlert,
  Edit2,
  Trash2,
  Plus,
  Search,
  Loader2,
  X,
  AlertTriangle,
  Eye,
  LogIn,
  History,
  Users,
  Cpu,
  BarChart3,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Link2,
  Zap,
  Clock,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { TemaToggle } from '../features/finanzas/components/TemaToggle';
import type { Tema } from '../features/finanzas/data/useTema';
import { obtenerSupabase } from '../features/finanzas/data/supabase';
import { useBloqueoScroll } from '../features/finanzas/data/useBloqueoScroll';
import { apiUrl } from '../lib/api';
import type { Visita } from './estadisticas';
import { banderaDePais, diasHasta, nombreDePais, resumir } from './estadisticas';

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

interface AuditLog {
  id: string;
  timestamp: string;
  adminEmail: string;
  action: string;
  targetUser?: string;
  details?: string;
}

interface PeticionIA {
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
}

interface MetricasIAResponse {
  fecha: string;
  proveedor: string;
  modelo: string;
  hayIA: boolean;
  tokensHoy: number;
  tokensRestantes: number;
  limiteDiarioTokens: number;
  porcentajeTokens: number;
  llamadasHoy: number;
  llamadasExitosas: number;
  llamadasFallback: number;
  llamadasRestantes: number;
  limiteDiarioLlamadas: number;
  porcentajeLlamadas: number;
  latenciaPromedioMs: number;
  costoEstimadoCop: number;
  peticionesRecientes: PeticionIA[];
}

type TabSuperadmin = 'usuarios' | 'ia-tokens' | 'visitantes' | 'auditoria';

const RANGOS = [
  { dias: 7, texto: '7 días' },
  { dias: 30, texto: '30 días' },
  { dias: 90, texto: '90 días' },
];

const ICONO_DISPOSITIVO: Record<string, React.ReactNode> = {
  movil: <Smartphone className="h-3.5 w-3.5" />,
  tablet: <Tablet className="h-3.5 w-3.5" />,
  escritorio: <Monitor className="h-3.5 w-3.5" />,
};

const NOMBRE_DISPOSITIVO: Record<string, string> = {
  movil: 'Celular',
  tablet: 'Tableta',
  escritorio: 'Computador',
};

const formatearFechaCorta = (iso: string): string => {
  const parts = iso.split('-');
  if (parts.length < 3) return iso;
  const mes = parseInt(parts[1], 10) - 1;
  const dia = parseInt(parts[2], 10);
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${dia} ${meses[mes] || parts[1]}`;
};

interface BarraItem {
  id: string;
  etiqueta: string;
  subetiqueta?: string;
  valor: number;
  secundario?: number;
}

/** Gráfica de barras interactiva unificada con visualización instantánea (0ms espera). */
const GraficaBarrasUnificada: React.FC<{
  titulo: string;
  subtitulo?: string;
  icono?: React.ReactNode;
  items: BarraItem[];
  vacio: string;
  pieDeGrafica?: React.ReactNode;
}> = ({ titulo, subtitulo, icono, items, vacio, pieDeGrafica }) => {
  const [hovered, setHovered] = useState<BarraItem | null>(null);
  const maxValor = Math.max(...items.map((i) => i.valor), 1);
  const total = items.reduce((acc, i) => acc + i.valor, 0);

  const pico = useMemo(() => {
    if (total === 0) return null;
    return items.reduce((max, i) => (i.valor > max.valor ? i : max), items[0]);
  }, [items, total]);

  const activo = hovered ?? pico;

  return (
    <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 sm:p-6 shadow-sm transition-colors">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {icono}
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
              {titulo}
            </h3>
          </div>
          {subtitulo && <p className="text-[10px] text-[var(--fin-ink-faint)] mt-0.5">{subtitulo}</p>}
        </div>

        {/* Resumen instantáneo en vivo sin tener que esperar tooltips */}
        {total > 0 && activo && (
          <div className="flex items-center gap-2 rounded-xl bg-[var(--fin-soft)] px-3 py-1.5 transition-all self-start sm:self-auto">
            <span className="text-[10px] font-semibold text-[var(--fin-ink-faint)] uppercase tracking-wider">
              {hovered ? 'Seleccionado:' : 'Pico más alto:'}
            </span>
            <span className="text-xs font-bold text-[var(--fin-ink)]">
              {activo.etiqueta}
            </span>
            <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[11px] font-extrabold text-sky-600 dark:text-sky-400 tabular-nums">
              {activo.valor.toLocaleString('es-CO')} {activo.valor === 1 ? 'vista' : 'vistas'}
            </span>
            {activo.secundario !== undefined && activo.secundario > 0 && (
              <span className="text-[10px] text-[var(--fin-ink-soft)] font-medium">
                · {activo.secundario} {activo.secundario === 1 ? 'visitante' : 'visitantes'}
              </span>
            )}
          </div>
        )}
      </div>

      {total === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--fin-ink-faint)]">{vacio}</p>
      ) : (
        <div>
          <div className="flex h-36 items-end gap-[3px] sm:gap-1.5 pt-7 pb-1">
            {items.map((item) => {
              const esHover = hovered?.id === item.id;
              const esPico = !hovered && pico?.id === item.id && item.valor > 0;
              const destacado = esHover || esPico;
              const porcentaje = Math.max((item.valor / maxValor) * 100, item.valor > 0 ? 8 : 3);

              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setHovered(item)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setHovered(item)}
                  className="group relative flex-1 h-full flex flex-col justify-end items-center cursor-pointer select-none"
                >
                  {/* Tooltip flotante instantáneo (0ms de retraso) */}
                  <div
                    className={`pointer-events-none absolute -top-8 z-30 whitespace-nowrap rounded-lg bg-[var(--fin-ink)] px-2.5 py-1 text-[10px] font-bold text-[var(--fin-bg)] shadow-xl transition-all duration-150 ${
                      esHover ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                    }`}
                  >
                    {item.etiqueta}: {item.valor} vistas
                    <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 border-4 border-transparent border-t-[var(--fin-ink)]" />
                  </div>

                  {/* Barra única y consistente */}
                  <div
                    className={`w-full rounded-t-sm transition-all duration-150 ${
                      destacado
                        ? 'bg-sky-400 shadow-md shadow-sky-500/30 brightness-110'
                        : item.valor > 0
                        ? 'bg-sky-500/80 hover:bg-sky-400'
                        : 'bg-[var(--fin-soft)]/60 hover:bg-[var(--fin-soft)]'
                    }`}
                    style={{ height: `${porcentaje}%` }}
                  />
                </div>
              );
            })}
          </div>

          {pieDeGrafica}
        </div>
      )}
    </div>
  );
};

export const SuperadminPanel: React.FC<SuperadminPanelProps> = ({ onBack, tema, onCambiarTema }) => {
  const [tabActiva, setTabActiva] = useState<TabSuperadmin>('usuarios');

  // --- Usuarios State ---
  const [usuarios, setUsuarios] = useState<Perfil[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editando, setEditando] = useState<Perfil | null>(null);
  const [borrando, setBorrando] = useState<Perfil | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoUsuario, setNuevoUsuario] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [nuevoRol, setNuevoRol] = useState<'admin' | 'usuario'>('usuario');

  // Impersonation
  const [impersonando, setImpersonando] = useState<Perfil | null>(null);
  const [impersonacionCargando, setImpersonacionCargando] = useState(false);

  // --- Auditoría State ---
  const [logsAuditoria, setLogsAuditoria] = useState<AuditLog[]>([]);
  const [loadingAuditoria, setLoadingAuditoria] = useState(false);

  // --- IA & Tokens State ---
  const [metricasIA, setMetricasIA] = useState<MetricasIAResponse | null>(null);
  const [loadingMetricasIA, setLoadingMetricasIA] = useState(false);

  // --- Visitantes State ---
  const [rangoVisitantes, setRangoVisitantes] = useState(30);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loadingVisitas, setLoadingVisitas] = useState(false);

  useBloqueoScroll(isModalOpen || borrando !== null || impersonando !== null);

  const dias = useMemo(() => diasHasta(new Date(), rangoVisitantes), [rangoVisitantes]);

  const tokenSesion = async (): Promise<string> => {
    const cliente = obtenerSupabase();
    const {
      data: { session },
    } = await cliente!.auth.getSession();
    if (!session) throw new Error('No hay sesión activa');
    return session.access_token;
  };

  // 1. Cargar Usuarios
  const fetchUsuarios = async () => {
    setLoadingUsuarios(true);
    const cliente = obtenerSupabase();
    if (!cliente) return;

    const { data, error } = await cliente
      .from('perfiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (data && !error) {
      setUsuarios(data as Perfil[]);
    }
    setLoadingUsuarios(false);
  };

  // 2. Cargar Auditoría
  const fetchAuditoria = async () => {
    setLoadingAuditoria(true);
    try {
      const token = await tokenSesion();
      const res = await fetch(apiUrl('/api/auditoria-logs'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLogsAuditoria(data.logs || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAuditoria(false);
    }
  };

  // 3. Cargar Métricas de IA & Tokens
  const fetchMetricasIA = async () => {
    setLoadingMetricasIA(true);
    try {
      const token = await tokenSesion();
      const res = await fetch(apiUrl('/api/metricas-ia'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMetricasIA(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMetricasIA(false);
    }
  };

  // 4. Cargar Visitantes
  const fetchVisitas = useCallback(async () => {
    setLoadingVisitas(true);
    const cliente = obtenerSupabase();
    if (!cliente) {
      setLoadingVisitas(false);
      return;
    }

    const desde = `${dias[0]}T00:00:00-05:00`;
    const { data, error } = await cliente
      .from('visitas')
      .select('ruta,referente,pais,dispositivo,visitante,creado_en')
      .gte('creado_en', desde)
      .order('creado_en', { ascending: false });

    if (!error && data) {
      setVisitas(data as Visita[]);
    }
    setLoadingVisitas(false);
  }, [dias]);

  useEffect(() => {
    fetchUsuarios();
  }, []);

  useEffect(() => {
    if (tabActiva === 'ia-tokens') fetchMetricasIA();
    if (tabActiva === 'auditoria') fetchAuditoria();
    if (tabActiva === 'visitantes') fetchVisitas();
  }, [tabActiva, fetchVisitas]);

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
    setNuevaPassword('');
    setNuevoRol(perfil.rol);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleImpersonar = async () => {
    if (!impersonando) return;
    setImpersonacionCargando(true);
    setFormError(null);
    try {
      const cliente = obtenerSupabase();
      if (!cliente) throw new Error('No hay cliente Supabase');

      const {
        data: { session: adminSession },
      } = await cliente.auth.getSession();
      if (!adminSession) throw new Error('No hay sesión activa');

      localStorage.setItem(
        '__admin_session_backup__',
        JSON.stringify({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
          usuario: adminSession.user.user_metadata?.usuario || adminSession.user.email,
          email: adminSession.user.email,
        }),
      );

      const res = await fetch(apiUrl('/api/impersonar-usuario'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminSession.access_token}`,
        },
        body: JSON.stringify({ userId: impersonando.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.tokenHash) {
        throw new Error(data.error || 'No se pudo generar el acceso al usuario');
      }

      const { error: otpError } = await cliente.auth.verifyOtp({
        token_hash: data.tokenHash,
        type: 'magiclink',
      });

      if (otpError) throw otpError;

      localStorage.setItem(
        '__impersonated_user__',
        JSON.stringify({
          usuario: impersonando.usuario,
          email: impersonando.email,
        }),
      );

      setImpersonando(null);
      window.location.href = '/finanzas';
    } catch (err: any) {
      setFormError(err.message);
      localStorage.removeItem('__admin_session_backup__');
    } finally {
      setImpersonacionCargando(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const token = await tokenSesion();

      if (!editando) {
        if (!nuevoEmail || !nuevaPassword) throw new Error('Correo y contraseña son obligatorios');
        if (nuevaPassword.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');

        const res = await fetch(apiUrl('/api/crear-usuario'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: nuevoEmail,
            usuario: nuevoUsuario || undefined,
            password: nuevaPassword,
            rol: nuevoRol,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al crear usuario');
      } else {
        const payload: Record<string, unknown> = { userId: editando.id };
        if (nuevoEmail !== editando.email) payload.email = nuevoEmail;
        if (nuevoUsuario !== (editando.usuario ?? '')) payload.usuario = nuevoUsuario;
        if (nuevaPassword.trim() !== '') {
          if (nuevaPassword.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
          payload.password = nuevaPassword;
        }
        if (nuevoRol !== editando.rol) payload.rol = nuevoRol;

        if (Object.keys(payload).length === 1) {
          setIsModalOpen(false);
          return;
        }

        const res = await fetch(apiUrl('/api/editar-usuario'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al editar usuario');
      }

      setIsModalOpen(false);
      fetchUsuarios();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEliminar = async () => {
    if (!borrando) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      const token = await tokenSesion();
      const res = await fetch(apiUrl('/api/eliminar-usuario'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId: borrando.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar usuario');

      setBorrando(null);
      fetchUsuarios();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsuarios = usuarios.filter(
    (u) =>
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.usuario && u.usuario.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const resumenVisitas = useMemo(() => resumir(visitas, dias), [visitas, dias]);

  const itemsDia: BarraItem[] = useMemo(
    () =>
      resumenVisitas.porDia.map((d) => ({
        id: d.fecha,
        etiqueta: formatearFechaCorta(d.fecha),
        subetiqueta: d.fecha,
        valor: d.vistas,
        secundario: d.visitantes,
      })),
    [resumenVisitas.porDia],
  );

  const itemsHora: BarraItem[] = useMemo(
    () =>
      resumenVisitas.porHora.map((h) => ({
        id: `h-${h.hora}`,
        etiqueta: h.etiqueta,
        valor: h.vistas,
      })),
    [resumenVisitas.porHora],
  );

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--fin-bg)] font-sans text-[var(--fin-ink)] transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--fin-line)] bg-[var(--fin-bg)]/80 px-4 py-3 backdrop-blur-xl transition-colors sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              aria-label="Volver"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-card)] hover:text-[var(--fin-ink)]"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight">Centro de Mando Superadmin</h1>
                <p className="text-[11px] text-[var(--fin-ink-soft)]">Administración total del ecosistema</p>
              </div>
            </div>
          </div>

          <TemaToggle tema={tema} onCambiar={onCambiarTema} />
        </div>

        {/* Navigation Tabs */}
        <div className="mx-auto max-w-6xl mt-3 flex items-center gap-1.5 overflow-x-auto border-t border-[var(--fin-line)]/50 pt-2">
          <button
            onClick={() => setTabActiva('usuarios')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              tabActiva === 'usuarios'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                : 'text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]'
            }`}
          >
            <Users className="h-4 w-4" />
            Usuarios ({usuarios.length})
          </button>

          <button
            onClick={() => setTabActiva('ia-tokens')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              tabActiva === 'ia-tokens'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                : 'text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]'
            }`}
          >
            <Cpu className="h-4 w-4" />
            IA & Tokens
            {metricasIA?.hayIA && (
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setTabActiva('visitantes')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              tabActiva === 'visitantes'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                : 'text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Analítica de Tráfico
          </button>

          <button
            onClick={() => setTabActiva('auditoria')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              tabActiva === 'auditoria'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                : 'text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]'
            }`}
          >
            <History className="h-4 w-4" />
            Auditoría
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:p-8">
        <div className="mx-auto max-w-6xl">
          {/* ========================================================================= */}
          {/* TAB 1: GESTIÓN DE USUARIOS */}
          {/* ========================================================================= */}
          {tabActiva === 'usuarios' && (
            <div>
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight">Usuarios & Acceso</h2>
                  <p className="mt-1 text-xs text-[var(--fin-ink-soft)]">
                    Administra cuentas, roles y entra en modo asesoría para soporte en vivo.
                  </p>
                </div>

                <button
                  onClick={abrirCrear}
                  className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-500/25 transition-all hover:bg-purple-700 hover:-translate-y-0.5"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo Usuario
                </button>
              </div>

              <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] shadow-sm overflow-hidden">
                <div className="border-b border-[var(--fin-line)] p-4 sm:px-6">
                  <div className="relative w-full max-w-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--fin-ink-faint)]">
                      <Search className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="Buscar por correo o usuario..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full rounded-xl border-none bg-[var(--fin-soft)] py-2.5 pl-10 pr-4 text-base sm:text-sm text-[var(--fin-ink)] placeholder-[var(--fin-ink-faint)] focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {loadingUsuarios ? (
                    <div className="flex h-64 items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-[var(--fin-ink-faint)]" />
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--fin-soft)]/50 text-[10px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                        <tr>
                          <th className="px-6 py-3.5">Usuario</th>
                          <th className="px-6 py-3.5">Rol</th>
                          <th className="px-6 py-3.5">Fecha de Registro</th>
                          <th className="px-6 py-3.5 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--fin-line)]">
                        {filteredUsuarios.map((u) => (
                          <tr key={u.id} className="transition-colors hover:bg-[var(--fin-soft)]/30">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold uppercase shadow-inner">
                                  {u.email.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-bold text-[var(--fin-ink)]">{u.usuario || 'Sin nombre'}</p>
                                  <p className="text-[11px] text-[var(--fin-ink-soft)]">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                  u.rol === 'admin'
                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                                }`}
                              >
                                {u.rol === 'admin' && <ShieldAlert className="h-3 w-3" />}
                                {u.rol}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-[var(--fin-ink-soft)]">
                              {new Date(u.created_at).toLocaleDateString('es-CO')}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setImpersonando(u)}
                                  title={`Ver finanzas como ${u.usuario || u.email}`}
                                  className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-600 hover:bg-amber-500/20 dark:text-amber-400 transition-colors"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>Asesorar</span>
                                </button>
                                <button
                                  onClick={() => abrirEditar(u)}
                                  title="Editar usuario"
                                  className="rounded-lg p-1.5 text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)] transition-colors"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setBorrando(u)}
                                  title="Eliminar usuario"
                                  className="rounded-lg p-1.5 text-[var(--fin-ink-soft)] hover:bg-red-500/10 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: MONITOR DE IA & TOKENS */}
          {/* ========================================================================= */}
          {tabActiva === 'ia-tokens' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight">Monitor de IA & Consumo de Tokens</h2>
                  <p className="mt-1 text-xs text-[var(--fin-ink-soft)]">
                    Telemetría en tiempo real del asesor financiero inteligente y cuotas de proveedor.
                  </p>
                </div>
                <button
                  onClick={fetchMetricasIA}
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--fin-line)] bg-[var(--fin-card)] px-3.5 py-2 text-xs font-bold text-[var(--fin-ink)] shadow-sm hover:bg-[var(--fin-soft)] transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingMetricasIA ? 'animate-spin' : ''}`} />
                  Actualizar
                </button>
              </div>

              {loadingMetricasIA && !metricasIA ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--fin-ink-faint)]" />
                </div>
              ) : metricasIA ? (
                <>
                  {/* Tarjetas Hero de Métricas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
                      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                        <span>Tokens Usados Hoy</span>
                        <Zap className="h-4 w-4 text-amber-500" />
                      </div>
                      <p className="mt-3 text-3xl font-extrabold tabular-nums tracking-tight text-[var(--fin-ink)]">
                        {metricasIA.tokensHoy.toLocaleString('es-CO')}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--fin-ink-soft)]">
                        Límite diario: {metricasIA.limiteDiarioTokens.toLocaleString('es-CO')}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
                      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                        <span>Tokens Restantes</span>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </div>
                      <p className="mt-3 text-3xl font-extrabold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
                        {metricasIA.tokensRestantes.toLocaleString('es-CO')}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--fin-ink-soft)]">
                        {100 - metricasIA.porcentajeTokens}% de cuota libre
                      </p>
                    </div>

                    <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
                      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                        <span>Consultas IA Hoy</span>
                        <Cpu className="h-4 w-4 text-purple-500" />
                      </div>
                      <p className="mt-3 text-3xl font-extrabold tabular-nums tracking-tight text-[var(--fin-ink)]">
                        {metricasIA.llamadasHoy}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--fin-ink-soft)]">
                        {metricasIA.llamadasExitosas} exitosas · {metricasIA.llamadasFallback} en local
                      </p>
                    </div>

                    <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
                      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                        <span>Latencia Promedio</span>
                        <Clock className="h-4 w-4 text-sky-500" />
                      </div>
                      <p className="mt-3 text-3xl font-extrabold tabular-nums tracking-tight text-[var(--fin-ink)]">
                        {metricasIA.latenciaPromedioMs} <span className="text-sm font-bold text-[var(--fin-ink-soft)]">ms</span>
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--fin-ink-soft)]">
                        Costo estimado: $0 COP
                      </p>
                    </div>
                  </div>

                  {/* Estado del Proveedor & Barra de Cuota */}
                  <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                          Proveedor & Modelo Activo
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <h3 className="text-lg font-bold text-[var(--fin-ink)]">{metricasIA.proveedor}</h3>
                          <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                            {metricasIA.modelo}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {metricasIA.hayIA ? 'Servicio IA en Línea' : 'Modo Local Heurístico'}
                        </span>
                      </div>
                    </div>

                    {/* Barra de progreso de tokens */}
                    <div className="mt-4">
                      <div className="flex justify-between text-xs font-medium text-[var(--fin-ink-soft)] mb-2">
                        <span>Consumo de Tokens Diario</span>
                        <span className="font-bold text-[var(--fin-ink)]">{metricasIA.porcentajeTokens}%</span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-[var(--fin-soft)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-amber-500 transition-all duration-500"
                          style={{ width: `${Math.min(metricasIA.porcentajeTokens, 100)}%` }}
                        />
                      </div>
                      <p className="mt-2 text-[10px] text-[var(--fin-ink-faint)]">
                        Cuota gratuita de 500.000 tokens diarios. Se reinicia automáticamente a medianoche (hora Colombia).
                      </p>
                    </div>
                  </div>

                  {/* Tabla de Peticiones Recientes */}
                  <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--fin-ink-soft)] mb-4">
                      Últimas Consultas Procesadas por la IA
                    </h3>

                    {metricasIA.peticionesRecientes.length === 0 ? (
                      <p className="py-8 text-center text-xs text-[var(--fin-ink-faint)]">
                        No hay consultas registradas aún en esta sesión de servidor.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[var(--fin-soft)]/50 text-[10px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                            <tr>
                              <th className="px-4 py-3">Hora</th>
                              <th className="px-4 py-3">Usuario</th>
                              <th className="px-4 py-3">Proveedor / Modelo</th>
                              <th className="px-4 py-3">Tokens</th>
                              <th className="px-4 py-3">Tiempo</th>
                              <th className="px-4 py-3 text-right">Resultado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--fin-line)]">
                            {metricasIA.peticionesRecientes.map((p) => (
                              <tr key={p.id} className="transition-colors hover:bg-[var(--fin-soft)]/30">
                                <td className="px-4 py-3 text-[var(--fin-ink-soft)] tabular-nums">
                                  {new Date(p.timestamp).toLocaleTimeString('es-CO')}
                                </td>
                                <td className="px-4 py-3 font-medium">{p.usuarioEmail}</td>
                                <td className="px-4 py-3 text-[var(--fin-ink-soft)]">
                                  {p.proveedor} ({p.modelo})
                                </td>
                                <td className="px-4 py-3 font-bold tabular-nums">
                                  {p.totalTokens} <span className="text-[10px] font-normal text-[var(--fin-ink-faint)]">({p.promptTokens} in / {p.completionTokens} out)</span>
                                </td>
                                <td className="px-4 py-3 tabular-nums text-[var(--fin-ink-soft)]">{p.duracionMs} ms</td>
                                <td className="px-4 py-3 text-right">
                                  {p.exito ? (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                      ✨ Exitoso
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" title={p.motivo}>
                                      ⚙️ Local ({p.motivo || 'fallback'})
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: ANALÍTICA DE VISITANTES */}
          {/* ========================================================================= */}
          {tabActiva === 'visitantes' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight">Analítica de Tráfico del Portafolio</h2>
                  <p className="mt-1 text-xs text-[var(--fin-ink-soft)]">
                    Quién visita tu portafolio, de dónde vienen y a qué horas, 100% privado y sin cookies.
                  </p>
                </div>

                <div className="flex gap-1 rounded-xl bg-[var(--fin-soft)] p-1">
                  {RANGOS.map((r) => (
                    <button
                      key={r.dias}
                      type="button"
                      onClick={() => setRangoVisitantes(r.dias)}
                      className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${
                        rangoVisitantes === r.dias
                          ? 'bg-[var(--fin-card)] text-[var(--fin-ink)] shadow-sm'
                          : 'text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)]'
                      }`}
                    >
                      {r.texto}
                    </button>
                  ))}
                </div>
              </div>

              {loadingVisitas ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--fin-ink-faint)]" />
                </div>
              ) : (
                <>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-sm">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                        Páginas vistas
                      </p>
                      <p className="mt-2 text-4xl font-extrabold tabular-nums tracking-tight">
                        {resumenVisitas.vistas.toLocaleString('es-CO')}
                      </p>
                    </div>

                    <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-sm">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                        Visitantes por día, sumados
                      </p>
                      <p className="mt-2 text-4xl font-extrabold tabular-nums tracking-tight">
                        {resumenVisitas.visitantes.toLocaleString('es-CO')}
                      </p>
                      <p className="mt-2 text-[11px] leading-relaxed text-[var(--fin-ink-faint)]">
                        El identificador rota cada medianoche para garantizar privacidad absoluta.
                      </p>
                    </div>
                  </div>

                  {/* Gráfica Día a Día (Estilo Unificado) */}
                  <GraficaBarrasUnificada
                    titulo="Tráfico Día a Día"
                    subtitulo={`Últimos ${rangoVisitantes} días en horario local`}
                    icono={<BarChart3 className="h-3.5 w-3.5 text-sky-500" />}
                    items={itemsDia}
                    vacio="Todavía no hay visitas en este rango."
                  />

                  {/* Gráfica Horas Pico de Tráfico (Mismo Estilo Unificado) */}
                  <GraficaBarrasUnificada
                    titulo="Horas Pico de Tráfico"
                    subtitulo="Distribución horaria (Hora Colombia UTC-5)"
                    icono={<Clock className="h-3.5 w-3.5 text-sky-500" />}
                    items={itemsHora}
                    vacio="Sin visitas registradas."
                    pieDeGrafica={
                      <div className="flex justify-between text-[10px] font-semibold text-[var(--fin-ink-faint)] mt-2.5 px-1">
                        <span>00:00</span>
                        <span>06:00</span>
                        <span>12:00 m.</span>
                        <span>18:00</span>
                        <span>23:00</span>
                      </div>
                    }
                  />

                  {/* Tablas de Desglose */}
                  <div className="grid gap-5 sm:grid-cols-2">
                    {/* Qué Miran */}
                    <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
                      <h3 className="mb-4 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                        <span className="flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5" /> Qué miran (Rutas)</span>
                        <span className="text-[10px] text-[var(--fin-ink-faint)]">{resumenVisitas.rutas.length} páginas</span>
                      </h3>
                      <ul className="flex flex-col gap-2.5">
                        {resumenVisitas.rutas.slice(0, 8).map((r) => {
                          const pct = resumenVisitas.vistas > 0 ? Math.round((r.n / resumenVisitas.vistas) * 100) : 0;
                          return (
                            <li key={r.clave} className="flex items-center justify-between rounded-xl bg-[var(--fin-soft)] px-3 py-2 text-xs">
                              <span className="font-medium truncate">{r.clave}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">{pct}%</span>
                                <span className="font-bold tabular-nums">{r.n}</span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* De Dónde Son */}
                    <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
                      <h3 className="mb-4 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                        <span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> De dónde son (Países)</span>
                        <span className="text-[10px] text-[var(--fin-ink-faint)]">{resumenVisitas.paises.length} países</span>
                      </h3>
                      <ul className="flex flex-col gap-2.5">
                        {resumenVisitas.paises.slice(0, 8).map((p) => {
                          const pct = resumenVisitas.vistas > 0 ? Math.round((p.n / resumenVisitas.vistas) * 100) : 0;
                          return (
                            <li key={p.clave} className="flex items-center justify-between rounded-xl bg-[var(--fin-soft)] px-3 py-2 text-xs">
                              <span className="font-medium">{banderaDePais(p.clave)} {nombreDePais(p.clave)}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">{pct}%</span>
                                <span className="font-bold tabular-nums">{p.n}</span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* Fuentes de Tráfico */}
                    <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
                      <h3 className="mb-4 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                        <span className="flex items-center gap-2"><Link2 className="h-3.5 w-3.5" /> Fuentes de Tráfico</span>
                        <span className="text-[10px] text-[var(--fin-ink-faint)]">{resumenVisitas.fuentes.length} fuentes</span>
                      </h3>
                      <ul className="flex flex-col gap-2.5">
                        {resumenVisitas.fuentes.slice(0, 8).map((f) => {
                          const pct = resumenVisitas.vistas > 0 ? Math.round((f.n / resumenVisitas.vistas) * 100) : 0;
                          return (
                            <li key={f.clave} className="flex items-center justify-between rounded-xl bg-[var(--fin-soft)] px-3 py-2 text-xs">
                              <span className="font-medium truncate">{f.clave}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">{pct}%</span>
                                <span className="font-bold tabular-nums">{f.n}</span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* Dispositivos */}
                    <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
                      <h3 className="mb-4 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                        <span className="flex items-center gap-2"><Monitor className="h-3.5 w-3.5" /> Dispositivos</span>
                        <span className="text-[10px] text-[var(--fin-ink-faint)]">{resumenVisitas.dispositivos.length} tipos</span>
                      </h3>
                      <ul className="flex flex-col gap-2.5">
                        {resumenVisitas.dispositivos.map((d) => {
                          const pct = resumenVisitas.vistas > 0 ? Math.round((d.n / resumenVisitas.vistas) * 100) : 0;
                          return (
                            <li key={d.clave} className="flex items-center justify-between rounded-xl bg-[var(--fin-soft)] px-3 py-2 text-xs">
                              <span className="font-medium flex items-center gap-2">
                                {ICONO_DISPOSITIVO[d.clave]} {NOMBRE_DISPOSITIVO[d.clave] ?? d.clave}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400">{pct}%</span>
                                <span className="font-bold tabular-nums">{d.n}</span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: AUDITORÍA & SEGURIDAD */}
          {/* ========================================================================= */}
          {tabActiva === 'auditoria' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight">Registro de Auditoría</h2>
                  <p className="mt-1 text-xs text-[var(--fin-ink-soft)]">
                    Trazabilidad de acciones de superadmin (creación, edición, borrado e inicios de asesoría).
                  </p>
                </div>
                <button
                  onClick={fetchAuditoria}
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--fin-line)] bg-[var(--fin-card)] px-3.5 py-2 text-xs font-bold text-[var(--fin-ink)] shadow-sm hover:bg-[var(--fin-soft)] transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingAuditoria ? 'animate-spin' : ''}`} />
                  Actualizar
                </button>
              </div>

              <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-sm">
                {loadingAuditoria && logsAuditoria.length === 0 ? (
                  <div className="flex h-64 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-[var(--fin-ink-faint)]" />
                  </div>
                ) : logsAuditoria.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center text-center text-xs text-[var(--fin-ink-faint)]">
                    <History className="h-8 w-8 mb-2 opacity-40" />
                    <p>Sin registros de auditoría aún en esta sesión de servidor.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {logsAuditoria.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-bg-soft)] p-4 text-xs"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-purple-600 dark:text-purple-400 text-sm">
                            {log.action}
                          </span>
                          <span className="text-[10px] text-[var(--fin-ink-faint)] tabular-nums">
                            {new Date(log.timestamp).toLocaleString('es-CO')}
                          </span>
                        </div>
                        {log.targetUser && (
                          <p className="text-[var(--fin-ink)] font-medium">
                            Objetivo: <span className="font-bold">{log.targetUser}</span>
                          </p>
                        )}
                        {log.details && (
                          <p className="text-[var(--fin-ink-soft)] text-[11px] mt-0.5">{log.details}</p>
                        )}
                        <p className="text-[10px] text-[var(--fin-ink-faint)] mt-2">
                          Ejecutado por Admin: <span className="font-medium">{log.adminEmail}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ========================================================================= */}
      {/* MODALES: CREAR / EDITAR USUARIO */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !isSubmitting && setIsModalOpen(false)}
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-2xl z-10">
            <div className="flex items-center justify-between border-b border-[var(--fin-line)] pb-4">
              <h3 className="text-base font-bold text-[var(--fin-ink)]">
                {editando ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl p-2 text-[var(--fin-ink-faint)] hover:bg-[var(--fin-soft)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-bold text-[var(--fin-ink-soft)]">Correo Electrónico</label>
                <input
                  type="email"
                  required
                  value={nuevoEmail}
                  onChange={(e) => setNuevoEmail(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-soft)] px-3.5 py-2.5 text-base sm:text-sm text-[var(--fin-ink)] focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--fin-ink-soft)]">Nombre / Usuario</label>
                <input
                  type="text"
                  value={nuevoUsuario}
                  onChange={(e) => setNuevoUsuario(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-soft)] px-3.5 py-2.5 text-base sm:text-sm text-[var(--fin-ink)] focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--fin-ink-soft)]">
                  {editando ? 'Nueva Contraseña (dejar en blanco para conservar)' : 'Contraseña'}
                </label>
                <input
                  type="password"
                  value={nuevaPassword}
                  onChange={(e) => setNuevaPassword(e.target.value)}
                  placeholder={editando ? '••••••••' : 'Mínimo 6 caracteres'}
                  className="mt-1.5 block w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-soft)] px-3.5 py-2.5 text-base sm:text-sm text-[var(--fin-ink)] focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--fin-ink-soft)]">Rol</label>
                <select
                  value={nuevoRol}
                  onChange={(e) => setNuevoRol(e.target.value as 'admin' | 'usuario')}
                  className="mt-1.5 block w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-soft)] px-3.5 py-2.5 text-base sm:text-sm text-[var(--fin-ink)] focus:border-purple-500 focus:outline-none"
                >
                  <option value="usuario">Usuario Normal</option>
                  <option value="admin">Superadmin</option>
                </select>
              </div>

              {formError && (
                <div className="rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-600 dark:text-red-400">
                  {formError}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="rounded-xl border border-[var(--fin-line)] px-4 py-2 text-xs font-bold text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-purple-700"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editando ? 'Guardar Cambios' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ELIMINAR USUARIO */}
      {/* ========================================================================= */}
      {borrando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setBorrando(null)} />
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-2xl z-10">
            <h3 className="text-base font-bold text-red-600">Eliminar Usuario</h3>
            <p className="mt-2 text-xs text-[var(--fin-ink-soft)] leading-relaxed">
              ¿Estás seguro de eliminar a <span className="font-bold text-[var(--fin-ink)]">{borrando.email}</span>?
              Esta acción no se puede deshacer.
            </p>

            {formError && (
              <div className="mt-3 rounded-xl bg-red-500/10 p-2.5 text-xs text-red-600">{formError}</div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBorrando(null)}
                disabled={isSubmitting}
                className="rounded-xl border border-[var(--fin-line)] px-4 py-2 text-xs font-bold text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminar}
                disabled={isSubmitting}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRMAR IMPERSONACIÓN / MODO ASESORÍA */}
      {/* ========================================================================= */}
      {impersonando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !impersonacionCargando && setImpersonando(null)}
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-2xl z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 font-bold">
                <Eye className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--fin-ink)]">Iniciar Modo Asesoría</h3>
                <p className="text-xs text-[var(--fin-ink-soft)]">Acceso temporal directo a la cuenta del usuario</p>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-soft)] p-3.5 mb-4 text-xs">
              <p className="font-bold text-[var(--fin-ink)]">{impersonando.usuario || 'Sin nombre'}</p>
              <p className="text-[11px] text-[var(--fin-ink-soft)]">{impersonando.email}</p>
            </div>

            <div className="mb-5 flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-[11px] text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <p>Tu sesión de admin quedará respaldada. Podrás volver a tu cuenta en cualquier momento con el botón superior.</p>
            </div>

            {formError && (
              <div className="mb-3 rounded-xl bg-red-500/10 p-2.5 text-xs text-red-600">{formError}</div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImpersonando(null)}
                disabled={impersonacionCargando}
                className="rounded-xl border border-[var(--fin-line)] px-4 py-2 text-xs font-bold text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]"
              >
                Cancelar
              </button>
              <button
                onClick={handleImpersonar}
                disabled={impersonacionCargando}
                className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-amber-600"
              >
                {impersonacionCargando ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Entrando...</>
                ) : (
                  <><LogIn className="h-3.5 w-3.5" /> Entrar como {impersonando.usuario || impersonando.email}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
