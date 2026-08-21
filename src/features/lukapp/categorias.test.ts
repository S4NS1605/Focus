import { describe, it, expect } from 'vitest';
import {
  CATALOGO_BASE,
  COLORES_CATEGORIA,
  ES_CLAVE_PROPIA,
  ICONOS_CATEGORIA,
  hacerCatalogo,
  iconoDeCategoria,
  nuevaClaveCategoria,
} from './categorias';
import type { CategoriaPersonal } from './categorias';
import { CATEGORIES } from './types';

const propia = (over: Partial<CategoriaPersonal> = {}): CategoriaPersonal => ({
  id: 'p-abc',
  nombre: 'Suscripciones',
  icon: 'Smartphone',
  color: '#6366F1',
  createdAt: '2026-08-01T00:00:00.000Z',
  archivedAt: null,
  ...over,
});

describe('catálogo de categorías', () => {
  it('mantiene las básicas aunque el usuario no haya creado ninguna', () => {
    expect(CATALOGO_BASE.lista.map((c) => c.clave)).toEqual([...CATEGORIES]);
  });

  it('suma las propias a las básicas sin reemplazarlas', () => {
    const cat = hacerCatalogo([propia()]);

    expect(cat.lista).toHaveLength(CATEGORIES.length + 1);
    expect(cat.de('p-abc').nombre).toBe('Suscripciones');
    expect(cat.de('comida').nombre).toBe('Comida');
  });

  it('marca cuáles puede editar el usuario', () => {
    const cat = hacerCatalogo([propia()]);

    expect(cat.de('p-abc').propia).toBe(true);
    expect(cat.de('comida').propia).toBe(false);
  });

  it('una categoría archivada sale de los selectores pero sigue mostrándose', () => {
    // El movimiento del mes pasado ya está archivado bajo esa clave. Si al
    // archivar dejara de resolver, ese gasto pasaría a verse como "Otros" y el
    // histórico cambiaría solo por ordenar la lista de hoy.
    const cat = hacerCatalogo([propia({ archivedAt: '2026-08-05T00:00:00.000Z' })]);

    expect(cat.lista.map((c) => c.clave)).not.toContain('p-abc');
    expect(cat.de('p-abc').nombre).toBe('Suscripciones');
    expect(cat.de('p-abc').archivada).toBe(true);
  });

  it('una clave que ya no existe se resuelve igual, sin romper la vista', () => {
    const entrada = hacerCatalogo([]).de('p-borrada-hace-meses');

    expect(entrada.clave).toBe('p-borrada-hace-meses');
    expect(entrada.nombre).toBe('Otros');
    expect(entrada.Icono).toBeTruthy();
    expect(entrada.color).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('ordena las propias alfabéticamente, con acentos del español', () => {
    const cat = hacerCatalogo([
      propia({ id: 'p-1', nombre: 'Zapatos' }),
      propia({ id: 'p-2', nombre: 'Árbol' }),
      propia({ id: 'p-3', nombre: 'mascotas' }),
    ]);

    const propias = cat.lista.filter((c) => c.propia).map((c) => c.nombre);
    expect(propias).toEqual(['Árbol', 'mascotas', 'Zapatos']);
  });

  it('las básicas van primero, para que la lista no se reordene sola al crear una', () => {
    const cat = hacerCatalogo([propia({ nombre: 'Aaa' })]);

    expect(cat.lista.slice(0, CATEGORIES.length).every((c) => !c.propia)).toBe(true);
  });
});

describe('claves nuevas', () => {
  it('nunca chocan con una categoría básica', () => {
    const claves = new Set(CATEGORIES as readonly string[]);
    for (let i = 0; i < 200; i += 1) {
      expect(claves.has(nuevaClaveCategoria())).toBe(false);
    }
  });

  it('no se repiten entre sí aunque se creen en el mismo milisegundo', () => {
    const generadas = new Set(Array.from({ length: 500 }, nuevaClaveCategoria));
    expect(generadas.size).toBe(500);
  });

  it('se distinguen de las básicas por el prefijo', () => {
    expect(ES_CLAVE_PROPIA(nuevaClaveCategoria())).toBe(true);
    expect(CATEGORIES.some(ES_CLAVE_PROPIA)).toBe(false);
  });
});

describe('opciones del selector', () => {
  it('cada ícono ofrecido existe de verdad', () => {
    for (const nombre of ICONOS_CATEGORIA) {
      expect(iconoDeCategoria(nombre)).toBeTruthy();
    }
    expect(ICONOS_CATEGORIA.length).toBeGreaterThan(15);
  });

  it('un ícono guardado que ya no está en la lista no rompe nada', () => {
    expect(iconoDeCategoria('UnIconoQueBorramos')).toBeTruthy();
    expect(iconoDeCategoria(null)).toBeTruthy();
  });

  it('los colores son hex válidos y ninguno se repite', () => {
    for (const c of COLORES_CATEGORIA) expect(c).toMatch(/^#[0-9A-F]{6}$/);
    expect(new Set(COLORES_CATEGORIA).size).toBe(COLORES_CATEGORIA.length);
  });
});
