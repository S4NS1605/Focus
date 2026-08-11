/// <reference types="node" />
// Reads source off disk, so Node types are referenced here rather than added to
// tsconfig.app.json — see pwa.test.ts for the same reasoning.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = process.cwd();

const archivos = (dir: string): string[] =>
  readdirSync(resolve(raiz, dir), { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith('.tsx') && !e.name.includes('.test.'))
    .map((e) => resolve(e.parentPath, e.name));

/** Tailwind's text scale, in pixels. */
const ESCALA: Record<string, number> = {
  'text-xs': 12,
  'text-sm': 14,
  'text-base': 16,
  'text-lg': 18,
  'text-xl': 20,
  'text-2xl': 24,
  'text-3xl': 30,
  'text-4xl': 36,
};

const tamanoDe = (clases: string): number | null => {
  for (const [clase, px] of Object.entries(ESCALA)) {
    if (new RegExp(`(^|[\\s\`'"])${clase}([\\s\`'"]|$)`).test(clases)) return px;
  }
  const arbitrario = clases.match(/text-\[(\d+(?:\.\d+)?)px\]/);
  return arbitrario ? Number(arbitrario[1]) : null;
};

/**
 * Every `<input|select|textarea …>` tag body in a file.
 *
 * Scanned by tracking brace and quote depth rather than matching to the first
 * `>`. JSX props routinely contain that character — `onChange={(e) => …}` alone
 * accounts for most fields here — and a lazy regex stops dead inside the arrow,
 * long before `className`. That silently emptied this check: 31 of the 34
 * fields in the app were being judged on the first two attributes only, so the
 * suite reported a clean sweep it had never actually performed.
 */
const camposDe = (fuente: string): string[] => {
  const cuerpos: string[] = [];

  for (const inicio of fuente.matchAll(/<(?:input|select|textarea)\b/g)) {
    const desde = inicio.index + inicio[0].length;
    let profundidad = 0;
    let comilla: string | null = null;

    for (let i = desde; i < fuente.length; i += 1) {
      const c = fuente[i];
      if (comilla !== null) {
        if (c === comilla) comilla = null;
      } else if (c === '"' || c === "'" || c === '`') {
        comilla = c;
      } else if (c === '{') {
        profundidad += 1;
      } else if (c === '}') {
        profundidad -= 1;
      } else if (c === '>' && profundidad === 0) {
        cuerpos.push(fuente.slice(desde, i));
        break;
      }
    }
  }

  return cuerpos;
};

const MINIMO_IOS = 16;

/**
 * Safari zooms the whole page in when a field smaller than 16px takes focus, and
 * in an installed app that zoom does not cleanly undo — the layout stays
 * enlarged and off-centre until the app is force-closed. It is the single most
 * common reason a web app "works in the browser but not once installed".
 *
 * Checked here rather than in CSS because CSS cannot express "raise this to 16
 * but leave anything larger alone": a rule specific enough to beat `text-xs`
 * also beats `text-3xl` and would shrink the amount fields.
 */
describe('campos táctiles', () => {
  const encontrados: { archivo: string; px: number; extracto: string }[] = [];

  for (const ruta of [...archivos('src/features/finanzas'), ...archivos('src/apps-dashboard')]) {
    const fuente = readFileSync(ruta, 'utf8');
    for (const cuerpo of camposDe(fuente)) {
      // `campo`-style shared class strings are resolved by looking at the file's
      // own constants, so a field is judged on what it actually renders with.
      const clases = cuerpo.includes('className={`') || cuerpo.includes('${campo}')
        ? `${cuerpo} ${fuente.match(/const campo =\s*'([^']*)'/)?.[1] ?? ''}`
        : cuerpo;

      const px = tamanoDe(clases);
      if (px !== null && px < MINIMO_IOS) {
        encontrados.push({
          archivo: ruta.replace(`${raiz}/`, ''),
          px,
          extracto: (cuerpo.match(/(?:id|aria-label)="([^"]+)"/)?.[1] ?? cuerpo.slice(0, 40)).trim(),
        });
      }
    }
  }

  it('ninguno baja de 16px, que es lo que dispara el zoom de iOS', () => {
    expect(encontrados).toEqual([]);
  });

  it('el barrido de verdad encuentra campos, no pasa por vacío', () => {
    // Sin esto el test anterior pasaría también si el regex dejara de casar.
    const total = [...archivos('src/features/finanzas'), ...archivos('src/apps-dashboard')]
      .flatMap((r) => camposDe(readFileSync(r, 'utf8')));
    expect(total.length).toBeGreaterThan(10);
  });
});
