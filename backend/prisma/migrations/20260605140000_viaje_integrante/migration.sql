-- CreateEnum
CREATE TYPE "EstadoViajeIntegrante" AS ENUM ('pendiente', 'confirmado', 'rechazado');

-- CreateEnum
CREATE TYPE "OrigenViajeIntegrante" AS ENUM ('creador', 'qr', 'link', 'grupo');

-- CreateTable
CREATE TABLE "viaje_integrante" (
    "viaje_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "estado" "EstadoViajeIntegrante" NOT NULL,
    "origen" "OrigenViajeIntegrante" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "viaje_integrante_pkey" PRIMARY KEY ("viaje_id","usuario_id")
);

-- Migrar creadores existentes como participantes confirmados
INSERT INTO "viaje_integrante" ("viaje_id", "usuario_id", "estado", "origen", "created_at")
SELECT "id", "creador_id", 'confirmado', 'creador', NOW()
FROM "viaje";

-- Migrar miembros del grupo vinculado (si existía) como invitaciones pendientes
INSERT INTO "viaje_integrante" ("viaje_id", "usuario_id", "estado", "origen", "created_at")
SELECT v."id", gm."usuario_id", 'pendiente', 'grupo', NOW()
FROM "viaje" v
INNER JOIN "grupo_miembro" gm ON gm."grupo_id" = v."grupo_id"
WHERE v."grupo_id" IS NOT NULL
  AND gm."usuario_id" <> v."creador_id"
ON CONFLICT ("viaje_id", "usuario_id") DO NOTHING;

-- DropForeignKey
ALTER TABLE "viaje" DROP CONSTRAINT IF EXISTS "viaje_grupo_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "viaje_grupo_id_idx";

-- AlterTable
ALTER TABLE "viaje" DROP COLUMN "grupo_id";

-- CreateIndex
CREATE INDEX "viaje_integrante_usuario_id_estado_idx" ON "viaje_integrante"("usuario_id", "estado");

-- AddForeignKey
ALTER TABLE "viaje_integrante" ADD CONSTRAINT "viaje_integrante_viaje_id_fkey" FOREIGN KEY ("viaje_id") REFERENCES "viaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viaje_integrante" ADD CONSTRAINT "viaje_integrante_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
