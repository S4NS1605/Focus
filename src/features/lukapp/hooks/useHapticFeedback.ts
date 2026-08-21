import { pulsarSwitchIOS } from '../lib/iosHapticSwitch';

/**
 * Retroalimentación háptica (vibraciones) para hacer la app más premium.
 * Simula el comportamiento nativo de iOS con diferentes intensidades y patrones.
 *
 * En Safari de iOS `navigator.vibrate` no existe -- Apple nunca lo implementó,
 * ni siquiera en la PWA instalada. `pulsarSwitchIOS()` es el único camino real
 * que se encontró para sentir algo ahí (ver ese archivo para el porqué):
 * aprovecha que iOS 18+ sí le da su haptic nativo a un switch cuando se toca
 * con un clic de verdad. Se llama junto a `navigator.vibrate`, nunca en su
 * lugar -- en Android/escritorio ese switch no hace nada y `vibrate` sigue
 * siendo el camino de siempre.
 */

export type HapticType =
  | 'light'      // Toque suave (10ms) - para interacciones normales
  | 'medium'     // Toque medio (30ms) - para acciones importantes
  | 'heavy'      // Toque fuerte (50ms) - para confirmaciones críticas
  | 'success'    // Patrón de éxito: [30, 20, 30] - después de guardar
  | 'error'      // Patrón de error: [80, 30, 80] - validaciones fallidas
  | 'warning'    // Patrón de advertencia: [40, 30, 40, 30, 40]
  | 'selection'; // Patrón de selección: [15, 10, 15] - cambio de tab/categoría

const VIBRATION_PATTERNS: Record<HapticType, number | number[]> = {
  light: 10,           // Suave y rápido como iOS
  medium: 30,          // Normal, se siente bien
  heavy: 50,           // Fuerte pero no molesta
  success: [30, 20, 30],        // Éxito: vibra-pausa-vibra
  error: [80, 30, 80],          // Error: vibración fuerte, pausa, vibración fuerte
  warning: [40, 30, 40, 30, 40], // Advertencia: tres vibraciones suaves
  selection: [15, 10, 15],      // Cambio de selección: muy suave
};

/**
 * Hook para manejar vibraciones del dispositivo.
 * Compatible con la Vibration API moderna (funciona en Android y algunos iPhones).
 */
export const useHapticFeedback = () => {
  const supported =
    typeof navigator !== 'undefined' &&
    'vibrate' in navigator &&
    typeof navigator.vibrate === 'function';

  const trigger = (type: HapticType): void => {
    // Se intenta siempre, no solo cuando `supported` (que en iOS Safari
    // siempre da falso, porque ahí `navigator.vibrate` no existe): el switch
    // escondido es justo el camino para ESE caso. En cualquier otro
    // navegador donde el switch no hace nada, este intento no cuesta nada.
    try {
      pulsarSwitchIOS();
    } catch {
      // Puramente decorativo -- si algo sale mal aquí, el resto sigue igual.
    }

    if (!supported) return;

    try {
      const pattern = VIBRATION_PATTERNS[type];
      navigator.vibrate(pattern);
    } catch (err) {
      // Silently fail if vibration is not available
      console.debug('Haptic feedback not available:', err);
    }
  };

  return { supported, trigger };
};

export default useHapticFeedback;
