-- Rumbo en la ubicación viva: el mapa grupal gira la flecha de cada integrante
-- según hacia dónde se mueve. Viaja también por Supabase Realtime (fila completa).
ALTER TABLE "ubicacion_viva" ADD COLUMN "rumbo_grados" DOUBLE PRECISION;
