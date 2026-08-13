import React, { useState, useEffect } from 'react';
import { useSesion } from '../features/finanzas/data/useSesion';
import { useTema } from '../features/finanzas/data/useTema';
import { obtenerSupabase } from '../features/finanzas/data/supabase';
import { LoginPanel } from '../features/finanzas/components/LoginPanel';
import { FinanzasApp } from '../features/finanzas/FinanzasApp';
import { AppLauncher } from './AppLauncher';
import { SuperadminPanel } from './SuperadminPanel';
import { EstadisticasPanel } from './EstadisticasPanel';
import { Loader2 } from 'lucide-react';

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
  const [loadingRol, setLoadingRol] = useState(true);

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
      const fetchRol = async () => {
        const cliente = obtenerSupabase();
        if (cliente && sesion.estado.modo === 'autenticado') {
          // The role comes from `perfiles` and nowhere else.
          //
          // A hard-coded list of admin addresses used to short-circuit this,
          // which was two problems at once: the addresses shipped inside the
          // public bundle for anyone to read, and the grant lived purely in
          // client state, so editing it in devtools revealed the admin UI.
          //
          // This became safe to remove only once migration 0002 created the
          // table — before that the query had nothing to read and the shortcut
          // was the sole path to admin. The API re-checks the role server-side
          // before doing anything privileged, so this only drives the UI.
          const { data } = await cliente
            .from('perfiles')
            .select('rol')
            .eq('id', sesion.estado.userId)
            .single();
          if (data?.rol === 'admin' || data?.rol === 'usuario') {
            setRol(data.rol);
          }
        }
        setLoadingRol(false);
      };
      fetchRol();
    } else {
      setLoadingRol(false);
    }
  }, [sesion.estado]);

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
    // Everyone gets the way back now that the launcher is the landing screen —
    // without it a non-admin who opens Finanzas is stuck there.
    return <FinanzasApp onBack={() => setActiveApp(null)} />;
  }

  if (activeApp === 'superadmin' && rol === 'admin') {
    return <SuperadminPanel onBack={() => setActiveApp(null)} tema={tema} onCambiarTema={setTema} />;
  }

  // Las visitas del portafolio son del dueño, no del ecosistema: un usuario
  // normal no tiene por qué ver por dónde entra la gente. La política de RLS ya
  // lo impide del lado de la base; esto solo evita mostrar una pantalla vacía.
  if (activeApp === 'estadisticas' && rol === 'admin') {
    return <EstadisticasPanel onBack={() => setActiveApp(null)} tema={tema} onCambiarTema={setTema} />;
  }

  // The launcher is the landing screen for every signed-in user, admin or not.
  // Redirecting a regular user straight into Finanzas hid the fact that this is
  // an ecosystem, and left them with nowhere to go when a second app appears.
  return (
    <AppLauncher
      rol={rol}
      onSelectApp={setActiveApp}
      tema={tema}
      onCambiarTema={setTema}
      onSalir={() => sesion.salir()}
    />
  );
};
