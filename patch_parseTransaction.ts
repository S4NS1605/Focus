import fs from 'fs';

let content = fs.readFileSync('src/features/finanzas/lib/parseTransaction.ts', 'utf8');

content = content.replace(
  "ambiguousAmount: boolean;\n  };\n}",
  `ambiguousAmount: boolean;
    destinatario: string | null;
    ubicacion: string | null;
    tags: string[];
  };
  suggestedCategories: CategoriaClave[];
}`
);

content = content.replace(
  "ambiguousAmount: false,\n  },\n});",
  `ambiguousAmount: false,
    destinatario: null,
    ubicacion: null,
    tags: [],
  },
  suggestedCategories: ['otros', 'comida', 'transporte'],
});`
);

content = content.replace(
  "let category: CategoriaClave = 'otros';\n  let categorySource: CategorySource = 'default';",
  `let category: CategoriaClave = 'otros';
  let categorySource: CategorySource = 'default';
  const categoryCandidates: Map<string, { source: CategorySource; score: number }> = new Map();

  const addCategoryScore = (cat: string, source: CategorySource, score: number) => {
    const existing = categoryCandidates.get(cat);
    if (!existing || existing.score < score) {
      categoryCandidates.set(cat, { source, score });
    }
  };`
);

// We need to rewrite the category assignment logic
// Find the block from "const frasesCat" up to "if (categorySource === 'default' && kind === 'ingreso') category = 'ingreso';"

fs.writeFileSync('src/features/finanzas/lib/parseTransaction.ts', content);
