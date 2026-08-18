-- Roles personalizables por permiso.
--
-- Hasta ahora perfiles.rol solo admite 'admin' o 'usuario', y las acciones del
-- Superadmin comparten un único candado: rol === 'admin', todo o nada. Esto
-- añade una capa aditiva: Julian puede crear roles con nombre propio (ej.
-- "Supervisor") y marcarles a mano cuáles de estos 7 permisos tienen, sin
-- tocar el modelo admin/usuario que ya existe.
--
-- 'admin' se queda FIJO e INTOCABLE por diseño: no es una fila de `roles`, es
-- el valor de perfiles.rol, y tiene acceso total sin mirar estas tablas. Así
-- nunca se puede bloquear el acceso del admin borrando o editando mal un rol
-- personalizado — es la misma garantía que ya tenía es_admin().

create table if not exists public.permisos (
  clave       text primary key,
  descripcion text not null
);

-- Catálogo cerrado en una tabla, no un check constraint por columna: añadir un
-- permiso 8 el día de mañana es un insert, no una migración de esquema.
insert into public.permisos (clave, descripcion) values
  ('crear_usuario',      'Crear cuentas nuevas'),
  ('editar_usuario',     'Editar cuentas existentes'),
  ('eliminar_usuario',   'Eliminar cuentas'),
  ('impersonar_usuario', 'Entrar como otro usuario'),
  ('ver_auditoria',      'Ver el registro de auditoría'),
  ('ver_metricas_ia',    'Ver métricas e historial del Asesor IA'),
  ('ver_visitantes',     'Ver analítica de visitantes')
on conflict (clave) do nothing;

-- `id text`, no `uuid` con gen_random_uuid(): ninguna otra tabla del proyecto
-- usa esa función (todas reciben el id ya generado desde la aplicación), así
-- que asumir que pgcrypto está habilitado sería una dependencia sin verificar.
-- server.ts ya genera ids con este mismo patrón (`log-${Date.now()}-...`) para
-- los registros de auditoría; se sigue el mismo estilo aquí.
create table if not exists public.roles (
  id          text primary key,
  nombre      text not null unique,
  descripcion text,
  created_at  timestamptz not null default now()
);

-- Qué permisos tiene marcados cada rol personalizado.
create table if not exists public.permisos_por_rol (
  rol_id  text not null references public.roles(id) on delete cascade,
  permiso text not null references public.permisos(clave) on delete cascade,
  primary key (rol_id, permiso)
);

-- ---------------------------------------------------------------------------
-- A qué rol personalizado pertenece un perfil, si a alguno.
--
-- Nullable y separada de `rol` a propósito: no reemplaza el modelo admin/
-- usuario, lo extiende. Nace null en todas las filas existentes — ningún
-- backfill, cero cambio de comportamiento el día del deploy.
--
-- Va ANTES de tiene_permiso(): una función `language sql` se valida contra el
-- catálogo al crearse (a diferencia de plpgsql, que solo se revisa al
-- ejecutarse), así que definirla primero y esta columna después falla en el
-- acto con "column does not exist" — el orden aquí no es cosmético.
alter table public.perfiles
  add column if not exists rol_personalizado_id text references public.roles(id) on delete set null;

-- ---------------------------------------------------------------------------
-- ¿Quién tiene tal permiso?
--
-- Reusa es_admin() en vez de reimplementar el chequeo de admin — una sola
-- fuente de verdad de "quién es admin", no dos que puedan desalinearse. Para
-- el resto, busca el rol_personalizado_id del que llama y revisa si ese rol
-- tiene el permiso marcado.
--
-- SECURITY DEFINER por la misma razón que es_admin(): se usa dentro de
-- policies de RLS, y si la consulta a perfiles/permisos_por_rol volviera a
-- pasar por RLS se llamaría a sí misma.
create or replace function public.tiene_permiso(permiso_buscado text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.es_admin()
    or exists (
      select 1
      from public.perfiles p
      join public.permisos_por_rol pr on pr.rol_id = p.rol_personalizado_id
      where p.id = (select auth.uid())
        and pr.permiso = permiso_buscado
    );
$$;

revoke all on function public.tiene_permiso(text) from public;
grant execute on function public.tiene_permiso(text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS de las tablas nuevas.
alter table public.permisos enable row level security;
alter table public.roles enable row level security;
alter table public.permisos_por_rol enable row level security;

-- El catálogo de permisos es solo lectura para cualquier autenticado (la UI de
-- checkboxes necesita listarlo), pero nadie lo modifica salvo esta migración.
drop policy if exists permisos_leer on public.permisos;
create policy permisos_leer on public.permisos
  for select to authenticated
  using (true);

-- roles y permisos_por_rol: admin-only para TODO, incluida la lectura. Es a
-- propósito: el único lector que un usuario con rol personalizado necesita es
-- /api/mis-permisos, que corre con el cliente de service-role (bypass total de
-- RLS) — así que no hace falta abrir SELECT aquí para que alguien vea sus
-- propios permisos, y evita que cualquiera pueda listar todos los roles del
-- sistema con sus permisos con solo iniciar sesión.
drop policy if exists roles_admin_todo on public.roles;
create policy roles_admin_todo on public.roles
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

drop policy if exists permisos_por_rol_admin_todo on public.permisos_por_rol;
create policy permisos_por_rol_admin_todo on public.permisos_por_rol
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- ---------------------------------------------------------------------------
-- telemetria_ia y visitas pasan de es_admin() al permiso puntual. Un rol
-- personalizado con 'ver_metricas_ia' o 'ver_visitantes' marcado ahora puede
-- leer estas tablas sin ser admin.
drop policy if exists telemetria_ia_leer on public.telemetria_ia;
create policy telemetria_ia_leer on public.telemetria_ia
  for select to authenticated
  using (public.tiene_permiso('ver_metricas_ia'));

drop policy if exists visitas_leer on public.visitas;
create policy visitas_leer on public.visitas
  for select to authenticated
  using (public.tiene_permiso('ver_visitantes'));

-- visitas_diarias no la lee nadie en el frontend hoy, pero es la misma
-- información agregada de la misma tabla — dejarla en es_admin() mientras su
-- hermana pasa a tiene_permiso() sería una inconsistencia dormida.
drop policy if exists visitas_diarias_leer on public.visitas_diarias;
create policy visitas_diarias_leer on public.visitas_diarias
  for select to authenticated
  using (public.tiene_permiso('ver_visitantes'));

-- ---------------------------------------------------------------------------
-- perfiles: la pestaña "Usuarios" del Superadmin lee la tabla completa
-- directo con el cliente de Supabase (fetchUsuarios en SuperadminPanel.tsx),
-- no a través de un endpoint de servidor. Su policy de hoy (0002) solo deja
-- ver la fila propia o ser admin — un rol personalizado con, por ejemplo,
-- 'crear_usuario' marcado quedaría viendo una lista vacía, aunque el backend
-- sí le dejara crear usuarios. Se amplía a cualquiera de los 4 permisos de
-- gestión de usuarios: los cuatro comparten la misma pestaña en la UI, así
-- que quien tiene uno necesita ver la lista para usarla.
drop policy if exists perfiles_leer on public.perfiles;
create policy perfiles_leer on public.perfiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or public.es_admin()
    or public.tiene_permiso('crear_usuario')
    or public.tiene_permiso('editar_usuario')
    or public.tiene_permiso('eliminar_usuario')
    or public.tiene_permiso('impersonar_usuario')
  );
