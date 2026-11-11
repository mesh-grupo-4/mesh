-- RN-066: circuitos de entrenamiento y repetición de sesiones.

ALTER TABLE "viaje" ADD COLUMN "repite_viaje_id" UUID;

ALTER TABLE "viaje"
  ADD CONSTRAINT "viaje_repite_viaje_id_fkey"
  FOREIGN KEY ("repite_viaje_id") REFERENCES "viaje"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "circuito_entrenamiento" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "tipo_actividad" "TipoActividad" NOT NULL,
    "ruta_plantilla_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "circuito_entrenamiento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "circuito_entrenamiento_usuario_id_ruta_plantilla_id_key"
  ON "circuito_entrenamiento"("usuario_id", "ruta_plantilla_id");
CREATE INDEX "circuito_entrenamiento_usuario_id_idx"
  ON "circuito_entrenamiento"("usuario_id");

ALTER TABLE "circuito_entrenamiento"
  ADD CONSTRAINT "circuito_entrenamiento_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "circuito_entrenamiento"
  ADD CONSTRAINT "circuito_entrenamiento_ruta_plantilla_id_fkey"
  FOREIGN KEY ("ruta_plantilla_id") REFERENCES "ruta_plantilla"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "circuito_sesion" (
    "usuario_id" UUID NOT NULL,
    "viaje_id" UUID NOT NULL,
    "circuito_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "circuito_sesion_pkey" PRIMARY KEY ("usuario_id", "viaje_id")
);

CREATE INDEX "circuito_sesion_circuito_id_idx" ON "circuito_sesion"("circuito_id");

ALTER TABLE "circuito_sesion"
  ADD CONSTRAINT "circuito_sesion_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "circuito_sesion"
  ADD CONSTRAINT "circuito_sesion_viaje_id_fkey"
  FOREIGN KEY ("viaje_id") REFERENCES "viaje"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "circuito_sesion"
  ADD CONSTRAINT "circuito_sesion_circuito_id_fkey"
  FOREIGN KEY ("circuito_id") REFERENCES "circuito_entrenamiento"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- RN-065 / RN-070: el modo entrenamiento ya no existe en moto ni auto.
-- Los viajes viejos en esa combinación pasan a recreativo.
UPDATE "viaje"
SET "modo" = 'recreativo'
WHERE "modo" = 'entrenamiento' AND "tipo_actividad" IN ('moto', 'auto');
