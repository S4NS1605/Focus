import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfirmSheet } from './ConfirmSheet';
import { parseTransaction } from '../lib/parseTransaction';
import type { Transaction } from '../types';

const tx = (amount: number): Transaction => ({
  id: `t-${amount}-${Math.random()}`,
  kind: 'gasto',
  amountCop: amount,
  category: 'comida',
  description: 'x',
  occurredOn: '2026-08-01',
  cuentaId: null,
  rawTranscript: '',
  createdAt: '2026-08-01T00:00:00.000Z',
});

// Historial parejo: 4 almuerzos de 10-13 mil. Un gasto de 500 mil en la misma
// categoría se sale claramente de ±2σ.
const HISTORIAL_NORMAL = [tx(10_000), tx(12_000), tx(11_000), tx(13_000)];

describe('ConfirmSheet — aviso de monto inusual', () => {
  beforeEach(() => {
    // jsdom no implementa scrollIntoView; ConfirmSheet no lo usa directamente
    // pero framer-motion y el bloqueo de scroll tocan el DOM real.
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('avisa cuando el monto se sale de lo usual en esa categoría', () => {
    const parsed = parseTransaction('gasté 500 mil en comida');
    render(
      <ConfirmSheet
        parsed={parsed}
        transacciones={HISTORIAL_NORMAL}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/fuera de lo usual/i)).toBeTruthy();
  });

  it('no avisa cuando el monto está dentro de lo usual', () => {
    const parsed = parseTransaction('gasté 12 mil en comida');
    render(
      <ConfirmSheet
        parsed={parsed}
        transacciones={HISTORIAL_NORMAL}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByText(/fuera de lo usual/i)).toBeNull();
  });

  it('no avisa sin historial para comparar', () => {
    const parsed = parseTransaction('gasté 500 mil en comida');
    render(
      <ConfirmSheet
        parsed={parsed}
        transacciones={[]}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByText(/fuera de lo usual/i)).toBeNull();
  });

  it('no avisa al editar un movimiento ya guardado', () => {
    // Editar reusa el mismo componente; el aviso no aplica a algo que la
    // persona ya vivió y confirmó una vez.
    const parsed = parseTransaction('gasté 500 mil en comida');
    render(
      <ConfirmSheet
        modo="editar"
        parsed={parsed}
        transacciones={HISTORIAL_NORMAL}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByText(/fuera de lo usual/i)).toBeNull();
  });
});
