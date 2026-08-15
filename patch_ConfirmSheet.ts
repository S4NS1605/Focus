import fs from 'fs';

let content = fs.readFileSync('src/features/finanzas/components/ConfirmSheet.tsx', 'utf8');

const targetBlock = `        {/* Category — emoji + hue makes 13 options scannable without reading */}
        <fieldset className="mt-5">
          <legend className="text-xs font-bold text-[var(--fin-ink-soft)]">{COPY.confirm.category}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {opciones.map((entrada) => {
              const option = entrada.clave;
              const active = category === option;
              const color = entrada.color;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCategory(option)}
                  aria-pressed={active}
                  className="flex items-center gap-1.5 rounded-full border-2 px-3 py-2 text-xs font-bold transition-colors"
                  style={{
                    backgroundColor: active ? tint(color, 0.16) : 'var(--fin-card)',
                    borderColor: active ? color : 'var(--fin-line)',
                    color: active ? 'var(--fin-ink)' : 'var(--fin-ink-soft)',
                  }}
                >
                  {(() => {
                    const Icon = entrada.Icono;
                    return <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />;
                  })()}
                  {entrada.nombre}
                </button>
              );
            })}
          </div>
        </fieldset>`;

const newBlock = `        {/* Category: Top 3 suggestions as buttons + dropdown for others */}
        <fieldset className="mt-5">
          <legend className="text-xs font-bold text-[var(--fin-ink-soft)]">{COPY.confirm.category}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(parsed.suggestedCategories?.slice(0, 3).map(c => catalogo.de(c)) || opciones.slice(0, 3)).map((entrada) => {
              const option = entrada.clave;
              const active = category === option;
              const color = entrada.color;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCategory(option)}
                  aria-pressed={active}
                  className="flex items-center gap-1.5 rounded-full border-2 px-3 py-2 text-xs font-bold transition-colors"
                  style={{
                    backgroundColor: active ? tint(color, 0.16) : 'var(--fin-card)',
                    borderColor: active ? color : 'var(--fin-line)',
                    color: active ? 'var(--fin-ink)' : 'var(--fin-ink-soft)',
                  }}
                >
                  {(() => {
                    const Icon = entrada.Icono;
                    return <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />;
                  })()}
                  {entrada.nombre}
                </button>
              );
            })}
            <select 
               value={category} 
               onChange={(e) => setCategory(e.target.value)} 
               className="ml-2 rounded-full border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-1.5 text-xs font-bold text-[var(--fin-ink-soft)] focus:outline-none"
            >
               <option disabled>Más categorías...</option>
               {opciones.filter(o => !parsed.suggestedCategories?.slice(0, 3).includes(o.clave)).map(entrada => (
                  <option key={entrada.clave} value={entrada.clave}>{entrada.nombre}</option>
               ))}
            </select>
          </div>
        </fieldset>

        {/* Signals Extracted */}
        {(!editando && (parsed.signals.destinatario || parsed.signals.ubicacion || parsed.signals.tags?.length > 0)) ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {parsed.signals.destinatario && (
              <span className="inline-flex items-center rounded bg-[var(--fin-soft)] px-2 py-1 text-[10px] font-bold text-[var(--fin-ink-soft)]">
                👤 {parsed.signals.destinatario}
              </span>
            )}
            {parsed.signals.ubicacion && (
              <span className="inline-flex items-center rounded bg-[var(--fin-soft)] px-2 py-1 text-[10px] font-bold text-[var(--fin-ink-soft)]">
                📍 {parsed.signals.ubicacion}
              </span>
            )}
            {parsed.signals.tags?.map(t => (
              <span key={t} className="inline-flex items-center rounded bg-[var(--fin-soft)] px-2 py-1 text-[10px] font-bold text-[var(--fin-ink-soft)]">
                🏷️ {t}
              </span>
            ))}
          </div>
        ) : null}`;

content = content.replace(targetBlock, newBlock);
fs.writeFileSync('src/features/finanzas/components/ConfirmSheet.tsx', content);
