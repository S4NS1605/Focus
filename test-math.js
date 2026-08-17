const CONJUNCTIONS = new Set(['y', 'e', 'mas', 'más', 'con', 'propina', 'de']);
// Mock tokens
const tokens = ['20', 'mil', 'y', '3', 'mil'].map((t, i) => ({ norm: t, index: i }));

// mock valid
const valid = [
  { value: 20000, start: 0, end: 2 },
  { value: 3000, start: 3, end: 5 }
];

let total = valid[0].value;
let consumed = [];
for(let i=valid[0].start; i<valid[0].end; i++) consumed.push(i);

let current = valid[0];
for(let i=1; i<valid.length; i++) {
  const next = valid[i];
  if (next.start - current.end <= 2) {
    const middle = tokens.slice(current.end, next.start).map(t => t.norm);
    if (middle.length === 0 || middle.some(t => CONJUNCTIONS.has(t))) {
      total += next.value;
      for(let j=current.end; j<next.end; j++) consumed.push(j);
      current = next;
    }
  }
}

console.log({ total, consumed });
