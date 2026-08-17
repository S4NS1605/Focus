const fs = require('fs');
const file = 'src/features/finanzas/lib/parseTransaction.ts';
let code = fs.readFileSync(file, 'utf8');

// 1. Add Transaction import
if (!code.includes('import type { Transaction }')) {
  code = code.replace("import type { LexicoAprendido } from './aprendizaje';", "import type { LexicoAprendido } from './aprendizaje';\nimport type { Transaction } from '../types';");
}

// 2. Add `transacciones` argument to `parseTransaction`
const argRegex = /lexico:\s*LexicoAprendido\s*=\s*LEXICO_VACIO,/;
if (code.match(argRegex)) {
  code = code.replace(argRegex, `lexico: LexicoAprendido = LEXICO_VACIO,\n  transacciones: readonly Transaction[] = [],`);
}

// 3. Fraction math logic at the start of amount parsing
const amountRegex = /const candidates = findAmountCandidates\(tokens\);/;
const fractionalLogic = `const candidates = findAmountCandidates(tokens);

  // MEGA UPGRADE 6: Fraction Math
  let fractionMultiplier = 1;
  const rawLowerForMath = raw.toLowerCase();
  if (rawLowerForMath.includes('la mitad de') || rawLowerForMath.includes('mitad de')) fractionMultiplier = 0.5;
  else if (rawLowerForMath.includes('un tercio de') || rawLowerForMath.includes('tercera parte de')) fractionMultiplier = 1/3;
  else if (rawLowerForMath.includes('un cuarto de') || rawLowerForMath.includes('cuarta parte de')) fractionMultiplier = 0.25;
  else if (rawLowerForMath.includes('el doble de')) fractionMultiplier = 2;
  else if (rawLowerForMath.includes('el triple de')) fractionMultiplier = 3;`;
if (code.match(amountRegex)) {
  code = code.replace(amountRegex, fractionalLogic);
}

// 4. Multiply amount by fractionMultiplier (and round it)
const amountAssignmentRegex = /if \(bestChainTotal > best\.value\) \{([\s\S]*?)amount = bestChainTotal;([\s\S]*?)\} else \{([\s\S]*?)amount = best\.value;/;
const amountAssignmentReplacement = `if (bestChainTotal > best.value) {$1amount = Math.round(bestChainTotal * fractionMultiplier);$2} else {$3amount = Math.round(best.value * fractionMultiplier);`;
if (code.match(amountAssignmentRegex)) {
  code = code.replace(amountAssignmentRegex, amountAssignmentReplacement);
}

// 5. Oracle Logic and Auto-tagging at the bottom before return
const returnRegex = /const suggestedCategories = \[/;
const oracleLogic = `// MEGA UPGRADE 5: El Oráculo (Contextual Memory for recurring/known expenses)
  if (amount === null && description !== '' && transacciones.length > 0) {
    const descLower = description.toLowerCase();
    // Search newest first
    for (let i = transacciones.length - 1; i >= 0; i--) {
      const t = transacciones[i];
      if (t.description.toLowerCase().includes(descLower) || descLower.includes(t.description.toLowerCase())) {
        amount = t.amountCop;
        if (category === 'otros' || categorySource === 'default') {
          category = t.category as CategoriaClave;
          categorySource = 'aprendida';
        }
        if (cuentaId === null) {
          cuentaId = t.cuentaId;
          cuentaSource = 'nombre';
        }
        confidence += 0.4;
        break;
      }
    }
  }

  // MEGA UPGRADE 7: Auto-tagging based on description/raw context
  const rawLower = raw.toLowerCase();
  if (rawLower.includes('viaje') || rawLower.includes('vacaciones') || rawLower.includes('vuelo') || rawLower.includes('hotel')) tags.push('viaje');
  if (rawLower.includes('cumpleaños') || rawLower.includes('regalo') || rawLower.includes('sorpresa')) tags.push('regalo');
  if (rawLower.includes('fiesta') || rawLower.includes('rumba') || rawLower.includes('salida')) tags.push('fiesta');
  if (rawLower.includes('multa') || rawLower.includes('infraccion') || rawLower.includes('intereses')) tags.push('multa');
  if (rawLower.includes('domicilio') || rawLower.includes('delivery') || rawLower.includes('rappi')) tags.push('domicilio');

  const suggestedCategories = [`;
if (code.match(returnRegex)) {
  code = code.replace(returnRegex, oracleLogic);
}

fs.writeFileSync(file, code);
console.log('Transform script completed');
