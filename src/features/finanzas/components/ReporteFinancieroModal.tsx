import React from 'react';
import { Printer, X, FileSpreadsheet } from 'lucide-react';
import type { Instantanea } from '../data/repositorio';
import { formatCop } from '../lib/formatCop';
import { ES_PASIVO } from '../data/modelos';
import { descargarExcel } from '../lib/exportarExcel';

interface ReporteFinancieroModalProps {
  abierto: boolean;
  onCerrar: () => void;
  mes: string; // "2026-08"
  datos: Instantanea;
  cajitasBalances: Record<string, number>;
  emailUsuario?: string;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
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
  const ingresos = txMes.filter((t) => t.kind === 'ingreso').reduce((sum, t) => sum + t.amountCop, 0);
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
      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-[var(--fin-card)] shadow-2xl border border-[var(--fin-line)] print:border-none print:shadow-none print:bg-white">
        
        {/* Barra superior de acciones (Oculta al imprimir) */}
        <div className="flex items-center justify-between border-b border-[var(--fin-line)] bg-[var(--fin-bg-soft)] px-6 py-4 print:hidden">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500 font-bold text-sm">
              📄
            </span>
            <div>
              <h3 className="text-sm font-bold text-[var(--fin-ink)]">Informe Financiero Mensual</h3>
              <p className="text-xs text-[var(--fin-ink-soft)]">{nombreMes}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => descargarExcel(datos, cajitasBalances, mes)}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2 text-xs font-bold text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-soft)]"
            >
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
              Excel (.xls)
            </button>
            <button
              onClick={imprimir}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-500"
            >
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </button>
            <button
              onClick={onCerrar}
              className="rounded-xl p-2 text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]"
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
                <span className="text-2xl font-black tracking-tight text-blue-600">FOCUS</span>
                <span className="text-2xl font-light text-[var(--fin-ink-soft)] print:text-zinc-600">FINANZAS</span>
              </div>
              <p className="text-xs uppercase tracking-widest text-[var(--fin-ink-faint)] print:text-zinc-500 mt-1">
                Estado de Resultados y Balance Personal
              </p>
            </div>
            <div className="text-right">
              <p className="text-base font-bold text-[var(--fin-ink)] print:text-black">{nombreMes}</p>
              <p className="text-xs text-[var(--fin-ink-soft)] print:text-zinc-600">
                Usuario: {emailUsuario || 'Usuario Principal'}
              </p>
              <p className="text-[11px] text-[var(--fin-ink-faint)] print:text-zinc-400">
                Emitido el {new Date().toLocaleDateString('es-CO')}
              </p>
            </div>
          </div>

          {/* Tarjetas KPI */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6">
            <div className="rounded-2xl border border-[var(--fin-line)] print:border-zinc-300 p-4 bg-[var(--fin-bg-soft)] print:bg-zinc-50">
              <span className="text-xs text-zinc-500 font-medium">Ingresos Totales</span>
              <p className="text-lg font-bold text-green-600 mt-1">{formatCop(ingresos)}</p>
            </div>
            <div className="rounded-2xl border border-[var(--fin-line)] print:border-zinc-300 p-4 bg-[var(--fin-bg-soft)] print:bg-zinc-50">
              <span className="text-xs text-zinc-500 font-medium">Gastos Totales</span>
              <p className="text-lg font-bold text-red-600 mt-1">{formatCop(gastos)}</p>
            </div>
            <div className="rounded-2xl border border-[var(--fin-line)] print:border-zinc-300 p-4 bg-[var(--fin-bg-soft)] print:bg-zinc-50">
              <span className="text-xs text-zinc-500 font-medium">Balance Neto {ingresos > 0 ? `(${tasaAhorro}% ahorro)` : ''}</span>
              <p className={`text-lg font-bold mt-1 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCop(balance)}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--fin-line)] print:border-zinc-300 p-4 bg-[var(--fin-bg-soft)] print:bg-zinc-50">
              <span className="text-xs text-zinc-500 font-medium">Patrimonio en Cuentas</span>
              <p className="text-lg font-bold text-blue-600 mt-1">{formatCop(patrimonioTotal)}</p>
            </div>
          </div>

          {/* Dos Columnas: Desglose de Gastos & Cuentas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
            {/* Gastos por Categoría */}
            <div className="rounded-2xl border border-[var(--fin-line)] print:border-zinc-300 p-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--fin-ink-soft)] print:text-zinc-600 mb-4">
                Gastos por Categoría
              </h4>
              {categoriasOrdenadas.length === 0 ? (
                <p className="text-xs text-zinc-400 italic">Sin gastos registrados este mes.</p>
              ) : (
                <div className="space-y-3">
                  {categoriasOrdenadas.map(([cat, total]) => {
                    const pct = gastos > 0 ? Math.round((total / gastos) * 100) : 0;
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-xs font-medium mb-1">
                          <span className="capitalize">{cat}</span>
                          <span className="font-bold">{formatCop(total)} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 print:bg-zinc-200">
                          <div
                            className="h-1.5 rounded-full bg-red-500 print:bg-zinc-700"
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
            <div className="rounded-2xl border border-[var(--fin-line)] print:border-zinc-300 p-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--fin-ink-soft)] print:text-zinc-600 mb-4">
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
                        className="flex items-center justify-between border-b border-[var(--fin-line)] print:border-zinc-200 pb-2 text-xs"
                      >
                        <span className="font-medium">{c.nombre}</span>
                        <span className={`font-bold ${esPasivo ? 'text-red-500' : 'text-[var(--fin-ink)] print:text-black'}`}>
                          {formatCop(saldo)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Pie de página del informe */}
          <div className="border-t border-[var(--fin-line)] print:border-zinc-300 pt-4 text-center text-[10px] text-[var(--fin-ink-faint)] print:text-zinc-500">
            Informe generado de forma confidencial por Focus Finanzas · Los datos provienen del libro contable registrado por el usuario.
          </div>
        </div>
      </div>
    </div>
  );
};
