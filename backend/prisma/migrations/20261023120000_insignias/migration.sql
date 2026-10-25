-- E09 / RN-074: catálogo de insignias y las que cada usuario fue consiguiendo.
-- Criterios (distancia, duración, tipo de actividad) son independientes entre sí
-- (AND) y opcionales. Nunca hay criterio de velocidad (RN-070).

-- CreateTable
CREATE TABLE "insignia" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "icono" TEXT NOT NULL,
    "criterio_distancia_m" DOUBLE PRECISION,
    "criterio_duracion_seg" INTEGER,
    "criterio_actividad" "TipoActividad",
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insignia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "insignia_codigo_key" ON "insignia"("codigo");

-- CreateTable
CREATE TABLE "usuario_insignia" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "insignia_id" UUID NOT NULL,
    "viaje_id" UUID,
    "obtenida_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_insignia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usuario_insignia_usuario_id_insignia_id_key" ON "usuario_insignia"("usuario_id", "insignia_id");
CREATE INDEX "usuario_insignia_usuario_id_idx" ON "usuario_insignia"("usuario_id");

ALTER TABLE "usuario_insignia"
  ADD CONSTRAINT "usuario_insignia_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "usuario_insignia"
  ADD CONSTRAINT "usuario_insignia_insignia_id_fkey"
  FOREIGN KEY ("insignia_id") REFERENCES "insignia"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "usuario_insignia"
  ADD CONSTRAINT "usuario_insignia_viaje_id_fkey"
  FOREIGN KEY ("viaje_id") REFERENCES "viaje"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Catálogo inicial. Idempotente (ON CONFLICT DO NOTHING) para poder re-correr
-- la migración sin duplicar si alguna vez se la vuelve a aplicar a mano.
INSERT INTO "insignia"
  ("id", "codigo", "nombre", "descripcion", "icono", "criterio_distancia_m", "criterio_duracion_seg", "criterio_actividad")
VALUES
  ('a1000000-0000-4000-8000-000000000001', 'primer_recorrido', 'Primer recorrido', 'Completaste tu primer viaje con Mesh.', 'flag', NULL, NULL, NULL),
  ('a1000000-0000-4000-8000-000000000002', 'hora_en_marcha', 'Hora en marcha', 'Más de 1 hora en movimiento en un mismo viaje.', 'clock', NULL, 3600, NULL),
  ('a1000000-0000-4000-8000-000000000003', 'diez_k_running', '10K', 'Corriste 10 km o más en un mismo viaje.', 'zap', 10000, NULL, 'running'),
  ('a1000000-0000-4000-8000-000000000004', 'media_maraton', 'Media maratón', 'Corriste 21 km o más en un mismo viaje.', 'award', 21097, NULL, 'running'),
  ('a1000000-0000-4000-8000-000000000005', 'cincuenta_k_bici', '50K en bici', '50 km o más en bicicleta en un mismo viaje.', 'zap', 50000, NULL, 'bici'),
  ('a1000000-0000-4000-8000-000000000006', 'centurion_bici', 'Centurión', '100 km o más en bicicleta en un mismo viaje.', 'award', 100000, NULL, 'bici'),
  ('a1000000-0000-4000-8000-000000000007', 'trekker_resistente', 'Trekker resistente', '3 horas o más de trekking en un mismo viaje.', 'award', NULL, 10800, 'trekking'),
  ('a1000000-0000-4000-8000-000000000008', 'rodador_100', 'Rodador de 100', '100 km o más en moto en un mismo viaje.', 'map', 100000, NULL, 'moto')
ON CONFLICT ("codigo") DO NOTHING;
