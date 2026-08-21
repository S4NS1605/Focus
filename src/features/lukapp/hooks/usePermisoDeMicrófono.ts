import { useEffect, useState } from 'react';

/**
 * Cachea si el usuario ya dio permiso al micrófono.
 *
 * En iOS PWA el permiso puede resetarse (cuando se limpia caché, tras cierto
 * tiempo, etc), pero podemos saber si YA LO DIO UNA VEZ y así mostrar
 * instrucciones sobre dónde encontrarlo en Ajustes, en lugar de esperar a
 * que falle la petición.
 */
export const usePermisoDeMicrófono = () => {
  const [tienePermiso, setTienePermiso] = useState<boolean | null>(null);
  const [permisoPedidoAntes, setPermisoPedidoAntes] = useState(false);

  useEffect(() => {
    // Chequear permisos si el navegador lo soporta (Chromium)
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'microphone' }).then((resultado) => {
        const concedido = resultado.state === 'granted';
        setTienePermiso(concedido);
        // Si ya fue concedido alguna vez, guardarlo
        if (concedido) {
          localStorage.setItem('__fin_mic_pedido', 'true');
        }
      });
    } else {
      // En Safari/iOS no hay navigator.permissions, pero sí podemos leer
      // lo que guardamos de intentos anteriores
      const fueIntentado = localStorage.getItem('__fin_mic_pedido') === 'true';
      setPermisoPedidoAntes(fueIntentado);
    }
  }, []);

  const marcarComoPedido = () => {
    localStorage.setItem('__fin_mic_pedido', 'true');
    setPermisoPedidoAntes(true);
  };

  return {
    /** null = desconocido, true = concedido, false = denegado o no soportado */
    tienePermiso,
    /** true si el usuario ya intentó dar permiso en algún momento */
    permisoPedidoAntes,
    /** Llamar cuando la app intenta acceder y iOS pide permiso */
    marcarComoPedido,
  };
};
