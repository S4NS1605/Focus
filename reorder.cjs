const fs = require('fs');
const file = 'src/features/finanzas/lib/parseTransaction.ts';
let code = fs.readFileSync(file, 'utf8');

const accountRegex = /\s*\/\/ 4 — Account[\s\S]*?const paymentMethod = detectAndConsumePaymentMethod\(tokens, consumed\);\n/;
const accountMatch = code.match(accountRegex);

if (accountMatch) {
  code = code.replace(accountRegex, '');
  const categoryPos = code.indexOf('  // 3 — Category');
  if (categoryPos !== -1) {
    code = code.slice(0, categoryPos) + accountMatch[0] + '\n' + code.slice(categoryPos);
    fs.writeFileSync(file, code);
    console.log('Reordered successfully');
  } else {
    console.log('Category not found');
  }
} else {
  console.log('Account block not found');
}
