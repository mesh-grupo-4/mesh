-- Vincula usuario de Firebase con fila en PostgreSQL (RN-001: email único).
ALTER TABLE "usuario" ADD COLUMN IF NOT EXISTS "firebase_uid" TEXT;

UPDATE "usuario"
SET "firebase_uid" = 'legacy_' || "id"::text
WHERE "firebase_uid" IS NULL;

ALTER TABLE "usuario" ALTER COLUMN "firebase_uid" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "usuario_firebase_uid_key" ON "usuario"("firebase_uid");
