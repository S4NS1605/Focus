import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category, Transaction, TxKind } from '../types';
import type { Cajita, CajitaMovimiento, CajitaMovKind, CajitaTipo, Meta } from './modelos';
import type { CategoriaPersonal } from '../categorias';
import type { Contacto } from '../lib/contactos';
import type { Instantanea, Repositorio } from './repositorio';
import { ES_PASIVO } from './modelos';

/**
 * Reads the stored kind back, checked against the real set.
 *
 * This was `fila.tipo === 'cuenta' ? 'cuenta' : 'cajita'` — written when only
 * those two existed, and never revisited when debts and cards were added. The
 * row saved correctly as 'tarjeta' and came back as 'cajita', so a credit card
 * created under Deudas silently appeared under Ahorro instead. Widening a set
 * without revisiting the code that narrows it is exactly how that happens, so
 * this now derives from the set itself and cannot fall behind it again.
 */
const aTipo = (valor: string | null): CajitaTipo =>
  valor !== null && valor in ES_PASIVO ? (valor as CajitaTipo) : 'cajita';

/**
 * Postgres-backed storage, one account per user.
 *
 * `user_id` is stamped on every write here rather than left to a database
 * default, because RLS rejects a row whose user_id is not the caller's — the
 * policy's `with check` is what makes an omitted column a hard error instead of
 * a silently mis-owned row.
 */
export class RepositorioSupabase implements Repositorio {
  // Declared and assigned explicitly rather than as constructor parameter
  // properties: `erasableSyntaxOnly` is on in tsconfig.app.json, which rules out
  // any TypeScript syntax that emits runtime code — the same reason this project
  // has no enums.
  private readonly cliente: SupabaseClient;
  private readonly userId: string;

  constructor(cliente: SupabaseClient, userId: string) {
    this.cliente = cliente;
    this.userId = userId;
  }

  private fallar(contexto: string, error: { message: string } | null): void {
    if (!error) return;

    // Constraint names are the schema's vocabulary, not the user's. Postgres
    // reports the rule that failed; this says what to do about it.
    if (error.message.includes('amount_cop_check')) {
      throw new Error('El monto debe ser mayor que cero.');
    }
    if (error.message.includes('objetivo_cop_check')) {
      throw new Error('El objetivo de la meta debe ser mayor que cero.');
    }
    if (error.message.includes('_kind_check') || error.message.includes('_rol_check')) {
      throw new Error('Ese valor no es uno de los permitidos.');
    }
    if (error.message.includes('violates row-level security')) {
      throw new Error('Tu sesión no tiene permiso para este cambio. Vuelve a entrar.');
    }
    if (error.message.includes('duplicate key')) {
      throw new Error('Ese registro ya existe.');
    }

    // PostgREST reports an unmigrated database as a missing table in its schema
    // cache. Raw, that reads like a bug in the app; it is almost always the
    // migration simply not having been run yet, so say that instead.
    if (error.message.includes('schema cache')) {
      throw new Error(
        'La base de datos está vacía: falta correr la migración de supabase/migrations/0001_finanzas.sql en el SQL Editor de Supabase.',
      );
    }

    throw new Error(`${contexto}: ${error.message}`);
  }

  async cargarTodo(): Promise<Instantanea> {
    const [transacciones, cajitas, movimientos, metas, categorias, contactos] = await Promise.all([
      this.cliente.from('transacciones').select('*').eq('user_id', this.userId),
      this.cliente.from('cajitas').select('*').eq('user_id', this.userId),
      this.cliente.from('cajita_movimientos').select('*').eq('user_id', this.userId),
      this.cliente.from('metas').select('*').eq('user_id', this.userId),
      this.cliente.from('categorias').select('*').eq('user_id', this.userId),
      this.cliente.from('contactos').select('*').eq('user_id', this.userId),
    ]);

    this.fallar('No se pudieron leer los movimientos', transacciones.error);
    this.fallar('No se pudieron leer las cajitas', cajitas.error);
    this.fallar('No se pudo leer el historial de cajitas', movimientos.error);
    this.fallar('No se pudieron leer las metas', metas.error);
    this.fallar('No se pudieron leer las categorías', categorias.error);
    this.fallar('No se pudieron leer los contactos', contactos.error);

    return {
      transacciones: (transacciones.data ?? []).map(aTransaccion),
      cajitas: (cajitas.data ?? []).map(aCajita),
      cajitaMovimientos: (movimientos.data ?? []).map(aMovimiento),
      metas: (metas.data ?? []).map(aMeta),
      categorias: (categorias.data ?? []).map(aCategoria),
      contactos: (contactos.data ?? []).map(aContacto),
    };
  }

