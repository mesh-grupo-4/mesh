-- Un recorrido publicado pasa de una foto a varias (RN-081, hasta 5): se muestran como
-- carrusel en el detalle y la primera es la portada de la tarjeta de Explorar. La foto
-- que ya tuviera cada recorrido queda como única foto de su lista.
ALTER TABLE "recorrido_publicado" ADD COLUMN "fotos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "recorrido_publicado" SET "fotos" = ARRAY["foto"] WHERE "foto" IS NOT NULL;

ALTER TABLE "recorrido_publicado" DROP COLUMN "foto";
