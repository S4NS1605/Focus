import React from 'react';
import { ChevronDown, Search, Settings2 } from 'lucide-react';
import type { Transaction } from '../types';
import { formatCop } from '../lib/formatCop';
import { monthKeyLabel } from '../lib/localDate';
import { TransactionList } from './TransactionList';

interface InicioViewProps {
  /** El mes que se está mirando, en formato YYYY-MM. */
  month: string;
  onCambiarMes: () => void;
  onBuscar: () => void;
  onAjustes: () => void;
  /** Lo que hay en total: cuentas + ahorros − deudas. */
  patrimonioCop: number;
  /** Lo que salió y lo que entró este mes. */
  gastosCop: number;
  ingresosCop: number;
  /** Se llama al tocar cualquiera de las dos mitades de la pastilla. */
  onVerMes: () => void;
  movimientos: readonly Transaction[];
  conSenal?: ReadonlySet<string>;
  onAbrirMovimiento: (tx: Transaction) => void;
  /** Un aviso corto, solo si de verdad pasa algo (un tope pasado). */
  aviso?: { texto: string; onTocar: () => void } | null;
}

/**
 * La pantalla de inicio.
 *
 * Antes esto medía 4.192 píxeles de alto en una pantalla de 812: cinco
 * pantallas de scroll. Y arriba había DOS números gigantes peleándose —el
 * patrimonio y el balance del mes— uno encima del otro. Cuando hay dos cosas
 * gritando, no se oye ninguna.
 *
 * Ahora hay UN número, y todo lo demás está por debajo en tamaño para que se
 * note cuál manda. Lo que se quitó de aquí no se borró de la app: se movió a
 * "Mes" (las gráficas, los topes, las comparaciones) o a Ajustes. La diferencia
 * es que ahora lo que scrollea es el contenido de verdad —los movimientos— y no
 * la decoración que había encima de ellos.
 *
 * Y el vacío se queda vacío. Si solo hay un movimiento, el resto de la pantalla
 * no se rellena con tarjetas de ceros: se queda quieto.
 */
export const InicioView: React.FC<InicioViewProps> = ({
  month,
  onCambiarMes,
  onBuscar,
  onAjustes,
  patrimonioCop,
  gastosCop,
  ingresosCop,
  onVerMes,
  movimientos,
  conSenal,
  onAbrirMovimiento,
  aviso,
}) => (
  <div className="flex flex-col">
    {/* Arriba: el mes a la izquierda, dos botones a la derecha. Nada más. Antes
 el navegador de mes ocupaba una fila entera para él solo, con dos
 flechas de 36px, y encima se montaba dos veces (una se escondía con
 CSS). */}
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={onCambiarMes}
        className="flex items-center gap-1.5 rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-3.5 py-2 text-[15px] font-semibold capitalize text-[var(--fin-ink)]"
      >
        {monthKeyLabel(month)}
        <ChevronDown
          className="h-4 w-4 text-[var(--fin-ink-faint)]"
          strokeWidth={2.5}
          aria-hidden="true"
        />
      </button>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBuscar}
          aria-label="Buscar un movimiento"
          className="flex h-9 w-9 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]"
        >
          <Search className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onAjustes}
          aria-label="Ajustes"
          className="flex h-9 w-9 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]"
        >
          <Settings2 className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
    </div>

    {/* El número. Es el único texto de la app por encima de 28px, y por eso se
 entiende sin leer nada más que es lo importante. */}
    <p className="mt-6 text-center text-[13px] text-[var(--fin-ink-faint)]">Tienes en total</p>
    <button
      type="button"
      onClick={onVerMes}
      className="mt-1 text-center tabular-nums text-[var(--fin-ink)]"
      style={{ font: 'var(--fin-t-cifra)', letterSpacing: 'var(--fin-track-cifra)' }}
    >
      {formatCop(patrimonioCop)}
    </button>

    {/* Lo que salió y lo que entró, en un solo control de 44px. Esto reemplaza
 tres bloques que decían lo mismo: la tarjeta de estado del mes (295px),
 las cuatro tarjetas de indicadores (257px, que no tenían ni un dato que
 no estuviera ya arriba) y los dos desgloses por categoría (796px).
 El signo y el color dicen cuál es cuál, así que no hacen falta las
 palabras "Gastos" e "Ingresos". */}
    <div className="mt-4 flex justify-center">
      <div className="flex overflow-hidden rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]">
        <button
          type="button"
          onClick={onVerMes}
          className="px-4 py-2.5 text-[17px] font-semibold tabular-nums"
          style={{ color: 'var(--fin-out)' }}
        >
          ↓ {formatCop(gastosCop)}
        </button>
        <button
          type="button"
          onClick={onVerMes}
          className="border-l border-[var(--fin-line)] px-4 py-2.5 text-[17px] font-semibold tabular-nums"
          style={{ color: 'var(--fin-in)' }}
        >
          ↑ {formatCop(ingresosCop)}
        </button>
      </div>
    </div>

    {/* Casi siempre no hay nada aquí, y eso está bien. Solo aparece si de verdad
 pasó algo que merece interrumpir. */}
    {aviso ? (
      <button
        type="button"
        onClick={aviso.onTocar}
        className="mt-5 flex items-center gap-2.5 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] px-4 py-3 text-left"
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-[var(--fin-r-pill)] bg-[var(--fin-out)]"
          aria-hidden="true"
        />
        <span className="text-[15px] text-[var(--fin-ink)]">{aviso.texto}</span>
      </button>
    ) : null}

    {/* La lista: el mes completo, no las cinco últimas. Antes había que irse a
 otra sección para ver el sexto movimiento. */}
    <div className="mt-7">
      <TransactionList transactions={movimientos} conSenal={conSenal} onAbrir={onAbrirMovimiento} />
    </div>
  </div>
);
