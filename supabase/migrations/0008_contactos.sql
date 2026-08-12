-- Con quién mueves la plata.
--
-- La lista NO se escribe a mano: sale de lo que los extractos ya dijeron. Esta
-- tabla guarda solo lo que la app no puede deducir sola — que dos grafías son
-- la misma persona, y que dos que se parecen NO lo son.
--
-- `alias` son los nombres normalizados que caen en este contacto, y es lo que
-- une con los movimientos: la transacción no guarda un contacto_id, porque el
-- vínculo se recalcula desde la descripción y así un extracto reimportado no
-- puede quedar huérfano ni duplicado.
create table if not exists public.contactos (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  nombre      text not null check (length(trim(nombre)) > 0),
  alias       text[] not null default '{}',
  -- Los nombres que el usuario dijo explícitamente que NO son este contacto.
  -- Sin esto la misma pregunta vuelve en cada recarga, que es la forma más
  -- rápida de convertir una ayuda en una molestia.
  separado_de text[] not null default '{}',
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists contactos_user_idx on public.contactos (user_id);

alter table public.contactos enable row level security;

drop policy if exists contactos_propios on public.contactos;
create policy contactos_propios on public.contactos
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
