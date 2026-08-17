const fs = require('fs');
const file = 'src/features/finanzas/lib/parseTransaction.ts';
let code = fs.readFileSync(file, 'utf8');

const regex = /\/\/ MEGA UPGRADE 4: Implicit accounts by payment method/;

const replacement = `// MEGA UPGRADE 2: Time Machine (Date extraction)
  let dateOverride: string | undefined = undefined;
  const today = new Date();
  
  // Format Date to YYYY-MM-DD
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  for (let i = 0; i < tokens.length; i++) {
    if (consumed[i]) continue;
    const norm = tokens[i].norm;
    let offsetDays = null;
    
    if (norm === 'ayer' || norm === 'anoche') offsetDays = 1;
    else if (norm === 'anteayer' || norm === 'antier') offsetDays = 2;
    else if (norm === 'hoy') offsetDays = 0;

    if (offsetDays !== null) {
      const d = new Date(today);
      d.setDate(d.getDate() - offsetDays);
      dateOverride = formatDate(d);
      consumed[i] = true;
      // Also consume preceding prepositions like "de" or "para" if any?
      // Wait, "ayer" rarely has prepositions.
    }
  }

  // MEGA UPGRADE 4: Implicit accounts by payment method`;

if (code.match(regex)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(file, code);
  console.log('Upgrade 2 injected successfully');
} else {
  console.log('Regex match failed');
}
