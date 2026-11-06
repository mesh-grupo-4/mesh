-- Aprovecha todo lo que entrega el GPS del dispositivo: altitud (con su precisión
-- vertical), velocidad medida por el chip y rumbo. Columnas nullables: las apps
-- viejas siguen mandando solo lat/lng/precisión (RN-038, sin romper la ingesta).
ALTER TABLE "registro_gps" ADD COLUMN "altitud_m" DOUBLE PRECISION;
ALTER TABLE "registro_gps" ADD COLUMN "precision_altitud_m" DOUBLE PRECISION;
ALTER TABLE "registro_gps" ADD COLUMN "velocidad_kmh" DOUBLE PRECISION;
ALTER TABLE "registro_gps" ADD COLUMN "rumbo_grados" DOUBLE PRECISION;

-- Altimetría por integrante en el cierre del viaje.
ALTER TABLE "metrica_viaje" ADD COLUMN "desnivel_positivo_m" DOUBLE PRECISION;
ALTER TABLE "metrica_viaje" ADD COLUMN "desnivel_negativo_m" DOUBLE PRECISION;
ALTER TABLE "metrica_viaje" ADD COLUMN "altitud_max_m" DOUBLE PRECISION;
ALTER TABLE "metrica_viaje" ADD COLUMN "altitud_min_m" DOUBLE PRECISION;
