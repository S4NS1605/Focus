/**
 * Protección de Código e Inspección Web (Anti-Clonación / Anti-DevTools)
 *
 * Aplica capas de seguridad en el cliente cuando la app corre en producción:
 * 1. Desactiva clic derecho (menú contextual).
 * 2. Bloquea atajos de teclado de desarrollo (F12, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S).
 * 3. Sobrescribe la consola del navegador para evitar fugas de información.
 * 4. Activa un bucle de anti-depuración que congela el depurador si intentan forzar DevTools.
 */

export const activarProteccionCodigo = (): void => {
  // En desarrollo permitimos inspeccionar libremente para trabajar cómodos.
  if (!import.meta.env.PROD) return;

  try {
    // 1. Bloquear menú contextual (clic derecho)
    document.addEventListener(
      'contextmenu',
      (e) => {
        e.preventDefault();
        return false;
      },
      { capture: true },
    );

    // 2. Bloquear atajos de teclado de inspección y descarga de fuente
    document.addEventListener(
      'keydown',
      (e) => {
        const key = e.key ? e.key.toLowerCase() : '';
        const ctrlOrCmd = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        const alt = e.altKey;

        // F12 -> DevTools
        if (key === 'f12') {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }

        // Ctrl+Shift+I / Cmd+Alt+I (Inspect)
        if (ctrlOrCmd && (shift || alt) && key === 'i') {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }

        // Ctrl+Shift+J / Cmd+Alt+J (Console)
        if (ctrlOrCmd && (shift || alt) && key === 'j') {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }

        // Ctrl+Shift+C / Cmd+Alt+C (Element Selector)
        if (ctrlOrCmd && (shift || alt) && key === 'c') {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }

        // Ctrl+U / Cmd+Alt+U (View Source)
        if (ctrlOrCmd && (key === 'u' || (alt && key === 'u'))) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }

        // Ctrl+S / Cmd+S (Save Webpage)
        if (ctrlOrCmd && key === 's') {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      },
      { capture: true },
    );

    // 3. Sobrescribir consola en producción para no exponer nada
    const noop = () => {};
    window.console.log = noop;
    window.console.warn = noop;
    window.console.error = noop;
    window.console.info = noop;
    window.console.debug = noop;
    window.console.trace = noop;

    // 4. Trampa Anti-debugger periódica si intentan abrir la consola forzada
    setInterval(() => {
      const inicio = performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      const fin = performance.now();
      // Si la consola estaba abierta, la ejecución se pausa significativamente
      if (fin - inicio > 100) {
        window.console.clear();
      }
    }, 1000);
  } catch {
    // Si algo falla, la aplicación sigue funcionando normalmente sin interrumpir al usuario.
  }
};
