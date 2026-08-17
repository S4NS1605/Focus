import { findAmountCandidates, tokenize } from './src/features/finanzas/lib/parseTransaction.ts';
const tokens = tokenize('Te envio esto ¿Cuánto? $100,00 Número Nequi 310 2201804');
console.log(tokens);
console.log(findAmountCandidates(tokens));
