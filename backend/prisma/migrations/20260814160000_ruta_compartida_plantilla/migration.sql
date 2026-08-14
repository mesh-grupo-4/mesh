-- Link privado de ruta planificada + plantillas de perfil (RN-085–088).

CREATE TABLE "ruta_compartida" (
    "id" UUID NOT NULL,
    "ruta_id" UUID,
    "token" VARCHAR(64) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocado_en" TIMESTAMP(3),

    CONSTRAINT "ruta_compartida_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ruta_compartida_ruta_id_key" ON "ruta_compartida"("ruta_id");
CREATE UNIQUE INDEX "ruta_compartida_token_key" ON "ruta_compartida"("token");

ALTER TABLE "ruta_compartida"
  ADD CONSTRAINT "ruta_compartida_ruta_id_fkey"
  FOREIGN KEY ("ruta_id") REFERENCES "ruta"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ruta_plantilla" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "ruta_compartida_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo_actividad" "TipoActividad" NOT NULL,
    "origen_lat" DOUBLE PRECISION NOT NULL,
    "origen_lng" DOUBLE PRECISION NOT NULL,
    "origen_nombre" TEXT,
    "destino_lat" DOUBLE PRECISION NOT NULL,
    "destino_lng" DOUBLE PRECISION NOT NULL,
    "destino_nombre" TEXT,
    "linestring_geojson" JSONB NOT NULL,
    "distancia_planeada_m" DOUBLE PRECISION,
    "tiempo_estimado_seg" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ruta_plantilla_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ruta_plantilla_usuario_id_ruta_compartida_id_key"
  ON "ruta_plantilla"("usuario_id", "ruta_compartida_id");
CREATE INDEX "ruta_plantilla_usuario_id_created_at_idx"
  ON "ruta_plantilla"("usuario_id", "created_at");

ALTER TABLE "ruta_plantilla"
  ADD CONSTRAINT "ruta_plantilla_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ruta_plantilla"
  ADD CONSTRAINT "ruta_plantilla_ruta_compartida_id_fkey"
  FOREIGN KEY ("ruta_compartida_id") REFERENCES "ruta_compartida"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ruta_plantilla_parada" (
    "id" UUID NOT NULL,
    "ruta_plantilla_id" UUID NOT NULL,
    "orden" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "nombre" TEXT,
    "categoria" "CategoriaParada" NOT NULL DEFAULT 'otro',

    CONSTRAINT "ruta_plantilla_parada_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ruta_plantilla_parada_ruta_plantilla_id_orden_key"
  ON "ruta_plantilla_parada"("ruta_plantilla_id", "orden");

ALTER TABLE "ruta_plantilla_parada"
  ADD CONSTRAINT "ruta_plantilla_parada_ruta_plantilla_id_fkey"
  FOREIGN KEY ("ruta_plantilla_id") REFERENCES "ruta_plantilla"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
