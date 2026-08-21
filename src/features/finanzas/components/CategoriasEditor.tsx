import React, { useState } from 'react';
import { Check, Lock, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import type { Transaction } from '../types';
import {
  COLORES_CATEGORIA,
  ICONOS_CATEGORIA,
  iconoDeCategoria,
  sugerirIconoCategoria,
} from '../categorias';
import type { CategoriaPersonal } from '../categorias';
import { useCatalogo } from '../catalogoContexto';
import { tint } from '../types';

export interface CategoriasEditorProps {
  categorias: readonly CategoriaPersonal[];
  transacciones: readonly Transaction[];
  onCrear: (datos: Omit<CategoriaPersonal, 'id' | 'createdAt' | 'archivedAt'>) => void;
  onActualizar: (categoria: CategoriaPersonal) => void;
  onArchivar: (id: string) => void;
  onBorrar: (id: string) => void;
}

/** 16px minimum: anything smaller makes iOS zoom the page in on focus. */
const CAMPO =
  'w-full rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2.5 text-[17px] font-normal text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none';

const SelectorIcono: React.FC<{ valor: string; onCambiar: (v: string) => void }> = ({
  valor,
  onCambiar,
}) => (
  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Ícono">
    {ICONOS_CATEGORIA.map((nombre) => {
      const Icono = iconoDeCategoria(nombre);
      const activo = valor === nombre;
      return (
        <button
          key={nombre}
          type="button"
          role="radio"
          aria-checked={activo}
          aria-label={nombre}
          onClick={() => onCambiar(nombre)}
          className={`flex h-9 w-9 items-center justify-center rounded-[var(--fin-r-control)] border-2 transition-colors ${
            activo
              ? 'border-[var(--fin-ink)] text-[var(--fin-ink)]'
              : 'border-[var(--fin-line)] text-[var(--fin-ink-faint)] hover:text-[var(--fin-ink-soft)]'
          }`}
        >
          <Icono className="h-4 w-4" aria-hidden="true" />
        </button>
      );
    })}
  </div>
);

const SelectorColor: React.FC<{ valor: string; onCambiar: (v: string) => void }> = ({
  valor,
  onCambiar,
}) => (
  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Color">
    {COLORES_CATEGORIA.map((color) => {
      const activo = valor.toUpperCase() === color;
      return (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={activo}
          // The hex is the only thing distinguishing these buttons, so it is
          // also what a screen reader gets — a row of "botón" would be useless.
          aria-label={`Color ${color}`}
          onClick={() => onCambiar(color)}
          className={`h-9 w-9 rounded-[var(--fin-r-control)] border-2 transition-transform ${
            activo ? 'scale-110 border-[var(--fin-ink)]' : 'border-transparent'
          }`}
          style={{ backgroundColor: color }}
        >
          {activo ? <Check className="mx-auto h-4 w-4 text-white" strokeWidth={3} /> : null}
        </button>
      );
    })}
  </div>
);

const Formulario: React.FC<{
  inicial?: CategoriaPersonal;
  onGuardar: (datos: { nombre: string; icon: string; color: string }) => void;
  onCancelar: () => void;
}> = ({ inicial, onGuardar, onCancelar }) => {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [icon, setIcon] = useState(inicial?.icon ?? 'Package');
  const [color, setColor] = useState<string>(inicial?.color ?? COLORES_CATEGORIA[0]);
  // Al editar una categoría ya tiene ícono propio, así que no se le encima una
  // sugerencia por retocar el nombre. Al crear una, sí — hasta que la persona
  // toque el selector con la mano, momento en que la sugerencia se apaga.
  const [iconoManual, setIconoManual] = useState(inicial !== undefined);

  const listo = nombre.trim() !== '';

  const cambiarNombre = (valor: string) => {
    setNombre(valor);
    if (!iconoManual) setIcon(sugerirIconoCategoria(valor));
  };

  const cambiarIconoManual = (valor: string) => {
    setIconoManual(true);
    setIcon(valor);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!listo) return;
        onGuardar({ nombre: nombre.trim(), icon, color });
      }}
      className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4"
    >
      <label
        htmlFor="cat-nombre"
        className="block text-[15px] font-semibold text-[var(--fin-ink-soft)]"
      >
        Nombre
      </label>
      <input
        id="cat-nombre"
        value={nombre}
        onChange={(e) => cambiarNombre(e.target.value)}
        placeholder="Suscripciones"
        maxLength={28}
        autoFocus
        className={`mt-1.5 ${CAMPO}`}
      />

      <p className="mt-4 text-[15px] font-semibold text-[var(--fin-ink-soft)]">Ícono</p>
      <div className="mt-1.5">
        <SelectorIcono valor={icon} onCambiar={cambiarIconoManual} />
      </div>

      <p className="mt-4 text-[15px] font-semibold text-[var(--fin-ink-soft)]">Color</p>
      <div className="mt-1.5">
        <SelectorColor valor={color} onCambiar={setColor} />
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="submit"
          disabled={!listo}
          className="flex-1 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-3 text-[17px] font-semibold text-[var(--fin-on-accent)] disabled:opacity-30"
        >
          {inicial ? 'Guardar cambios' : 'Crear categoría'}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-[var(--fin-r-control)] border border-[var(--fin-line)] px-4 py-3 text-[17px] font-semibold text-[var(--fin-ink-soft)]"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
};

