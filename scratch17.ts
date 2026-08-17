import { parseTransaction } from './src/features/finanzas/lib/parseTransaction.ts';
import { normalizarNombre } from './src/features/finanzas/lib/contactos.ts';

// Suppose we have a magic text matcher:
export const calzaTextoMagico = (tx: any, consulta: string, catalogo: any): boolean => {
  if (consulta.trim() === '') return true;
  
  // Normal string match
  const q = normalizarNombre(consulta);
  const campos = [
    normalizarNombre(tx.description),
    normalizarNombre(catalogo?.de(tx.category).nombre ?? tx.category),
  ];
  if (campos.some((campo) => campo.includes(q))) return true;

  // Magic match!
  if (consulta.length > 3) {
    const parsed = parseTransaction(consulta);
    let matchMagico = false;
    let tieneFiltrosMagicos = false;

    // If query implies a specific category
    if (parsed.signals.categorySource !== 'default' && parsed.signals.categorySource !== 'aprendida') {
      tieneFiltrosMagicos = true;
      if (tx.category === parsed.category) matchMagico = true;
      else return false; // If query says "comida" and tx is NOT "comida", it fails!
    }

    // If query implies a specific kind
    if (parsed.signals.kindSource !== 'default') {
      tieneFiltrosMagicos = true;
      if (tx.kind === parsed.kind) matchMagico = true;
      else return false;
    }

    if (tieneFiltrosMagicos) return matchMagico;
  }
  
  return false;
}
