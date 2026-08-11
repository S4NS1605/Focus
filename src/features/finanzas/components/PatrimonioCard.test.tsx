import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PatrimonioCard } from './PatrimonioCard';
import type { Cajita, CajitaMovimiento } from '../data/modelos';

const caj = (over: Partial<Cajita> = {}): Cajita => ({
  id: 'c1',
  nombre: 'Nequi',
  icon: 'Wallet',
  tipo: 'cuenta',
  metaCop: null,
  tasaEaPct: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  archivedAt: null,
  ...over,
});

const mov = (over: Partial<CajitaMovimiento> = {}): CajitaMovimiento => ({
  id: 'm1',
  cajitaId: 'c1',
  kind: 'deposito',
  deltaCop: 300_000,
  categoria: null,
  occurredOn: '2026-08-01',
  nota: '',
  createdAt: '2026-08-01T10:00:00.000Z',
  ...over,
});

/** 300.000 in an account, 200.000 in savings. */
const montar = (mostrarAhorro: boolean) =>
  render(
    <PatrimonioCard
      cajitas={[caj(), caj({ id: 'c2', nombre: 'Viaje', tipo: 'cajita' })]}
      movimientos={[mov(), mov({ id: 'm2', cajitaId: 'c2', deltaCop: 200_000 })]}
      transacciones={[]}
      mostrarAhorro={mostrarAhorro}
    />,
  );

describe('PatrimonioCard — contar o no los ahorros', () => {
  it('por defecto los suma al total', () => {
    montar(true);

    expect(screen.getByText('$500.000')).toBeInTheDocument();
    expect(screen.getByText('En cajitas')).toBeInTheDocument();
  });

  it('al apagarlo, los saca del total y no solo de la vista', () => {
    // Ocultar solo el recuadro dejaría un total que incluye en silencio una
    // cifra que no se puede ver: las partes dejarían de sumar el todo.
    montar(false);

    expect(screen.getByText('$300.000')).toBeInTheDocument();
    expect(screen.queryByText('$500.000')).not.toBeInTheDocument();
    expect(screen.queryByText('En cajitas')).not.toBeInTheDocument();
  });

  it('cambia el título con el número, en vez de prometer el todo', () => {
    // "Lo que tienes ahora" sobre un total sin ahorros es una promesa que la
    // cifra no cumple — y a quien tiene toda su plata en cajitas le diría que
    // tiene $0.
    montar(false);

    expect(screen.getByText('Lo que tienes en cuentas')).toBeInTheDocument();
    expect(screen.queryByText('Lo que tienes ahora')).not.toBeInTheDocument();
  });

  it('dice cuánto queda fuera, no solo que algo queda fuera', () => {
    montar(false);

    expect(screen.getByText(/sin contar \$200\.000 en ahorros/i)).toBeInTheDocument();
  });

  it('no pone esa advertencia cuando sí los cuenta', () => {
    montar(true);

    expect(screen.getByText('Lo que tienes ahora')).toBeInTheDocument();
    expect(screen.queryByText(/sin contar/i)).not.toBeInTheDocument();
  });

  it('no anuncia ahorros ocultos a quien no tiene ninguno', () => {
    // Inventaría plata que no existe.
    render(
      <PatrimonioCard
        cajitas={[caj()]}
        movimientos={[mov()]}
        transacciones={[]}
        mostrarAhorro={false}
      />,
    );

    expect(screen.queryByText(/sin contar/i)).not.toBeInTheDocument();
    expect(screen.getByText('$300.000')).toBeInTheDocument();
  });

  it('con los ahorros apagados no repite el mismo número dos veces', () => {
    // El titular ya ES lo que hay en cuentas; volver a decirlo debajo se lee
    // como dos datos cuando solo hay uno.
    montar(false);

    expect(screen.getAllByText('$300.000')).toHaveLength(1);
    expect(screen.queryByText('En cuentas')).not.toBeInTheDocument();
  });

  it('sin preferencia declarada, los cuenta', () => {
    // El resumen sirve para responder "cuánto tengo"; dejarlos fuera por
    // omisión lo subestimaría para quien nunca encuentre el interruptor.
    render(
      <PatrimonioCard
        cajitas={[caj(), caj({ id: 'c2', tipo: 'cajita' })]}
        movimientos={[mov(), mov({ id: 'm2', cajitaId: 'c2', deltaCop: 200_000 })]}
        transacciones={[]}
      />,
    );

    expect(screen.getByText('$500.000')).toBeInTheDocument();
  });
});
