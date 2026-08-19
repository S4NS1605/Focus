import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Transaction } from '../types';
import { DetalleMes } from './DetalleMes';

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  kind: 'gasto',
  amountCop: 25_000,
  category: 'comida',
  description: 'Almuerzo',
  occurredOn: '2026-08-10',
  cuentaId: null,
  rawTranscript: '',
  createdAt: '2026-08-10T00:00:00.000Z',
  ...over,
});

const montar = (transacciones: Transaction[], mes = '2026-08') =>
  render(<DetalleMes delMes={transacciones} transacciones={transacciones} mes={mes} />);

// The bars are labelled with `dayLabel`, which says "Hoy" and "Ayer" for the two
// most recent days instead of a date. With a real clock these assertions held
// for 29 days a month and broke on the other two, which is worse than no test:
// it fails without anything having changed. Pinned to a day far from the
// fixtures so the labels are always "10 ago" and friends.
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-25T15:00:00.000Z'));
});
afterAll(() => {
  vi.useRealTimers();
});

describe('DetalleMes — gráfica por día', () => {
  it('invites interaction before anything is selected', () => {
    montar([tx()]);

    expect(screen.getByText(/toca una barra para ver ese día/i)).toBeInTheDocument();
  });

  it('shows that day when a bar is hovered', () => {
    montar([tx({ amountCop: 25_000, occurredOn: '2026-08-10' })]);

    fireEvent.mouseEnter(screen.getByRole('button', { name: /10 ago: \$25\.000/ }));

    expect(screen.getByText('1 movimiento · Comida')).toBeInTheDocument();
  });

  it('reaches the same readout by keyboard focus, not only by mouse', () => {
    montar([tx({ occurredOn: '2026-08-10' })]);

    fireEvent.focus(screen.getByRole('button', { name: /10 ago/ }));

    expect(screen.getByText('1 movimiento · Comida')).toBeInTheDocument();
  });

  it('clears the readout when the pointer leaves the chart', () => {
    montar([tx({ occurredOn: '2026-08-10' })]);
    const barra = screen.getByRole('button', { name: /10 ago/ });

    fireEvent.mouseEnter(barra);
    fireEvent.mouseLeave(barra.parentElement!);

    expect(screen.getByText(/toca una barra para ver ese día/i)).toBeInTheDocument();
  });

  it('toggles off on a second tap, which is how touch closes it', () => {
    montar([tx({ occurredOn: '2026-08-10' })]);
    const barra = screen.getByRole('button', { name: /10 ago/ });

    fireEvent.click(barra);
    expect(screen.getByText('1 movimiento · Comida')).toBeInTheDocument();

    fireEvent.click(barra);
    expect(screen.getByText(/toca una barra para ver ese día/i)).toBeInTheDocument();
  });

  it('renders a bar for every day of the month, empty ones included', () => {
    montar([tx({ occurredOn: '2026-08-10' })]);

    // The gaps are the point: without them the chart hides that spending was a
    // few heavy days rather than a steady drip.
    const barras = screen.getAllByRole('button', { name: /: \$/ });
    expect(barras).toHaveLength(31);
  });

  it('reports a day with nothing on it honestly', () => {
    montar([tx({ occurredOn: '2026-08-10' })]);

    // Anchored: an unanchored "1 ago" also matches 11, 21 and 31.
    fireEvent.mouseEnter(screen.getByRole('button', { name: /^1 ago: \$0$/ }));

    expect(screen.getByText('sin movimientos')).toBeInTheDocument();
  });

  it('shows income alongside spending on the same day', () => {
    montar([
      tx({ id: 'g', occurredOn: '2026-08-10', amountCop: 25_000 }),
      tx({ id: 'i', kind: 'ingreso', occurredOn: '2026-08-10', amountCop: 900_000 }),
    ]);

    fireEvent.mouseEnter(screen.getByRole('button', { name: /10 ago/ }));

    expect(screen.getByText('+$900.000')).toBeInTheDocument();
  });

  it('hides the whole chart when there was no spending at all', () => {
    montar([tx({ kind: 'ingreso' })]);

    expect(screen.queryByText('En qué días se fue')).not.toBeInTheDocument();
  });
});

describe('DetalleMes — contrapartes', () => {
  it('answers who was paid, which the category alone cannot', () => {
    montar([
      tx({
        id: 'a',
        category: 'transferencia',
        description: 'Para ANA MARIA GOMEZ',
        amountCop: 80_000,
      }),
      tx({ id: 'b', category: 'transferencia', description: 'Para LUIS PEREZ', amountCop: 40_000 }),
    ]);

    expect(screen.getByText('A quién le mandaste')).toBeInTheDocument();
    expect(screen.getByText('Ana Maria Gomez')).toBeInTheDocument();
    expect(screen.getByText('Luis Perez')).toBeInTheDocument();
  });

  it('keeps the two directions in separate panels', () => {
    montar([
      tx({ id: 'a', description: 'Para ANA MARIA GOMEZ' }),
      tx({ id: 'b', kind: 'ingreso', description: 'De LUIS PEREZ' }),
    ]);

    expect(screen.getByText('A quién le mandaste')).toBeInTheDocument();
    expect(screen.getByText('Quién te mandó')).toBeInTheDocument();
  });

  it('shows no panel when nobody is named', () => {
    montar([tx({ description: 'COMPRA PAQUETE PTM' })]);

    expect(screen.queryByText('A quién le mandaste')).not.toBeInTheDocument();
  });
});
