-- Telemetría e historial de consultas del Asesor IA
--
-- Guarda de forma persistente el consumo de tokens, latencia, modelo y el
-- historial de chat (pregunta y respuesta) para que el Superadmin pueda auditar
-- el uso y revisar las conversaciones aunque el servidor Node se reinicie.

create table if not exists public.telemetria_ia (
  id              text primary key,
  usuario_id      uuid references auth.users(id) on delete set null,
  usuario_email   text not null,
  proveedor       text not null,
  modelo          text not null,
  prompt_tokens   integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens    integer not null default 0,
  duracion_ms     integer not null default 0,
  exito           boolean not null default true,
  motivo          text,
  prompt_texto    text,
  respuesta_texto text,
  creado_en       timestamptz not null default now()
);

create index if not exists telemetria_ia_creado_idx on public.telemetria_ia (creado_en desc);
create index if not exists telemetria_ia_usuario_idx on public.telemetria_ia (usuario_id, creado_en desc);

-- RLS
alter table public.telemetria_ia enable row level security;

-- Solo el superadmin puede leer el historial de IA
drop policy if exists telemetria_ia_leer on public.telemetria_ia;
create policy telemetria_ia_leer on public.telemetria_ia
  for select to authenticated
  using (
    exists (
      select 1 from public.perfiles
      where perfiles.id = auth.uid()
        and perfiles.rol = 'admin'
    )
  );

-- El backend con service_role tiene bypass total de RLS para insertar y leer.
