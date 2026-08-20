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
