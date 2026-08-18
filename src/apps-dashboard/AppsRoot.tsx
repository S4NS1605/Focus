import React, { useState, useEffect, useCallback } from 'react';
import { useSesion } from '../features/finanzas/data/useSesion';
import { useTema } from '../features/finanzas/data/useTema';
import { obtenerSupabase } from '../features/finanzas/data/supabase';
import { apiUrl } from '../lib/api';
import { LoginPanel } from '../features/finanzas/components/LoginPanel';
import { FinanzasApp } from '../features/finanzas/FinanzasApp';
import { AppLauncher } from './AppLauncher';
import { SuperadminPanel } from './SuperadminPanel';
import { EstadisticasPanel } from './EstadisticasPanel';
import { Loader2, ShieldAlert, LogOut } from 'lucide-react';

const ADMIN_BACKUP_KEY = '__admin_session_backup__';

interface AdminBackup {
  access_token: string;
  refresh_token: string;
  usuario?: string;
  email?: string;
}

export type AppId = 'finanzas' | 'superadmin' | 'estadisticas' | null;

export const AppsRoot: React.FC = () => {
  const sesion = useSesion();
  const { tema, setTema } = useTema();
  const [activeApp, setActiveApp] = useState<AppId>(() => {
    const path = window.location.pathname;
    if (path.startsWith('/finanzas')) return 'finanzas';
    if (path.startsWith('/superadmin')) return 'superadmin';
    if (path.startsWith('/estadisticas')) return 'estadisticas';
    return null;
  });
  const [rol, setRol] = useState<'admin' | 'usuario'>('usuario');
  // Los 7 permisos delegables que un rol personalizado puede tener marcados.
  // Vacío para 'admin' -- ese caso ya se trata aparte con `rol === 'admin'`
  // en cada punto de gating, así que esta lista nunca necesita listarlos.
  const [permisos, setPermisos] = useState<string[]>([]);
  const [loadingRol, setLoadingRol] = useState(true);

  // Admin impersonation banner
  const [adminBackup, setAdminBackup] = useState<AdminBackup | null>(() => {
    try {
      const raw = localStorage.getItem(ADMIN_BACKUP_KEY);
      return raw ? (JSON.parse(raw) as AdminBackup) : null;
    } catch {
      return null;
    }
  });

  // Info del usuario que se está viendo (para el banner)
  const [impersonatedUser, setImpersonatedUser] = useState<{ usuario: string | null; email: string } | null>(() => {
    try {
      const raw = localStorage.getItem('__impersonated_user__');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const volverAlAdmin = useCallback(async () => {
    if (!adminBackup) return;
    const cliente = obtenerSupabase();
    if (!cliente) return;
    await cliente.auth.setSession({
      access_token: adminBackup.access_token,
      refresh_token: adminBackup.refresh_token,
    });
    localStorage.removeItem(ADMIN_BACKUP_KEY);
    localStorage.removeItem('__impersonated_user__');
    setAdminBackup(null);
    setImpersonatedUser(null);
    window.location.href = '/superadmin';
  }, [adminBackup]);

  // Sync URL and Title with state changes
  useEffect(() => {
    const RUTAS: Record<string, string> = {
      finanzas: '/finanzas',
      superadmin: '/superadmin',
      estadisticas: '/estadisticas',
    };
    const TITULOS: Record<string, string> = {
      finanzas: 'Finanzas | Ecosistema',
      superadmin: 'Superadmin | Ecosistema',
      estadisticas: 'Visitantes | Ecosistema',
    };

    const path = (activeApp && RUTAS[activeApp]) ?? '/ecosistema';
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }

    document.title = (activeApp && TITULOS[activeApp]) ?? 'Ecosistema de Apps';
  }, [activeApp]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/finanzas')) setActiveApp('finanzas');
      else if (path.startsWith('/superadmin')) setActiveApp('superadmin');
      else if (path.startsWith('/estadisticas')) setActiveApp('estadisticas');
      else setActiveApp(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (sesion.estado.modo === 'autenticado') {
      const fetchPermisos = async () => {
        // El rol y los permisos vienen de /api/mis-permisos y de ningún otro
        // lado.
        //
        // Antes esto leía `perfiles.rol` directo con el cliente de Supabase.
        // Con roles personalizados eso ya no alcanza: un usuario con un rol
        // personalizado necesita saber qué permisos tiene, y abrir RLS de
        // lectura en `permisos_por_rol` a cualquier autenticado dejaría a
        // cualquiera listar el catálogo entero de roles del sistema. El
        // endpoint corre con el cliente de service-role y evita ese trueque.
        //
        // La API re-comprueba todo server-side antes de hacer nada
        // privilegiado (`exigirPermiso` en cada endpoint), así que esto solo
        // decide qué se muestra, nunca qué se permite de verdad.
        const cliente = obtenerSupabase();
        const session = cliente ? (await cliente.auth.getSession()).data.session : null;
        if (session?.access_token) {
          try {
            const res = await fetch(apiUrl('/api/mis-permisos'), {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (res.ok) {
              const data = await res.json();
              if (data?.rol === 'admin' || data?.rol === 'usuario') setRol(data.rol);
              if (Array.isArray(data?.permisos)) setPermisos(data.permisos);
            }
          } catch {
            // Sin red, se queda en el 'usuario' sin permisos por defecto.
          }
        }
        setLoadingRol(false);
      };
      fetchPermisos();
    } else {
      setLoadingRol(false);
    }
  }, [sesion.estado]);

  // Banner de impersonación — se muestra encima de cualquier vista
  const bannerAdmin = adminBackup ? (
    <div className="fixed bottom-0 left-0 right-0 z-[200] flex items-center justify-between gap-3 border-t border-amber-400/30 bg-amber-500 px-4 py-2.5 shadow-lg shadow-amber-900/20">
      <div className="flex items-center gap-2 text-white">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <p className="text-xs font-semibold">
          Modo asesoría — viendo como{' '}
          <span className="font-bold">
            {impersonatedUser?.usuario || impersonatedUser?.email || 'usuario'}
          </span>
        </p>
      </div>
      <button
        onClick={volverAlAdmin}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white/30"
      >
        <LogOut className="h-3.5 w-3.5" />
        Volver a mi cuenta
      </button>
    </div>
  ) : null;

  if (sesion.estado.modo === 'cargando' || (sesion.estado.modo === 'autenticado' && loadingRol)) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--fin-bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--fin-ink-faint)]" />
      </div>
    );
  }

  if (sesion.estado.modo === 'anonimo') {
    return <LoginPanel sesion={sesion} tema={tema} onCambiarTema={setTema} />;
  }

  if (activeApp === 'finanzas') {
    return (
      <>
        <FinanzasApp onBack={() => setActiveApp(null)} />
        {bannerAdmin}
      </>
    );
  }

  if (activeApp === 'superadmin' && (rol === 'admin' || permisos.length > 0)) {
    return (
      <SuperadminPanel
        rol={rol}
        permisos={permisos}
        onBack={() => setActiveApp(null)}
        tema={tema}
        onCambiarTema={setTema}
      />
    );
  }

  if (activeApp === 'estadisticas' && (rol === 'admin' || permisos.includes('ver_visitantes'))) {
    return <EstadisticasPanel onBack={() => setActiveApp(null)} tema={tema} onCambiarTema={setTema} />;
  }

  return (
    <>
      <AppLauncher
        rol={rol}
        tienePermisos={permisos.length > 0}
        onSelectApp={setActiveApp}
        tema={tema}
        onCambiarTema={setTema}
        onSalir={() => sesion.salir()}
      />
      {bannerAdmin}
    </>
  );
};
