import React, { createContext, useContext, useMemo } from 'react';
import { CATALOGO_BASE, hacerCatalogo } from './categorias';
import type { Catalogo, CategoriaPersonal } from './categorias';

/**
 * The resolved category catalogue, read by anything that draws a category.
 *
 * Context rather than a prop because a category is drawn at nearly every leaf of
 * the tree — the movement row, the breakdown, the trends chart, the analysis
 * sheet — and threading one object through all of them would mean editing every
 * intermediate component that has no interest in categories.
 *
 * The default is the built-in set, so a component rendered outside the provider
 * (a test, a storybook-style harness) still shows real names instead of blank.
 */
const CatalogoContexto = createContext<Catalogo>(CATALOGO_BASE);

export const CatalogoProvider: React.FC<{
  categorias: readonly CategoriaPersonal[];
  children: React.ReactNode;
}> = ({ categorias, children }) => {
  // Rebuilt only when the user's categories change, not on every render: it
  // builds a Map over every category and is read by every row in a long list.
  const catalogo = useMemo(() => hacerCatalogo(categorias), [categorias]);

  return <CatalogoContexto.Provider value={catalogo}>{children}</CatalogoContexto.Provider>;
};

export const useCatalogo = (): Catalogo => useContext(CatalogoContexto);
