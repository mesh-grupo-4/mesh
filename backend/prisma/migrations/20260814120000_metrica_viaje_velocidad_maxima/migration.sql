-- Agrega velocidad máxima al resumen por integrante (US: métricas grupales de viaje).
ALTER TABLE "metrica_viaje" ADD COLUMN "velocidad_maxima_kmh" DOUBLE PRECISION;
