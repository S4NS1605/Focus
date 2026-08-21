/**
 * El único camino real que existe hoy para sentir una vibración de verdad en
 * Safari de iOS (18+): `navigator.vibrate` no existe ahí y Apple nunca lo ha
 * implementado (ver la nota en useHapticFeedback.ts). Pero desde iOS 18 el
 * sistema SÍ le da su haptic nativo a un `<input type="checkbox" switch>`
 * cuando lo toca un click de verdad -- es el mismo golpecito que se siente al
 * activar un switch de Ajustes.
 *
 * Tocarlo POR CÓDIGO desde DENTRO del mismo manejador de clic de un botón
 * cuenta como "el mismo toque" para el navegador (activación transitoria del
 * usuario), así que el switch igual dispara su haptic. Es el mismo mecanismo
 * que usan los polyfills de vibración para iOS (ios-vibrator-pro-max, entre
 * otros) -- la diferencia es que ellos envuelven TODO el `document.body` en
 * un `<label>` con un `MutationObserver` para poder interceptar clics de
 * cualquier parte del código sin saber de antemano dónde. Esta app no
 * necesita eso: cada botón que quiere haptic ya llama a `trigger()`
 * directamente desde su propio `onClick`, así que basta con un único switch
 * escondido y tocarlo ahí mismo -- sin tocar `document.body` ni tener nada
 * observando el DOM todo el tiempo.
 *
 * Limitación real (iOS 18.4+): el navegador exige que sea un clic de verdad
 * -- no sirve desde un `setTimeout`, una respuesta de red, ni un gesto de
 * arrastre -- y la ventana de gracia dura ~1s desde ese clic. Coincide
 * exactamente con cómo se usa `trigger()` en esta app: siempre dentro de un
 * `onClick` real.
 *
 * En cualquier otro navegador (Android, escritorio, iOS viejo) el atributo
 * `switch` no existe: el checkbox se comporta como uno normal, invisible, sin
 * ningún efecto -- `navigator.vibrate` de siempre sigue siendo el camino ahí.
 */

let switchEl: HTMLInputElement | null = null;

const obtenerSwitch = (): HTMLInputElement | null => {
  if (typeof document === 'undefined') return null;
  if (switchEl && document.body.contains(switchEl)) return switchEl;

  const el = document.createElement('input');
  el.type = 'checkbox';
  el.setAttribute('switch', '');
  el.setAttribute('aria-hidden', 'true');
  el.tabIndex = -1;
  // Visualmente oculto pero renderizado de verdad -- `display: none` puede
  // hacer que el navegador ni se moleste en tratarlo como interactivo.
  Object.assign(el.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    opacity: '0',
    pointerEvents: 'none',
  });

  document.body.appendChild(el);
  switchEl = el;
  return el;
};

/** Se llama SIEMPRE desde dentro de un manejador de clic real -- ver el porqué arriba. */
export const pulsarSwitchIOS = (): void => {
  obtenerSwitch()?.click();
};
