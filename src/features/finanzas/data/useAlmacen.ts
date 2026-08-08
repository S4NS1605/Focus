import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Category, Transaction } from '../types';
import { bogotaDate } from '../lib/localDate';
import { nuevoId } from '../lib/id';
import { saldoDeCajita, ajusteHacia } from '../lib/cajitas';
import type { Cajita, CajitaMovimiento, CajitaMovKind, CajitaTipo, Meta } from './modelos';
import type { Instantanea, Repositorio } from './repositorio';
import { instantaneaVacia } from './repositorio';
import { crearRepositorio } from './crearRepositorio';

export interface Almacen {
  datos: Instantanea;
  cargando: boolean;
  /** False when storage is memory-only, so the UI can warn instead of lying. */
  persistente: boolean;
  error: string | null;
  descartarError: () => void;

  agregarTransaccion: (tx: Transaction) => Promise<void>;
  importarTransacciones: (txs: readonly Transaction[]) => Promise<void>;
  actualizarTransaccion: (tx: Transaction) => Promise<void>;
  borrarTransaccion: (id: string) => Promise<void>;

  crearCajita: (datos: {
    nombre: string;
    icon: string;
    tipo: CajitaTipo;
    metaCop: number | null;
    tasaEaPct: number | null;
    /** What is already in the pocket. Recorded as its opening movement. */
    saldoInicialCop: number;
  }) => Promise<void>;
  actualizarCajita: (cajita: Cajita) => Promise<void>;
  borrarCajita: (id: string) => Promise<void>;

  registrarMovimiento: (datos: {
    cajitaId: string;
    kind: CajitaMovKind;
    deltaCop: number;
    occurredOn?: string;
    nota?: string;
    categoria?: Category | null;
  }) => Promise<void>;
  /** "I have X in this pocket" — records the delta needed to reach X. */
  fijarSaldo: (cajitaId: string, saldoObjetivo: number, nota?: string) => Promise<void>;
  borrarMovimiento: (id: string) => Promise<void>;

  crearMeta: (datos: Omit<Meta, 'id' | 'createdAt' | 'completedAt'>) => Promise<void>;
  actualizarMeta: (meta: Meta) => Promise<void>;
  borrarMeta: (id: string) => Promise<void>;
}

const mensajeDeError = (e: unknown): string =>
  e instanceof Error ? e.message : 'No se pudo guardar el cambio.';

