import React from 'react';
import { Printer, X, FileSpreadsheet, FileText } from 'lucide-react';
import type { Instantanea } from '../data/repositorio';
import { formatCop } from '../lib/formatCop';
import { ES_PASIVO } from '../data/modelos';
import { descargarExcel } from '../lib/exportarExcel';

/**
 * Ojo con los colores de aquí: esta pantalla NO usa los tokens del tema, y es a
 * propósito. Es un documento para imprimir o guardar en PDF, o sea que acaba
 * sobre papel blanco. Si usara `--fin-ink`, en tema oscuro saldría texto casi
 * blanco sobre papel blanco: una hoja en blanco.
 *
 * Es la única excepción de la app a la regla de "todo color pasa por un token".
 */
interface ReporteFinancieroModalProps {
  abierto: boolean;
  onCerrar: () => void;
  mes: string; // "2026-08"
  datos: Instantanea;
  cajitasBalances: Record<string, number>;
  emailUsuario?: string;
}

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const ReporteFinancieroModal: React.FC<ReporteFinancieroModalProps> = ({
  abierto,
  onCerrar,
  mes,
  datos,
  cajitasBalances,
  emailUsuario,
}) => {
  if (!abierto) return null;

  const [anoStr, mesStr] = mes.split('-');
  const nombreMes = `${MESES[parseInt(mesStr, 10) - 1]} de ${anoStr}`;

  const txMes = datos.transacciones.filter((t) => t.occurredOn.startsWith(mes));
  const ingresos = txMes
    .filter((t) => t.kind === 'ingreso')
    .reduce((sum, t) => sum + t.amountCop, 0);
  const gastos = txMes.filter((t) => t.kind === 'gasto').reduce((sum, t) => sum + t.amountCop, 0);
  const balance = ingresos - gastos;
  const tasaAhorro = ingresos > 0 ? Math.max(0, Math.round((balance / ingresos) * 100)) : 0;

  // Desglose por categorías
  const categoriasMap = new Map<string, number>();
  for (const tx of txMes.filter((t) => t.kind === 'gasto')) {
    categoriasMap.set(tx.category, (categoriasMap.get(tx.category) || 0) + tx.amountCop);
  }
  const categoriasOrdenadas = Array.from(categoriasMap.entries()).sort((a, b) => b[1] - a[1]);

  // Cuentas y saldo total
  const cuentasActivas = datos.cajitas.filter((c) => !c.archivedAt && !ES_PASIVO[c.tipo]);
  const patrimonioTotal = cuentasActivas.reduce((sum, c) => sum + (cajitasBalances[c.id] ?? 0), 0);

  const imprimir = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm print:static print:bg-white print:p-0">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-[var(--fin-r-card)] bg-[var(--fin-card)] shadow-2xl print:border-none print:shadow-none print:bg-white">
        {/* Barra superior de acciones (Oculta al imprimir) */}
        <div className="flex items-center justify-between border-b border-[var(--fin-line)] bg-[var(--fin-bg-soft)] px-6 py-4 print:hidden">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-[var(--fin-r-control)] bg-blue-500/15 text-blue-500">
              <FileText className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <div>
              <h3 className="text-[17px] font-semibold text-[var(--fin-ink)]">
                Informe Financiero Mensual
              </h3>
              <p className="text-[15px] text-[var(--fin-ink-soft)]">{nombreMes}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => descargarExcel(datos, cajitasBalances, mes)}
              className="flex items-center gap-1.5 rounded-[var(--fin-r-control)] bg-[var(--fin-card)] px-3 py-2 text-[15px] font-semibold text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-soft)]"
            >
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              Excel (.xls)
            </button>
            <button
              onClick={imprimir}
              className="flex items-center gap-1.5 rounded-[var(--fin-r-control)] bg-blue-600 px-3.5 py-2 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-500"
            >
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </button>
            <button
              onClick={onCerrar}
              className="rounded-[var(--fin-r-control)] p-2 text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Contenido Imprimible del Informe */}
        <div className="p-8 print:p-6 text-[var(--fin-ink)] print:text-black">
          {/* Encabezado formal */}
          <div className="flex items-start justify-between border-b-2 border-zinc-200 dark:border-zinc-800 pb-6 print:border-zinc-300">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[28px] font-semibold tracking-tight text-blue-600">
                  FOCUS
                </span>
                <span className="text-[28px] font-normal text-[var(--fin-ink-soft)] print:text-zinc-600">
                  FINANZAS
                </span>
              </div>
              <p className="text-[15px] uppercase tracking-widest text-[var(--fin-ink-faint)] print:text-zinc-500 mt-1">
                Estado de Resultados y Balance Personal
              </p>
            </div>
            <div className="text-right">
              <p className="text-[17px] font-semibold text-[var(--fin-ink)] print:text-black">
                {nombreMes}
              </p>
              <p className="text-[15px] text-[var(--fin-ink-soft)] print:text-zinc-600">
                Usuario: {emailUsuario || 'Usuario Principal'}
              </p>
              <p className="text-[13px] text-[var(--fin-ink-faint)] print:text-zinc-400">
                Emitido el {new Date().toLocaleDateString('es-CO')}
              </p>
            </div>
          </div>

          {/* Tarjetas KPI */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6">
            <div className="rounded-[var(--fin-r-card)] border border-[var(--fin-line)] print:border-zinc-300 p-4 bg-[var(--fin-bg-soft)] print:bg-zinc-50">
              <span className="text-[15px] text-zinc-500 font-normal">Ingresos Totales</span>
              <p className="text-[20px] font-semibold text-green-600 mt-1">{formatCop(ingresos)}</p>
            </div>
            <div className="rounded-[var(--fin-r-card)] border border-[var(--fin-line)] print:border-zinc-300 p-4 bg-[var(--fin-bg-soft)] print:bg-zinc-50">
              <span className="text-[15px] text-zinc-500 font-normal">Gastos Totales</span>
              <p className="text-[20px] font-semibold text-red-600 mt-1">{formatCop(gastos)}</p>
            </div>
            <div className="rounded-[var(--fin-r-card)] border border-[var(--fin-line)] print:border-zinc-300 p-4 bg-[var(--fin-bg-soft)] print:bg-zinc-50">
              <span className="text-[15px] text-zinc-500 font-normal">
                Balance Neto {ingresos > 0 ? `(${tasaAhorro}% ahorro)` : ''}
              </span>
              <p
                className={`text-[20px] font-semibold mt-1 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {formatCop(balance)}
              </p>
            </div>
            <div className="rounded-[var(--fin-r-card)] border border-[var(--fin-line)] print:border-zinc-300 p-4 bg-[var(--fin-bg-soft)] print:bg-zinc-50">
              <span className="text-[15px] text-zinc-500 font-normal">Patrimonio en Cuentas</span>
              <p className="text-[20px] font-semibold text-blue-600 mt-1">
                {formatCop(patrimonioTotal)}
              </p>
            </div>
          </div>

          {/* Dos Columnas: Desglose de Gastos & Cuentas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
            {/* Gastos por Categoría */}
            <div className="rounded-[var(--fin-r-card)] border border-[var(--fin-line)] print:border-zinc-300 p-5">
              <h4 className="text-[15px] font-semibold uppercase tracking-wider text-[var(--fin-ink-soft)] print:text-zinc-600 mb-4">
                Gastos por Categoría
              </h4>
              {categoriasOrdenadas.length === 0 ? (
                <p className="text-[15px] text-zinc-400 italic">Sin gastos registrados este mes.</p>
              ) : (
                <div className="space-y-3">
                  {categoriasOrdenadas.map(([cat, total]) => {
                    const pct = gastos > 0 ? Math.round((total / gastos) * 100) : 0;
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-[15px] font-normal mb-1">
                          <span className="capitalize">{cat}</span>
                          <span className="font-semibold">
                            {formatCop(total)} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-[var(--fin-r-pill)] bg-zinc-100 dark:bg-zinc-800 print:bg-zinc-200">
                          <div
                            className="h-1.5 rounded-[var(--fin-r-pill)] bg-red-500 print:bg-zinc-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Saldos en Cuentas */}
            <div className="rounded-[var(--fin-r-card)] border border-[var(--fin-line)] print:border-zinc-300 p-5">
              <h4 className="text-[15px] font-semibold uppercase tracking-wider text-[var(--fin-ink-soft)] print:text-zinc-600 mb-4">
                Cuentas y Saldos Actuales
              </h4>
              <div className="space-y-2.5">
                {datos.cajitas
                  .filter((c) => !c.archivedAt)
                  .map((c) => {
                    const saldo = cajitasBalances[c.id] ?? 0;
                    const esPasivo = ES_PASIVO[c.tipo];
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between border-b border-[var(--fin-line)] print:border-zinc-200 pb-2 text-[15px]"
                      >
                        <span className="font-normal">{c.nombre}</span>
                        <span
                          className={`font-semibold ${esPasivo ? 'text-red-500' : 'text-[var(--fin-ink)] print:text-black'}`}
                        >
                          {formatCop(saldo)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Pie de página del informe */}
          <div className="border-t border-[var(--fin-line)] print:border-zinc-300 pt-4 text-center text-[13px] text-[var(--fin-ink-faint)] print:text-zinc-500">
            Informe generado de forma confidencial por Focus Finanzas · Los datos provienen del
            libro contable registrado por el usuario.
          </div>
        </div>
      </div>
    </div>
  );
};
