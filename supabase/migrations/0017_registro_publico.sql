-- Registro público.
--
-- Hasta aquí las cuentas las creaba el admin a mano: no había registro, y varias
-- decisiones de 0002 se apoyaban en eso. Abrir el registro obliga a rehacer las
-- que dejaban de tenerse en pie.

-- ---------------------------------------------------------------------------
-- 1. Se va el login por nombre de usuario.
--
-- `correo_de_usuario` devolvía el correo de cualquiera que acertara un nombre.
-- 0002 lo justificaba así, con todas sus letras:
--
--     "Se acepta porque este sistema es cerrado (las cuentas las crea el
--      admin, no hay registro público)"
--
-- Esa premisa se acaba justo con esta migración. Con registro abierto,
-- cualquiera crea una cuenta, prueba nombres y se lleva los correos de todos
-- los usuarios. La función se borra y se entra solo con correo.
drop function if exists public.correo_de_usuario(text);

-- ---------------------------------------------------------------------------
-- 2. Saber si un nombre está libre, sin decir de quién es.
--
-- El formulario de registro necesita avisar "ese nombre ya está cogido" ANTES
-- de enviar, porque el índice único de abajo haría fallar el alta con un error
-- de base de datos que no le dice nada a nadie.
--
-- Devuelve un booleano y nada más. Que se pueda averiguar si un nombre existe
-- es inevitable en cualquier registro con nombres únicos —el propio formulario
-- lo dice al validar— y es una revelación de otro orden que entregar el correo.
create or replace function public.usuario_disponible(nombre text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select not exists (
    select 1 from public.perfiles where lower(usuario) = lower(trim(nombre))
  );
$$;

revoke all on function public.usuario_disponible(text) from public;
grant execute on function public.usuario_disponible(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Que un nombre repetido no tumbe el alta.
--
-- El trigger de 0002 hacía `on conflict (id) do nothing`, que cubre el id pero
-- no el índice único de `usuario`. Con el admin creando cuentas de una en una
-- eso no pasaba nunca; con registro abierto, dos personas pueden pedir el mismo
-- nombre con segundos de diferencia y la segunda se encontraba con el alta
-- caída y sin explicación — la cuenta de auth creada y sin perfil.
--
-- Ahora la colisión deja el nombre en NULL y la cuenta se crea igual. Quedarse
-- sin apodo se arregla desde Ajustes; quedarse sin cuenta, no.
create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nombre text := nullif(trim(new.raw_user_meta_data ->> 'usuario'), '');
begin
  begin
    insert into public.perfiles (id, email, usuario)
    values (new.id, new.email, nombre)
    on conflict (id) do nothing;
  exception
    when unique_violation then
      -- Solo puede ser el índice de `usuario`: el de `id` ya lo absorbe el
      -- ON CONFLICT de arriba.
      insert into public.perfiles (id, email, usuario)
      values (new.id, new.email, null)
      on conflict (id) do nothing;
  end;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Que cada quien pueda ponerse su propio nombre.
--
-- 0002 dejó `perfiles` sin política de escritura a propósito, para que nadie
-- pudiera ascenderse a admin desde el navegador. Eso se mantiene: esta política
-- permite cambiar el apodo y NADA más. El rol y el correo se quedan como
-- estaban — la comprobación de abajo es lo que lo garantiza, no la confianza.
drop policy if exists perfiles_editar_apodo on public.perfiles;
create policy perfiles_editar_apodo on public.perfiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and rol = (select p.rol from public.perfiles p where p.id = (select auth.uid()))
    and email = (select p.email from public.perfiles p where p.id = (select auth.uid()))
  );
