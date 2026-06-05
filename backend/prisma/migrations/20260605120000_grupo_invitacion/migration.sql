-- CreateEnum
CREATE TYPE "EstadoInvitacionGrupo" AS ENUM ('pendiente', 'aceptada', 'rechazada');

-- CreateTable
CREATE TABLE "grupo_invitacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "grupo_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "invitado_por_id" UUID NOT NULL,
    "grupo_origen_id" UUID NOT NULL,
    "estado" "EstadoInvitacionGrupo" NOT NULL DEFAULT 'pendiente',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grupo_invitacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "grupo_invitacion_grupo_id_usuario_id_key" ON "grupo_invitacion"("grupo_id", "usuario_id");

-- CreateIndex
CREATE INDEX "grupo_invitacion_usuario_id_estado_idx" ON "grupo_invitacion"("usuario_id", "estado");

-- AddForeignKey
ALTER TABLE "grupo_invitacion" ADD CONSTRAINT "grupo_invitacion_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_invitacion" ADD CONSTRAINT "grupo_invitacion_grupo_origen_id_fkey" FOREIGN KEY ("grupo_origen_id") REFERENCES "grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_invitacion" ADD CONSTRAINT "grupo_invitacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_invitacion" ADD CONSTRAINT "grupo_invitacion_invitado_por_id_fkey" FOREIGN KEY ("invitado_por_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