  async guardarTransacciones(transacciones: readonly Transaction[]): Promise<void> {
    if (transacciones.length === 0) return;
    const { error } = await this.cliente
      .from('transacciones')
      .upsert(transacciones.map((t) => desdeTransaccion(t, this.userId)));
    this.fallar('No se pudo guardar el movimiento', error);
  }

  async borrarTransaccion(id: string): Promise<void> {
    const { error } = await this.cliente.from('transacciones').delete().eq('id', id);
    this.fallar('No se pudo eliminar el movimiento', error);
  }

  async guardarCajita(cajita: Cajita): Promise<void> {
    const { error } = await this.cliente
      .from('cajitas')
      .upsert(desdeCajita(cajita, this.userId));
    this.fallar('No se pudo guardar la cajita', error);
  }

  async borrarCajita(id: string): Promise<void> {
    // No manual cascade: the schema declares `on delete cascade` for movements
    // and `on delete set null` for goals, so one statement leaves the database
    // in exactly the state the local implementation produces.
    const { error } = await this.cliente.from('cajitas').delete().eq('id', id);
    this.fallar('No se pudo eliminar la cajita', error);
  }

  async guardarCajitaMovimientos(movimientos: readonly CajitaMovimiento[]): Promise<void> {
    if (movimientos.length === 0) return;
    const { error } = await this.cliente
      .from('cajita_movimientos')
      .upsert(movimientos.map((m) => desdeMovimiento(m, this.userId)));
    this.fallar('No se pudo guardar el movimiento de la cajita', error);
  }

  async borrarCajitaMovimiento(id: string): Promise<void> {
    const { error } = await this.cliente.from('cajita_movimientos').delete().eq('id', id);
    this.fallar('No se pudo eliminar el movimiento de la cajita', error);
  }

  async guardarMeta(meta: Meta): Promise<void> {
    const { error } = await this.cliente.from('metas').upsert(desdeMeta(meta, this.userId));
    this.fallar('No se pudo guardar la meta', error);
  }

  async borrarMeta(id: string): Promise<void> {
    const { error } = await this.cliente.from('metas').delete().eq('id', id);
    this.fallar('No se pudo eliminar la meta', error);
  }

  async guardarCategoria(categoria: CategoriaPersonal): Promise<void> {
    const { error } = await this.cliente
      .from('categorias')
      .upsert(desdeCategoria(categoria, this.userId));
    this.fallar('No se pudo guardar la categoría', error);
  }

  async guardarContacto(contacto: Contacto): Promise<void> {
    const { error } = await this.cliente
      .from('contactos')
      .upsert(desdeContacto(contacto, this.userId));
    this.fallar('No se pudo guardar el contacto', error);
  }

  async borrarContacto(id: string): Promise<void> {
    const { error } = await this.cliente.from('contactos').delete().eq('id', id);
    this.fallar('No se pudo eliminar el contacto', error);
  }

  async borrarCategoria(id: string): Promise<void> {
    // Movements keep their category key — see RepositorioMemoria.
    const { error } = await this.cliente.from('categorias').delete().eq('id', id);
    this.fallar('No se pudo eliminar la categoría', error);
  }

  async vaciar(): Promise<void> {
    // Pockets last: deleting them cascades into their movements, so removing
    // movements first is redundant but keeps the intent explicit if the schema
    // ever loses that cascade.
    for (const tabla of ['transacciones', 'metas', 'cajita_movimientos', 'cajitas', 'categorias', 'contactos']) {
      const { error } = await this.cliente.from(tabla).delete().eq('user_id', this.userId);
      this.fallar(`No se pudo vaciar ${tabla}`, error);
    }
  }
}

// ------------------------------------------------------------------ mapeadores
// snake_case in Postgres, camelCase in TypeScript. Kept as plain functions so
// the shape of every column crossing the boundary is visible in one place.

interface FilaTransaccion {
  id: string;
  kind: string;
  amount_cop: number;
  category: string;
  description: string;
  occurred_on: string;
  cuenta_id: string | null;
  raw_transcript: string;
  created_at: string;
}

const aTransaccion = (fila: FilaTransaccion): Transaction => ({
  id: fila.id,
  kind: fila.kind as TxKind,
  amountCop: Number(fila.amount_cop),
  category: fila.category as Category,
  description: fila.description,
  occurredOn: fila.occurred_on,
  cuentaId: fila.cuenta_id,
  rawTranscript: fila.raw_transcript,
  createdAt: fila.created_at,
});

const desdeTransaccion = (tx: Transaction, userId: string) => ({
  id: tx.id,
  user_id: userId,
  kind: tx.kind,
  amount_cop: tx.amountCop,
  category: tx.category,
  description: tx.description,
  occurred_on: tx.occurredOn,
  cuenta_id: tx.cuentaId,
  raw_transcript: tx.rawTranscript,
  created_at: tx.createdAt,
});

