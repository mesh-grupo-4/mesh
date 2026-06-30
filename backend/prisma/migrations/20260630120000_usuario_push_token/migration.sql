-- Push notifications (Expo): token por dispositivo en usuario.
ALTER TABLE "usuario" ADD COLUMN IF NOT EXISTS "push_token" TEXT;
