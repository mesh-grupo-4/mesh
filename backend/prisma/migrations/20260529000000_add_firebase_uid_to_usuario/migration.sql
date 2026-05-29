-- Agrega firebase_uid a usuario.
-- Las filas existentes (datos de dev) reciben un placeholder único;
-- en producción esta tabla estará vacía al momento de la migración.
ALTER TABLE "usuario" ADD COLUMN "firebase_uid" TEXT;

UPDATE "usuario" SET "firebase_uid" = 'dev_placeholder_' || id WHERE "firebase_uid" IS NULL;

ALTER TABLE "usuario" ALTER COLUMN "firebase_uid" SET NOT NULL;

CREATE UNIQUE INDEX "usuario_firebase_uid_key" ON "usuario"("firebase_uid");
