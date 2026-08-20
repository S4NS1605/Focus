# Qué falta aplicar a mano

Lo que el código ya trae pero todavía no está encendido en producción. En este
orden.

---

## 1. Migraciones pendientes: `0007` a `0012`, y la `0017`

**Dónde:** Supabase → tu proyecto → **SQL Editor** → *New query*.

**Cómo:** una migración por consulta. Pega, dale *Run*, comprueba que diga
`Success`, y solo entonces pasa a la siguiente. No las pegues todas juntas: si
una falla a mitad, no vas a saber cuál.

Todas son seguras de repetir. Si ya corriste alguna, correrla otra vez no rompe
nada.

Los archivos están en `supabase/migrations/`. Ábrelos y copia el contenido, o
usa los bloques de abajo.

### Orden y qué hace cada una

| # | Archivo | Qué añade |
|---|---|---|
| 0007 | `0007_categorias_propias.sql` | categorías que inventas tú |
| 0008 | `0008_contactos.sql` | con quién mueves la plata |
| 0009 | `0009_presupuestos.sql` | topes de gasto por categoría |
| 0010 | `0010_recurrentes.sql` | lo que se repite cada mes |
| 0011 | `0011_apodos.sql` | cómo le dices tú a cada contacto |
| 0017 | `0017_registro_publico.sql` | abre el registro y cierra la fuga de correos |
| 0012 | `0012_visitas.sql` | analítica del portafolio |

**Dependencias ya cubiertas:** la `0010` referencia `public.cajitas`, creada en
la `0001`. La `0012` usa `public.es_admin()`, creada en la `0002`. Las dos ya
las tienes aplicadas, así que no hay nada que hacer antes.

**Ojo con la `0011`:** es la de apodos y no estaba en tu lista original — se
añadió después. Sin ella, la app falla al guardar un apodo.

---

## 2. Comprobar que quedaron

Pega esto después y mira que salgan las **siete** tablas:

```sql
select table_name
  from information_schema.tables
 where table_schema = 'public'
   and table_name in (
     'categorias', 'contactos', 'presupuestos',
     'recurrentes', 'visitas', 'visitas_diarias', 'perfiles'
   )
 order by table_name;
```

Que `contactos` tenga la columna de apodos:

```sql
select column_name
  from information_schema.columns
 where table_schema = 'public'
   and table_name = 'contactos'
   and column_name = 'apodos';
```

Si no devuelve una fila, la `0011` no se aplicó.

---

## 3. Las tareas automáticas de la analítica (`pg_cron`)

La `0012` intenta agendarlas sola, pero si `pg_cron` no está encendido no puede
y lo dice con un `NOTICE` en vez de fallar. Comprueba si quedaron:

```sql
select jobname, schedule, command, active
  from cron.job
 where jobname in ('resumir-visitas', 'purgar-visitas');
```

**Si devuelve dos filas, listo.** No tienes que hacer nada más.

**Si da error `relation "cron.job" does not exist` o devuelve cero filas:**

1. Supabase → **Database → Extensions** → busca `pg_cron` → enciéndelo.
2. Vuelve al SQL Editor y pega:

```sql
select cron.schedule('resumir-visitas', '30 5 * * *', 'select public.resumir_visitas()');
select cron.schedule('purgar-visitas',  '45 5 * * *', 'select public.purgar_visitas()');
```

Las horas son UTC. Bogotá es UTC-5, así que `05:30 UTC` = `00:30` de acá: ya
pasó la medianoche local y el día que se va a resumir está cerrado.

**Si nunca las agendas**, la analítica igual funciona y guarda visitas. Lo que
no pasa es que se resuma por día ni que se borre lo viejo a los 90 días — o sea,
la parte de privacidad que promete el pie del portafolio. Vale la pena dejarlo
agendado.

---

## 4. `VISITAS_SAL` en Vercel

Sin esta variable la función del borde **no guarda nada**. Falla cerrada a
propósito: un despliegue mal configurado no cuenta mal, no cuenta.

Genera el valor:

```bash
openssl rand -hex 32
```

**Dónde:** Vercel → tu proyecto → **Settings → Environment Variables**.

- **Name:** `VISITAS_SAL`
- **Value:** lo que salió del comando
- **Environments:** marca *Production* (y *Preview* si quieres probar allí)

**Sin prefijo `VITE_`.** Ese prefijo es lo que hace que Vite incruste el valor
en el bundle público; sin él, la variable solo existe del lado del servidor.

No es la llave de servicio ni se le parece: lo único que habilita es calcular el
hash diario de un visitante. La llave de servicio sigue viviendo únicamente en
Render.

**Después de añadirla hay que volver a desplegar** — Vercel no reinyecta
variables en un despliegue que ya existe. Deployments → el último → *Redeploy*.

### Si alguna vez la rotas

Cambiar la sal parte el conteo de ese día en dos: las visitas de antes y las de
después producen huellas distintas para la misma persona. Se infla el número de
"visitantes" de ese día y nada más. No rompe nada, pero mejor hacerlo de noche.

---

## 5. El registro público — ahora es a propósito

**Déjalo encendido.** Aquí antes decía justo lo contrario: apágalo. Ya no.

Supabase → **Authentication → Sign In / Providers → Email** → *Allow new users
to sign up* tiene que estar **activado**. Es configuración del proyecto, no del
código: ninguna migración lo cambia, y si está apagado el formulario de la
portada falla con un error que no le dice nada a nadie.

### Lo que había que arreglar antes de abrirlo

Esa casilla llevaba encendida todo este tiempo. La app lo tapaba enseñando solo
la pestaña de entrar, pero eso es maquillaje: cualquiera que llamara a la API
de Supabase directamente podía crearse una cuenta igual.

Eso importa porque la 0002 daba el sistema por cerrado, y sobre esa idea
justificaba `correo_de_usuario` — una función que devolvía el correo de
cualquiera que acertara un nombre de usuario. O sea que la fuga ya estaba
abierta, solo que nadie la había mirado de frente.

La `0017` cierra eso: borra la función, quita el login por nombre de usuario
(ahora se entra solo con correo) y deja el registro apoyado en algo que sí se
sostiene.

---

## 6. Rotar tu contraseña de superadmin

La compartiste en un chat hace tiempo.

Supabase → **Authentication → Users** → tu usuario → *Reset password*. O desde
la app, si ya tienes el flujo de cambio de contraseña.

---

## 7. El repo se movió

GitHub avisa en cada push que `S4NS1605/Focus` ahora es
`S4NS1605/PortafolioJsgonzalez`. Funciona por redirección, pero conviene
arreglarlo:

```bash
git remote set-url origin git@github.com:S4NS1605/PortafolioJsgonzalez.git
```

---

## Cómo saber que la analítica quedó viva

Después de desplegar con `VISITAS_SAL` puesta, entra a
[juliangonzalez.lat](https://juliangonzalez.lat) desde el celular (con datos, no
por wifi, para que el país no sea el mismo que el tuyo de casa) y luego mira:

```sql
select ruta, referente, pais, dispositivo, creado_en
  from public.visitas
 order by creado_en desc
 limit 10;
```

Si sale tu visita, funciona de punta a punta. Después entra al ecosistema →
**Visitantes** y compruébalo en el panel.

Si no sale nada, en orden: ¿está `VISITAS_SAL` en Vercel?, ¿volviste a
desplegar?, ¿el navegador tiene activado "Do Not Track" (se respeta y no
cuenta)?, ¿algún bloqueador tumbó la petición a `/api/visita`?
