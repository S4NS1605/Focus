import { useEffect, useState } from 'react';

/**
 * Whether the app is currently rendering dark.
 *
 * Charts need this as a value, not as CSS: their palette is not a flip of the
 * light one — each step was chosen against the dark surface and validated
 * separately — so the component has to know which set to hand to the marks.
 *
 * Resolves the same two signals the stylesheet does, in the same order: an
 * explicit `data-tema` wins, and the OS preference decides when there is none.
 */
export const useEsOscuro = (): boolean => {
  const resolver = (): boolean => {
    if (typeof document === 'undefined') return false;
    const elegido = document.documentElement.getAttribute('data-tema');
    if (elegido === 'oscuro') return true;
    if (elegido === 'claro') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  const [oscuro, setOscuro] = useState(resolver);

  useEffect(() => {
    const consulta = window.matchMedia('(prefers-color-scheme: dark)');
    const actualizar = () => setOscuro(resolver());

    consulta.addEventListener('change', actualizar);
    // The theme toggle stamps the attribute rather than firing an event, so the
    // only way to notice a manual switch is to watch the element itself.
    const observador = new MutationObserver(actualizar);
    observador.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-tema'],
    });

    return () => {
      consulta.removeEventListener('change', actualizar);
      observador.disconnect();
    };
  }, []);

  return oscuro;
};
