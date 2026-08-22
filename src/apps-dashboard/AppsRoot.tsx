import React, { useState, useEffect, useCallback } from 'react';
import { useSesion } from '../features/lukapp/data/useSesion';
import { useTema } from '../features/lukapp/data/useTema';
import { obtenerSupabase } from '../features/lukapp/data/supabase';
import { apiUrl } from '../lib/api';
import { LoginPanel } from '../features/lukapp/components/LoginPanel';
import { LukAppMain } from '../features/lukapp/LukAppApp';
import { AppLauncher } from './AppLauncher';
import { SuperadminPanel } from './SuperadminPanel';
import { EstadisticasPanel } from './EstadisticasPanel';
import { LandingLukApp } from '../features/lukapp/components/LandingLukApp';
import { BASE_LUKAPP, segmentosDe, useRuta } from '../features/lukapp/data/useRuta';
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

  // Landing y login son rutas, no estados: /finanzas es la portada y
  // /finanzas/entrar el formulario. Antes ambas vivían en la misma URL, así
  // que no se podía enlazar ninguna de las dos ni volver atrás entre ellas.
  const { ruta, ir, reemplazar } = useRuta();
  const enPortada = activeApp === 'finanzas' && segmentosDe(ruta).length === 0;

  // Quien entra por /finanzas/entrar espera terminar en la app de finanzas.
  // Pero si resulta tener un rol con privilegios (admin o un rol personalizado
  // con permisos), lo mandamos al lanzador del ecosistema en su lugar -- el
  // login de finanzas ya no es la única puerta, así que un admin que solo
  // pasaba por ahí no debería quedar encerrado en una sola app.
  const veniaDelLoginFinanzas = React.useRef(activeApp === 'finanzas');

  // Quien ya pasó por la portada entra directo al formulario. Reemplaza en vez
  // de empujar: es un salto que el usuario no pidió, y empujarlo dejaría el
  // botón atrás rebotando contra la redirección.
  useEffect(() => {
    if (!enPortada) return;
    // Con sesión ya no hay portada que enseñar: la raíz es la app.
    if (sesion.estado.modo === 'autenticado' || sesion.estado.modo === 'local') {
      reemplazar(`${BASE_LUKAPP}/app`);
      return;
    }
    if (localStorage.getItem('__lukapp_landing_seen__')) {
      reemplazar(`${BASE_LUKAPP}/entrar`);
    }
  }, [enPortada, reemplazar, sesion.estado.modo]);

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
      finanzas: 'LukApp | Ecosistema',
      superadmin: 'Superadmin | Ecosistema',
      estadisticas: 'Visitantes | Ecosistema',
    };

    const path = (activeApp && RUTAS[activeApp]) ?? '/ecosistema';
    // Comparar con startsWith y no con igualdad: cada app tiene ahora subrutas
    // propias (/finanzas/ajustes/cuentas), y exigir el path exacto las
    // revertía a la raíz en bucle contra quien acababa de navegar.
    if (!window.location.pathname.startsWith(path)) {
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
              const rolRecibido = data?.rol === 'admin' || data?.rol === 'usuario' ? data.rol : null;
              const permisosRecibidos = Array.isArray(data?.permisos) ? data.permisos : [];
              if (rolRecibido) setRol(rolRecibido);
              setPermisos(permisosRecibidos);

              if (veniaDelLoginFinanzas.current) {
                veniaDelLoginFinanzas.current = false;
                if (rolRecibido === 'admin' || permisosRecibidos.length > 0) {
                  setActiveApp(null);
                }
              }
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

  // Banner de impersonación — se muestra en la parte superior para no tapar la navegación de abajo
  const bannerAdmin = adminBackup ? (
    <div className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-between gap-3 border-b border-amber-400/30 bg-amber-500 px-4 py-2.5 shadow-md">
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
    if (enPortada) {
      const entrar = () => {
        localStorage.setItem('__lukapp_landing_seen__', 'true');
        ir(`${BASE_LUKAPP}/entrar`);
      };
      return <LandingLukApp onGetStarted={entrar} onLogin={entrar} sesion={sesion} />;
    }
    return <LoginPanel sesion={sesion} tema={tema} onCambiarTema={setTema} />;
  }

  if (activeApp === 'finanzas') {
    return (
      <div className={adminBackup ? 'pt-11' : ''}>
        {bannerAdmin}
        <LukAppMain onBack={() => setActiveApp(null)} />
      </div>
    );
  }

  if (activeApp === 'superadmin' && (rol === 'admin' || permisos.length > 0)) {
    return (
      <div className={adminBackup ? 'pt-11' : ''}>
        {bannerAdmin}
        <SuperadminPanel
          rol={rol}
          permisos={permisos}
          onBack={() => setActiveApp(null)}
          tema={tema}
          onCambiarTema={setTema}
        />
      </div>
    );
  }

  if (activeApp === 'estadisticas' && (rol === 'admin' || permisos.includes('ver_visitantes'))) {
    return (
      <div className={adminBackup ? 'pt-11' : ''}>
        {bannerAdmin}
        <EstadisticasPanel onBack={() => setActiveApp(null)} tema={tema} onCambiarTema={setTema} />
      </div>
    );
  }

  const handleSalir = async () => {
    await sesion.salir();
    // Asegurar que redirige al login aunque el signOut falle silenciosamente
    setActiveApp(null);
    setTimeout(() => {
      if (sesion.estado.modo === 'autenticado') {
        window.location.href = '/';
      }
    }, 500);
  };

  return (
    <div className={adminBackup ? 'pt-11' : ''}>
      {bannerAdmin}
      <AppLauncher
        rol={rol}
        tienePermisos={permisos.length > 0}
        onSelectApp={setActiveApp}
        tema={tema}
        onCambiarTema={setTema}
        onSalir={handleSalir}
      />
    </div>
  );
};
