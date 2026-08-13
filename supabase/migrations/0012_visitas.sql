-- Quién pasa por el portafolio, sin saber quién es cada quien.
--
-- Lo que NO está en esta tabla es la decisión. No hay IP, ni user agent
-- completo, ni cookie, ni id de navegador, ni ciudad. La ciudad se dejó por
-- fuera a propósito: con el tráfico de un portafolio, "1 visitante de Sopó"
-- señala a una persona; "1 visitante de Colombia" no señala a nadie.
--
-- `visitante` es un hash del día — sha256(ip + user agent + fecha + sal). La
-- sal vive solo en la función del borde y la fecha va dentro del hash, así que
-- la misma persona produce otro valor mañana: se puede contar cuántos entraron
-- hoy, y no se puede seguir a nadie de un día para otro. La IP se usa para
-- calcularlo y se descarta ahí mismo; nunca llega hasta aquí.

create table if not exists public.visitas (
  id          bigint generated always as identity primary key,
  ruta        text not null,
  -- Solo el dominio de donde vino, nunca la URL entera.
  referente   text,
  pais        text not null default 'XX',
  dispositivo text not null check (dispositivo in ('movil', 'tablet', 'escritorio')),
  visitante   text not null,
  -- Truncado a la hora: la hora exacta, junto con país y dispositivo, vuelve a
  -- ser una huella. Para contar visitas la hora sobra.
  creado_en   timestamptz not null default date_trunc('hour', now())
);

create index if not exists visitas_creado_idx on public.visitas (creado_en desc);

-- ---------------------------------------------------------------------------
-- Lo que sobrevive a los 90 días: cuentas, no personas.
--
-- Una fila agregada con su conteo ya no es dato personal, y es lo que deja que
-- el panel muestre la tendencia de años sin guardar nada de nadie.
create table if not exists public.visitas_diarias (
  fecha       date not null,
  ruta        text not null,
  pais        text not null default 'XX',
  dispositivo text not null,
  vistas      integer not null,
  unicos      integer not null,
  primary key (fecha, ruta, pais, dispositivo)
);

-- ---------------------------------------------------------------------------
-- RLS
alter table public.visitas enable row level security;
alter table public.visitas_diarias enable row level security;

-- El beacon inserta con la clave publicable y sin sesión, o sea como `anon`.
-- Solo INSERT: no puede leer lo que otros dejaron, ni cambiarlo, ni borrarlo.
-- Que la clave sea pública no importa aquí — lo único que habilita es sumar
-- una visita, y nadie gana nada inflando el contador de un portafolio.
drop policy if exists visitas_insertar on public.visitas;
create policy visitas_insertar on public.visitas
  for insert to anon
  with check (true);

-- Leer es solo del superadmin. Ni siquiera un usuario normal del ecosistema
-- tiene por qué ver por dónde entra la gente al portafolio.
drop policy if exists visitas_leer on public.visitas;
create policy visitas_leer on public.visitas
  for select to authenticated
  using (public.es_admin());

drop policy if exists visitas_diarias_leer on public.visitas_diarias;
create policy visitas_diarias_leer on public.visitas_diarias
  for select to authenticated
  using (public.es_admin());

-- ---------------------------------------------------------------------------
-- Resumir un día y borrar lo viejo.
--
-- Los límites se calculan en hora de Bogotá, no en UTC: entre las 7 y las 12 de
-- la noche de acá ya es el día siguiente en UTC, y las visitas de la noche
-- caerían en el resumen equivocado.
create or replace function public.resumir_visitas(
  dia date default ((now() at time zone 'America/Bogota')::date - 1)
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.visitas_diarias (fecha, ruta, pais, dispositivo, vistas, unicos)
  select dia, ruta, pais, dispositivo, count(*), count(distinct visitante)
    from public.visitas
   where creado_en >= (dia::timestamp at time zone 'America/Bogota')
     and creado_en <  ((dia + 1)::timestamp at time zone 'America/Bogota')
   group by ruta, pais, dispositivo
  -- Rehacer el resumen de un día ya resumido lo reemplaza, no lo duplica: así
  -- correr esto dos veces es seguro.
  on conflict (fecha, ruta, pais, dispositivo) do update
    set vistas = excluded.vistas,
        unicos = excluded.unicos;
$$;

create or replace function public.purgar_visitas()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.visitas where creado_en < now() - interval '90 days';
$$;

revoke all on function public.resumir_visitas(date) from public;
revoke all on function public.purgar_visitas() from public;

-- ---------------------------------------------------------------------------
-- Automatizarlo, si pg_cron está disponible.
--
-- Va dentro de un bloque que se traga el error a propósito: si la extensión no
-- está encendida en este proyecto, el resto de la migración ya quedó aplicado y
-- lo único que falta es agendar. Se puede encender después desde
-- Database → Extensions y volver a correr este archivo.
--
-- Las horas son UTC. Bogotá es UTC-5, así que 05:30 UTC = 00:30 de acá: ya pasó
-- la medianoche local y el día que se va a resumir está cerrado.
do $$
begin
  create extension if not exists pg_cron;

  perform cron.unschedule('resumir-visitas');
  perform cron.unschedule('purgar-visitas');
exception
  when others then null;
end $$;

do $$
begin
  perform cron.schedule('resumir-visitas', '30 5 * * *', 'select public.resumir_visitas()');
  perform cron.schedule('purgar-visitas',  '45 5 * * *', 'select public.purgar_visitas()');
exception
  when others then
    raise notice 'pg_cron no disponible: agenda resumir_visitas() y purgar_visitas() a mano.';
end $$;
