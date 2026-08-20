-- Vista: Resumen de visitas por día (agregado total)
-- Muestra: Fecha | Total Visitas | Visitantes Únicos
--
-- Se actualiza automáticamente cada día a las 05:30 UTC (00:30 Bogotá)
-- vía el cron job resumir_visitas() que ya existe.

drop view if exists public.visitas_por_dia cascade;

create or replace view public.visitas_por_dia with (security_invoker = true) as
select
  fecha,
  sum(vistas)::integer as total_vistas,
  sum(unicos)::integer as visitantes_unicos
from public.visitas_diarias
group by fecha
order by fecha desc;

comment on view public.visitas_por_dia is 'Resumen diario de visitas: fecha, total de visitas, visitantes únicos. Se recalcula automáticamente cada 05:30 UTC.';

-- Vista: Datos en vivo del día actual (se actualiza al consultar)
-- Muestra: Fecha | Visitas de Hoy | Visitantes Únicos Hoy
--
-- Esta vista NO es agregada: se calcula en tiempo real cada consulta.
-- Útil para el dashboard en vivo que muestra las visitas del día actual.

drop view if exists public.visitas_hoy_en_vivo cascade;

create or replace view public.visitas_hoy_en_vivo with (security_invoker = true) as
select
  (now() at time zone 'America/Bogota')::date as fecha,
  sum(case when ruta = '/' then 1 else 0 end)::integer as visitas_hoy,
  count(distinct visitante)::integer as unicos_hoy
from public.visitas
where creado_en >= (now() at time zone 'America/Bogota')::date;

comment on view public.visitas_hoy_en_vivo is 'Datos en vivo del tráfico del día actual: fecha local, visitas totales, visitantes únicos. Se recalcula cada consulta.';
