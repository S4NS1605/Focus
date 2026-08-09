import { useEffect } from 'react';

/**
 * How many sheets are open right now. Kept at module scope because two sheets
 * can be stacked — ConfirmSheet opens over the "Más" menu — and the inner one's
 * cleanup must not unlock the page while the outer one is still up.
 */
let abiertos = 0;
/** Where the page was before the first lock, restored when the last one lifts. */
let scrollGuardado = 0;

/**
 * Freezes the page behind an open sheet.
 *
 * `overflow: hidden` on the body is the usual recipe and iOS ignores it: the
 * drag chains through to the page underneath, which scrolls away behind the
 * sheet and is still there when the sheet closes. Only `position: fixed` really
 * stops it, and that collapses the scroll offset to zero — hence saving and
 * restoring it here, otherwise every sheet would kick the user back to the top
 * of a long list of movements.
 */
export const useBloqueoScroll = (activo: boolean): void => {
  useEffect(() => {
    if (!activo) return;

    const { body } = document;
    if (abiertos === 0) {
      scrollGuardado = window.scrollY;
      body.style.position = 'fixed';
      body.style.top = `-${scrollGuardado}px`;
      body.style.left = '0';
      body.style.right = '0';
    }
    abiertos += 1;

    return () => {
      abiertos -= 1;
      if (abiertos > 0) return;
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      window.scrollTo(0, scrollGuardado);
    };
  }, [activo]);
};
