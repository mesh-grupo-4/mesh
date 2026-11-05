-- Rol superadmin y backoffice de la plataforma (RN-120 a RN-126).
--
--  1. `usuario.rol_sistema`: rol de PLATAFORMA (`usuario` | `superadmin`). No es un
--     rol de grupo: RN-011 sigue intacta (dentro de un grupo solo hay líder y
--     participante).
--  2. `usuario.suspendido_at` / `motivo_suspension`: suspensión de cuenta (RN-123).
--  3. `usuario.created_at`: fecha de alta, para el listado del backoffice. Las filas
--     existentes quedan con la fecha de esta migración (no hay un dato mejor).
--  4. `auditoria_admin`: bitácora append-only de cada acción del backoffice (RN-121).
--     Sin FK hacia la entidad afectada, para que sobreviva a su eliminación.

-- CreateEnum
CREATE TYPE "RolSistema" AS ENUM ('usuario', 'superadmin');

ALTER TABLE "usuario"
  ADD COLUMN "rol_sistema" "RolSistema" NOT NULL DEFAULT 'usuario',
  ADD COLUMN "suspendido_at" TIMESTAMP(3),
  ADD COLUMN "motivo_suspension" TEXT,
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "usuario_rol_sistema_idx" ON "usuario"("rol_sistema");

-- CreateTable
CREATE TABLE "auditoria_admin" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "accion" VARCHAR(60) NOT NULL,
    "entidad" VARCHAR(30) NOT NULL,
    "entidad_id" UUID NOT NULL,
    "detalle" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_admin_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auditoria_admin_created_at_idx" ON "auditoria_admin"("created_at");
CREATE INDEX "auditoria_admin_entidad_entidad_id_idx" ON "auditoria_admin"("entidad", "entidad_id");

ALTER TABLE "auditoria_admin"
  ADD CONSTRAINT "auditoria_admin_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "usuario"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
