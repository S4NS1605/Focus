-- Movimientos que se repiten cada mes: arriendo, suscripciones, gimnasio.
--
-- La app NO los registra sola: los propone y espera confirmación. Un cobro que
-- no ocurrió y quedó escrito deja el saldo mintiendo, y eso no se nota hasta
-- que el mes cuadra mal. Por eso aquí no hay "última vez aplicado": lo que
-- decide si falta o no es el libro mismo.
create table if not exists public.recurrentes (
  id           uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  nombre       text not null check (length(trim(nombre)) > 0),
  kind         text not null check (kind in ('gasto', 'ingreso')),
  amount_cop   bigint not null check (amount_cop > 0),
  categoria    text not null,
  cuenta_id    uuid references public.cajitas (id) on delete set null,
  dia_del_mes  smallint not null check (dia_del_mes between 1 and 31),
  created_at   timestamptz not null default now(),
  archived_at  timestamptz
);

create index if not exists recurrentes_user_idx on public.recurrentes (user_id);

alter table public.recurrentes enable row level security;

drop policy if exists recurrentes_propios on public.recurrentes;
create policy recurrentes_propios on public.recurrentes
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
