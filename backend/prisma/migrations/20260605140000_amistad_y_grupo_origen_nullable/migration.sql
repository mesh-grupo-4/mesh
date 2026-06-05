-- CreateEnum
CREATE TYPE "EstadoAmistad" AS ENUM ('pendiente', 'aceptada', 'rechazada');

-- AlterTable
ALTER TABLE "grupo_invitacion" ALTER COLUMN "grupo_origen_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "amistad" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "solicitante_id" UUID NOT NULL,
    "destinatario_id" UUID NOT NULL,
    "estado" "EstadoAmistad" NOT NULL DEFAULT 'pendiente',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amistad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "amistad_solicitante_id_destinatario_id_key" ON "amistad"("solicitante_id", "destinatario_id");

-- CreateIndex
CREATE INDEX "amistad_destinatario_id_estado_idx" ON "amistad"("destinatario_id", "estado");

-- AddForeignKey
ALTER TABLE "amistad" ADD CONSTRAINT "amistad_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amistad" ADD CONSTRAINT "amistad_destinatario_id_fkey" FOREIGN KEY ("destinatario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
