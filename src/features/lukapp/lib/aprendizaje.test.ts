import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import { aprenderDe } from './aprendizaje';

const tx = (raw: string, category: string, id = raw): Transaction => ({
  id,
  kind: 'gasto',
  amountCop: 10000,
  category,
  description: raw,
  occurredOn: '2026-08-01',
  cuentaId: null,
  rawTranscript: raw,
  createdAt: '2026-08-01T00:00:00.000Z',
});

describe('aprenderDe', () => {
  it('aprende una palabra que archivas siempre en la misma categoría', () => {
    // Dos veces "croquetas" en Mascotas: ya es señal.
    const lex = aprenderDe([
      tx('croquetas 20 mil', 'mascotas', '1'),
      tx('croquetas del gato', 'mascotas', '2'),
    ]);
    expect(lex.categoriaDe('croquetas')).toBe('mascotas');
  });

  it('no aprende de un solo movimiento', () => {
    // Una vez no basta: un gasto raro no debe reescribir lo que sueles hacer.
    const lex = aprenderDe([tx('croquetas 20 mil', 'mascotas')]);
    expect(lex.categoriaDe('croquetas')).toBeNull();
  });

  it('exige que una categoría domine, no un empate', () => {
    // 2 y 2 = 50%, por debajo del 60% que se pide: no se decide.
    const lex = aprenderDe([
      tx('taxi al centro', 'transporte', '1'),
      tx('taxi tarde', 'transporte', '2'),
      tx('taxi amarillo', 'otros', '3'),
      tx('taxi otra vez', 'otros', '4'),
    ]);
    expect(lex.categoriaDe('taxi')).toBeNull();
  });

  it('decide cuando una categoría predomina de verdad', () => {
    // 3 de 4 = 75%: predomina.
    const lex = aprenderDe([
      tx('gimnasio lunes', 'salud', '1'),
      tx('gimnasio martes', 'salud', '2'),
      tx('gimnasio jueves', 'salud', '3'),
      tx('gimnasio con amigos', 'entretenimiento', '4'),
    ]);
    expect(lex.categoriaDe('gimnasio')).toBe('salud');
  });

  it('cuenta por movimiento, no por repetición dentro de la frase', () => {
    // "cafe cafe cafe" una sola vez NO es evidencia de dos movimientos.
    const lex = aprenderDe([tx('cafe cafe cafe', 'comida')]);
    expect(lex.categoriaDe('cafe')).toBeNull();
  });

  it('ignora conectores, verbos de dirección, montos y numerales', () => {
    const lex = aprenderDe([
      tx('gasté 20 mil en el almuerzo', 'comida', '1'),
      tx('pagué 15 mil por el almuerzo', 'comida', '2'),
    ]);
    // La palabra de contenido sí se aprende...
    expect(lex.categoriaDe('almuerzo')).toBe('comida');
    // ...pero no los conectores ni los verbos ni "mil".
    expect(lex.categoriaDe('mil')).toBeNull();
    expect(lex.categoriaDe('pague')).toBeNull();
    expect(lex.categoriaDe('gaste')).toBeNull();
  });

  it('aprende hacia una categoría que el usuario creó (su id)', () => {
    const lex = aprenderDe([
      tx('croquetas', 'c-mascotas-123', '1'),
      tx('croquetas premium', 'c-mascotas-123', '2'),
    ]);
    expect(lex.categoriaDe('croquetas')).toBe('c-mascotas-123');
  });

  it('un movimiento sin texto no rompe nada', () => {
    const sinTexto = { ...tx('', 'otros'), rawTranscript: '' };
    expect(aprenderDe([sinTexto]).tamano).toBe(0);
  });
});
