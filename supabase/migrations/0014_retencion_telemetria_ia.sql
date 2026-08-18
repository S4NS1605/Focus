-- Retención de 90 días para telemetria_ia, igual que visitas (0012_visitas.sql).
--
-- A diferencia de visitas, esta tabla no es anónima: guarda usuario_email y el
-- texto completo de cada pregunta y respuesta, que puede incluir montos, saldos
-- y deudas reales — es el contenido de finanzasContext que arma AsesorView.tsx
-- para dárselo al modelo. Guardarlo para siempre no tiene mejor justificación
-- aquí que en visitas, así que se le aplica el mismo límite.
--
-- Sin tabla de agregados: a diferencia de visitas_diarias, nada en
-- /api/metricas-ia ni en el Superadmin consulta telemetria_ia más allá de "hoy"
-- (con un respaldo a "las 50 más recientes" si hoy está vacío), así que no hay
-- ningún panel de tendencia de meses que dependa de conservar los números viejos
-- por separado. Si el día de mañana se agrega uno, ahí sí hace falta un resumen
-- diario como el de visitas — hoy sería una tabla más para nada.

create or replace function public.purgar_telemetria_ia()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.telemetria_ia where creado_en < now() - interval '90 days';
$$;

revoke all on function public.purgar_telemetria_ia() from public;

-- ---------------------------------------------------------------------------
-- Automatizarlo, si pg_cron está disponible.
--
-- No hace falta `create extension` de nuevo: 0012_visitas.sql ya la encendió si
-- estaba disponible en este proyecto. Si no lo estaba, este bloque tampoco va a
-- poder agendar, y el aviso explica qué hacer.
--
-- Nombre de trabajo distinto a 'purgar-visitas' — cron.schedule identifica cada
-- trabajo por su nombre, así que reutilizar uno existente lo reemplazaría en vez
-- de sumar este.
do $$
begin
  perform cron.schedule('purgar-telemetria-ia', '50 5 * * *', 'select public.purgar_telemetria_ia()');
exception
  when others then
    raise notice 'pg_cron no disponible: agenda purgar_telemetria_ia() a mano, o enciende la extensión en Database → Extensions y vuelve a correr este archivo.';
end $$;
