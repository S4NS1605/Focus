import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ArrowRight, Check, Eye, EyeOff, Loader2, MailCheck, Sparkles, X } from 'lucide-react';
import type { Sesion } from '../data/useSesion';
import type { Tema } from '../data/useTema';
import { BrandMark } from './BrandMark';
import { TemaToggle } from './TemaToggle';

interface LoginPanelProps {
  sesion: Sesion;
  tema: Tema;
  onCambiarTema: (tema: Tema) => void;
  permitirRegistro?: boolean;
}

type Modo = 'entrar' | 'registrarse';
type EstadoApodo = 'vacio' | 'corto' | 'comprobando' | 'libre' | 'cogido';
const APODO_MINIMO = 3;
const MINIMO_PASSWORD = 6;

export const LoginPanel: React.FC<LoginPanelProps> = ({
  sesion,
  tema,
  onCambiarTema,
  permitirRegistro = true,
}) => {
  const [modo, setModo] = useState<Modo>('entrar');
  const [identidad, setIdentidad] = useState('');
  const [password, setPassword] = useState('');
  const [usuario, setUsuario] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [apodo, setApodo] = useState<EstadoApodo>('vacio');

  const peticion = useRef(0);
  useEffect(() => {
    if (modo !== 'registrarse') return;
    const limpio = usuario.trim();
    if (limpio === '') {
      setApodo('vacio');
      return;
    }
    if (limpio.length < APODO_MINIMO) {
      setApodo('corto');
      return;
    }

    setApodo('comprobando');
    const mia = ++peticion.current;
    const id = setTimeout(async () => {
      const libre = await sesion.usuarioDisponible(limpio);
      if (mia === peticion.current) setApodo(libre ? 'libre' : 'cogido');
    }, 450);

    return () => clearTimeout(id);
  }, [usuario, sesion, modo]);

  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identidad.trim());
  const listo =
    modo === 'entrar'
      ? identidad.trim() !== '' && password.length > 0
      : correoValido && password.length >= MINIMO_PASSWORD && apodo === 'libre' && !sesion.ocupado;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listo) return;
    if (modo === 'entrar') {
      await sesion.entrar(identidad.trim(), password);
    } else {
      await sesion.registrarse(identidad.trim(), password, usuario.trim());
      setEnviado(true);
    }
  };

  const cambiarModo = (siguiente: Modo) => {
    setModo(siguiente);
    sesion.limpiarError();
    setEnviado(false);
  };

  const campo =
    'w-full rounded-[var(--fin-r-card)] border border-[var(--fin-line)]/50 bg-[var(--fin-bg)] px-4 py-3.5 text-[16px] font-normal text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] transition-all focus:border-[var(--fin-accent)] focus:bg-[var(--fin-card)] focus:outline-none focus:ring-2 focus:ring-[var(--fin-accent)]/20';

  const exito = modo === 'registrarse' && enviado && !sesion.error && !sesion.ocupado;

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[var(--fin-bg)] px-5 py-10 selection:bg-[var(--fin-accent)] selection:text-white">
      {/* Background Animated Glow Spheres */}
      <div className="fin-aurora" aria-hidden="true" />

      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.35, 0.55, 0.35],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute -left-32 -top-32 h-[450px] w-[450px] rounded-full bg-gradient-to-br from-amber-500/20 via-sky-500/10 to-transparent blur-[100px]"
        aria-hidden="true"
      />
      <motion.div
        animate={{
          scale: [1, 1.25, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="pointer-events-none absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-gradient-to-tl from-emerald-500/20 via-sky-500/15 to-transparent blur-[110px]"
        aria-hidden="true"
      />

      <div className="absolute right-5 top-5 z-20">
        <TemaToggle tema={tema} onCambiar={onCambiarTema} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[26.5rem]"
      >
        {/* Header section with floating badge pill & brand */}
        <div className="mb-6 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--fin-line)] bg-[var(--fin-card)]/80 px-3 py-1 text-[11px] font-semibold text-[var(--fin-ink-soft)] shadow-sm backdrop-blur-md"
          >
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span>Control financiero inteligente</span>
          </motion.div>

          <span className="relative flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-[var(--fin-card)] shadow-[0_2px_8px_rgb(0_0_0/0.08),0_12px_32px_-8px_rgb(0_0_0/0.22)] border border-[var(--fin-line)]/50">
            <span
              className="absolute inset-0 rounded-[1.4rem] opacity-75"
              style={{
                background:
                  'radial-gradient(120% 120% at 15% 15%, #f59e0b33, transparent 55%), radial-gradient(120% 120% at 85% 30%, #38bdf833, transparent 55%), radial-gradient(120% 120% at 50% 100%, #16c55e33, transparent 55%)',
              }}
              aria-hidden
            />
            <BrandMark className="relative h-8 w-8" />
          </span>

          <h1 className="mt-3.5 text-[30px] font-bold tracking-tight text-[var(--fin-ink)]">
            LukApp
          </h1>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
            {modo === 'entrar'
              ? 'Tus finanzas, en un solo lugar.'
              : 'Crea tu cuenta para empezar a organizar tu dinero.'}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-[var(--fin-r-sheet)] border border-[var(--fin-line)]/80 bg-[var(--fin-card)]/95 p-6 shadow-[0_4px_24px_-4px_rgb(0_0_0/0.12),0_20px_48px_-12px_rgb(0_0_0/0.24)] backdrop-blur-xl sm:p-7">
          {exito ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center py-3"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                <MailCheck size={28} strokeWidth={2} />
              </div>
              <h2 className="text-[20px] font-bold text-[var(--fin-ink)]">¡Revisa tu correo!</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--fin-ink-soft)]">
                Te enviamos un enlace de confirmación a <strong className="text-[var(--fin-ink)]">{identidad.trim()}</strong>. Ábrelo y tu cuenta estará lista para entrar.
              </p>
              <button
                type="button"
                onClick={() => cambiarModo('entrar')}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-[var(--fin-r-card)] bg-[var(--fin-accent)] px-6 py-3.5 text-[15px] font-semibold text-[var(--fin-on-accent)] transition-colors hover:bg-[var(--fin-accent-hover)]"
              >
                Ya lo confirmé, quiero entrar
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </motion.div>
          ) : (
            <form onSubmit={enviar} noValidate>
              {permitirRegistro ? (
                <div className="mb-6 grid grid-cols-2 gap-1 rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] p-1 border border-[var(--fin-line)]/40">
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
                      {modo === item.id ? (
                        <motion.span
                          layoutId="fin-login-pastilla"
                          transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                          className="absolute inset-0 rounded-[var(--fin-r-control)] bg-[var(--fin-card)] shadow-sm"
                        />
                      ) : null}
                      <span
                        className={`relative z-10 ${
                          modo === item.id ? 'text-[var(--fin-ink)]' : 'text-[var(--fin-ink-soft)]'
                        }`}
                      >
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              <AnimatePresence mode="wait">
                <motion.div
                  key={modo}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col gap-4"
                >
                  {/* Field: Tu Nombre (Usuario) - Only shown on registration */}
                  {modo === 'registrarse' ? (
                    <div>
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="login-usuario"
                          className="block text-[12px] font-bold uppercase tracking-wider text-[var(--fin-ink-faint)]"
                        >
                          Tu nombre / apodo
                        </label>
                        <ApodoAviso estado={apodo} />
                      </div>
                      <input
                        id="login-usuario"
                        type="text"
                        value={usuario}
                        onChange={(e) => setUsuario(e.target.value)}
                        placeholder="Ej. Julián"
                        autoComplete="username"
                        spellCheck={false}
                        required
                        className={`mt-1.5 ${campo}`}
                      />
                    </div>
                  ) : null}

                  {/* Field: Tu Correo */}
                  <div>
                    <label
                      htmlFor="login-identidad"
                      className="block text-[12px] font-bold uppercase tracking-wider text-[var(--fin-ink-faint)]"
                    >
                      Tu correo
                    </label>
                    <input
                      id="login-identidad"
                      type="email"
                      value={identidad}
                      onChange={(e) => setIdentidad(e.target.value)}
                      placeholder="tu@correo.com"
                      autoComplete="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                      className={`mt-1.5 ${campo}`}
                    />
                  </div>

                  {/* Field: Contraseña */}
                  <div>
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="login-password"
                        className="block text-[12px] font-bold uppercase tracking-wider text-[var(--fin-ink-faint)]"
                      >
                        Contraseña
                      </label>
                      {modo === 'registrarse' ? (
                        <span className="text-[11px] font-medium text-[var(--fin-ink-faint)]">
                          {password.length > 0 && password.length < MINIMO_PASSWORD
                            ? `Faltan ${MINIMO_PASSWORD - password.length} caráct.`
                            : `Mín. ${MINIMO_PASSWORD} caráct.`}
                        </span>
                      ) : null}
                    </div>
                    <div className="relative mt-1.5">
                      <input
                        id="login-password"
                        type={verPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
                        required
                        minLength={MINIMO_PASSWORD}
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
                          <EyeOff className="h-4 w-4" strokeWidth={2.25} />
                        ) : (
                          <Eye className="h-4 w-4" strokeWidth={2.25} />
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              <AnimatePresence>
                {sesion.error ? (
                  <motion.p
                    role="alert"
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 18 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-start gap-2 overflow-hidden rounded-[var(--fin-r-card)] bg-[var(--fin-out-bg)] px-4 py-3 text-[14px] leading-relaxed text-[var(--fin-out-ink)]"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
                    {sesion.error}
                  </motion.p>
                ) : null}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={sesion.ocupado || !listo}
                whileHover={listo && !sesion.ocupado ? { scale: 1.015 } : undefined}
                whileTap={listo && !sesion.ocupado ? { scale: 0.985 } : undefined}
                className="group mt-6 flex w-full items-center justify-center gap-2 rounded-[var(--fin-r-card)] bg-[var(--fin-accent)] px-6 py-4 text-[16px] font-semibold text-[var(--fin-on-accent)] transition-[background-color,opacity,transform] hover:bg-[var(--fin-accent-hover)] disabled:cursor-not-allowed disabled:opacity-30 shadow-md"
              >
                {sesion.ocupado ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" strokeWidth={2.5} />
                    {modo === 'entrar' ? 'Entrando…' : 'Creando cuenta…'}
                  </>
                ) : (
                  <>
                    {modo === 'entrar' ? 'Entrar' : 'Crear mi cuenta'}
                    <ArrowRight
                      className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1"
                      strokeWidth={2.5}
                    />
                  </>
                )}
              </motion.button>

              {permitirRegistro ? (
                <div className="mt-5 text-center">
                  <button
                    type="button"
                    onClick={() => cambiarModo(modo === 'entrar' ? 'registrarse' : 'entrar')}
                    className="text-[13px] font-semibold text-[var(--fin-ink-soft)] transition-colors hover:text-[var(--fin-ink)]"
                  >
                    {modo === 'entrar' ? (
                      <>
                        ¿No tienes cuenta?{' '}
                        <span className="text-[var(--fin-accent)] underline underline-offset-2">
                          Crear cuenta
                        </span>
                      </>
                    ) : (
                      <>
                        ¿Ya tienes cuenta?{' '}
                        <span className="text-[var(--fin-accent)] underline underline-offset-2">
                          Iniciar sesión
                        </span>
                      </>
                    )}
                  </button>
                </div>
              ) : null}
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const ApodoAviso: React.FC<{ estado: EstadoApodo }> = ({ estado }) => {
  if (estado === 'vacio') return null;

  if (estado === 'corto') {
    return <span className="text-[11px] font-medium text-amber-500">mín. {APODO_MINIMO} letras</span>;
  }

  if (estado === 'comprobando') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--fin-ink-faint)]">
        <Loader2 className="h-3 w-3 animate-spin" />
        comprobando
      </span>
    );
  }

  if (estado === 'libre') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500">
        <Check className="h-3 w-3" strokeWidth={3} />
        disponible
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500">
      <X className="h-3 w-3" strokeWidth={3} />
      ya tomado
    </span>
  );
};
