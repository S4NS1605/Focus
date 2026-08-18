import React, { useMemo, useState } from 'react';
import { Users, Link2Off, Pencil, Check } from 'lucide-react';
import type { Transaction } from '../types';
import type { Contacto, Duda, ParteVista } from '../lib/contactos';
import { dudasDeUnion, partesDelLibro } from '../lib/contactos';
import { dayLabel } from '../lib/localDate';
import { DudaContacto } from './DudaContacto';
import { DetalleContacto } from './DetalleContacto';

interface ContactosViewProps {
  transacciones: readonly Transaction[];
  contactos: readonly Contacto[];
  onUnir: (a: string, b: string, nombre: string) => void;
  onSeparar: (a: string, b: string, nombre: string) => void;
  onRenombrar: (contacto: Contacto) => void;
  /** Undoes a merge: the spellings go back to being their own rows. */
  onDeshacer: (contactoId: string) => void;
  onApodar: (clave: string, nombre: string, apodo: string, quitar?: boolean) => void;
}

/** One row of the list: a merged contact, or a name still standing alone. */
interface Fila {
  clave: string;
  nombre: string;
  alias: string[];
  movimientos: number;
  ultimaFecha: string;
  /** The stored contact, when this row is a merge that can be undone. */
  contacto: Contacto | null;
}

const armarFilas = (partes: readonly ParteVista[], contactos: readonly Contacto[]): Fila[] => {
  const porAlias = new Map<string, Contacto>();
  for (const c of contactos) {
    if (c.archivedAt !== null) continue;
    for (const alias of c.alias) porAlias.set(alias, c);
  }

  // Grouped by contact where one exists, and left alone where none does: the
  // list is the ledger's own counterparties, not a separate address book that
  // could drift away from them.
  const filas = new Map<string, Fila>();

  for (const parte of partes) {
    const contacto = porAlias.get(parte.clave) ?? null;
    const clave = contacto ? contacto.id : parte.clave;

    const previa = filas.get(clave);
    filas.set(clave, {
      clave,
      nombre: contacto ? contacto.nombre : parte.nombre,
      alias: [...(previa?.alias ?? []), parte.clave],
      movimientos: (previa?.movimientos ?? 0) + parte.movimientos,
      ultimaFecha:
        previa && previa.ultimaFecha > parte.ultimaFecha ? previa.ultimaFecha : parte.ultimaFecha,
      contacto,
    });
  }

  return [...filas.values()].sort((a, b) =>
    b.movimientos !== a.movimientos
      ? b.movimientos - a.movimientos
      : a.nombre.localeCompare(b.nombre, 'es'),
  );
};

