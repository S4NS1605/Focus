import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { obtenerSupabase, supabaseConfigurado } from './supabase';

export type EstadoSesion =
  /** No backend configured. The app runs on local storage and needs no login. */
  | { modo: 'local' }
  | { modo: 'cargando' }
  | { modo: 'anonimo' }
  | { modo: 'autenticado'; userId: string; email: string };

export interface Sesion {
  estado: EstadoSesion;
  error: string | null;
  ocupado: boolean;
  entrar: (email: string, password: string) => Promise<void>;
  registrarse: (email: string, password: string) => Promise<void>;
  salir: () => Promise<void>;
  limpiarError: () => void;
}

const aEstado = (sesion: Session | null): EstadoSesion =>
  sesion?.user
    ? { modo: 'autenticado', userId: sesion.user.id, email: sesion.user.email ?? '' }
    : { modo: 'anonimo' };

/**
 * Wraps Supabase Auth, degrading to a login-free local mode when no project is
 * configured. That fallback is what lets the finance tool keep working before
 * (and without) a backend, rather than presenting a login wall it cannot serve.
 */
export const useSesion = (): Sesion => {
  const cliente = obtenerSupabase();
  const [estado, setEstado] = useState<EstadoSesion>(
    supabaseConfigurado() ? { modo: 'cargando' } : { modo: 'local' },
  );
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!cliente) return;

    let cancelado = false;
    cliente.auth.getSession().then(({ data }) => {
      if (!cancelado) {
        setEstado(aEstado(data.session));
        if (data.session?.user?.user_metadata) {
          import('./usePreferencias').then((m) =>
            m.sincronizarDesdeSupabase(data.session!.user.user_metadata),
          );
        }
      }
    });

    // Covers token refresh and sign-out from another tab, so a session that
    // expires elsewhere does not leave this tab writing into a dead client.
    const { data: sub } = cliente.auth.onAuthStateChange((_evento, sesion) => {
      setEstado(aEstado(sesion));
      if (sesion?.user?.user_metadata) {
        import('./usePreferencias').then((m) =>
          m.sincronizarDesdeSupabase(sesion.user.user_metadata),
        );
      }
    });

    return () => {
      cancelado = true;
      sub.subscription.unsubscribe();
    };
  }, [cliente]);

  const ejecutar = useCallback(
    async (accion: () => Promise<{ error: { message: string } | null }>) => {
      if (!cliente) return;
      setOcupado(true);
      setError(null);
      try {
        const { error: fallo } = await conTiempoLimite(accion());
        if (fallo) setError(traducir(fallo.message));
      } catch (e) {
        setError(traducir(e instanceof Error ? e.message : ''));
      } finally {
        setOcupado(false);
      }
    },
    [cliente],
  );

  return {
    estado,
    error,
    ocupado,
    limpiarError: useCallback(() => setError(null), []),

    entrar: useCallback(
      (identidad, password) =>
        ejecutar(async () => {
          // Supabase authenticates by email only. A value with no "@" is taken
          // as a username and resolved through `correo_de_usuario`, a
          // security-definer function that returns the address for an exact
          // match — see migration 0002 for why that disclosure is acceptable here.
          let email = identidad;
          if (!identidad.includes('@')) {
            const { data, error: fallo } = await cliente!.rpc('correo_de_usuario', {
              nombre: identidad,
            });
            if (fallo) return { error: fallo };
            if (!data) {
              // Deliberately the same wording as a wrong password: saying "that
              // user does not exist" would turn the login form into a way to
              // enumerate which accounts are real.
              return { error: { message: 'invalid login credentials' } };
            }
            email = data as string;
          }
          return cliente!.auth.signInWithPassword({ email, password });
        }),
      [cliente, ejecutar],
    ),

    registrarse: useCallback(
      (email, password) => ejecutar(() => cliente!.auth.signUp({ email, password })),
      [cliente, ejecutar],
    ),

    salir: useCallback(() => ejecutar(() => cliente!.auth.signOut()), [cliente, ejecutar]),
  };
};

const LIMITE_MS = 12_000;
const TIEMPO_AGOTADO = 'tiempo-agotado';

/**
 * Caps how long a sign-in can hang.
 *
 * An unreachable project (wrong URL, no signal, project paused) takes the fetch
 * layer the better part of twenty seconds to give up on, and until it does the
 * button just spins with nothing said. Racing it turns that into a real answer.
 * The losing request is left to settle on its own — there is nothing to cancel
 * that would change what the user sees.
 */
const conTiempoLimite = <T>(promesa: Promise<T>): Promise<T> =>
  Promise.race([
    promesa,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(TIEMPO_AGOTADO)), LIMITE_MS)),
  ]);

/** Supabase reports auth failures in English; this is a Spanish-only tool. */
const traducir = (mensaje: string): string => {
  const m = mensaje.toLowerCase();
  if (m === TIEMPO_AGOTADO) {
    return 'El servidor no respondió. Revisa tu conexión e inténtalo de nuevo.';
  }
  // Every browser words a failed fetch differently: Chrome "Failed to fetch",
  // Firefox "NetworkError when attempting to fetch resource", Safari "Load
  // failed". All three mean the same thing to the person reading it.
  if (
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('load failed') ||
    m.includes('network request failed')
  ) {
    return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  }
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de entrar.';
  if (m.includes('user already registered')) return 'Ese correo ya tiene una cuenta.';
  if (m.includes('password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (m.includes('unable to validate email address')) return 'Ese correo no parece válido.';
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Demasiados intentos. Espera un momento.';
  }
  return mensaje || 'No se pudo completar la operación.';
};
