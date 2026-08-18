# Finanzas — manual de funcionalidades

App de finanzas personales para Colombia (COP, zona horaria `America/Bogota`).
Se registra hablando, funciona sin conexión, y todo cálculo es reconstruible
desde los movimientos guardados: ningún saldo es un número suelto.

Código en `src/features/finanzas/`. Entrada: [`FinanzasApp.tsx`](FinanzasApp.tsx).

---

## 1. Acceso, sesión y almacenamiento

- **Tres modos de arranque** ([`data/useSesion.ts`](data/useSesion.ts)):
  - `local` — no hay proyecto Supabase configurado: la app corre completa contra
    IndexedDB de este dispositivo y **no muestra pantalla de login**.
  - `anonimo` — hay backend: se muestra [`LoginPanel`](components/LoginPanel.tsx)
    (entrar / registrarse con email y contraseña, errores en español).
  - `autenticado` — datos en Supabase por usuario.
- **Aislamiento por cuenta**: el panel se remonta con `key = userId`, así que los
  datos de un usuario nunca quedan en pantalla bajo la sesión de otro.
- **Repositorio intercambiable** ([`data/repositorio.ts`](data/repositorio.ts),
  [`data/indexeddb.ts`](data/indexeddb.ts),
  [`data/repositorioSupabase.ts`](data/repositorioSupabase.ts)): misma interfaz
  async para local y remoto; las escrituras van por registro completo, no por
  parches.
- **Aviso de no persistencia**: si el almacenamiento es solo memoria, un banner
  lo dice en vez de perder datos en silencio. Los errores de guardado se muestran
  arriba y se pueden descartar.
- **PWA** ([`data/registrarSW.ts`](data/registrarSW.ts), `public/ecosistema.webmanifest`,
  iconos 180/192/512): instalable y abre sin conexión. El service worker no se
  registra en dev y falla en silencio (una instalación degradada no es una app rota).
- **Tema claro/oscuro** ([`data/useTema.ts`](data/useTema.ts),
  [`components/TemaToggle.tsx`](components/TemaToggle.tsx)) y preferencias por
  dispositivo en `localStorage` ([`data/usePreferencias.ts`](data/usePreferencias.ts)).

## 2. Navegación

[`sections.ts`](sections.ts) define 11 secciones. En móvil la barra inferior
muestra 5 (Resumen, Movimientos, Asesor, Cuentas, Ahorro) y el resto va tras
"Más"; en escritorio el sidebar las muestra todas
([`components/FinanzasShell.tsx`](components/FinanzasShell.tsx)).
Cada sección tiene icono y color propios; **el color nunca es el único canal de
significado** — siempre hay icono y texto.

---

## 3. Registrar un movimiento

### 3.1 Dictado por voz
[`hooks/useDictation.ts`](hooks/useDictation.ts) +
[`components/DictationInput.tsx`](components/DictationInput.tsx): reconocimiento
de voz en español. Detecta el caso iOS instalado donde la API existe pero nunca
emite eventos (sonda de silencio de 3,5 s) y distingue errores fatales
(`not-allowed`, `audio-capture`) de los reintentables, cayendo al teclado.

### 3.2 OCR de imágenes
[`hooks/useImageOCR.ts`](hooks/useImageOCR.ts): foto de un recibo → Tesseract.js
en español → el texto entra al mismo parser, con barra de progreso.

### 3.3 Texto escrito y alta manual
Campo de texto libre, más "O añádelo a mano" para el movimiento que el parser
pelearía (monto raro, fecha que no es hoy).

### 3.4 El parser ([`lib/parseTransaction.ts`](lib/parseTransaction.ts))
De una frase saca **monto, tipo, categoría, cuenta, fecha y descripción**:

- **Números en español y jerga colombiana** ([`lib/numerals.ts`](lib/numerals.ts)):
  `20 mil`, `veinte mil`, `20mil`, `20 lucas`, `dos palos`, `medio melón`, `20k`
  pasan por **una sola** máquina de estados (dígitos y palabras, mismo camino).
- **Dirección del movimiento** ([`lib/vocabulary.ts`](lib/vocabulary.ts)): frases
  ordenadas por longitud para que `me costó` (gasto) nunca se confunda con
  `me pagaron` (ingreso); incluye colombianismos (`cancelé la factura` = pagué).
