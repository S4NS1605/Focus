-- Categorías que crea el usuario, junto a las que ya trae la app.
--
-- Las básicas NO viven aquí: son código, iguales para todos, y meterlas en la
-- base obligaría a sembrarlas por usuario y a mantenerlas sincronizadas con el
-- parser y las plantillas de extracto, que las conocen por su nombre. Esta
-- tabla guarda solo lo que el usuario inventa.
--
-- `id` es text, no uuid: es exactamente el valor que queda escrito en
-- transacciones.category, junto a claves básicas como 'comida'. Una sola
-- columna con una sola clase de valor — un movimiento nunca tiene que mirar en
-- dos sitios para saber en qué categoría está.
create table if not exists public.categorias (
  id          text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  nombre      text not null check (length(trim(nombre)) > 0),
  icon        text not null default 'Package',
  color       text not null default '#A8A29E',
  created_at  timestamptz not null default now(),
  -- Se archiva, no se borra. Los movimientos del mes pasado siguen apuntando
  -- aquí, y borrar la fila convertiría ese gasto en una clave huérfana: el
  -- histórico cambiaría solo por ordenar la lista de hoy.
  archived_at timestamptz
);

create index if not exists categorias_user_idx on public.categorias (user_id);

-- Dos categorías con el mismo nombre son indistinguibles en un selector. El
-- índice es parcial porque una archivada sí puede compartir nombre con la
-- nueva que la reemplaza.
create unique index if not exists categorias_user_nombre_idx
  on public.categorias (user_id, lower(trim(nombre)))
  where archived_at is null;

alter table public.categorias enable row level security;

drop policy if exists categorias_propias on public.categorias;
create policy categorias_propias on public.categorias
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
