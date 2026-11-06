-- RN-029b / RN-029c: presencia en el viaje.
-- `confirmado` pasa a significar solo "dije que voy". La presencia real se marca con
-- `check_in_at` ("Me sumo") y quien confirmó pero nunca se sumó queda `ausente`.

-- AlterEnum (el valor nuevo no se usa en esta migración: Postgres no permite usarlo
-- dentro de la misma transacción en que se agrega).
ALTER TYPE "EstadoViajeIntegrante" ADD VALUE 'ausente';

-- AlterTable
ALTER TABLE "viaje_integrante" ADD COLUMN "check_in_at" TIMESTAMP(3);

-- Backfill: los viajes que ya están en curso al desplegar no pueden quedarse sin
-- tracking. Se toma como presentes a todos sus confirmados desde el inicio real.
-- Los viajes finalizados quedan intactos: ahí `check_in_at = NULL` no significa nada.
UPDATE "viaje_integrante" vi
SET "check_in_at" = COALESCE(v."fecha_inicio_real", CURRENT_TIMESTAMP)
FROM "viaje" v
WHERE vi."viaje_id" = v."id"
  AND v."estado" = 'en_curso'
  AND vi."estado" = 'confirmado';
