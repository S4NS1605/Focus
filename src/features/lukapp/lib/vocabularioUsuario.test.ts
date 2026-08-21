import { describe, expect, it } from 'vitest';
import type { CategoriaPersonal } from '../categorias';
import { frasesDeCategorias } from './vocabularioUsuario';

const cat = (over: Partial<CategoriaPersonal> = {}): CategoriaPersonal => ({
  id: 'c-1',
  nombre: 'Mascotas',
  icon: 'Package',
  color: '#A8A29E',
  createdAt: '2026-08-01T00:00:00.000Z',
  archivedAt: null,
  ...over,
});

describe('frasesDeCategorias', () => {
  it('normaliza el nombre a palabras', () => {
    expect(frasesDeCategorias([cat({ id: 'c-m', nombre: 'Mascotás' })])).toEqual([
      { id: 'c-m', seq: ['mascotas'] },
    ]);
  });

  it('conserva las palabras del nombre compuesto, en orden', () => {
    expect(frasesDeCategorias([cat({ id: 'c-casa', nombre: 'Cosas de la casa' })])).toEqual([
      { id: 'c-casa', seq: ['cosas', 'de', 'la', 'casa'] },
    ]);
  });

  it('ordena de la frase más larga a la más corta', () => {
    // Para que "Cosas de la casa" no se resuelva por un "Casa" suelto.
    const frases = frasesDeCategorias([
      cat({ id: 'c-casa', nombre: 'Casa' }),
      cat({ id: 'c-cosas', nombre: 'Cosas de la casa' }),
    ]);
    expect(frases.map((f) => f.id)).toEqual(['c-cosas', 'c-casa']);
  });

  it('ignora las categorías archivadas', () => {
    const frases = frasesDeCategorias([
      cat({ id: 'viva', nombre: 'Novia' }),
      cat({ id: 'vieja', nombre: 'Ex', archivedAt: '2026-01-01T00:00:00.000Z' }),
    ]);
    expect(frases.map((f) => f.id)).toEqual(['viva']);
  });

  it('descarta un nombre que queda vacío al normalizar', () => {
    expect(frasesDeCategorias([cat({ nombre: '   ' })])).toEqual([]);
  });
});
