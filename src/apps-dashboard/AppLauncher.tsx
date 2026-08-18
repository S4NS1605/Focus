import React from 'react';
import { LayoutGrid, Shield, LogOut, ChevronRight, PieChart, Activity } from 'lucide-react';
import { TemaToggle } from '../features/finanzas/components/TemaToggle';
import type { Tema } from '../features/finanzas/data/useTema';
import type { AppId } from './AppsRoot';

interface AppLauncherProps {
  rol: 'admin' | 'usuario';
  /** Si tiene al menos un permiso de un rol personalizado, aunque no sea admin. */
  tienePermisos: boolean;
  onSelectApp: (app: AppId) => void;
  tema: Tema;
  onCambiarTema: (tema: Tema) => void;
  onSalir: () => void;
}

export const AppLauncher: React.FC<AppLauncherProps> = ({ rol, tienePermisos, onSelectApp, tema, onCambiarTema, onSalir }) => {
  return (
    <div className="min-h-[100dvh] bg-[var(--fin-bg)] text-[var(--fin-ink)] transition-colors duration-300 selection:bg-[var(--fin-primary)] selection:text-white flex flex-col font-sans">
      
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[var(--fin-line)] bg-[var(--fin-bg)]/80 px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-4 transition-colors">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Ecosistema</h1>
            <p className="text-[11px] font-medium text-[var(--fin-ink-soft)] uppercase tracking-wider">Tus Aplicaciones</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <TemaToggle tema={tema} onCambiar={onCambiarTema} />
          <div className="h-6 w-px bg-[var(--fin-line)] mx-1"></div>
          <button
            onClick={onSalir}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-card)] hover:text-[var(--fin-out)]"
            title="Cerrar sesión"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 py-8 sm:p-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Bienvenido de vuelta</h2>
            <p className="mt-2 text-base text-[var(--fin-ink-soft)]">Selecciona una aplicación para continuar con tu trabajo hoy.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            
            <button
              onClick={() => onSelectApp('finanzas')}
              className="group flex h-full flex-col rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 text-left shadow-sm transition-colors hover:border-emerald-500/40"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                <PieChart className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-bold">Finanzas</h3>
              <p className="mb-6 flex-1 text-sm text-[var(--fin-ink-soft)]">
                Gestiona tus movimientos, metas y cajitas.
              </p>

              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                <span className="text-sm font-semibold">Abrir aplicación</span>
                <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </div>
            </button>

            {/* Tarjeta de Superadmin: admin siempre la ve; alguien con un rol
                personalizado la ve si tiene al menos un permiso -- lo que
                muestre adentro depende de cuáles, eso lo decide el panel. */}
            {(rol === 'admin' || tienePermisos) && (
              <button
                onClick={() => onSelectApp('superadmin')}
                className="group flex h-full flex-col rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 text-left shadow-sm transition-colors hover:border-purple-500/40"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-bold">Superadmin</h3>
                <p className="mb-6 flex-1 text-sm text-[var(--fin-ink-soft)]">
                  Gestiona usuarios, roles, IA y analítica del sistema.
                </p>

                <div className="flex items-center justify-between text-purple-600 dark:text-purple-400">
                  <span className="text-sm font-semibold">Administrar</span>
                  <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            )}

            {/* Placeholder for future apps */}
            <div className="group relative flex h-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed border-[var(--fin-line)] bg-[var(--fin-card)]/50 p-6 text-center transition-all duration-300">
               <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]">
                <Activity className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-[var(--fin-ink-soft)]">Próximamente</h3>
              <p className="text-sm text-[var(--fin-ink-faint)]">
                Más aplicaciones llegarán pronto a tu ecosistema.
              </p>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};
