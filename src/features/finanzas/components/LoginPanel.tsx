import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import type { Sesion } from '../data/useSesion';
import type { Tema } from '../data/useTema';
import { BrandMark } from './BrandMark';
import { TemaToggle } from './TemaToggle';

interface LoginPanelProps {
  sesion: Sesion;
  tema: Tema;
  onCambiarTema: (tema: Tema) => void;
  /**
   * False once the admin turns off public sign-ups, which is the whole point of
   * this being an invite-only tool — the tab would otherwise offer something the
   * server is configured to refuse.
   */
  permitirRegistro?: boolean;
}

type Modo = 'entrar' | 'registrarse';

export const LoginPanel: React.FC<LoginPanelProps> = ({
  sesion,
  tema,
  onCambiarTema,
  permitirRegistro = false,
}) => {
  const [modo, setModo] = useState<Modo>('entrar');
  const [identidad, setIdentidad] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);

  const listo = identidad.trim() !== '' && password.length > 0;

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!listo) return;
    void (modo === 'entrar'
      ? sesion.entrar(identidad.trim(), password)
      : sesion.registrarse(identidad.trim(), password));
  };

  const cambiarModo = (siguiente: Modo) => {
    setModo(siguiente);
    sesion.limpiarError();
  };

  // 16px is not a style choice: iOS zooms the page in on any field below it, and
  // in an installed app that zoom does not cleanly undo.
  const campo =
    'w-full rounded-[var(--fin-r-card)] bg-[var(--fin-bg)] px-4 py-3.5 text-[17px] font-normal text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] transition-colors focus:border-[var(--fin-ink-faint)] focus:bg-[var(--fin-card)] focus:outline-none';

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[var(--fin-bg)] px-5 py-10">
      <div className="fin-aurora" aria-hidden="true" />

      <div className="absolute right-5 top-5 z-10">
        <TemaToggle tema={tema} onCambiar={onCambiarTema} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[26rem]"
      >
        {/* Brand sits above the card, not inside it: the card is the task, the
 brand is the context. */}
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-[var(--fin-r-card)] bg-[var(--fin-card)] shadow-sm">
            <BrandMark className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-[28px] font-semibold tracking-tight text-[var(--fin-ink)]">
            Apps Personalizadas
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
            {modo === 'entrar' ? 'Accede a tu ecosistema.' : 'Crea tu cuenta para empezar.'}
          </p>
        </div>

        <form
          onSubmit={enviar}
          className="rounded-[var(--fin-r-sheet)] bg-[var(--fin-card)] p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.12)] sm:p-7"
        >
          {permitirRegistro ? (
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] p-1">
              {(
                [
                  { id: 'entrar', label: 'Entrar' },
                  { id: 'registrarse', label: 'Crear cuenta' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => cambiarModo(item.id)}
                  aria-pressed={modo === item.id}
                  className="relative rounded-[var(--fin-r-control)] px-4 py-2.5 text-[13px] font-semibold transition-colors"
                >
                  {/* The pill slides between tabs instead of cutting, so the eye
 tracks where it went. */}
                  {modo === item.id ? (
                    <motion.span
                      layoutId="fin-login-pastilla"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      className="absolute inset-0 rounded-[var(--fin-r-control)] bg-[var(--fin-card)] shadow-sm"
                    />
                  ) : null}
                  <span
                    className={`relative ${
                      modo === item.id ? 'text-[var(--fin-ink)]' : 'text-[var(--fin-ink-soft)]'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <label
            htmlFor="login-identidad"
            className="block text-[13px] font-semibold uppercase tracking-wider text-[var(--fin-ink-faint)]"
          >
            Tu correo
          </label>
          <input
            id="login-identidad"
            // Email, not text: 0017 quitó el login por nombre de usuario, y el
            // tipo correcto es lo que hace que en un celular salga el teclado
            // con la arroba.
            type="email"
            value={identidad}
            onChange={(e) => setIdentidad(e.target.value)}
            // No placeholder on purpose. A sample value here is shown to every
            // person who reaches the login screen, and a real address is half
            // of a working credential — the label above already says what goes
            // in the field, so the hint bought nothing and leaked something.
            // Standard token so password managers recognise the form and fill it.
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            className={`mt-2 ${campo}`}
          />

          <label
            htmlFor="login-password"
            className="mt-5 block text-[13px] font-semibold uppercase tracking-wider text-[var(--fin-ink-faint)]"
          >
            Contraseña
          </label>
          <div className="relative mt-2">
            <input
              id="login-password"
              type={verPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              className={`${campo} pr-12`}
            />
            <button
              type="button"
              onClick={() => setVerPassword((v) => !v)}
              aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={verPassword}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-[var(--fin-r-control)] p-2.5 text-[var(--fin-ink-faint)] transition-colors hover:text-[var(--fin-ink)]"
            >
              {verPassword ? (
                <EyeOff className="h-4 w-4" strokeWidth={2.5} />
              ) : (
                <Eye className="h-4 w-4" strokeWidth={2.5} />
              )}
            </button>
          </div>

          <AnimatePresence>
            {sesion.error ? (
              <motion.p
                role="alert"
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 20 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2 overflow-hidden rounded-[var(--fin-r-card)] bg-[var(--fin-out-bg)] px-4 py-3 text-[15px] leading-relaxed text-[var(--fin-out-ink)]"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={3} />
                {sesion.error}
              </motion.p>
            ) : null}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={sesion.ocupado || !listo}
            whileHover={listo && !sesion.ocupado ? { scale: 1.015 } : undefined}
            whileTap={listo && !sesion.ocupado ? { scale: 0.985 } : undefined}
            className="group mt-6 flex w-full items-center justify-center gap-2 rounded-[var(--fin-r-card)] bg-[var(--fin-accent)] px-6 py-4 text-[17px] font-semibold text-[var(--fin-on-accent)] transition-[background-color,opacity] hover:bg-[var(--fin-accent-hover)] disabled:cursor-not-allowed disabled:opacity-25"
          >
            {sesion.ocupado ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={3} />
                Entrando…
              </>
            ) : (
              <>
                {modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={3}
                />
              </>
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
};
