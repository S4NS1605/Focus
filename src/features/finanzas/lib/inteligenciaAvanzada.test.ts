import { describe, expect, it } from 'vitest';
import {
  distanciaLevenshtein,
  buscarSimilar,
  parsearTiempoRelativo,
  detectarMultiplesEntidades,
  calcularConfianzaGranular,
  promedioConfianza,
} from './inteligenciaAvanzada';

describe('distanciaLevenshtein', () => {
  it('distancia 0 para palabras idénticas', () => {
    expect(distanciaLevenshtein('cafe', 'cafe')).toBe(0);
  });

  it('distancia corta para typos', () => {
    expect(distanciaLevenshtein('cafe', 'cafee')).toBe(1);
    expect(distanciaLevenshtein('pizza', 'piza')).toBe(1);
  });
});

describe('buscarSimilar', () => {
  it('encuentra palabras con typo pequeño', () => {
    const dic = ['almuerzo', 'desayuno', 'comida'];
    const resultado = buscarSimilar('almuerzoo', dic, 2);
    expect(resultado).toBe('almuerzo');
  });

  it('devuelve null si no hay similar', () => {
    const resultado = buscarSimilar('xyzabc', ['cafe', 'almuerzo'], 1);
    expect(resultado).toBeNull();
  });
});

describe('parsearTiempoRelativo', () => {
  it('parsea "mañana"', () => {
    expect(parsearTiempoRelativo('mañana 50 mil')).toBe(1);
  });

  it('parsea "ayer"', () => {
    expect(parsearTiempoRelativo('ayer gasté')).toBe(-1);
  });

  it('parsea "hace 3 días"', () => {
    expect(parsearTiempoRelativo('hace 3 días compré')).toBe(-3);
  });

  it('parsea "hace una semana"', () => {
    expect(parsearTiempoRelativo('hace una semana')).toBe(-7);
  });
});

describe('detectarMultiplesEntidades', () => {
  it('detecta "Netflix + Spotify"', () => {
    const r = detectarMultiplesEntidades('Netflix + Spotify 100 mil');
    expect(r.tipo).toBe('multi_categoria');
  });

  it('detecta "3 cafés"', () => {
    const r = detectarMultiplesEntidades('3 cafes en Juan Valdez');
    expect(r.tipo).toBe('multi_monto');
  });
});

describe('confianzaGranular', () => {
  it('calcula scores por dimensión', () => {
    const c = calcularConfianzaGranular(50000, true, 'usuario', true, true);
    expect(c.monto).toBe(0.95);
    expect(c.tipo).toBe(0.9);
    expect(c.categoria).toBe(0.95);
  });

  it('promedia correctamente', () => {
    const c = calcularConfianzaGranular(50000, true, 'merchant', true, false);
    const prom = promedioConfianza(c);
    expect(prom).toBeGreaterThan(0.7);
    expect(prom).toBeLessThan(1);
  });
});
