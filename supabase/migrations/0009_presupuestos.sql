-- Topes de gasto mensual por categoría.
--
-- La clave es (user_id, categoria) y no un id generado: hay como máximo un
-- presupuesto por categoría, así que un id aparte solo abriría la puerta a dos
-- filas que se contradicen sobre el mismo tope.
--
-- `categoria` es text porque así son las claves de categoría en esta app —
-- básicas como 'comida' y propias como 'p-a1b2'. No hay llave foránea contra
-- `categorias` a propósito: las básicas viven en el código, no en la base.
create table if not exists public.presupuestos (
  user_id    uuid not null references auth.users (id) on delete cascade,
  categoria  text not null,
  monto_cop  bigint not null check (monto_cop > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, categoria)
);

alter table public.presupuestos enable row level security;

drop policy if exists presupuestos_propios on public.presupuestos;
create policy presupuestos_propios on public.presupuestos
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
