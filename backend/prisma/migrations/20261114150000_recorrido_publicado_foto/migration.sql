-- Foto opcional de un recorrido publicado (RN-081): URL pública del archivo en Supabase
-- Storage (bucket `avatares`, carpeta `recorridos/{usuario_id}/{viaje_id}/`). Nullable:
-- sin foto, la tarjeta de Explorar se muestra como siempre.
ALTER TABLE "recorrido_publicado" ADD COLUMN "foto" TEXT;
