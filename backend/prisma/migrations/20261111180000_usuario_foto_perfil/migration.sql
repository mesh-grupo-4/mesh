-- Foto de perfil: URL pública del archivo en Supabase Storage (bucket `avatares`).
-- Nullable: sin foto, la app muestra las iniciales como hasta ahora.
ALTER TABLE "usuario" ADD COLUMN "foto_perfil" TEXT;
