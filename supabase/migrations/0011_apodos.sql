-- Cómo le dices tú a cada contacto: "pa", "ana riaza", "el jefe".
--
-- Distinto de `alias`, que son las grafías que usa el banco. Un apodo lo eliges
-- tú y sirve para lo contrario: reconocer a quién te refieres cuando hablas, y
-- dejar escrito el nombre completo en su lugar.
alter table public.contactos
  add column if not exists apodos text[] not null default '{}';
