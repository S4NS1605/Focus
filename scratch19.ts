import { tokenize, findAmountCandidates } from './src/features/finanzas/lib/parseTransaction.ts';
console.log(findAmountCandidates(tokenize("gaste 15 dolares")));
console.log(findAmountCandidates(tokenize("compre algo por 20 euros")));
