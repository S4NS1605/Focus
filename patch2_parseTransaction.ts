import fs from 'fs';

let content = fs.readFileSync('src/features/finanzas/lib/parseTransaction.ts', 'utf8');

const targetBlock = `  // 5 — Description. Category keywords are deliberately KEPT: for a merchant
  // that text is the most useful thing on the row.
  const words = available()
    .filter((t) => !STOPWORDS.has(t.norm))
    .map((t) => MERCHANT_DISPLAY[t.norm] ?? t.raw);

  let description = words.join(' ').trim();
  if (description === '') {
    // El respaldo solo aplica a las de fábrica; una categoría del usuario deja
    // su nombre en los tokens (no se consumen), así que aquí nunca cae vacía.
    description = CATEGORY_LABELS[category as Category] ?? '';
  } else {
    description = description.charAt(0).toUpperCase() + description.slice(1);
  }

  // 6 — Confidence. Drives PRESENTATION only: the confirm sheet always opens,
  // and this decides which field gets highlighted and focused.
  let confidence = 0;
  if (amount !== null) confidence += WEIGHTS.amount;
  if (kindSource === 'keyword' || kindSource === 'morphology') confidence += WEIGHTS.kindKeyword;
  else if (kindSource === 'category-implied') confidence += WEIGHTS.kindImplied;
  if (categorySource === 'usuario') confidence += WEIGHTS.userCategory;
  else if (categorySource === 'merchant') confidence += WEIGHTS.merchant;
  else if (categorySource === 'aprendida') confidence += WEIGHTS.learned;
  else if (categorySource === 'keyword') confidence += WEIGHTS.categoryKeyword;

  const ambiguousAmount = candidates.length > 1;
  if (ambiguousAmount) confidence -= WEIGHTS.ambiguityPenalty;
  confidence = Math.max(0, Math.min(1, Number(confidence.toFixed(2))));

  const confianzaGranular = calcularConfianzaGranular(
    amount,
    kindSource !== 'default',
    categorySource,
    cuentaId !== null,
    detectPaymentMethod(tokens) !== 'desconocido',
  );

  return {
    kind,
    amount,
    category,
    cuentaId,
    description,
    raw,
    confidence,
    confianzaGranular,
    needsReview: amount === null || kindSource === 'default' || confidence < REVIEW_THRESHOLD,
    signals: {
      amountSource: best ? classifyAmountSource(best) : 'none',
      kindSource,
      categorySource,
      cuentaSource,
      paymentMethod: detectPaymentMethod(tokens),
      recurringPattern: detectarRecurrencia(raw).patrón,
      ambiguousAmount,
    },
  };`;

const newBlock = `  let destinatario: string | null = null;
  let ubicacion: string | null = null;
  const tags: string[] = [];

  const avail = available();
  for (let i = 0; i < avail.length; i++) {
    const t = avail[i];
    if ((t.norm === 'a' || t.norm === 'para') && i + 1 < avail.length) {
      const name = avail[i + 1].raw;
      destinatario = name.charAt(0).toUpperCase() + name.slice(1);
    }
    if (t.norm === 'en' && i + 1 < avail.length) {
      const loc = avail[i + 1].raw;
      ubicacion = loc.charAt(0).toUpperCase() + loc.slice(1);
    }
    if (['viaje', 'regalo', 'emergencia', 'salud', 'vacaciones', 'fiesta', 'prestamo', 'comida', 'transporte'].includes(t.norm)) {
      if (!tags.includes(t.raw)) tags.push(t.raw);
    }
  }

  // 5 — Description. Category keywords are deliberately KEPT: for a merchant
  // that text is the most useful thing on the row.
  const words = available()
    .filter((t) => !STOPWORDS.has(t.norm))
    .map((t) => MERCHANT_DISPLAY[t.norm] ?? t.raw);

  let description = words.join(' ').trim();
  if (description === '') {
    description = CATEGORY_LABELS[category as Category] ?? category;
  } else {
    description = description.charAt(0).toUpperCase() + description.slice(1);
  }

  const timeMatch = raw.match(/\\b([01]?[0-9]|2[0-3]):([0-5][0-9])\\b/);
  if (timeMatch && !description.includes(timeMatch[0])) {
    description += \` (\${timeMatch[0]})\`;
  }

  // 6 — Confidence. Drives PRESENTATION only: the confirm sheet always opens,
  // and this decides which field gets highlighted and focused.
  let confidence = 0;
  if (amount !== null) confidence += WEIGHTS.amount;
  if (kindSource === 'keyword' || kindSource === 'morphology') confidence += WEIGHTS.kindKeyword;
  else if (kindSource === 'category-implied') confidence += WEIGHTS.kindImplied;
  if (categorySource === 'usuario') confidence += WEIGHTS.userCategory;
  else if (categorySource === 'merchant') confidence += WEIGHTS.merchant;
  else if (categorySource === 'aprendida') confidence += WEIGHTS.learned;
  else if (categorySource === 'keyword') confidence += WEIGHTS.categoryKeyword;

  const ambiguousAmount = candidates.length > 1;
  if (ambiguousAmount) confidence -= WEIGHTS.ambiguityPenalty;
  confidence = Math.max(0, Math.min(1, Number(confidence.toFixed(2))));

  const confianzaGranular = calcularConfianzaGranular(
    amount,
    kindSource !== 'default',
    categorySource,
    cuentaId !== null,
    detectPaymentMethod(tokens) !== 'desconocido',
  );

  const suggestedCategories = [
    category,
    ...sortedCandidates.filter(c => c[0] !== category).map(c => c[0]),
    'otros', 'comida', 'transporte'
  ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 3);

  return {
    kind,
    amount,
    category,
    suggestedCategories,
    cuentaId,
    description,
    raw,
    confidence,
    confianzaGranular,
    needsReview: amount === null || kindSource === 'default' || confidence < REVIEW_THRESHOLD,
    signals: {
      amountSource: best ? classifyAmountSource(best) : 'none',
      kindSource,
      categorySource,
      cuentaSource,
      paymentMethod: detectPaymentMethod(tokens),
      recurringPattern: detectarRecurrencia(raw).patrón,
      ambiguousAmount,
      destinatario,
      ubicacion,
      tags,
    },
  };`;

content = content.replace(targetBlock, newBlock);
fs.writeFileSync('src/features/finanzas/lib/parseTransaction.ts', content);
