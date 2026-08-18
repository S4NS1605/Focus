import { describe, it, expect } from 'vitest';
import {
  SECTIONS,
  SECCIONES_BARRA,
  SECCIONES_MAS,
  OCULTAS_EN_SIDEBAR_ESCRITORIO,
  PESTANAS_CONFIGURACION,
} from './sections';

describe('OCULTAS_EN_SIDEBAR_ESCRITORIO', () => {
  it('esconde exactamente Contactos y Tendencias, nada más', () => {
    expect([...OCULTAS_EN_SIDEBAR_ESCRITORIO].sort()).toEqual(['contactos', 'tendencias']);
  });

  it('cada sección escondida del sidebar existe en SECTIONS', () => {
    const ids = new Set(SECTIONS.map((s) => s.id));
    for (const id of OCULTAS_EN_SIDEBAR_ESCRITORIO) expect(ids.has(id)).toBe(true);
  });
});

describe('el celular no pierde nada', () => {
  it('SECCIONES_MAS sigue incluyendo Contactos y Tendencias, exactamente como antes', () => {
    // La hoja "Más" del celular no debía cambiar con este ajuste -- si algún
    // día alguien las saca de aquí sin querer, en el celular desaparecerían
    // del todo (no están en la barra de 5, y ya no están en el sidebar).
    expect(SECCIONES_MAS).toContain('contactos');
    expect(SECCIONES_MAS).toContain('tendencias');
  });

  it('SECCIONES_BARRA (la barra fija de 5) no cambió', () => {
    expect([...SECCIONES_BARRA]).toEqual(['resumen', 'movimientos', 'asesor', 'cuentas', 'ahorro']);
  });

  it('ninguna sección queda inalcanzable: todo lo escondido del sidebar sigue en SECCIONES_MAS', () => {
    for (const id of OCULTAS_EN_SIDEBAR_ESCRITORIO) {
      expect(SECCIONES_MAS).toContain(id);
    }
  });
});

describe('PESTANAS_CONFIGURACION', () => {
  it('tiene una pestaña por cada sección escondida del sidebar, más Ajustes', () => {
    const ids = PESTANAS_CONFIGURACION.map((p) => p.id);
    expect(ids).toContain('ajustes');
    for (const escondida of OCULTAS_EN_SIDEBAR_ESCRITORIO) {
      expect(ids).toContain(escondida);
    }
  });
});
