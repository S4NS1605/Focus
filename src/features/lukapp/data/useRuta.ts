import { useCallback, useSyncExternalStore } from 'react';

/**
 * La URL como estado de navegación.
 *
 * Antes toda la app vivía en `/finanzas`: la landing, el login, Inicio, Dinero
 * y cada panel de Ajustes eran el mismo sitio para el navegador. Eso costaba
 * tres cosas que sí se notan usándola — no se podía enlazar una pantalla, el
 * botón atrás se salía de la app en vez de retroceder dentro, y recargar en
 * mitad de Ajustes devolvía al inicio.
 *
 * No hay librería de rutas: `history.pushState` más `popstate` es todo lo que
 * hace falta, y son menos líneas que la configuración que pediría un router.
 *
 * La ruta vive en un store compartido y no en un `useState` por componente.
 * Con estado por componente, AppsRoot y LukAppMain tendrían cada uno su copia
 * y un cambio hecho en uno no llegaría nunca al otro: `pushState` no dispara
 * `popstate`, así que la única forma de que ambos vean lo mismo es que ambos
 * lean del mismo sitio.
 */

/** El prefijo bajo el que vive Finanzas. Todo lo demás cuelga de aquí. */
export const BASE_LUKAPP = '/finanzas';

const normalizar = (ruta: string): string => {
  // Sin barra final, salvo que sea la raíz: `/finanzas/app/` y `/finanzas/app`
  // son la misma pantalla y guardarlas distinto ensucia el historial.
  const limpia = ruta.replace(/\/+$/, '');
  return limpia === '' ? '/' : limpia;
};

const leer = (): string =>
  typeof window === 'undefined' ? BASE_LUKAPP : normalizar(window.location.pathname);

let rutaActual = leer();
const suscriptores = new Set<() => void>();

const avisar = () => {
  const siguiente = leer();
  if (siguiente === rutaActual) return;
  rutaActual = siguiente;
  suscriptores.forEach((f) => f());
};

const suscribir = (f: () => void) => {
  suscriptores.add(f);
  window.addEventListener('popstate', avisar);
  return () => {
    suscriptores.delete(f);
    if (suscriptores.size === 0) window.removeEventListener('popstate', avisar);
  };
};

/** Empuja al historial: el atrás vuelve a la pantalla anterior. */
export const irA = (destino: string): void => {
  const limpio = normalizar(destino);
  if (leer() === limpio) return;
  window.history.pushState({}, '', limpio);
  avisar();
};

/**
 * Cambia la URL sin dejar rastro en el historial. Para los saltos que el
 * usuario no pidió — redirigir a la portada porque no hay sesión, por ejemplo.
 * Sin esta distinción el botón atrás se queda rebotando contra la redirección.
 */
export const reemplazarPor = (destino: string): void => {
  const limpio = normalizar(destino);
  if (leer() === limpio) return;
  window.history.replaceState({}, '', limpio);
  avisar();
};

/** La ruta de ahora, y cómo cambiarla. */
export const useRuta = () => {
  const ruta = useSyncExternalStore(
    suscribir,
    () => rutaActual,
    () => BASE_LUKAPP,
  );

  const ir = useCallback((destino: string) => irA(destino), []);
  const reemplazar = useCallback((destino: string) => reemplazarPor(destino), []);

  return { ruta, ir, reemplazar };
};

/**
 * El trozo de ruta que va después de `/finanzas`, ya partido.
 *
 * `/finanzas/ajustes/cuentas` → `['ajustes', 'cuentas']`
 * `/finanzas`                 → `[]`
 */
export const segmentosDe = (ruta: string): string[] =>
  normalizar(ruta)
    .replace(BASE_LUKAPP, '')
    .split('/')
    .filter(Boolean);
