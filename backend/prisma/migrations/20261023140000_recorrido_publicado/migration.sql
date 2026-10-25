-- E10 / RN-081: recorridos del historial publicados para la comunidad.
-- Snapshot de la traza propia al publicar; despublicar = activo=false. Sin velocidades (RN-070).

-- CreateTable
CREATE TABLE "recorrido_publicado" (
    "id" UUID NOT NULL,
    "viaje_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "nombre" TEXT,
    "tipo_actividad" "TipoActividad" NOT NULL,
    "distancia_m" DOUBLE PRECISION NOT NULL,
    "tiempo_seg" INTEGER NOT NULL,
    "segmentos" JSONB NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "publicado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recorrido_publicado_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recorrido_publicado_viaje_id_usuario_id_key" ON "recorrido_publicado"("viaje_id", "usuario_id");
CREATE INDEX "recorrido_publicado_activo_publicado_at_idx" ON "recorrido_publicado"("activo", "publicado_at");
CREATE INDEX "recorrido_publicado_usuario_id_idx" ON "recorrido_publicado"("usuario_id");

ALTER TABLE "recorrido_publicado"
  ADD CONSTRAINT "recorrido_publicado_viaje_id_fkey"
  FOREIGN KEY ("viaje_id") REFERENCES "viaje"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recorrido_publicado"
  ADD CONSTRAINT "recorrido_publicado_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