/**
 * Managing the categories the user invented.
 *
 * The built-in ones are listed but not editable, and that is deliberate: the
 * dictation parser and the bank-statement templates match against them by name,
 * so renaming "Comida" would quietly stop "almuerzo" from landing anywhere
 * sensible. They are shown anyway — a list that silently omitted them would
 * read as "these are all my categories", which is false.
 */
export const CategoriasEditor: React.FC<CategoriasEditorProps> = ({
  categorias,
  transacciones,
  onCrear,
  onActualizar,
  onArchivar,
  onBorrar,
}) => {
  const catalogo = useCatalogo();
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  // How many movements each category holds, which decides whether deleting it
  // is safe or whether archiving is the only option that keeps history honest.
  const usos = new Map<string, number>();
  for (const tx of transacciones) usos.set(tx.category, (usos.get(tx.category) ?? 0) + 1);

  const basicas = catalogo.todas.filter((c) => !c.propia);
  const propias = [...categorias].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return (
    <section>
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-[15px] font-semibold text-[var(--fin-ink-soft)]">Categorías</h2>
        {!creando && editando === null ? (
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="flex items-center gap-1.5 rounded-[var(--fin-r-control)] border border-[var(--fin-line)] px-3 py-2 text-[15px] font-semibold text-[var(--fin-ink)]"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
            Nueva
          </button>
        ) : null}
      </div>

      {creando ? (
        <div className="mt-2">
          <Formulario
            onGuardar={(datos) => {
              onCrear(datos);
              setCreando(false);
            }}
            onCancelar={() => setCreando(false)}
          />
        </div>
      ) : null}

      <ul className="mt-2 flex flex-col gap-2">
        {propias.map((cat) => {
          const enUso = usos.get(cat.id) ?? 0;
          const archivada = cat.archivedAt !== null;

          if (editando === cat.id) {
            return (
              <li key={cat.id}>
                <Formulario
                  inicial={cat}
                  onGuardar={(datos) => {
                    onActualizar({ ...cat, ...datos });
                    setEditando(null);
                  }}
                  onCancelar={() => setEditando(null)}
                />
              </li>
            );
          }

          const Icono = iconoDeCategoria(cat.icon);
          return (
            <li
              key={cat.id}
              className={`flex items-center gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] px-3 py-3 ${
                archivada ? 'opacity-55' : ''
              }`}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--fin-r-control)]"
                style={{ backgroundColor: tint(cat.color, 0.16), color: cat.color }}
              >
                <Icono className="h-4 w-4" aria-hidden="true" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[17px] font-semibold text-[var(--fin-ink)]">
                  {cat.nombre}
                </span>
                <span className="block text-[13px] text-[var(--fin-ink-faint)]">
                  {archivada ? 'Archivada · ' : ''}
                  {enUso === 0 ? 'sin movimientos' : `${enUso} movimiento${enUso === 1 ? '' : 's'}`}
                </span>
              </span>

              {archivada ? (
                <button
                  type="button"
                  onClick={() => onActualizar({ ...cat, archivedAt: null })}
                  aria-label={`Reactivar ${cat.nombre}`}
                  className="rounded-[var(--fin-r-control)] p-2 text-[var(--fin-ink-faint)] hover:text-[var(--fin-ink)]"
                >
                  <RotateCcw className="h-4 w-4" strokeWidth={2.5} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditando(cat.id)}
                  aria-label={`Editar ${cat.nombre}`}
                  className="rounded-[var(--fin-r-control)] p-2 text-[var(--fin-ink-faint)] hover:text-[var(--fin-ink)]"
                >
                  <Pencil className="h-4 w-4" strokeWidth={2.5} />
                </button>
              )}

              {/* Deleting is only offered when nothing points here. With
 movements attached the row has to survive, or last month's
 spending loses the only thing that explains it — so the
 action becomes "archive", which takes it out of the pickers
 and leaves the history intact. */}
              <button
                type="button"
                onClick={() => (enUso === 0 ? onBorrar(cat.id) : onArchivar(cat.id))}
                disabled={archivada && enUso > 0}
                aria-label={enUso === 0 ? `Eliminar ${cat.nombre}` : `Archivar ${cat.nombre}`}
                className="rounded-[var(--fin-r-control)] p-2 text-[var(--fin-ink-faint)] hover:text-[var(--fin-out)] disabled:opacity-30"
              >
                {enUso === 0 ? (
                  <Trash2 className="h-4 w-4" strokeWidth={2.5} />
                ) : (
                  <X className="h-4 w-4" strokeWidth={2.5} />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 px-1 text-[15px] font-semibold text-[var(--fin-ink-soft)]">
        Las que trae la app
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {basicas.map((cat) => (
          <li
            key={cat.clave}
            className="flex items-center gap-1.5 rounded-[var(--fin-r-pill)] border border-[var(--fin-line)] px-2.5 py-1.5 text-[13px] font-semibold text-[var(--fin-ink-soft)]"
          >
            <cat.Icono
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: cat.color }}
              aria-hidden="true"
            />
            {cat.nombre}
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-start gap-1.5 px-1 text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
        <Lock className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={3} aria-hidden="true" />
        Estas no se editan: el dictado y las plantillas de extracto las reconocen por su nombre.
      </p>
    </section>
  );
};
