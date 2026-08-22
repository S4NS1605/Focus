import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Shield, LogOut, ArrowRight, PieChart, Sparkles } from 'lucide-react';
import { TemaToggle } from '../features/lukapp/components/TemaToggle';
import { BrandMark } from '../features/lukapp/components/BrandMark';
import type { Tema } from '../features/lukapp/data/useTema';
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

/* Cada tarjeta lleva su propio color de acento en vez de la paleta genérica
   indigo/purple de un template: el naranja es el mismo que usa la insignia
   del login para Finanzas, así que el ecosistema se siente como una sola
   marca y no como pantallas pegadas entre sí. */
const ACENTOS = {
  finanzas: { ring: '#f59e0b', bg: '#f59e0b1a', fg: '#c2760a' },
  superadmin: { ring: '#8b5cf6', bg: '#8b5cf61a', fg: '#7c3aed' },
} as const;

export const AppLauncher: React.FC<AppLauncherProps> = ({
  rol,
  tienePermisos,
  onSelectApp,
  tema,
  onCambiarTema,
  onSalir,
}) => {
  const quieto = useReducedMotion();
  const muestraSuperadmin = rol === 'admin' || tienePermisos;

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[var(--fin-bg)] text-[var(--fin-ink)] transition-colors duration-300 selection:bg-[var(--fin-accent)] selection:text-white">
      <div className="fin-aurora" aria-hidden="true" />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--fin-card)] shadow-sm">
            <BrandMark className="h-5 w-5" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">LukApp</span>
        </div>

        <div className="flex items-center gap-2">
          <TemaToggle tema={tema} onCambiar={onCambiarTema} />
          <button
            onClick={onSalir}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-card)] hover:text-[var(--fin-out)]"
            title="Cerrar sesión"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center px-5 pb-16 pt-6 sm:pt-10">
        <div className="w-full max-w-3xl">
          <motion.div
            initial={quieto ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mb-10 text-center"
          >
            <h1 className="text-[32px] font-semibold tracking-tight sm:text-[38px]">
              ¿Qué necesitas hoy?
            </h1>
            <p className="mt-2 text-[15px] text-[var(--fin-ink-soft)]">
              Elige una aplicación para continuar.
            </p>
          </motion.div>

          <div className={`grid gap-4 ${muestraSuperadmin ? 'sm:grid-cols-2' : 'mx-auto max-w-sm'}`}>
            <motion.button
              initial={quieto ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              whileHover={quieto ? undefined : { y: -3 }}
              whileTap={{ scale: 0.985 }}
              onClick={() => onSelectApp('finanzas')}
              className="group relative flex flex-col overflow-hidden rounded-[1.75rem] border border-[var(--fin-line)]/70 bg-[var(--fin-card)] p-6 text-left shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_36px_-16px_rgb(0_0_0/0.16)] transition-colors sm:p-7"
              style={{ borderColor: undefined }}
            >
              <span
                className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                style={{ background: ACENTOS.finanzas.ring }}
                aria-hidden
              />
              <span
                className="relative mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ background: ACENTOS.finanzas.bg, color: ACENTOS.finanzas.fg }}
              >
                <PieChart className="h-5 w-5" strokeWidth={2.25} />
              </span>
              <h2 className="relative text-[19px] font-semibold tracking-tight">Finanzas</h2>
              <p className="relative mb-6 mt-1.5 flex-1 text-[13.5px] leading-relaxed text-[var(--fin-ink-soft)]">
                Movimientos, presupuestos y metas — todo en un solo lugar.
              </p>
              <div
                className="relative flex items-center gap-1.5 text-[13px] font-semibold"
                style={{ color: ACENTOS.finanzas.fg }}
              >
                Abrir
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" strokeWidth={2.5} />
              </div>
            </motion.button>

            {muestraSuperadmin && (
              <motion.button
                initial={quieto ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
                whileHover={quieto ? undefined : { y: -3 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => onSelectApp('superadmin')}
                className="group relative flex flex-col overflow-hidden rounded-[1.75rem] border border-[var(--fin-line)]/70 bg-[var(--fin-card)] p-6 text-left shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_36px_-16px_rgb(0_0_0/0.16)] transition-colors sm:p-7"
              >
                <span
                  className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                  style={{ background: ACENTOS.superadmin.ring }}
                  aria-hidden
                />
                <span
                  className="relative mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ background: ACENTOS.superadmin.bg, color: ACENTOS.superadmin.fg }}
                >
                  <Shield className="h-5 w-5" strokeWidth={2.25} />
                </span>
                <h2 className="relative text-[19px] font-semibold tracking-tight">Superadmin</h2>
                <p className="relative mb-6 mt-1.5 flex-1 text-[13.5px] leading-relaxed text-[var(--fin-ink-soft)]">
                  Usuarios, roles, IA y analítica del sistema.
                </p>
                <div
                  className="relative flex items-center gap-1.5 text-[13px] font-semibold"
                  style={{ color: ACENTOS.superadmin.fg }}
                >
                  Administrar
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" strokeWidth={2.5} />
                </div>
              </motion.button>
            )}
          </div>

          <motion.p
            initial={quieto ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 flex items-center justify-center gap-1.5 text-center text-[12.5px] text-[var(--fin-ink-faint)]"
          >
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
            Más aplicaciones llegarán pronto a tu ecosistema.
          </motion.p>
        </div>
      </main>
    </div>
  );
};
