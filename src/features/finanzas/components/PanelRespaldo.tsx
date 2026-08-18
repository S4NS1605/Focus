import React, { useRef, useState } from 'react';
import { AlertTriangle, Download, HardDriveDownload, Upload } from 'lucide-react';
import type { Instantanea } from '../data/repositorio';
import {
  aCsv,
  armarRespaldo,
  leerRespaldo,
  nombreDeArchivo,
  pesoAproximado,
  resumirRespaldo,
} from '../lib/respaldo';
import { descargarExcel } from '../lib/exportarExcel';

interface PanelRespaldoProps {
  datos: Instantanea;
  hoy: string;
  onRestaurar: (datos: Instantanea) => void;
}

const descargar = (contenido: string, nombre: string, tipo: string) => {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  // Sin esto el Blob queda retenido en memoria hasta que se cierre la pestaña.
  URL.revokeObjectURL(url);
};

/**
 * Sacar los datos y volverlos a meter.
 *
 * Restaurar REEMPLAZA todo, así que la pantalla dice qué trae el archivo antes
 * de tocar nada y pide una confirmación aparte. Nadie debería descubrir lo que
 * había dentro de un respaldo después de que ya reemplazó su contabilidad.
 */
export const PanelRespaldo: React.FC<PanelRespaldoProps> = ({ datos, hoy, onRestaurar }) => {
  const archivoRef = useRef<HTMLInputElement>(null);
  const [porRestaurar, setPorRestaurar] = useState<{ datos: Instantanea; resumen: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const nombreDeCuenta = (id: string | null) =>
    id === null ? '' : (datos.cajitas.find((c) => c.id === id)?.nombre ?? '');

  const json = JSON.stringify(armarRespaldo(datos, new Date().toISOString()), null, 2);

  const elegirArchivo = async (archivo: File) => {
    setError(null);
    setPorRestaurar(null);

    const leido = leerRespaldo(await archivo.text());
    if (!leido.ok || leido.respaldo === null) {
      setError(leido.error);
      return;
    }
    setPorRestaurar({ datos: leido.respaldo.datos, resumen: leido.resumen ?? '' });
  };

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="flex items-center gap-1.5 px-1 text-xs font-bold text-[var(--fin-ink-soft)]">
          <HardDriveDownload className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
          Tus datos
        </h2>
        <p className="mt-1 px-1 text-[11px] leading-relaxed text-[var(--fin-ink-faint)]">
          {resumirRespaldo(datos)} · {pesoAproximado(json)}
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-4">
        <button
          type="button"
          onClick={() => descargar(json, nombreDeArchivo(hoy), 'application/json')}
          className="flex items-center justify-center gap-2 rounded-xl bg-[var(--fin-accent)] px-4 py-3 text-sm font-bold text-[var(--fin-on-accent)]"
        >
          <Download className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
          Descargar respaldo completo
        </button>
        <p className="text-[10px] leading-relaxed text-[var(--fin-ink-faint)]">
          Un archivo con todo, que esta misma app puede volver a leer. Guárdalo donde no dependa
          de esta cuenta.
        </p>

        <button
          type="button"
          onClick={() => descargarExcel(datos, {}, hoy)}
          className="mt-1 flex items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-bold text-green-600 dark:text-green-400 hover:bg-green-500/20"
        >
          <Download className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          Exportar a Excel (.xls)
        </button>
        <p className="text-[10px] leading-relaxed text-[var(--fin-ink-faint)]">
          Incluye hojas separadas de movimientos formateados y saldos de cuentas para Excel y Google Sheets.
        </p>

        <button
          type="button"
          onClick={() => descargar(aCsv(datos, nombreDeCuenta), `movimientos-${hoy}.csv`, 'text/csv')}
          className="mt-1 flex items-center justify-center gap-2 rounded-xl border border-[var(--fin-line)] px-4 py-3 text-sm font-bold text-[var(--fin-ink)]"
        >
          <Download className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          Movimientos en CSV
        </button>
        <p className="text-[10px] leading-relaxed text-[var(--fin-ink-faint)]">
          Para abrirlos en cualquier hoja de cálculo o importar en otro software contable.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-4">
        <input
          ref={archivoRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            if (archivo) void elegirArchivo(archivo);
            // Se limpia para que elegir el MISMO archivo dos veces vuelva a
            // disparar el evento.
            e.target.value = '';
          }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => archivoRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--fin-line)] px-4 py-3 text-sm font-bold text-[var(--fin-ink)]"
        >
          <Upload className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          Restaurar desde un respaldo
        </button>

        {error !== null ? (
          <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-[var(--fin-out-bg)] px-3 py-2.5 text-[11px] leading-relaxed text-[var(--fin-out-ink)]">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden="true" />
            {error}
          </p>
        ) : null}

        {/* Qué trae, ANTES de reemplazar nada. Descubrirlo después sería tarde. */}
        {porRestaurar !== null ? (
          <div className="mt-3 rounded-xl bg-[var(--fin-warn-bg)] px-3.5 py-3">
            <p className="text-[11px] font-bold text-[var(--fin-warn-ink)]">
              Ese archivo trae {porRestaurar.resumen}.
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--fin-warn-ink)]">
              Restaurar REEMPLAZA todo lo que tienes ahora ({resumirRespaldo(datos)}). Esto no se
              puede deshacer — descarga un respaldo de lo actual si tienes dudas.
            </p>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onRestaurar(porRestaurar.datos);
                  setPorRestaurar(null);
                }}
                className="flex-1 rounded-full bg-[var(--fin-out)] px-4 py-2.5 text-xs font-bold text-white"
              >
                Sí, reemplazar todo
              </button>
              <button
                type="button"
                onClick={() => setPorRestaurar(null)}
                className="rounded-full border border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-2.5 text-xs font-bold text-[var(--fin-ink-soft)]"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};
