import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

/**
 * The Supabase client is a double. Nothing here talks to a network — what is
 * under test is the decisions this hook makes around the call: which address it
 * signs in with, what it says when the call fails, and what it refuses to leak.
 */
interface Fallo {
  message: string;
}
type Aviso = (evento: string, sesion: unknown) => void;

const auth = {
  getSession: vi.fn<() => Promise<{ data: { session: unknown } }>>(),
  onAuthStateChange:
    vi.fn<(cb: Aviso) => { data: { subscription: { unsubscribe: () => void } } }>(),
  signInWithPassword: vi.fn<(datos: unknown) => Promise<{ error: Fallo | null }>>(),
  signUp: vi.fn<(datos: unknown) => Promise<{ error: Fallo | null }>>(),
  signOut: vi.fn<() => Promise<{ error: Fallo | null }>>(),
};
const rpc =
  vi.fn<(nombre: string, args: unknown) => Promise<{ data: unknown; error: Fallo | null }>>();
let configurado = true;

// One object, not a fresh one per call — the real `obtenerSupabase` caches a
// singleton, and the hook's effect depends on that identity. A double that
// returns a new client each render re-runs the effect forever.
const CLIENTE = { auth, rpc };

vi.mock('./supabase', () => ({
  obtenerSupabase: () => (configurado ? CLIENTE : null),
  supabaseConfigurado: () => configurado,
}));

const { useSesion } = await import('./useSesion');

const montar = async () => {
  const vista = renderHook(() => useSesion());
  await waitFor(() => expect(vista.result.current.estado.modo).not.toBe('cargando'));
  return vista;
};

beforeEach(() => {
  configurado = true;
  vi.clearAllMocks();
  // Re-declared rather than relying on the factory implementations surviving:
  // one test overrides onAuthStateChange, and a leaked override leaves the hook
  // waiting on a subscription that never arrives.
  auth.getSession.mockResolvedValue({ data: { session: null } });
  auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  auth.signInWithPassword.mockResolvedValue({ error: null });
  auth.signUp.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useSesion — sin backend', () => {
  it('corre en local, sin muro de login', async () => {
    // El modo local es lo que deja usar la app antes de que exista un proyecto,
    // en vez de mostrar un login que nadie puede atender.
    configurado = false;
    const { result } = renderHook(() => useSesion());

    expect(result.current.estado.modo).toBe('local');
  });

  it('no intenta autenticar contra un cliente que no existe', async () => {
    configurado = false;
    const { result } = renderHook(() => useSesion());

    await act(async () => {
      await result.current.entrar('quien@sea.com', 'x');
    });

    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('useSesion — entrar', () => {
  it('usa el correo tal cual cuando le dan uno', async () => {
    const { result } = await montar();

    await act(async () => {
      await result.current.entrar('yo@correo.com', 'clave');
    });

    expect(rpc).not.toHaveBeenCalled();
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'yo@correo.com',
      password: 'clave',
    });
  });

  it('nunca resuelve nombres de usuario contra la base', async () => {
    // La 0017 borró `correo_de_usuario`: entregaba el correo de cualquiera que
    // acertara un nombre, y eso solo se sostenía mientras no hubiera registro
    // público. Un valor sin arroba ya no dispara ninguna consulta — se manda tal
    // cual y lo rechaza Supabase.
    const { result } = await montar();

    await act(async () => {
      await result.current.entrar('miusuario', 'clave');
    });

    expect(rpc).not.toHaveBeenCalled();
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'miusuario',
      password: 'clave',
    });
  });

  it('le quita los espacios al correo antes de entrar', async () => {
    const { result } = await montar();

    await act(async () => {
      await result.current.entrar('  yo@correo.com  ', 'clave');
    });

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'yo@correo.com',
      password: 'clave',
    });
  });

  it('manda el apodo en la metadata al registrarse', async () => {
    // Es el único momento en que se puede escribir: `perfiles` no tiene permiso
    // de inserción desde el navegador, así que la fila la crea el trigger
    // leyendo esta metadata.
    const { result } = await montar();

    await act(async () => {
      await result.current.registrarse(' yo@correo.com ', 'clave', ' juli ');
    });

    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'yo@correo.com',
      password: 'clave',
      options: { data: { usuario: 'juli' } },
    });
  });

  it('registra sin metadata cuando no se dio apodo', async () => {
    const { result } = await montar();

    await act(async () => {
      await result.current.registrarse('yo@correo.com', 'clave');
    });

    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'yo@correo.com',
      password: 'clave',
      options: undefined,
    });
  });

  it('dice si un apodo está libre', async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const { result } = await montar();

    await expect(result.current.usuarioDisponible(' juli ')).resolves.toBe(false);
    expect(rpc).toHaveBeenCalledWith('usuario_disponible', { nombre: 'juli' });
  });

  it('da el apodo por libre si la comprobación falla', async () => {
    // Bloquear el registro por no haber podido comprobarlo es peor que dejar que
    // lo rechace el índice único, que es de todos modos quien manda.
    rpc.mockResolvedValue({ data: null, error: { message: 'network' } });
    const { result } = await montar();

    await expect(result.current.usuarioDisponible('juli')).resolves.toBe(true);
  });

  it('traduce el fallo al español', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      error: { message: 'Invalid login credentials' },
    });
    const { result } = await montar();

    await act(async () => {
      await result.current.entrar('yo@correo.com', 'mala');
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error).not.toMatch(/invalid login credentials/i);
  });

  it('deja de estar ocupado aunque la llamada falle', async () => {
    // Si no, el botón se queda girando para siempre y no hay forma de reintentar.
    auth.signInWithPassword.mockRejectedValueOnce(new Error('se cayó la red'));
    const { result } = await montar();

    await act(async () => {
      await result.current.entrar('yo@correo.com', 'clave');
    });

    expect(result.current.ocupado).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it('limpia el error anterior al reintentar', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      error: { message: 'Invalid login credentials' },
    });
    const { result } = await montar();

    await act(async () => {
      await result.current.entrar('yo@correo.com', 'mala');
    });
    expect(result.current.error).toBeTruthy();

    await act(async () => {
      await result.current.entrar('yo@correo.com', 'buena');
    });
    expect(result.current.error).toBeNull();
  });

  it('limpiarError borra el mensaje', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      error: { message: 'Invalid login credentials' },
    });
    const { result } = await montar();

    await act(async () => {
      await result.current.entrar('yo@correo.com', 'mala');
    });
    act(() => result.current.limpiarError());

    expect(result.current.error).toBeNull();
  });
});

describe('useSesion — estado', () => {
  it('reconoce una sesión ya abierta', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1', email: 'yo@correo.com' } } },
    });

    const { result } = await montar();

    expect(result.current.estado).toEqual({
      modo: 'autenticado',
      userId: 'u1',
      email: 'yo@correo.com',
    });
  });

  it('sigue el cierre de sesión hecho en otra pestaña', async () => {
    // Sin esto, esta pestaña se queda escribiendo contra un cliente muerto.
    auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1', email: 'yo@correo.com' } } },
    });
    const { result } = await montar();

    const avisar = auth.onAuthStateChange.mock.calls[0][0];
    act(() => avisar('SIGNED_OUT', null));

    expect(result.current.estado.modo).toBe('anonimo');
  });

  it('se da de baja del listener al desmontarse', async () => {
    const unsubscribe = vi.fn();
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });

    const { unmount } = await montar();
    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
