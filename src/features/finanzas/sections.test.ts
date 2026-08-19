import { describe, it, expect } from 'vitest';
import { SECTIONS, PANELES_AJUSTES, sectionLabel } from './sections';

/**
 * Los tests de antes vigilaban que la jerarquía de tres niveles no se rompiera:
 * comprobaban que Contactos y Tendencias siguieran escondidas del menú lateral
 * y presentes en la hoja "Más". O sea que protegían la divergencia entre
 * celular y computador en vez de detectarla — y ninguno comprobaba lo único que
 * de verdad importaba: que todo se pudiera alcanzar desde los dos.
 *
 * Ahora que la navegación es una sola, eso es lo que se comprueba.
 */
describe('la navegación', () => {
  it('tiene cuatro destinos, ni uno más', () => {
    // El número importa: pasar de cuatro es como empezó la cuesta que llevó a
    // once. Si algún día hay que añadir un quinto, que sea una decisión que
    // alguien tome a propósito y no algo que se cuele.
    expect(SECTIONS).toHaveLength(4);
  });

  it('los destinos son los esperados y en ese orden', () => {
    expect(SECTIONS.map((s) => s.id)).toEqual(['inicio', 'dinero', 'mes', 'ajustes']);
  });

  it('cada destino tiene id único', () => {
    const ids = SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ningún destino lleva color propio', () => {
    // El color en esta app significa una sola cosa: verde entró, rojo salió.
    // Antes cada entrada del menú tenía su tono decorativo y eso le quitaba el
    // significado al color en todas partes.
    for (const s of SECTIONS) {
      expect(s).not.toHaveProperty('color');
    }
  });

  it('todos tienen etiqueta', () => {
    for (const s of SECTIONS) {
      expect(sectionLabel(s.id)).not.toBe('');
    }
  });
});

describe('los paneles de Ajustes', () => {
  it('existen todos los que antes eran inalcanzables desde el celular', () => {
    // Este es el test que faltaba. Categorías, el 4x1000, el Respaldo y el
    // Informe vivían en pestañas marcadas `hidden lg:grid`, así que en un
    // teléfono la barra no se pintaba nunca y esas pantallas no se podían
    // abrir. Como filas de una lista existen en todas partes.
    const ids = PANELES_AJUSTES.map((p) => p.id);
    expect(ids).toContain('categorias');
    expect(ids).toContain('gmf');
    expect(ids).toContain('respaldo');
  });

  it('cada panel tiene id único', () => {
    const ids = PANELES_AJUSTES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada panel dice qué hay dentro', () => {
    // Una fila que solo dice "4x1000" no le sirve a nadie que no sepa ya lo que
    // es. La línea de ayuda es obligatoria por eso.
    for (const p of PANELES_AJUSTES) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.ayuda.length).toBeGreaterThan(0);
    }
  });
});
