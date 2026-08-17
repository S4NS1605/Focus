import { tokenize } from './src/features/finanzas/lib/parseTransaction.ts';
import fs from 'fs';
const content = fs.readFileSync('./src/features/finanzas/lib/parseTransaction.ts', 'utf8');
const readNumberAt = eval(`(${content.match(/const readNumberAt = [\s\S]+?;\n/)[0].replace('const readNumberAt =', '')})`);
// Too complex, let's just use sed to export it temporarily again