interface FilaCajita {
  id: string;
  nombre: string;
  emoji: string;
  tipo: string | null;
  meta_cop: number | null;
  tasa_ea_pct: number | null;
  created_at: string;
  archived_at: string | null;
}

const aCajita = (fila: FilaCajita): Cajita => ({
  id: fila.id,
  nombre: fila.nombre,
  icon: fila.emoji,
  tipo: aTipo(fila.tipo),
  metaCop: fila.meta_cop === null ? null : Number(fila.meta_cop),
  tasaEaPct: fila.tasa_ea_pct === null ? null : Number(fila.tasa_ea_pct),
  createdAt: fila.created_at,
  archivedAt: fila.archived_at,
});

const desdeCajita = (c: Cajita, userId: string) => ({
  id: c.id,
  user_id: userId,
  nombre: c.nombre,
  emoji: c.icon,
  tipo: c.tipo,
  meta_cop: c.metaCop,
  tasa_ea_pct: c.tasaEaPct,
  created_at: c.createdAt,
  archived_at: c.archivedAt,
});

interface FilaMovimiento {
  id: string;
  cajita_id: string;
  kind: string;
  delta_cop: number;
  categoria: string | null;
  occurred_on: string;
  nota: string;
  created_at: string;
}

const aMovimiento = (fila: FilaMovimiento): CajitaMovimiento => ({
  id: fila.id,
  cajitaId: fila.cajita_id,
  kind: fila.kind as CajitaMovKind,
  deltaCop: Number(fila.delta_cop),
  categoria: (fila.categoria as Category | null) ?? null,
  occurredOn: fila.occurred_on,
  nota: fila.nota,
  createdAt: fila.created_at,
});

const desdeMovimiento = (m: CajitaMovimiento, userId: string) => ({
  id: m.id,
  user_id: userId,
  cajita_id: m.cajitaId,
  kind: m.kind,
  delta_cop: m.deltaCop,
  categoria: m.categoria,
  occurred_on: m.occurredOn,
  nota: m.nota,
  created_at: m.createdAt,
});

interface FilaMeta {
  id: string;
  nombre: string;
  emoji: string;
  objetivo_cop: number;
  fecha_objetivo: string | null;
  cajita_id: string | null;
  ahorrado_cop: number;
  created_at: string;
  completed_at: string | null;
}

const aMeta = (fila: FilaMeta): Meta => ({
  id: fila.id,
  nombre: fila.nombre,
  icon: fila.emoji,
  objetivoCop: Number(fila.objetivo_cop),
  fechaObjetivo: fila.fecha_objetivo,
  cajitaId: fila.cajita_id,
  ahorradoCop: Number(fila.ahorrado_cop),
  createdAt: fila.created_at,
  completedAt: fila.completed_at,
});

interface FilaContacto {
  id: string;
  nombre: string;
  alias: string[] | null;
  separado_de: string[] | null;
  created_at: string;
  archived_at: string | null;
}

const aContacto = (fila: FilaContacto): Contacto => ({
  id: fila.id,
  nombre: fila.nombre,
  alias: fila.alias ?? [],
  separadoDe: fila.separado_de ?? [],
  createdAt: fila.created_at,
  archivedAt: fila.archived_at,
});

const desdeContacto = (c: Contacto, userId: string) => ({
  id: c.id,
  user_id: userId,
  nombre: c.nombre,
  alias: c.alias,
  separado_de: c.separadoDe,
  created_at: c.createdAt,
  archived_at: c.archivedAt,
});

interface FilaCategoria {
  id: string;
  nombre: string;
  icon: string | null;
  color: string | null;
  created_at: string;
  archived_at: string | null;
}

const aCategoria = (fila: FilaCategoria): CategoriaPersonal => ({
  id: fila.id,
  nombre: fila.nombre,
  icon: fila.icon ?? 'Package',
  color: fila.color ?? '#A8A29E',
  createdAt: fila.created_at,
  archivedAt: fila.archived_at,
});

const desdeCategoria = (c: CategoriaPersonal, userId: string) => ({
  id: c.id,
  user_id: userId,
  nombre: c.nombre,
  icon: c.icon,
  color: c.color,
  created_at: c.createdAt,
  archived_at: c.archivedAt,
});

const desdeMeta = (m: Meta, userId: string) => ({
  id: m.id,
  user_id: userId,
  nombre: m.nombre,
  emoji: m.icon,
  objetivo_cop: m.objetivoCop,
  fecha_objetivo: m.fechaObjetivo,
  cajita_id: m.cajitaId,
  ahorrado_cop: m.ahorradoCop,
  created_at: m.createdAt,
  completed_at: m.completedAt,
});
