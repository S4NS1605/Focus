-- Migration 0017: Fix para conteo de visitas_hoy_en_vivo
-- Corrección: contar todas las páginas visitadas hoy y no únicamente la ruta raíz '/'

drop view if exists public.visitas_hoy_en_vivo cascade;

create or replace view public.visitas_hoy_en_vivo with (security_invoker = true) as
select
  (now() at time zone 'America/Bogota')::date as fecha,
  count(*)::integer as visitas_hoy,
  count(distinct visitante)::integer as unicos_hoy
from public.visitas
where creado_en >= ((now() at time zone 'America/Bogota')::date::timestamp at time zone 'America/Bogota');

comment on view public.visitas_hoy_en_vivo is 'Datos en vivo del tráfico del día actual: fecha local, visitas totales, visitantes únicos. Se recalcula cada consulta.';