- **Categoría**: palabras clave, comercios conocidos, categorías propias del
  usuario ([`lib/vocabularioUsuario.ts`](lib/vocabularioUsuario.ts)) y
  **fuzzy matching** por distancia de Levenshtein
  ([`lib/inteligenciaAvanzada.ts`](lib/inteligenciaAvanzada.ts)).
- **Cuenta**: por nombre, y con más fuerza cuando la preposición lo dice
  ("a Bancolombia", "desde Nequi").
- **Fechas habladas**: días de la semana y meses ("el martes", "el 3 de marzo").
- **Confianza granular** por campo (monto, tipo, categoría, cuenta, método) más
  `needsReview` y categorías sugeridas.
- **Aprendizaje local** ([`lib/aprendizaje.ts`](lib/aprendizaje.ts)): de tus
  propias confirmaciones deduce qué categoría suele tener cada palabra **para ti**
  (mínimo 2 apariciones y 60 % de dominancia). No sale del dispositivo ni guarda
  datos nuevos.
- **Contactos por apodo**: dices "le mandé 20 mil a mi pa" y en el libro queda el
  nombre completo del contacto.

### 3.5 Confirmación obligatoria
[`components/ConfirmSheet.tsx`](components/ConfirmSheet.tsx) siempre gatea la
escritura: monto, tipo, categoría, cuenta, fecha y descripción editables. Sirve
también para **editar** un movimiento existente; si la fecha cambia de mes, la
app salta a ese mes para que la edición no parezca un borrado.

---

## 4. Resumen (dashboard)

- **Patrimonio** ([`components/PatrimonioCard.tsx`](components/PatrimonioCard.tsx)):
  activos menos pasivos, con opción de incluir o no el ahorro (si se oculta, sale
  del titular *y* del detalle, para que las partes siempre sumen el total).
- **Estado del mes** ([`components/EstadoDelMes.tsx`](components/EstadoDelMes.tsx)):
  veredicto con icono y palabras, nunca solo color.
- **Presupuestos** ([`lib/presupuestos.ts`](lib/presupuestos.ts),
  [`components/PresupuestosView.tsx`](components/PresupuestosView.tsx)): tope
  mensual por categoría, gastado, disponible, % usado y **proyección al ritmo
  actual** (mostrada como suposición, aparte del gasto real) con aviso de
  "va a rebasar".
- **KPIs** ([`components/KpiRow.tsx`](components/KpiRow.tsx)): ingresos, gastos,
  balance y **tasa de ahorro** (`null` cuando no hubo ingresos — distinto de 0 %).
- **Desglose por categoría** ([`components/CategoryBreakdown.tsx`](components/CategoryBreakdown.tsx)):
  "En qué se te va" y "De dónde entra", con % y color/icono por categoría.
- **Últimos 5 movimientos** y **detalle del mes**
  ([`components/DetalleMes.tsx`](components/DetalleMes.tsx)): calendario del mes
  con lo que pasó cada día y ranking de contrapartes
  ([`lib/detalle.ts`](lib/detalle.ts)).
- **Navegador de meses** ([`components/MonthNav.tsx`](components/MonthNav.tsx)),
  tope en el mes actual.
- **Botón "Generar Informe / PDF"** (ver §11).

---

## 5. Movimientos

- Lista agrupada por día ([`components/TransactionList.tsx`](components/TransactionList.tsx))
  con editar, borrar y analizar.
- **Buscador y filtros** ([`lib/filtros.ts`](lib/filtros.ts),
  [`components/BuscadorMovimientos.tsx`](components/BuscadorMovimientos.tsx)):
  texto, categoría, cuenta, tipo y rango de fechas, con total corrido de lo
  filtrado. **Con filtro activo la búsqueda recorre todo el libro**, no solo el
  mes visible (y el navegador de meses se oculta para no mentir).
- **Señales por movimiento** ([`lib/senales.ts`](lib/senales.ts)): `inusual`,
  `recurrente`, `hormiga`, `duplicado`, `creciendo`, `nuevo`. Nunca "bueno" o
  "malo": comparan contra tu propio historial (mediana por categoría), que es un
  hecho, no un juicio.
