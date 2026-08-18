import { describe, expect, it } from 'vitest';
import { distanciaLevenshtein, buscarSimilar, calcularConfianzaGranular } from './inteligenciaAvanzada';

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

describe('confianzaGranular', () => {
  it('calcula scores por dimensión', () => {
    const c = calcularConfianzaGranular(50000, true, 'usuario', true, true);
    expect(c.monto).toBe(0.95);
    expect(c.tipo).toBe(0.9);
    expect(c.categoria).toBe(0.95);
  });
});
