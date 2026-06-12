-- AlterTable: parámetros de coordinación por tipo de actividad (RN-021 / SCRUM-25)
ALTER TABLE "viaje" ADD COLUMN "velocidad_esperada" DOUBLE PRECISION;
ALTER TABLE "viaje" ADD COLUMN "distancia_max_separacion" INTEGER;

UPDATE "viaje" SET "velocidad_esperada" = 120, "distancia_max_separacion" = 1000 WHERE "tipo_actividad" = 'moto';
UPDATE "viaje" SET "velocidad_esperada" = 35, "distancia_max_separacion" = 300 WHERE "tipo_actividad" = 'bici';
UPDATE "viaje" SET "velocidad_esperada" = 15, "distancia_max_separacion" = 100 WHERE "tipo_actividad" = 'running';
UPDATE "viaje" SET "velocidad_esperada" = 5, "distancia_max_separacion" = 50 WHERE "tipo_actividad" = 'trekking';

ALTER TABLE "viaje" ALTER COLUMN "velocidad_esperada" SET NOT NULL;
ALTER TABLE "viaje" ALTER COLUMN "distancia_max_separacion" SET NOT NULL;
