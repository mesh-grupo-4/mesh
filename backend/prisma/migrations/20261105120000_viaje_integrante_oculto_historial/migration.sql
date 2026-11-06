-- Quitar un viaje finalizado del historial propio sin afectar al resto del grupo.

-- AlterTable
ALTER TABLE "viaje_integrante" ADD COLUMN "oculto_en_historial" BOOLEAN NOT NULL DEFAULT false;
