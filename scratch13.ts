import { findAmountCandidates, tokenize } from './src/features/finanzas/lib/parseTransaction.ts';
const raw = '[OCR] € comprobante de pago (O Envío Realizado A [a] Le I "| E _— L.] NN L a La “ EH El [m] P E, h: O ¡Escanea este GR con Nequi para verificar tu envío al instante! Para Josue Conversación Te envío esto como prueba para la app de finanzas gracias bro ¿Cuánto? $ 100,00 Número Nequi 310 2201494 Fecha 16 de agosto de 2026 alas 06:15 p.m. Referencia M16482536';
const tokens = tokenize(raw);
console.log(findAmountCandidates(tokens));
