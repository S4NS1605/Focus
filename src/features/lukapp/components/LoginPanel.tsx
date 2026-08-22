import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  MailCheck,
  ShieldCheck,
  Smartphone,
  Sparkles,
  User,
  X,
  Zap,
} from 'lucide-react';
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
    'w-full rounded-[var(--fin-r-card)] border border-[var(--fin-line)]/60 bg-[var(--fin-bg)]/80 pl-10 pr-4 py-3.5 text-[16px] font-normal text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] transition-all duration-200 focus:border-[var(--fin-accent)] focus:bg-[var(--fin-card)] focus:outline-none focus:ring-2 focus:ring-[var(--fin-accent)]/25';

  const exito = modo === 'registrarse' && enviado && !sesion.error && !sesion.ocupado;

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[var(--fin-bg)] px-5 py-10 selection:bg-[var(--fin-accent)] selection:text-white">
      {/* Dynamic Background Grid Pattern */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--fin-line)_1px,transparent_1px)] [background-size:28px_28px] opacity-30 [mask-image:radial-gradient(ellipse_75%_65%_at_50%_45%,#000_60%,transparent_100%)]"
        aria-hidden="true"
      />

      {/* Aurora Ambient Background Glowing Spheres */}
      <div className="fin-aurora" aria-hidden="true" />

      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 90, 0],
          opacity: [0.35, 0.6, 0.35],
        }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-amber-500/25 via-sky-500/15 to-transparent blur-[120px]"
        aria-hidden="true"
      />
      <motion.div
        animate={{
          scale: [1, 1.25, 1],
          rotate: [0, -90, 0],
          opacity: [0.3, 0.55, 0.3],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="pointer-events-none absolute -bottom-40 -right-40 h-[550px] w-[550px] rounded-full bg-gradient-to-tl from-emerald-500/25 via-amber-500/15 to-transparent blur-[130px]"
        aria-hidden="true"
      />

      <div className="absolute right-5 top-5 z-20">
        <TemaToggle tema={tema} onCambiar={onCambiarTema} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[27rem]"
      >
        {/* Brand Header */}
        <div className="mb-7 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="mb-3.5 inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3.5 py-1 text-[11.5px] font-semibold text-amber-500 shadow-sm backdrop-blur-md"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>Control Financiero Inteligente</span>
          </motion.div>

          <div className="relative mb-3.5 flex items-center justify-center">
            <span className="absolute -inset-2.5 rounded-3xl bg-gradient-to-r from-amber-500/30 via-sky-500/20 to-emerald-500/30 blur-xl animate-pulse" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-[1.4rem] border border-[var(--fin-line)] bg-[var(--fin-card)] shadow-[0_4px_20px_-2px_rgb(0_0_0/0.15)]">
              <span
                className="absolute inset-0 rounded-[1.4rem] opacity-80"
                style={{
                  background:
                    'radial-gradient(120% 120% at 15% 15%, #f59e0b35, transparent 55%), radial-gradient(120% 120% at 85% 30%, #38bdf835, transparent 55%), radial-gradient(120% 120% at 50% 100%, #16c55e35, transparent 55%)',
                }}
                aria-hidden
              />
              <BrandMark className="relative h-8 w-8" />
            </span>
          </div>

          <h1 className="text-[32px] font-extrabold tracking-tight text-[var(--fin-ink)]">
            LukApp
          </h1>
          <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--fin-ink-soft)]">
            {modo === 'entrar'
              ? 'Tus finanzas personales, en un solo lugar.'
              : 'Crea tu cuenta para tomar el control de tu dinero.'}
          </p>
        </div>

        {/* Form Card Container */}
        <div className="relative overflow-hidden rounded-[var(--fin-r-sheet)] border border-[var(--fin-line)]/90 bg-[var(--fin-card)]/90 p-6 shadow-[0_8px_32px_-4px_rgb(0_0_0/0.16),0_24px_64px_-16px_rgb(0_0_0/0.3)] backdrop-blur-2xl sm:p-8 before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:via-amber-400/40 before:to-transparent">
          {exito ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-2 text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500 shadow-inner">
                <MailCheck size={32} strokeWidth={2} />
              </div>
              <h2 className="text-[22px] font-bold text-[var(--fin-ink)]">¡Revisa tu correo!</h2>
              <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--fin-ink-soft)]">
                Te enviamos un enlace de confirmación a{' '}
                <strong className="text-[var(--fin-ink)]">{identidad.trim()}</strong>. Ábrelo para
                activar tu cuenta y empezar.
              </p>
              <button
                type="button"
                onClick={() => cambiarModo('entrar')}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-[var(--fin-r-card)] bg-[var(--fin-accent)] px-6 py-3.5 text-[15px] font-bold text-[var(--fin-on-accent)] shadow-lg shadow-amber-500/20 transition-all hover:bg-[var(--fin-accent-hover)]"
              >
                Ya lo confirmé, quiero entrar
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </motion.div>
          ) : (
            <form onSubmit={enviar} noValidate>
              {permitirRegistro ? (
                <div className="mb-6 grid grid-cols-2 gap-1 rounded-[var(--fin-r-card)] border border-[var(--fin-line)]/50 bg-[var(--fin-soft)] p-1">
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
                      className="relative rounded-[var(--fin-r-control)] px-4 py-2.5 text-[13px] font-bold transition-colors"
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
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                  className="flex flex-col gap-4.5"
                >
                  {/* Field: Tu Nombre / Apodo (Registration Only) */}
                  {modo === 'registrarse' ? (
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label
                          htmlFor="login-usuario"
                          className="block text-[12px] font-bold uppercase tracking-wider text-[var(--fin-ink-faint)]"
                        >
                          Tu nombre / apodo
                        </label>
                        <ApodoAviso estado={apodo} />
                      </div>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fin-ink-faint)]" />
                        <input
                          id="login-usuario"
                          type="text"
                          value={usuario}
                          onChange={(e) => setUsuario(e.target.value)}
                          placeholder="Ej. Julián"
                          autoComplete="username"
                          spellCheck={false}
                          required
                          className={campo}
                        />
                      </div>
                    </div>
                  ) : null}

                  {/* Field: Tu Correo */}
                  <div>
                    <label
                      htmlFor="login-identidad"
                      className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider text-[var(--fin-ink-faint)]"
                    >
                      Tu correo
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fin-ink-faint)]" />
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
                        className={campo}
                      />
                    </div>
                  </div>

                  {/* Field: Contraseña */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
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
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fin-ink-faint)]" />
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

              {/* Error Message Alert */}
              <AnimatePresence>
                {sesion.error ? (
                  <motion.p
                    role="alert"
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 18 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-start gap-2.5 overflow-hidden rounded-[var(--fin-r-card)] border border-red-500/20 bg-red-500/10 px-4 py-3 text-[14px] leading-relaxed text-red-400"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
                    {sesion.error}
                  </motion.p>
                ) : null}
              </AnimatePresence>

              {/* Submit CTA Button */}
              <motion.button
                type="submit"
                disabled={sesion.ocupado || !listo}
                whileHover={listo && !sesion.ocupado ? { scale: 1.015 } : undefined}
                whileTap={listo && !sesion.ocupado ? { scale: 0.985 } : undefined}
                className="group relative mt-6 flex w-full items-center justify-center gap-2.5 rounded-[var(--fin-r-card)] bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 bg-[length:200%_auto] px-6 py-4 text-[16.5px] font-bold text-white shadow-[0_8px_24px_-4px_rgba(245,158,11,0.35)] transition-all duration-300 hover:bg-[position:right_center] disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none"
              >
                {sesion.ocupado ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" strokeWidth={2.5} />
                    {modo === 'entrar' ? 'Entrando…' : 'Creando tu cuenta…'}
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

              {/* Switch Mode Toggle Link */}
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
                        <span className="text-amber-500 underline underline-offset-2 hover:text-amber-400">
                          Crear cuenta
                        </span>
                      </>
                    ) : (
                      <>
                        ¿Ya tienes cuenta?{' '}
                        <span className="text-amber-500 underline underline-offset-2 hover:text-amber-400">
                          Iniciar sesión
                        </span>
                      </>
                    )}
                  </button>
                </div>
              ) : null}
            </form>
          )}

          {/* Footer Features / Trust Highlights */}
          <div className="mt-7 flex items-center justify-around border-t border-[var(--fin-line)]/50 pt-5 text-[11px] font-medium text-[var(--fin-ink-faint)]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Datos cifrados
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              100% Gratuito
            </span>
            <span className="flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-sky-400" />
              Atajos iOS & 4x1000
            </span>
          </div>
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
