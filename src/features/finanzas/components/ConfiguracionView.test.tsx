import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Cajita, CajitaMovimiento } from '../data/modelos';
import { ConfiguracionView } from './ConfiguracionView';

const caj = (over: Partial<Cajita> = {}): Cajita => ({
  id: 'c1',
  nombre: 'Nequi',
  icon: 'PiggyBank',
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
  deltaCop: 500_000,
  categoria: null,
  occurredOn: '2026-08-01',
  nota: '',
  createdAt: '2026-08-01T00:00:00.000Z',
  ...over,
});

const montar = (cajitas: Cajita[] = [caj()], movimientos: CajitaMovimiento[] = [mov()]) => {
  const onActualizar = vi.fn();
  const onFijarSaldo = vi.fn();

  render(
    <ConfiguracionView
      cajitas={cajitas}
      movimientos={movimientos}
      transacciones={[]}
      onActualizar={onActualizar}
      onFijarSaldo={onFijarSaldo}
      categorias={[]}
      onCrearCategoria={vi.fn()}
      onActualizarCategoria={vi.fn()}
      onArchivarCategoria={vi.fn()}
      onBorrarCategoria={vi.fn()}
    />,
  );

  return { onActualizar, onFijarSaldo };
};

describe('ConfiguracionView', () => {
  it('groups accounts, pockets and debts under their own headings', () => {
    montar(
      [
        caj({ id: 'a', nombre: 'Nequi', tipo: 'cuenta' }),
        caj({ id: 'b', nombre: 'Vacaciones', tipo: 'cajita' }),
        caj({ id: 'c', nombre: 'Visa', tipo: 'tarjeta' }),
      ],
      [],
    );

    expect(screen.getByText('Cuentas bancarias')).toBeInTheDocument();
    expect(screen.getByText('Cajitas de ahorro')).toBeInTheDocument();
    expect(screen.getByText('Tarjetas y deudas')).toBeInTheDocument();
  });

  it('hides a heading that has nothing under it', () => {
    montar([caj({ tipo: 'cuenta' })], []);

    expect(screen.queryByText('Tarjetas y deudas')).not.toBeInTheDocument();
  });

  it('updates a balance inline, without opening the edit form', () => {
    const { onFijarSaldo } = montar();

    // The common task is "update what my four accounts say today"; making that
    // an open-edit-save trip per account would be the slowest possible shape.
    fireEvent.change(screen.getByLabelText('Saldo de Nequi'), { target: { value: '750000' } });
    fireEvent.click(screen.getByLabelText('Guardar saldo de Nequi'));

    expect(onFijarSaldo).toHaveBeenCalledWith('c1', 750000);
  });

  it('keeps the save disabled until the balance actually differs', () => {
    const { onFijarSaldo } = montar();

    const guardar = screen.getByLabelText('Guardar saldo de Nequi');
    expect(guardar).toBeDisabled();

    fireEvent.click(guardar);
    expect(onFijarSaldo).not.toHaveBeenCalled();
  });

  it('accepts a balance of zero — an emptied account is a real state', () => {
    const { onFijarSaldo } = montar();

    fireEvent.change(screen.getByLabelText('Saldo de Nequi'), { target: { value: '0' } });
    fireEvent.click(screen.getByLabelText('Guardar saldo de Nequi'));

    expect(onFijarSaldo).toHaveBeenCalledWith('c1', 0);
  });

  it('edits name and rate, which could only be set at creation before', () => {
    const { onActualizar } = montar();

    fireEvent.click(screen.getByLabelText('Editar Nequi'));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nequi principal' } });
    fireEvent.change(screen.getByLabelText('% E.A.'), { target: { value: '13,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    // Comma accepted: it is the decimal separator on a Colombian keyboard.
    expect(onActualizar).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c1', nombre: 'Nequi principal', tasaEaPct: 13.5 }),
    );
  });

  it('offers no rate or target on a debt — neither means anything there', () => {
    montar([caj({ id: 'd1', nombre: 'Visa', tipo: 'tarjeta' })], []);

    fireEvent.click(screen.getByLabelText('Editar Visa'));

    expect(screen.queryByLabelText('% E.A.')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Meta')).not.toBeInTheDocument();
  });

  it('leaves archived balances out entirely', () => {
    montar([caj({ archivedAt: '2026-01-01T00:00:00.000Z' })], []);

    expect(screen.getByText('Todavía no tienes cuentas.')).toBeInTheDocument();
  });

  it('still offers the category editor when there are no accounts', () => {
    // Having no accounts is the empty state of the balances block, not of the
    // page. Returning early made the only place to edit categories unreachable
    // until a pocket existed, which has nothing to do with categories.
    montar([], []);

    expect(screen.getByText('Categorías')).toBeInTheDocument();
    expect(screen.getByText('Nueva')).toBeInTheDocument();
  });

  it('totals only what is held, never what is owed', () => {
    montar(
      [caj({ id: 'a', tipo: 'cuenta' }), caj({ id: 'b', nombre: 'Visa', tipo: 'tarjeta' })],
      [
        mov({ id: 'm1', cajitaId: 'a', deltaCop: 500_000 }),
        mov({ id: 'm2', cajitaId: 'b', deltaCop: 900_000 }),
      ],
    );

    // 500.000 held; the 900.000 owed must not be added into it.
    expect(screen.getByText('$500.000')).toBeInTheDocument();
  });
});
