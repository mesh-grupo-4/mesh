-- RN-075 / E09: racha de semanas consecutivas con al menos un viaje finalizado.
-- Una fila por usuario; se actualiza al finalizar un viaje (ViajesService.generarResumen)
-- y la rotura por inactividad se detecta/notifica desde el job diario (src/jobs/rachasJob.ts).

CREATE TABLE "racha_actividad" (
    "usuario_id" UUID NOT NULL,
    "semanas_consecutivas" INTEGER NOT NULL DEFAULT 0,
    "inicio_racha" TIMESTAMP(3) NOT NULL,
    "ultima_actividad" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "racha_actividad_pkey" PRIMARY KEY ("usuario_id")
);

ALTER TABLE "racha_actividad"
  ADD CONSTRAINT "racha_actividad_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
