import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Category, Transaction } from '../types';
import { bogotaDate } from '../lib/localDate';
import { nuevoId } from '../lib/id';
import { nuevaClaveCategoria } from '../categorias';
import type { CategoriaPersonal } from '../categorias';
import type { Contacto } from '../lib/contactos';
import { normalizarNombre } from '../lib/contactos';
import { saldoDeCajita, ajusteHacia } from '../lib/cajitas';
import type { Cajita, CajitaMovimiento, CajitaMovKind, CajitaTipo, Meta } from './modelos';
import { ID_EFECTIVO, cuentaEfectivo } from './modelos';
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
  /**
   * Pays down a debt with money from a real account.
   *
   * One call, two movements, one write: the debt goes down and the account it
   * came out of goes down with it. Recorded as a pair rather than a ledger
   * expense because paying a debt is not new consumption — it moves money that
   * was already counted, and booking it as a gasto would inflate the month
   * every time a card gets paid.
   */
  abonarDeuda: (datos: {
    deudaId: string;
    cuentaId: string;
    montoCop: number;
    occurredOn?: string;
  }) => Promise<void>;
  /**
   * Moves money between two balances of your own.
   *
   * A pair of pocket movements, never a ledger entry: money leaving Nequi for a
   * savings pocket is not spending and its arrival is not income. Booked as
   * transactions it would inflate BOTH sides of the month and make the summary
   * report activity that never happened.
   */
  transferirEntreCuentas: (datos: {
    origenId: string;
    destinoId: string;
    montoCop: number;
    occurredOn?: string;
  }) => Promise<void>;
  /** "I have X in this pocket" — records the delta needed to reach X. */
  fijarSaldo: (cajitaId: string, saldoObjetivo: number, nota?: string) => Promise<void>;
  borrarMovimiento: (id: string) => Promise<void>;

  crearMeta: (datos: Omit<Meta, 'id' | 'createdAt' | 'completedAt'>) => Promise<void>;
  actualizarMeta: (meta: Meta) => Promise<void>;
  borrarMeta: (id: string) => Promise<void>;

  crearCategoria: (datos: Omit<CategoriaPersonal, 'id' | 'createdAt' | 'archivedAt'>) => Promise<void>;
  actualizarCategoria: (categoria: CategoriaPersonal) => Promise<void>;
  /** Archives it. The movements filed under it keep pointing here. */
  archivarCategoria: (id: string) => Promise<void>;
  /**
   * Removes the row outright. Only offered for a category nothing uses — with
   * movements attached, archiving is the only honest option, since the key
   * would otherwise survive with nothing left to explain it.
   */
  borrarCategoria: (id: string) => Promise<void>;

  /**
   * Says two spellings are one person. Idempotent, and merges whatever contacts
   * already held either name so answering twice cannot create a third row.
   */
  unirContactos: (a: string, b: string, nombre: string) => Promise<void>;
  /** Says they are NOT the same, so the question is never asked again. */
  separarContactos: (a: string, b: string, nombre: string) => Promise<void>;
  actualizarContacto: (contacto: Contacto) => Promise<void>;
  /** Undoes a merge: the spellings go back to standing on their own. */
  borrarContacto: (id: string) => Promise<void>;
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
        if (cancelado) return;

        // Cash is seeded rather than shipped as a synthetic entry, so it behaves
        // like every other account: it holds a balance, appears in Configuración,
        // and can be renamed or archived. Keyed by a fixed id, so this runs at
        // most once — and an archived one is never resurrected.
        if (!cargado.cajitas.some((c) => c.id === ID_EFECTIVO)) {
          const efectivo = cuentaEfectivo(new Date().toISOString());
          cargado.cajitas = [...cargado.cajitas, efectivo];
          // Written but not awaited into the render path: failing to persist the
          // default is not a reason to leave the user staring at a spinner.
          void repo.guardarCajita(efectivo).catch(() => {});
        }

        setDatos(cargado);
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

  const abonarDeuda = useCallback(
    async ({
      deudaId,
      cuentaId,
      montoCop,
      occurredOn,
    }: {
      deudaId: string;
      cuentaId: string;
      montoCop: number;
      occurredOn?: string;
    }) => {
      const monto = Math.abs(montoCop);
      if (monto === 0) return;

      const nombreDe = (id: string) => datos.cajitas.find((c) => c.id === id)?.nombre ?? '';
      const fecha = occurredOn ?? bogotaDate();
      const creado = new Date().toISOString();

      const base = { occurredOn: fecha, categoria: null, createdAt: creado };
      const enLaDeuda: CajitaMovimiento = {
        ...base,
        id: nuevoId('mov'),
        cajitaId: deudaId,
        kind: 'abono',
        deltaCop: -monto,
        nota: `Pagado desde ${nombreDe(cuentaId)}`.trim(),
      };
      const enLaCuenta: CajitaMovimiento = {
        ...base,
        id: nuevoId('mov'),
        cajitaId: cuentaId,
        kind: 'retiro',
        deltaCop: -monto,
        nota: `Abono a ${nombreDe(deudaId)}`.trim(),
      };

      const par = [enLaDeuda, enLaCuenta];
      await aplicar({ ...datos, cajitaMovimientos: [...datos.cajitaMovimientos, ...par] }, () =>
        repo.guardarCajitaMovimientos(par),
      );
    },
    [aplicar, datos, repo],
  );

  const transferirEntreCuentas = useCallback(
    async ({
      origenId,
      destinoId,
      montoCop,
      occurredOn,
    }: {
      origenId: string;
      destinoId: string;
      montoCop: number;
      occurredOn?: string;
    }) => {
      const monto = Math.abs(montoCop);
      // Moving money to itself is not a transfer; recording it would leave two
      // rows in the history that cancel out and explain nothing.
      if (monto === 0 || origenId === destinoId) return;

      const nombreDe = (id: string) => datos.cajitas.find((c) => c.id === id)?.nombre ?? '';
      const base = {
        occurredOn: occurredOn ?? bogotaDate(),
        categoria: null,
        createdAt: new Date().toISOString(),
      };

      const par: CajitaMovimiento[] = [
        {
          ...base,
          id: nuevoId('mov'),
          cajitaId: origenId,
          kind: 'retiro',
          deltaCop: -monto,
          nota: `Enviado a ${nombreDe(destinoId)}`.trim(),
        },
        {
          ...base,
          id: nuevoId('mov'),
          cajitaId: destinoId,
          kind: 'deposito',
          deltaCop: monto,
          nota: `Recibido de ${nombreDe(origenId)}`.trim(),
        },
      ];

      await aplicar({ ...datos, cajitaMovimientos: [...datos.cajitaMovimientos, ...par] }, () =>
        repo.guardarCajitaMovimientos(par),
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

  const crearCategoria = useCallback(
    async (entrada: Omit<CategoriaPersonal, 'id' | 'createdAt' | 'archivedAt'>) => {
      const categoria: CategoriaPersonal = {
        ...entrada,
        id: nuevaClaveCategoria(),
        createdAt: new Date().toISOString(),
        archivedAt: null,
      };
      await aplicar({ ...datos, categorias: [...datos.categorias, categoria] }, () =>
        repo.guardarCategoria(categoria),
      );
    },
    [aplicar, datos, repo],
  );

  const guardarCategoria = useCallback(
    async (categoria: CategoriaPersonal) => {
      await aplicar(
        {
          ...datos,
          categorias: datos.categorias.map((c) => (c.id === categoria.id ? categoria : c)),
        },
        () => repo.guardarCategoria(categoria),
      );
    },
    [aplicar, datos, repo],
  );

  const archivarCategoria = useCallback(
    async (id: string) => {
      const actual = datos.categorias.find((c) => c.id === id);
      if (!actual) return;
      await guardarCategoria({ ...actual, archivedAt: new Date().toISOString() });
    },
    [datos.categorias, guardarCategoria],
  );

  const borrarCategoria = useCallback(
    async (id: string) => {
      await aplicar({ ...datos, categorias: datos.categorias.filter((c) => c.id !== id) }, () =>
        repo.borrarCategoria(id),
      );
    },
    [aplicar, datos, repo],
  );

  const unirContactos = useCallback(
    async (a: string, b: string, nombre: string) => {
      const claveA = normalizarNombre(a);
      const claveB = normalizarNombre(b);
      if (claveA === '' || claveB === '' || claveA === claveB) return;

      // Any existing contact holding either name is absorbed, not left beside
      // the new one — otherwise the same person ends up split across two rows
      // by the very action meant to join them.
      const tocados = datos.contactos.filter(
        (c) => c.alias.includes(claveA) || c.alias.includes(claveB),
      );
      const resto = datos.contactos.filter((c) => !tocados.includes(c));

      const unido: Contacto = {
        id: tocados[0]?.id ?? nuevoId('contacto'),
        nombre,
        alias: [...new Set([claveA, claveB, ...tocados.flatMap((c) => c.alias)])],
        separadoDe: [...new Set(tocados.flatMap((c) => c.separadoDe))].filter(
          (n) => n !== claveA && n !== claveB,
        ),
        createdAt: tocados[0]?.createdAt ?? new Date().toISOString(),
        archivedAt: null,
      };

      await aplicar({ ...datos, contactos: [...resto, unido] }, async () => {
        await repo.guardarContacto(unido);
        for (const viejo of tocados.slice(1)) await repo.borrarContacto(viejo.id);
      });
    },
    [aplicar, datos, repo],
  );

  const separarContactos = useCallback(
    async (a: string, b: string, nombre: string) => {
      const claveA = normalizarNombre(a);
      const claveB = normalizarNombre(b);
      if (claveA === '' || claveB === '' || claveA === claveB) return;

      // Recorded on a contact for A. A rejection has to live somewhere durable,
      // and the contact row is the only thing that outlives a reload.
      const existente = datos.contactos.find((c) => c.alias.includes(claveA));
      const contacto: Contacto = existente
        ? { ...existente, separadoDe: [...new Set([...existente.separadoDe, claveB])] }
        : {
            id: nuevoId('contacto'),
            // The display spelling, never the normalized key: the key is a
            // join column, and showing it turns "Juan Carlos Perez" into
            // "juan carlos perez" on screen.
            nombre,
            alias: [claveA],
            separadoDe: [claveB],
            createdAt: new Date().toISOString(),
            archivedAt: null,
          };

      await aplicar(
        {
          ...datos,
          contactos: existente
            ? datos.contactos.map((c) => (c.id === contacto.id ? contacto : c))
            : [...datos.contactos, contacto],
        },
        () => repo.guardarContacto(contacto),
      );
    },
    [aplicar, datos, repo],
  );

  const borrarContacto = useCallback(
    async (id: string) => {
      await aplicar({ ...datos, contactos: datos.contactos.filter((c) => c.id !== id) }, () =>
        repo.borrarContacto(id),
      );
    },
    [aplicar, datos, repo],
  );

  const actualizarContacto = useCallback(
    async (contacto: Contacto) => {
      await aplicar(
        { ...datos, contactos: datos.contactos.map((c) => (c.id === contacto.id ? contacto : c)) },
        () => repo.guardarContacto(contacto),
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
    abonarDeuda,
    transferirEntreCuentas,
    fijarSaldo,
    borrarMovimiento,
    crearMeta,
    actualizarMeta,
    borrarMeta,
    crearCategoria,
    actualizarCategoria: guardarCategoria,
    archivarCategoria,
    borrarCategoria,
    unirContactos,
    separarContactos,
    actualizarContacto,
    borrarContacto,
  };
};
