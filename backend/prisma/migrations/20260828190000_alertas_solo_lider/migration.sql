-- AlterEnum
ALTER TYPE "OrigenAlerta" ADD VALUE 'integrante';

-- AlterTable
ALTER TABLE "viaje" ADD COLUMN "alertas_solo_lider" BOOLEAN NOT NULL DEFAULT true;
