-- Cuentas bancarias, sobre la misma tabla que las cajitas.
--
-- Una cuenta y una cajita son la misma estructura: un saldo que el usuario
-- mantiene a mano, con su historial de movimientos detrás. Separarlas en dos
-- tablas habría duplicado el saldo, el ajuste, el historial y el rendimiento.
--
-- El default es 'cajita' para que las filas creadas antes de que existieran las
-- cuentas sigan cargando con su significado original.
alter table public.cajitas
  add column if not exists tipo text not null default 'cajita'
  check (tipo in ('cuenta', 'cajita'));

create index if not exists cajitas_user_tipo_idx on public.cajitas (user_id, tipo);
