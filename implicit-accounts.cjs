const fs = require('fs');
const file = 'src/features/finanzas/lib/parseTransaction.ts';
let code = fs.readFileSync(file, 'utf8');

const regex = /\/\/ 5 — Payment method\. Consumed so 'en efectivo' or 'con tarjeta' doesn't leak into description\.\s*const paymentMethod = detectAndConsumePaymentMethod\(tokens, consumed\);/;

const replacement = `// 5 — Payment method. Consumed so 'en efectivo' or 'con tarjeta' doesn't leak into description.
  const paymentMethod = detectAndConsumePaymentMethod(tokens, consumed);

  // MEGA UPGRADE 4: Implicit accounts by payment method
  if (!cuentaId) {
    if (paymentMethod === 'efectivo') {
      const efectivoAcc = cuentas.find(c => c.nombre.toLowerCase().includes('efectivo') || c.nombre.toLowerCase().includes('billetera'));
      if (efectivoAcc) {
        cuentaId = efectivoAcc.id;
        cuentaSource = 'nombre'; // pretend it matched by name
      }
    } else if (paymentMethod === 'tarjeta') {
      const tarjetaAcc = cuentas.find(c => c.nombre.toLowerCase().includes('tarjeta') || c.nombre.toLowerCase().includes('credito'));
      if (tarjetaAcc) {
        cuentaId = tarjetaAcc.id;
        cuentaSource = 'nombre';
      }
    }
  }`;

if (code.match(regex)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(file, code);
  console.log('Upgrade 4 injected successfully');
} else {
  console.log('Regex match failed');
}
