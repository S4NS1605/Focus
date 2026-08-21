-- Llaves para que el teléfono anote los gastos solo.
--
-- El caso: pagas con Apple Pay, y un Atajo del iPhone le manda el monto y el
-- comercio al servidor sin que abras nada. El Atajo no puede iniciar sesión
-- —no hay navegador, no hay pantalla, no hay nadie mirando— así que necesita
-- una credencial propia que valga para una sola cosa: anotar un movimiento.
--
-- Aquí NO se guarda la llave. Se guarda su sha256. Si alguien se lleva esta
-- tabla no se lleva ninguna credencial utilizable, y por eso mismo la llave se
-- enseña una única vez, cuando se crea: ni el servidor puede volver a leerla.
--
-- `pista` son los últimos cuatro caracteres, y existe para lo único que hace
-- falta desde la interfaz: reconocer cuál de tus llaves es la que tienes
-- pegada en el Atajo, sin que la app tenga que conocerla entera.
create table if not exists public.llaves_atajo (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- sha256 en hexadecimal de la llave. Único: dos llaves no pueden colisionar,
  -- y la búsqueda al validar es por este índice y no por user_id.
  hash        text not null unique,
  pista       text not null,
  -- Para qué la creaste. "iPhone de Julian", "iPad". Se enseña en la lista.
  etiqueta    text not null default 'Mi iPhone',
  creada_en   timestamptz not null default now(),
  -- La última vez que el teléfono la usó. Es lo que deja ver de un vistazo si
  -- el Atajo de verdad está funcionando, sin tener que buscar el movimiento.
  usada_en    timestamptz,
  -- Revocar no borra: la fila se queda para que la llave vieja siga siendo
  -- reconocible como revocada y no vuelva a valer si alguien la reutiliza.
  revocada_en timestamptz
);

-- Solo se listan las tuyas, y casi siempre solo las vivas.
create index if not exists llaves_atajo_user_idx
  on public.llaves_atajo (user_id)
  where revocada_en is null;

-- ------------------------------------------------------------------------- RLS
--
-- RLS encendida y SIN ninguna política, a propósito. No es un olvido.
--
-- Al resto de tablas de Finanzas entra el navegador con la clave publicable, y
-- por eso cada una lleva su política de "solo lo mío". A esta no entra el
-- navegador nunca: todo lo que la toca —crear, listar, revocar y validar— pasa
-- por el Express de Render con la llave de servicio, que se salta RLS por
-- definición. Sin políticas, `anon` y `authenticated` no pueden leer ni una
-- fila aunque alguien apunte la clave publicable directo a PostgREST.
alter table public.llaves_atajo enable row level security;