export const ContactosView: React.FC<ContactosViewProps> = ({
  transacciones,
  contactos,
  onUnir,
  onSeparar,
  onRenombrar,
  onDeshacer,
  onApodar,
}) => {
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState('');
  // Se guarda la CLAVE, no la fila: la fila es un objeto derivado, y al añadir
  // un apodo la hoja abierta seguiría mostrando la versión de antes del cambio.
  const [claveAbierta, setClaveAbierta] = useState<string | null>(null);

  const partes = useMemo(() => partesDelLibro(transacciones), [transacciones]);
  const filas = useMemo(
    () => armarFilas(partes, contactos),
    [partes, contactos],
  );
  const dudas = useMemo(() => dudasDeUnion(partes, contactos), [partes, contactos]);

  // También por alias: poner el primer apodo CREA el contacto, y con eso la
  // fila pasa a llavearse por su id. Buscando solo por clave, la hoja abierta
  // se cerraría sola justo al usarla.
  const abierta =
    claveAbierta === null
      ? null
      : (filas.find((f) => f.clave === claveAbierta || f.alias.includes(claveAbierta)) ?? null);

  const responder = (duda: Duda, unir: boolean) => {
    if (unir) onUnir(duda.a.clave, duda.b.clave, duda.a.nombre);
    else onSeparar(duda.a.clave, duda.b.clave, duda.a.nombre);
  };

  return (
    // Mismo criterio que CajitasView: el resumen se queda angosto, la lista
    // de contactos usa una grilla ancha en vez de una sola columna larga.
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <div className="mx-auto w-full max-w-3xl">
      <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5">
        <h2 className="flex items-center gap-1.5 text-xs font-bold text-[var(--fin-ink-soft)]">
          <Users className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
          Con quién mueves la plata
        </h2>
        <p className="mt-1 font-display text-4xl font-extrabold tabular-nums text-[var(--fin-ink)]">
          {filas.length}
        </p>
        <p className="mt-1 text-[11px] text-[var(--fin-ink-faint)]">
          Salen solos de tus movimientos. No hay nada que escribir.
        </p>

        <DudaContacto
          duda={dudas[0] ?? null}
          onUnir={(d) => responder(d, true)}
          onSeparar={(d) => responder(d, false)}
        />
      </section>

      {filas.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-[var(--fin-line)] px-6 py-10 text-center">
          <Users className="mx-auto h-9 w-9 text-[var(--fin-ink-ghost)]" strokeWidth={1.5} aria-hidden="true" />
          <p className="mt-3 text-sm font-bold text-[var(--fin-ink)]">Todavía no hay contactos.</p>
          <p className="mt-1 text-xs text-[var(--fin-ink-faint)]">
            Aparecen solos cuando un movimiento diga con quién fue — una transferencia, un
            pago por BRE-B, un extracto que subas.
          </p>
        </div>
      ) : null}
      </div>

      {filas.length > 0 ? (
        <ul className="grid grid-cols-1 items-start gap-2 lg:grid-cols-2 xl:grid-cols-3">
          {filas.map((fila) => (
            <li
              key={fila.clave}
              className="rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3"
            >
              {editando === fila.clave && fila.contacto ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const nombre = borrador.trim();
                    if (nombre !== '' && fila.contacto) {
                      onRenombrar({ ...fila.contacto, nombre });
                    }
                    setEditando(null);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    value={borrador}
                    onChange={(e) => setBorrador(e.target.value)}
                    aria-label={`Nombre de ${fila.nombre}`}
                    autoFocus
                    className="w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2 text-base font-medium text-[var(--fin-ink)] focus:outline-none"
                  />
                  <button
                    type="submit"
                    aria-label="Guardar nombre"
                    className="rounded-xl p-2 text-[var(--fin-ink-soft)]"
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-3">
                  {/* Toda la fila abre: "3 movimientos" no sirve para reconocer
                      a nadie, y el nombre solo tampoco. Hay que poder ver
                      cuáles fueron. */}
                  <button
                    type="button"
                    onClick={() => setClaveAbierta(fila.clave)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-bold text-[var(--fin-ink)]">
                      {fila.nombre}
                    </span>
                    <span className="block text-[11px] text-[var(--fin-ink-faint)]">
                      {fila.movimientos} movimiento{fila.movimientos === 1 ? '' : 's'} · último{' '}
                      {dayLabel(fila.ultimaFecha)}
                      {fila.alias.length > 1 ? ` · ${fila.alias.length} grafías` : ''}
                    </span>
                  </button>

                  {fila.contacto ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditando(fila.clave);
                          setBorrador(fila.nombre);
                        }}
                        aria-label={`Renombrar ${fila.nombre}`}
                        className="rounded-xl p-2 text-[var(--fin-ink-faint)] hover:text-[var(--fin-ink)]"
                      >
                        <Pencil className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                      {/* Undoing a merge is the reason this screen exists at all:
                          a wrong "sí" must not be permanent. */}
                      {fila.alias.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => fila.contacto && onDeshacer(fila.contacto.id)}
                          aria-label={`Deshacer la unión de ${fila.nombre}`}
                          className="rounded-xl p-2 text-[var(--fin-ink-faint)] hover:text-[var(--fin-out)]"
                        >
                          <Link2Off className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {abierta !== null ? (
        <DetalleContacto
          nombre={abierta.nombre}
          alias={abierta.alias}
          apodos={abierta.contacto?.apodos ?? []}
          onAgregarApodo={(apodo) => onApodar(abierta.alias[0], abierta.nombre, apodo)}
          onQuitarApodo={(apodo) => onApodar(abierta.alias[0], abierta.nombre, apodo, true)}
          transacciones={transacciones}
          onCerrar={() => setClaveAbierta(null)}
        />
      ) : null}
    </div>
  );
};
