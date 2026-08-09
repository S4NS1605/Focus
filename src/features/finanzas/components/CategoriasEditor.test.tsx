import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoriasEditor } from './CategoriasEditor';
import type { CategoriaPersonal } from '../categorias';
import { CatalogoProvider } from '../catalogoContexto';
import type { Transaction } from '../types';

const cat = (over: Partial<CategoriaPersonal> = {}): CategoriaPersonal => ({
  id: 'p-subs',
  nombre: 'Suscripciones',
  icon: 'Smartphone',
  color: '#6366F1',
  createdAt: '2026-08-01T00:00:00.000Z',
  archivedAt: null,
  ...over,
});

const tx = (category: string): Transaction => ({
  id: `t-${category}`,
  kind: 'gasto',
  amountCop: 20000,
  category,
  description: 'algo',
  occurredOn: '2026-08-01',
  cuentaId: null,
  rawTranscript: '',
  createdAt: '2026-08-01T00:00:00.000Z',
});

const montar = (categorias: CategoriaPersonal[], transacciones: Transaction[] = []) => {
  const props = {
    onCrear: vi.fn(),
    onActualizar: vi.fn(),
    onArchivar: vi.fn(),
    onBorrar: vi.fn(),
  };
  render(
    <CatalogoProvider categorias={categorias}>
      <CategoriasEditor categorias={categorias} transacciones={transacciones} {...props} />
    </CatalogoProvider>,
  );
  return props;
};

describe('editor de categorías', () => {
  it('una categoría sin movimientos se puede eliminar', () => {
    const { onBorrar, onArchivar } = montar([cat()]);

    fireEvent.click(screen.getByLabelText('Eliminar Suscripciones'));

    expect(onBorrar).toHaveBeenCalledWith('p-subs');
    expect(onArchivar).not.toHaveBeenCalled();
  });

  it('una con movimientos se archiva, nunca se borra', () => {
    // Borrar la fila dejaría esos gastos apuntando a una clave que ya no
    // explica nada: el histórico cambiaría solo por ordenar la lista de hoy.
    const { onBorrar, onArchivar } = montar([cat()], [tx('p-subs')]);

    expect(screen.queryByLabelText('Eliminar Suscripciones')).toBeNull();
    fireEvent.click(screen.getByLabelText('Archivar Suscripciones'));

    expect(onArchivar).toHaveBeenCalledWith('p-subs');
    expect(onBorrar).not.toHaveBeenCalled();
  });

  it('dice cuántos movimientos la usan', () => {
    montar([cat()], [tx('p-subs'), { ...tx('p-subs'), id: 't-2' }]);

    expect(screen.getByText('2 movimientos')).toBeTruthy();
  });

  it('una archivada se puede reactivar', () => {
    const { onActualizar } = montar([cat({ archivedAt: '2026-08-06T00:00:00.000Z' })]);

    fireEvent.click(screen.getByLabelText('Reactivar Suscripciones'));

    expect(onActualizar).toHaveBeenCalledWith(expect.objectContaining({ archivedAt: null }));
  });

  it('crea una con el nombre, ícono y color elegidos', () => {
    const { onCrear } = montar([]);

    fireEvent.click(screen.getByText('Nueva'));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '  Mascotas  ' } });
    fireEvent.click(screen.getByLabelText('PawPrint'));
    fireEvent.click(screen.getByLabelText('Color #10B981'));
    fireEvent.click(screen.getByText('Crear categoría'));

    expect(onCrear).toHaveBeenCalledWith({
      nombre: 'Mascotas',
      icon: 'PawPrint',
      color: '#10B981',
    });
  });

  it('no deja crear una sin nombre', () => {
    const { onCrear } = montar([]);

    fireEvent.click(screen.getByText('Nueva'));
    fireEvent.click(screen.getByText('Crear categoría'));

    expect(onCrear).not.toHaveBeenCalled();
  });

  it('lista las básicas pero sin acciones de edición', () => {
    montar([]);

    expect(screen.getByText('Comida')).toBeTruthy();
    expect(screen.queryByLabelText('Editar Comida')).toBeNull();
    expect(screen.queryByLabelText('Eliminar Comida')).toBeNull();
  });

  it('editar conserva el id y la fecha de creación', () => {
    // Cambiar el id re-etiquetaría todos los movimientos que ya la usan.
    const { onActualizar } = montar([cat()], [tx('p-subs')]);

    fireEvent.click(screen.getByLabelText('Editar Suscripciones'));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Streaming' } });
    fireEvent.click(screen.getByText('Guardar cambios'));

    expect(onActualizar).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'p-subs',
        nombre: 'Streaming',
        createdAt: '2026-08-01T00:00:00.000Z',
      }),
    );
  });
});
