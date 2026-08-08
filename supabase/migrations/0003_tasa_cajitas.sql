-- Tasa de rendimiento por cajita.
--
-- Se guarda como EFECTIVO ANUAL en porcentaje (13.5 = 13.5% E.A.) porque es la
-- única cifra que publican los bancos en Colombia: es el número que el usuario
-- puede leer en su app y escribir aquí sin convertir nada.
--
-- numeric, no float: una tasa es un decimal exacto, y float la volvería
-- 13.499999999999998 al leerla de vuelta.
alter table public.cajitas
  add column if not exists tasa_ea_pct numeric(6, 3)
  check (tasa_ea_pct is null or (tasa_ea_pct >= 0 and tasa_ea_pct <= 200));
