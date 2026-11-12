-- Foto del grupo: URL pública del archivo en Supabase Storage (bucket `avatares`,
-- carpeta `grupos/{grupo_id}/`). Nullable: sin foto, la app muestra las iniciales.
ALTER TABLE "grupo" ADD COLUMN "foto" TEXT;
