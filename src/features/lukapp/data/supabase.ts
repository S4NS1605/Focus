import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearFetchTolerante } from './fetchTolerante';

/**
 * These two DO carry the `VITE_` prefix, unlike ANALISTA_TOKEN.
 *
 * That is not an oversight and not a contradiction of the warning in
 * .env.example. The anon key is designed to be public: it identifies the
 * project, carries no privileges of its own, and every table it can reach is
 * gated by row level security enforced inside PostgreSQL. What must never
 * appear here is the SERVICE ROLE key, which bypasses RLS entirely — that one
 * belongs only in a server environment, never in a variable Vite inlines into
 * the browser bundle.
 */
const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

/**
 * Supabase renamed its public key: `anon` became "publishable" (`sb_publishable_…`),
 * and the dashboard now hands out `VITE_SUPABASE_PUBLISHABLE_KEY`. Both names are
 * accepted so this keeps working whichever the project was created under, with
 * the current name preferred.
 *
 * The other half of that rename is `service_role` → "secret" (`sb_secret_…`).
 * That one bypasses RLS entirely and must never reach a VITE_ variable, because
 * Vite inlines those into the public bundle.
 */
const ANON_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

export const supabaseConfigurado = (): boolean => Boolean(URL && ANON_KEY);

let cliente: SupabaseClient | null = null;

/**
 * Null until the project is configured, so the app can fall back to local-only
 * storage instead of crashing on a missing environment variable — the finance
 * tool has to keep working offline regardless of whether a backend exists yet.
 */
export const obtenerSupabase = (): SupabaseClient | null => {
  if (!supabaseConfigurado()) return null;
  if (!cliente) {
    cliente = createClient(URL!, ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      /**
       * Se envuelve aquí, en el único cliente del navegador, y no en cada
       * repositorio: el desfase de reloj rechaza por igual lecturas, escrituras
       * y RPC, así que el sitio donde se arregla una sola vez es el transporte.
       *
       * `fetch` se pasa dentro de una lambda porque arrancado del objeto global
       * pierde su `this` y algunos navegadores lo rechazan con `Illegal invocation`.
       */
      global: {
        fetch: crearFetchTolerante((entrada, init) => fetch(entrada, init)),
      },
    });
  }
  return cliente;
};