- **Análisis de un movimiento** ([`components/AnalisisMovimiento.tsx`](components/AnalisisMovimiento.tsx)):
  detección de anomalías por ±2σ y percentil, y detección de recurrencia
  (diaria/semanal/mensual/anual con confianza) —
  [`lib/senalesAvanzadas.ts`](lib/senalesAvanzadas.ts).

---

## 6. Cuentas, Cajitas y Deudas

Una sola estructura (`Cajita`) con cuatro tipos —`cuenta`, `cajita`, `deuda`,
`tarjeta`— donde deudas y tarjetas son la misma forma **invertida**: una compra
sube lo que debes, un abono lo baja ([`data/modelos.ts`](data/modelos.ts)).

- **El saldo es siempre la suma de sus movimientos**, nunca un número guardado
  ([`lib/cajitas.ts`](lib/cajitas.ts)). Por eso "solo dime cuánto tienes" es
  seguro: fijar un saldo se registra como el **ajuste** necesario para llegar ahí,
  y la historia jamás se reescribe.
- **Tipos de movimiento**: depósito, retiro, rendimiento, ajuste de saldo, compra
  y abono, cada uno con icono propio.
- **Transferencias entre cuentas y cajitas propias** (las deudas quedan fuera:
  pagarlas tiene su propio flujo con el signo invertido).
- **Abono a deuda** desde una cuenta concreta ([`components/DeudasView.tsx`](components/DeudasView.tsx)),
  con categoría por cargo (una tarjeta que solo sube sin explicación es justo el
  problema que esto resuelve).
- **Rendimientos** ([`lib/rendimiento.ts`](lib/rendimiento.ts)): tasa E.A. (el
  único número que publican los bancos colombianos) convertida correctamente a
  tasa diaria como **raíz 365** —nunca `EA/365`—, recorriendo la historia real de
  saldos. Devuelve acumulado, diario y anual estimado.
- **Cuenta Efectivo** sembrada con id fijo (idempotente, renombrable y archivable
  como cualquier otra).
- **Archivado** en vez de borrado: una cuenta retirada conserva su historia pero
  sale de los totales.
- Los movimientos del libro atribuidos a una cuenta mueven su saldo; los no
  atribuidos siguen contando en los totales del mes sin mover ningún saldo
  (dictar rápido no debe costar una decisión extra).

## 7. Ahorro y Metas

Pestañas dentro de "Ahorro": **Cajitas** (estilo Nu, con meta propia opcional e
icono a elegir) y **Metas** ([`lib/metas.ts`](lib/metas.ts),
[`components/MetasView.tsx`](components/MetasView.tsx)):

- Objetivo en COP, fecha objetivo opcional, icono.
- **Progreso leído de una cajita enlazada** cuando la hay, para que la cifra no
  pueda desviarse de la cajita que dice describir.
- Faltante, % (topado a 100), días restantes y **ritmo mensual necesario**
  (`null` si la meta es abierta, ya se cumplió, o la fecha ya pasó).

## 8. Recurrentes

[`lib/recurrentes.ts`](lib/recurrentes.ts) +
[`components/RecurrentesView.tsx`](components/RecurrentesView.tsx): arriendo,
Netflix, gimnasio. Nombre, tipo, monto, categoría, cuenta y día del mes.

- **La app los propone, no los registra sola**: un movimiento inventado es plata
  falsa en el libro. Cada mes muestra los pendientes y espera un toque.
- Un recurrente del día 31 cae el 28 en febrero (no se salta ni se corre a marzo).
- Se archivan en vez de borrarse.

## 9. Contactos

[`lib/contraparte.ts`](lib/contraparte.ts), [`lib/contactos.ts`](lib/contactos.ts),
[`components/ContactosView.tsx`](components/ContactosView.tsx).

- **Extracción de contraparte** de la descripción bancaria: BRE-B (envío, recibo,
  QR), transferencias, "pago recibido de", limpiando colas de ruido (cédulas,
  códigos de oficina, `S.A.S.`, `Ltda.`). Si no hay contraparte identificable
  devuelve `null` en vez de inventar una bolsa "otros".
- **Unificación de grafías**: "JUAN PEREZ", "Juan P." y "Juan Carlos Perez" son
  una sola persona. La app pregunta **una duda a la vez**, justo donde se
  registran los movimientos ([`components/DudaContacto.tsx`](components/DudaContacto.tsx));
  un "no" queda guardado (`separadoDe`) y la pareja no vuelve a preguntarse.
