-- Privacidad y permisos de geolocalización (RN-110 a RN-114).
--
-- Tres piezas:
--  1. `usuario`: consentimiento informado de geolocalización (fecha + versión del
--     texto aceptado) y el default con el que arranca cada viaje nuevo.
--  2. `privacidad_viaje`: el interruptor por viaje. Va en tabla propia y no como
--     columna de `viaje_integrante` porque el creador del viaje no siempre tiene
--     fila ahí (viajes creados antes de `viaje_integrante`) y también necesita
--     poder apagar el compartir. Sin fila = default del usuario.
--  3. `acceso_ubicacion`: quién vio la posición de quién. Agregado por trío
--     (viaje, observado, observador) en vez de append-only: con 200 integrantes
--     (RN-033) un log por lectura generaría 200 filas por persona en cada
--     refresco del mapa.

ALTER TABLE "usuario"
  ADD COLUMN "consentimiento_ubicacion_at" TIMESTAMP(3),
  ADD COLUMN "consentimiento_ubicacion_version" TEXT,
  ADD COLUMN "comparte_ubicacion_default" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "privacidad_viaje" (
    "viaje_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "comparte_ubicacion" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "privacidad_viaje_pkey" PRIMARY KEY ("viaje_id","usuario_id")
);

CREATE INDEX "privacidad_viaje_usuario_id_idx"
  ON "privacidad_viaje"("usuario_id");

ALTER TABLE "privacidad_viaje"
  ADD CONSTRAINT "privacidad_viaje_viaje_id_fkey"
  FOREIGN KEY ("viaje_id") REFERENCES "viaje"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "privacidad_viaje"
  ADD CONSTRAINT "privacidad_viaje_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "acceso_ubicacion" (
    "viaje_id" UUID NOT NULL,
    "observado_id" UUID NOT NULL,
    "observador_id" UUID NOT NULL,
    "primera_vez" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_vez" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "veces" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "acceso_ubicacion_pkey" PRIMARY KEY ("viaje_id","observado_id","observador_id")
);

CREATE INDEX "acceso_ubicacion_observado_id_ultima_vez_idx"
  ON "acceso_ubicacion"("observado_id", "ultima_vez");

ALTER TABLE "acceso_ubicacion"
  ADD CONSTRAINT "acceso_ubicacion_viaje_id_fkey"
  FOREIGN KEY ("viaje_id") REFERENCES "viaje"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "acceso_ubicacion"
  ADD CONSTRAINT "acceso_ubicacion_observado_id_fkey"
  FOREIGN KEY ("observado_id") REFERENCES "usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "acceso_ubicacion"
  ADD CONSTRAINT "acceso_ubicacion_observador_id_fkey"
  FOREIGN KEY ("observador_id") REFERENCES "usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
