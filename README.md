# Portafolio + Ecosistema

Dos aplicaciones en un repositorio, con bundles independientes:

| Ruta | Qué es | Quién entra |
|---|---|---|
| `/` | Portafolio público — [juliangonzalez.lat](https://juliangonzalez.lat) | cualquiera |
| `/ecosistema` | Lanzador de apps privadas, hoy **Finanzas** | solo con cuenta |

Son dos entradas HTML separadas en Vite, no una SPA con rutas. La app privada
necesita su propio `<head>` (`noindex`, metas de iOS standalone, manifest de PWA)
y así los dos bundles quedan disjuntos: el visitante del portafolio nunca
descarga el código de finanzas.

## Finanzas

Contabilidad personal en pesos colombianos, pensada para no depender de que
ningún banco tenga API.

- **Movimientos** dictados o escritos en lenguaje natural (`gasté 45 mil en un
  juego`), con un parser propio que saca monto, tipo y categoría.
- **Extractos** en PDF de Nu, Nequi, Bancolombia y Davivienda. Al importar,
  separa lo nuevo de lo que ya estaba: nunca duplica en silencio ni funde en
  silencio.
- **Cuentas, cajitas, deudas y tarjetas**. El saldo siempre es la suma de sus
  movimientos; decir "tengo X" registra la diferencia como un ajuste, así que la
  app y el banco nunca terminan discrepando sin rastro.
- **Rendimiento E.A.** derivado, nunca escrito como movimiento — raíz 365 de la
  tasa, replayando el historial real.
- **Categorías propias** junto a las trece que trae la app.
- **Señales por movimiento**: compara cada gasto contra tu propio historial
  (inusual, recurrente, hormiga, duplicado, creciendo, nuevo). Todo local, sin
  llamadas a ningún modelo.

### Decisiones que el código defiende con tests

- Un saldo es siempre la suma de sus movimientos.
- El rendimiento estimado se calcula, no se guarda.
- Deudas y tarjetas son la misma estructura invertida: una compra sube lo que debes.
- Las señales comparan contra tu historial, no moralizan. Hay un test que exige
  que el texto nunca diga "malo", "innecesario", "derroche" ni "deberías".
- El color sigue a la entidad, nunca a su posición en un ranking.

## Correr en local

```bash
npm install
```

Front (las dos entradas, en `http://localhost:5173`):

```bash
npm run dev
```

API del analista de extractos, aparte:

```bash
npm run dev:api
```

Tests, tipos y lint:

```bash
npm test
```

## Variables de entorno

Del lado del navegador (`VITE_`) — **se incrustan en el bundle público**, así
que aquí solo va lo que puede ser público:

| Variable | Para qué |
|---|---|
| `VITE_SUPABASE_URL` | proyecto de Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | clave publicable (la antigua `VITE_SUPABASE_ANON_KEY` sigue funcionando) |
| `VITE_API_URL` | dónde vive la API del analista |

Del lado del servidor, **nunca con prefijo `VITE_`**:

| Variable | Para qué |
|---|---|
| `SUPABASE_URL` | mismo proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | crear usuarios desde el panel de superadmin |
| `ANALISTA_TOKEN` | protege el endpoint que lee extractos |
| `PORT` | puerto del servidor |

La clave publicable es pública por diseño; quien de verdad separa los datos de
cada usuario es Row Level Security en Postgres, no el secreto de la clave.

## Base de datos

Las migraciones se corren **en orden** desde el SQL Editor de Supabase:

```
supabase/migrations/0001_finanzas.sql          tablas base + RLS
supabase/migrations/0002_perfiles_y_roles.sql  perfiles y rol de superadmin
supabase/migrations/0003_tasa_cajitas.sql      tasa E.A.
supabase/migrations/0004_tipo_cajitas.sql      cuenta vs cajita
supabase/migrations/0005_deudas_y_tarjetas.sql deudas, tarjetas y categoría del cargo
supabase/migrations/0006_movimientos_por_cuenta.sql  movimientos atados a una cuenta
supabase/migrations/0007_categorias_propias.sql      categorías del usuario
```

Cada tabla tiene RLS con una política que cubre los cuatro verbos, con `using` y
`with check`: sin las dos, alguien podría mover una fila ajena a su propia
cuenta, o insertar una ya marcada con otro `user_id`.

El registro público se apaga desde Supabase → Authentication → Sign In /
Providers → Email → *Allow new users to sign up*. Es una configuración del
proyecto, no del código: mientras esté encendida, cualquiera con la URL puede
crearse una cuenta.

## Despliegue

- **Vercel** sirve el front. Solo las variables `VITE_`.
- **Render** corre la API. Aquí van `SUPABASE_SERVICE_ROLE_KEY` y
  `ANALISTA_TOKEN`, y **nunca** en Vercel.

## Estructura

```
src/
  components/            portafolio público
  apps-dashboard/        lanzador + panel de superadmin
  features/finanzas/
    lib/                 lógica pura: saldos, señales, tendencias, fechas Bogotá
    data/                repositorios (memoria, IndexedDB, Supabase) y hooks
    components/          UI
    analista/            planificación de importaciones
server_lib/plantillas/   lectores de extracto, uno por banco
supabase/migrations/     esquema
```

Los tres repositorios implementan la misma interfaz y se someten a **una sola
batería de tests de conformidad**. La divergencia entre ellos es el fallo que de
verdad importa: el de memoria es el que corre cuando IndexedDB no está
disponible (Firefox en ventana privada se niega a abrir la base), así que
cualquier conducta cierta en uno solo es un bug esperando a que alguien la
encuentre.
