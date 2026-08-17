const fs = require('fs');
const file = 'src/features/finanzas/lib/parseTransaction.ts';
let code = fs.readFileSync(file, 'utf8');

const regex = /const candidates = findAmountCandidates\(tokens\);\s*const best = pickBest\(candidates\);\s*const amount = best \? best.value : null;\s*if \(best\) \{\s*for \(let i = best.start; i < best.end; i \+= 1\) consumed\[i\] = true;\s*\/\/ Consume preceding AMOUNT_CUE[^\}]+\}\s*\}/;

const replacement = `const candidates = findAmountCandidates(tokens);
  
  // Upgrade 1: Sumar múltiples montos unidos por conjunciones ("20 mil y 3 mil")
  let amount: number | null = null;
  let best = pickBest(candidates);
  
  if (best) {
    const valid = candidates.filter(c => c.score >= 0).sort((a, b) => a.start - b.start);
    let totalValue = 0;
    
    // Check if best is part of a conjoined chain
    const CONJUNCTIONS = new Set(['y', 'e', 'mas', 'más', 'con', 'propina', 'de']);
    let current = valid[0];
    
    // We will find chains of conjoined valid amounts
    let bestChainTotal = 0;
    let bestChainIndices: number[] = [];
    
    for (let startIdx = 0; startIdx < valid.length; startIdx++) {
      let chainTotal = valid[startIdx].value;
      let chainIndices: number[] = [];
      for(let j=valid[startIdx].start; j<valid[startIdx].end; j++) chainIndices.push(j);
      
      let curr = valid[startIdx];
      for (let i = startIdx + 1; i < valid.length; i++) {
        const next = valid[i];
        if (next.start - curr.end <= 2) {
          const middle = tokens.slice(curr.end, next.start).map(t => t.norm);
          if (middle.length === 0 || middle.some(t => CONJUNCTIONS.has(t))) {
            chainTotal += next.value;
            for(let j=curr.end; j<next.end; j++) chainIndices.push(j);
            curr = next;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      if (chainTotal > bestChainTotal) {
        bestChainTotal = chainTotal;
        bestChainIndices = chainIndices;
      }
    }
    
    if (bestChainTotal > best.value) {
      amount = bestChainTotal;
      for (const idx of bestChainIndices) consumed[idx] = true;
      // Note: we might have consumed the middle tokens too!
      // Actually let's manually consume the middle tokens.
      let curr = valid.find(v => v.start === bestChainIndices[0])!;
      for (let i = valid.indexOf(curr) + 1; i < valid.length; i++) {
        const next = valid[i];
        if (bestChainIndices.includes(next.start)) {
          for(let j=curr.end; j<next.start; j++) consumed[j] = true;
          curr = next;
        }
      }
    } else {
      amount = best.value;
      for (let i = best.start; i < best.end; i += 1) consumed[i] = true;
    }

    // Consume preceding AMOUNT_CUE ("por", "vale", "son")
    const firstStart = bestChainTotal > best.value ? bestChainIndices[0] : best.start;
    if (firstStart > 0 && AMOUNT_CUES.has(tokens[firstStart - 1].norm)) {
      consumed[firstStart - 1] = true;
    }
  }`;

if (code.match(regex)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync(file, code);
  console.log('Math logic injected successfully');
} else {
  console.log('Regex match failed');
}
