import { parseTransaction } from './src/features/finanzas/lib/parseTransaction.ts';
const raw = 'Te envio esto ¿Cuánto? $100,00 Número Nequi 310 2201804';
const tx = parseTransaction(raw);
console.log("Amount:", tx.amount);
