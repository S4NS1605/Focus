-- Deudas y tarjetas de crédito, sobre la misma tabla.
--
-- Son la misma estructura INVERTIDA: el saldo es lo que debes, no lo que
-- tienes, así que una compra lo sube y un abono lo baja. Compartir la forma
-- evita duplicar el saldo, el historial y el flujo de "solo dime el número".
alter table public.cajitas
  drop constraint if exists cajitas_tipo_check;

alter table public.cajitas
  add constraint cajitas_tipo_check
  check (tipo in ('cuenta', 'cajita', 'deuda', 'tarjeta'));

-- Qué fue cada cargo. Solo tiene sentido en tarjetas y deudas, donde el punto
-- entero es poder decir en qué se gastó: un saldo que solo sube sin explicación
-- es justo el problema que tiene un extracto de tarjeta.
alter table public.cajita_movimientos
  add column if not exists categoria text;

alter table public.cajita_movimientos
  drop constraint if exists cajita_movimientos_kind_check;

alter table public.cajita_movimientos
  add constraint cajita_movimientos_kind_check
  check (kind in ('deposito', 'retiro', 'rendimiento', 'ajuste', 'compra', 'abono'));
