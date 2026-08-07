import React, { useState, useEffect } from 'react';
import { useSesion } from '../features/finanzas/data/useSesion';
import { useTema } from '../features/finanzas/data/useTema';
import { obtenerSupabase } from '../features/finanzas/data/supabase';
import { LoginPanel } from '../features/finanzas/components/LoginPanel';
import { FinanzasApp } from '../features/finanzas/FinanzasApp';
import { AppLauncher } from './AppLauncher';
import { SuperadminPanel } from './SuperadminPanel';
import { Loader2 } from 'lucide-react';

export type AppId = 'finanzas' | 'superadmin' | null;

export const AppsRoot: React.FC = () => {
  const sesion = useSesion();
  const { tema, setTema } = useTema();
  const [activeApp, setActiveApp] = useState<AppId>(() => {
    const path = window.location.pathname;
    if (path.startsWith('/finanzas')) return 'finanzas';
    if (path.startsWith('/superadmin')) return 'superadmin';
    return null;
  });
  const [rol, setRol] = useState<'admin' | 'usuario'>('usuario');
  const [loadingRol, setLoadingRol] = useState(true);

  // Sync URL and Title with state changes
  useEffect(() => {
    const path = activeApp === 'finanzas' ? '/finanzas' : activeApp === 'superadmin' ? '/superadmin' : '/ecosistema';
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
    
    // Actualizar el título de la pestaña
    if (activeApp === 'finanzas') {
      document.title = 'Finanzas | Ecosistema';
    } else if (activeApp === 'superadmin') {
      document.title = 'Superadmin | Ecosistema';
    } else {
      document.title = 'Ecosistema de Apps';
    }
  }, [activeApp]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/finanzas')) setActiveApp('finanzas');
      else if (path.startsWith('/superadmin')) setActiveApp('superadmin');
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
          // Si el correo es el del admin principal, otorgar acceso directamente en la UI.
          const emailUser = sesion.estado.email?.toLowerCase();
          if (
            emailUser === 'jsgonzalez1658@gmail.com' || 
            emailUser === 'jsgonzalezdevs@gmail.com'
          ) {
            setRol('admin');
            setLoadingRol(false);
            return;
          }

          const { data } = await cliente
            .from('perfiles')
            .select('rol')
            .eq('id', sesion.estado.userId)
            .single();
          if (data?.rol) {
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
