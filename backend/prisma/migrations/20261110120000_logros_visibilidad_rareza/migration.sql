-- RN-077: visibilidad de los logros del perfil (estadísticas, racha, insignias).
CREATE TYPE "VisibilidadLogros" AS ENUM ('todos', 'amigos', 'solo_yo');

ALTER TABLE "usuario"
  ADD COLUMN "visibilidad_logros" "VisibilidadLogros" NOT NULL DEFAULT 'todos';

-- RN-078: rareza fija por insignia; solo define cómo se ve.
CREATE TYPE "RarezaInsignia" AS ENUM ('comun', 'rara', 'epica', 'legendaria');

ALTER TABLE "insignia"
  ADD COLUMN "rareza" "RarezaInsignia" NOT NULL DEFAULT 'comun';

UPDATE "insignia" SET "rareza" = 'comun'      WHERE "codigo" IN ('primer_recorrido', 'hora_en_marcha');
UPDATE "insignia" SET "rareza" = 'rara'       WHERE "codigo" IN ('diez_k_running', 'cincuenta_k_bici');
UPDATE "insignia" SET "rareza" = 'epica'      WHERE "codigo" IN ('media_maraton', 'trekker_resistente', 'rodador_100');
UPDATE "insignia" SET "rareza" = 'legendaria' WHERE "codigo" IN ('centurion_bici');
