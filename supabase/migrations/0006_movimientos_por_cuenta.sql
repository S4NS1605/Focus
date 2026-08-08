-- Atribuir cada movimiento a la cuenta por la que pasó.
--
-- Sin esto los saldos son islas: registras un gasto y la cuenta no se entera,
-- así que hay que mantenerla a mano. Con esto el saldo pasa a ser lo que la
-- cuenta tenía más lo que ha movido, y se mantiene solo.
--
-- `on delete set null`, no cascade: borrar una cuenta no puede llevarse por
-- delante el historial de gastos: el dinero se gastó igual, solo se pierde el
-- dato de por dónde salió.
alter table public.transacciones
  add column if not exists cuenta_id uuid references public.cajitas (id) on delete set null;

create index if not exists transacciones_cuenta_idx
  on public.transacciones (user_id, cuenta_id);