export const useAlmacen = (repositorioInyectado?: Repositorio): Almacen => {
  const elegido = useMemo(
    () =>
      repositorioInyectado
        ? { repositorio: repositorioInyectado, persistente: true }
        : crearRepositorio(),
    [repositorioInyectado],
  );

  const [datos, setDatos] = useState<Instantanea>(instantaneaVacia());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [persistente, setPersistente] = useState(elegido.persistente);

  // Held in a ref so the recovery path can re-read storage without every action
  // callback depending on the latest snapshot.
  const repo = elegido.repositorio;
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const cargado = await repo.cargarTodo();
        if (!cancelado) setDatos(cargado);
      } catch (e) {
        if (!cancelado) {
          setError(mensajeDeError(e));
          // Storage exists but would not open. The session still works; it just
          // will not survive a reload, and the banner has to say that.
          setPersistente(false);
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [repo]);

  /**
   * Applies a change to the screen first, then writes it.
   *
   * If the write fails the optimistic state is thrown away and storage is
   * re-read, so the UI can never end up showing a movement that was never
   * actually saved — the one outcome that would quietly corrupt a ledger.
   */
  const aplicar = useCallback(
    async (siguiente: Instantanea, escribir: () => Promise<void>) => {
      const anterior = datos;
      setDatos(siguiente);
      try {
        await escribir();
      } catch (e) {
        if (!montado.current) return;
        setError(mensajeDeError(e));
        try {
          setDatos(await repo.cargarTodo());
        } catch {
          setDatos(anterior);
        }
      }
    },
    [datos, repo],
  );

  const agregarTransaccion = useCallback(
    async (tx: Transaction) => {
      await aplicar({ ...datos, transacciones: [tx, ...datos.transacciones] }, () =>
        repo.guardarTransacciones([tx]),
      );
    },
    [aplicar, datos, repo],
  );

  const importarTransacciones = useCallback(
    async (txs: readonly Transaction[]) => {
      if (txs.length === 0) return;
      await aplicar({ ...datos, transacciones: [...txs, ...datos.transacciones] }, () =>
        repo.guardarTransacciones(txs),
      );
    },
    [aplicar, datos, repo],
  );

  const actualizarTransaccion = useCallback(
    async (tx: Transaction) => {
      await aplicar(
        {
          ...datos,
          transacciones: datos.transacciones.map((t) => (t.id === tx.id ? tx : t)),
        },
        () => repo.guardarTransacciones([tx]),
      );
    },
    [aplicar, datos, repo],
  );

  const borrarTransaccion = useCallback(
    async (id: string) => {
      await aplicar(
        { ...datos, transacciones: datos.transacciones.filter((t) => t.id !== id) },
        () => repo.borrarTransaccion(id),
      );
    },
    [aplicar, datos, repo],
  );

  const crearCajita = useCallback(
    async ({
      nombre,
      icon,
      tipo,
      metaCop,
      tasaEaPct,
      saldoInicialCop,
    }: {
      nombre: string;
      icon: string;
      tipo: CajitaTipo;
      metaCop: number | null;
      tasaEaPct: number | null;
      saldoInicialCop: number;
    }) => {
      const cajita: Cajita = {
        id: nuevoId('caj'),
        nombre,
        icon,
        tipo,
        metaCop,
        tasaEaPct,
        createdAt: new Date().toISOString(),
        archivedAt: null,
      };
      // An opening balance is a movement, not a stored field — the invariant is
      // that a balance is the sum of its movements, and this is what the yield
      // calculation walks to know since when the money has been earning.
      const apertura: CajitaMovimiento[] =
        saldoInicialCop > 0
          ? [
              {
                id: nuevoId('mov'),
                cajitaId: cajita.id,
                kind: 'deposito',
                deltaCop: saldoInicialCop,
                categoria: null,
                occurredOn: bogotaDate(),
                nota: 'Saldo inicial',
                createdAt: new Date().toISOString(),
              },
            ]
          : [];

      await aplicar(
        {
          ...datos,
          cajitas: [...datos.cajitas, cajita],
          cajitaMovimientos: [...datos.cajitaMovimientos, ...apertura],
        },
        async () => {
          await repo.guardarCajita(cajita);
          await repo.guardarCajitaMovimientos(apertura);
        },
      );
    },
    [aplicar, datos, repo],
  );

  const actualizarCajita = useCallback(
    async (cajita: Cajita) => {
      await aplicar(
        { ...datos, cajitas: datos.cajitas.map((c) => (c.id === cajita.id ? cajita : c)) },
        () => repo.guardarCajita(cajita),
      );
    },
    [aplicar, datos, repo],
  );

  const borrarCajita = useCallback(
    async (id: string) => {
      await aplicar(
        {
          ...datos,
          cajitas: datos.cajitas.filter((c) => c.id !== id),
          cajitaMovimientos: datos.cajitaMovimientos.filter((m) => m.cajitaId !== id),
          // Mirrors the repository's cascade: the goal survives, the link does not.
          metas: datos.metas.map((m) => (m.cajitaId === id ? { ...m, cajitaId: null } : m)),
        },
        () => repo.borrarCajita(id),
      );
    },
    [aplicar, datos, repo],
  );

  const registrarMovimiento = useCallback(
    async ({
      cajitaId,
      kind,
      deltaCop,
      occurredOn,
      nota,
      categoria,
    }: {
      cajitaId: string;
      kind: CajitaMovKind;
      deltaCop: number;
      occurredOn?: string;
      nota?: string;
      categoria?: Category | null;
    }) => {
      const movimiento: CajitaMovimiento = {
        id: nuevoId('mov'),
        cajitaId,
        kind,
        deltaCop,
        occurredOn: occurredOn ?? bogotaDate(),
        nota: nota ?? '',
        categoria: categoria ?? null,
        createdAt: new Date().toISOString(),
      };
      await aplicar(
        { ...datos, cajitaMovimientos: [...datos.cajitaMovimientos, movimiento] },
        () => repo.guardarCajitaMovimientos([movimiento]),
      );
    },
    [aplicar, datos, repo],
  );

  const fijarSaldo = useCallback(
    async (cajitaId: string, saldoObjetivo: number, nota?: string) => {
      // Measured against the EFFECTIVE balance — pocket movements plus anything
      // attributed to it. Against the raw sum, the adjustment would fight every
      // recorded transaction and the correction would never land where asked.
      const actual = saldoDeCajita(datos.cajitaMovimientos, cajitaId, datos.transacciones);
      const delta = ajusteHacia(actual, saldoObjetivo);
      // Nothing changed: recording a zero-delta row would clutter the history
      // with movements that say nothing happened.
      if (delta === 0) return;

      await registrarMovimiento({
        cajitaId,
        kind: 'ajuste',
        deltaCop: delta,
        nota: nota ?? 'Saldo actualizado',
      });
    },
    [datos.cajitaMovimientos, datos.transacciones, registrarMovimiento],
  );

  const borrarMovimiento = useCallback(
    async (id: string) => {
      await aplicar(
        { ...datos, cajitaMovimientos: datos.cajitaMovimientos.filter((m) => m.id !== id) },
        () => repo.borrarCajitaMovimiento(id),
      );
    },
    [aplicar, datos, repo],
  );

  const crearMeta = useCallback(
    async (entrada: Omit<Meta, 'id' | 'createdAt' | 'completedAt'>) => {
      const meta: Meta = {
        ...entrada,
        id: nuevoId('meta'),
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      await aplicar({ ...datos, metas: [...datos.metas, meta] }, () => repo.guardarMeta(meta));
    },
    [aplicar, datos, repo],
  );

  const actualizarMeta = useCallback(
    async (meta: Meta) => {
      await aplicar(
        { ...datos, metas: datos.metas.map((m) => (m.id === meta.id ? meta : m)) },
        () => repo.guardarMeta(meta),
      );
    },
    [aplicar, datos, repo],
  );

  const borrarMeta = useCallback(
    async (id: string) => {
      await aplicar({ ...datos, metas: datos.metas.filter((m) => m.id !== id) }, () =>
        repo.borrarMeta(id),
      );
    },
    [aplicar, datos, repo],
  );

  return {
    datos,
    cargando,
    persistente,
    error,
    descartarError: useCallback(() => setError(null), []),
    agregarTransaccion,
    importarTransacciones,
    actualizarTransaccion,
    borrarTransaccion,
    crearCajita,
    actualizarCajita,
    borrarCajita,
    registrarMovimiento,
    fijarSaldo,
    borrarMovimiento,
    crearMeta,
    actualizarMeta,
    borrarMeta,
  };
};