- Renombrar sin huérfanos, deshacer una unión, y **apodos propios** ("pa", "el
  jefe") que el dictado reconoce para escribir el nombre completo.
- Vista con total, número de movimientos y última fecha por contacto.

## 10. Tendencias

[`lib/tendencias.ts`](lib/tendencias.ts) +
[`components/TendenciasView.tsx`](components/TendenciasView.tsx): ventana de
**6 meses** anclada al mes en pantalla.

- Serie mensual de ingresos, gastos y balance **incluyendo meses vacíos** (saltar
  los huecos comprimiría el tiempo y mentiría sobre una pausa de dos meses).
- Promedio mensual y **comparación de categorías contra el mes anterior**
  (qué subió, qué bajó, cuánto).
- Barras escaladas contra el mayor valor de la ventana.

## 11. Informe financiero y exportación

- **[`components/ReporteFinancieroModal.tsx`](components/ReporteFinancieroModal.tsx)**:
  informe imprimible del mes (`window.print()` → PDF) con los datos completos y
  el email del usuario.
- **Excel** ([`lib/exportarExcel.ts`](lib/exportarExcel.ts)): genera un `.xls`
  (XML Spreadsheet 2003) con hojas, estilos, colores y formatos numéricos, que
  abre nativo en Excel, LibreOffice y Google Sheets, sin librerías pesadas.
  Filtrable por mes.
- **Respaldo y restauración** ([`lib/respaldo.ts`](lib/respaldo.ts),
  [`components/PanelRespaldo.tsx`](components/PanelRespaldo.tsx)): exporta un JSON
  versionado con todo (movimientos, cuentas, cajitas, metas, categorías,
  contactos, presupuestos, recurrentes) y también CSV. Al restaurar **dice qué
  trae dentro y de cuándo es antes de reemplazar nada**. Existe porque un libro
  del que no puedes sacar tus datos es un libro prestado.

## 12. 4x1000 (GMF)

[`lib/gmf.ts`](lib/gmf.ts) + [`components/PanelGmf.tsx`](components/PanelGmf.tsx).

- Tarifa 4 por mil, tope exento de **350 UVT mensuales** (art. 879 E.T.) y
  exención propia de **65 UVT** para depósitos de bajo monto.
- **UVT editable con año y resolución de origen** (valor de arranque: $52.374,
  Resolución DIAN 000238 de 2025). Si el año pasa y nadie la actualiza, la
  pantalla **avisa que está vieja** en vez de calcular en silencio.
- Elección de régimen, cuentas sujetas a GMF y cuál es la cuenta marcada como
  exenta; consumo del tope en el mes y en el año.
- Explícitamente **estimaciones**: quien liquida es el banco. Sirve para entender
  de dónde salió una plata, no para discutirle al banco.

## 13. Configuración

[`components/ConfiguracionView.tsx`](components/ConfiguracionView.tsx):

- Editar cuentas/cajitas/deudas: nombre, icono, tipo, meta, tasa E.A., marca de
  bajo monto, fijar saldo, archivar.
- **Categorías propias** ([`categorias.ts`](categorias.ts),
  [`components/CategoriasEditor.tsx`](components/CategoriasEditor.tsx)): crear con
  nombre, icono (25 iconos) y color; editar, archivar y borrar. Las 13 de fábrica
  (mercado, comida, transporte, servicios, salud, hogar, entretenimiento, ropa,
  educación, transferencia, ahorro, ingreso, otros) siguen ahí. El movimiento
  guarda **una sola columna** `category`, así que una categoría renombrada o
  borrada nunca deja filas apuntando al vacío.
- Mostrar u ocultar el ahorro en el Resumen.
- Panel de 4x1000 y panel de respaldo embebidos aquí.

## 14. Analista de extractos (PDF)

[`analista/`](analista/) + `POST /api/analizar-extracto` en `server.ts` +
plantillas en `server_lib/plantillas/`.

- Subes el **PDF del extracto** (token propio guardado en `localStorage`, límite
  de 4 MB, varios archivos en paralelo, reintento sin volver a elegir el archivo).
- El servidor extrae el texto, **detecta el banco** y aplica plantilla:
  **Nequi, Nu, Bancolombia y Davivienda**. Errores claros y distintos para PDF
  corrupto/con contraseña, escaneo sin capa de texto, banco no soportado y
  extracto sin movimientos.
- Devuelve movimientos con fecha, descripción, monto, tipo, categoría y
  **confianza**, más un motivo de **exclusión** cuando la fila no es un gasto
  real: traslado propio, pago de tarjeta, reverso o saldo informativo (sumar todo
  a ciegas duplicaría la contabilidad).
- **Plan de importación** ([`analista/aMovimientos.ts`](analista/aMovimientos.ts)):
  separa nuevos, duplicados exactos, **posibles duplicados** (mismo día, monto y
  signo pero otra redacción — se preguntan en vez de decidir por ti) y excluidos.
- **Reporte auditable** ([`components/AnalistaReporte.tsx`](components/AnalistaReporte.tsx)):
  los totales se recalculan en el cliente y se contrastan con los del modelo
  (`metricasCoherentes`), con hallazgos por severidad alta/media/baja.

## 15. Asesor financiero (chat)

[`components/AsesorView.tsx`](components/AsesorView.tsx),
[`lib/asesorBot.ts`](lib/asesorBot.ts), `POST /api/asesor-ia`.

- **Con IA**: el servidor consulta, en cascada y con la sesión Supabase
  verificada, **Groq → OpenAI → Gemini → Anthropic → DeepSeek** (la primera llave
  configurada que responda). Recibe un resumen financiero real como contexto,
  responde en Markdown, en español, orientado a Colombia (CDT, gastos hormiga,
  presupuestos, manejo de deudas) y registra **por qué** falló cada proveedor en
  vez de callarlo.
- **`GET /api/salud`**: dice si hay algún modelo detrás sin llamarlo ni revelar
  cuál. También lo usa el keep-alive; el chat muestra un estado **"despertando"**
  real porque el plan gratuito de Render duerme el servicio (~40 s la primera vez).
- **Sin IA o sin red: motor local** que responde igual, sobre tus datos:
  saludo según la hora, resumen del mes y "cómo voy", consulta de saldos por
  cuenta o cajita, **exención inteligente del 4x1000**, **presupuesto diario
  sugerido** ("cuánto puedo gastar"), suscripciones y gastos recurrentes,
  analítica profunda con anomalías ("sorpréndeme", "algo raro"), consultas de
  gasto por categoría/periodo/contraparte, correcciones al vuelo, chitchat de
  respaldo y sugerencias de seguimiento.
- **Registrar hablando desde el chat**: entiende una transacción ("gasté 50 en
  comida") o **varias en una frase** ("gasté 50 en comida, 20 en transporte y 100
  en cine") y las manda al mismo `ConfirmSheet` — nada se escribe sin confirmar.
  Si falta el monto, lo pide.

---

## 16. Reglas transversales

- **Fechas**: siempre día calendario de Bogotá `YYYY-MM-DD`, jamás timestamps UTC
  ([`lib/localDate.ts`](lib/localDate.ts)) — con UTC, todo lo dictado después de
  las 7 p. m. caería en el día siguiente.
- **Moneda**: COP sin decimales, agrupada a mano y no vía `Intl`, para que la
  salida sea idéntica en Node y en cualquier navegador
  ([`lib/formatCop.ts`](lib/formatCop.ts)). Un movimiento de $0 se rechaza; un
  **saldo** de $0 no (vaciar una cajita es legítimo).
- **Accesibilidad**: color nunca es el único canal —siempre icono y texto—; los
  tonos de estado no se reutilizan como colores de serie
  ([`lib/paletaViz.ts`](lib/paletaViz.ts)); campos a 16 px mínimo para que iOS no
  haga zoom al enfocar.
- **Nada se escribe sin confirmación** del usuario, en ningún flujo (dictado,
  OCR, chat, recurrentes, importación de extractos).
- **Cobertura de pruebas**: cada módulo de `lib/`, `data/`, `analista/` y las
  vistas críticas tienen su `.test.ts(x)` al lado.
- **Seguridad**: las llaves de modelos y la service role key viven solo en el
  servidor (nunca `VITE_`); `/api` va con rate limiting (120 req/min) y el asesor
  exige sesión válida de Supabase antes de tocar un modelo.
