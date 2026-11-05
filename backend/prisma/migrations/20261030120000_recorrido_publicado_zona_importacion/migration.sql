-- E10 / SCRUM-62: explorar recorridos publicados por zona e importarlos como plantilla.

-- Punto de inicio del recorrido publicado, para filtrar por zona con ST_DWithin.
-- Nullable: una fila sin punto simplemente no entra en búsquedas por zona.
ALTER TABLE "recorrido_publicado"
  ADD COLUMN "inicio_lat" DOUBLE PRECISION,
  ADD COLUMN "inicio_lng" DOUBLE PRECISION;

-- Backfill desde el primer punto de la traza ya congelada (segmentos = [[lat, lng], ...][]).
UPDATE "recorrido_publicado"
SET
  "inicio_lat" = ("segmentos" -> 0 -> 0 ->> 0)::double precision,
  "inicio_lng" = ("segmentos" -> 0 -> 0 ->> 1)::double precision
WHERE jsonb_typeof("segmentos" -> 0 -> 0) = 'array';

-- RN-084: una plantilla puede venir de un link de ruta (ruta_compartida) o de un
-- recorrido publicado. Es una copia independiente (RN-086): si el recorrido
-- desaparece, la plantilla queda y solo pierde la referencia.
ALTER TABLE "ruta_plantilla"
  ALTER COLUMN "ruta_compartida_id" DROP NOT NULL,
  ADD COLUMN "recorrido_publicado_id" UUID;

-- Importar el mismo recorrido dos veces es idempotente por (usuario, recorrido).
CREATE UNIQUE INDEX "ruta_plantilla_usuario_id_recorrido_publicado_id_key"
  ON "ruta_plantilla"("usuario_id", "recorrido_publicado_id");

ALTER TABLE "ruta_plantilla"
  ADD CONSTRAINT "ruta_plantilla_recorrido_publicado_id_fkey"
  FOREIGN KEY ("recorrido_publicado_id") REFERENCES "recorrido_publicado"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
