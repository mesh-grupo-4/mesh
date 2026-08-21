-- Paradas voluntarias y solicitudes de parada al líder (US1–US3, RN-037 / RN-044).

-- CreateEnum
CREATE TYPE "EstadoIntegranteViaje" AS ENUM ('en_movimiento', 'detenido_voluntario', 'posible_incidente');
CREATE TYPE "TipoParada" AS ENUM ('voluntaria', 'incidente_detectado');
CREATE TYPE "EstadoSolicitudParada" AS ENUM ('pendiente', 'aprobada', 'rechazada', 'cancelada');

-- CreateTable
CREATE TABLE "parada" (
    "id" UUID NOT NULL,
    "viaje_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "tipo" "TipoParada" NOT NULL DEFAULT 'voluntaria',
    "categoria" "CategoriaParada",
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin" TIMESTAMP(3),
    "confirmado_bien" BOOLEAN,

    CONSTRAINT "parada_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "parada_viaje_id_inicio_idx" ON "parada"("viaje_id", "inicio");
CREATE INDEX "parada_usuario_id_inicio_idx" ON "parada"("usuario_id", "inicio");

-- Una sola parada abierta por integrante y viaje: el estado del mapa se deriva
-- de esta fila, así que dos abiertas a la vez lo volverían ambiguo.
CREATE UNIQUE INDEX "parada_abierta_unica"
  ON "parada"("viaje_id", "usuario_id")
  WHERE "fin" IS NULL;

ALTER TABLE "parada"
  ADD CONSTRAINT "parada_viaje_id_fkey"
  FOREIGN KEY ("viaje_id") REFERENCES "viaje"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "parada"
  ADD CONSTRAINT "parada_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "solicitud_parada" (
    "id" UUID NOT NULL,
    "viaje_id" UUID NOT NULL,
    "solicitante_id" UUID NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "motivo" TEXT,
    "estado" "EstadoSolicitudParada" NOT NULL DEFAULT 'pendiente',
    "resuelta_por_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "solicitud_parada_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "solicitud_parada_viaje_id_estado_idx" ON "solicitud_parada"("viaje_id", "estado");
CREATE INDEX "solicitud_parada_solicitante_id_created_at_idx" ON "solicitud_parada"("solicitante_id", "created_at");

-- Una sola solicitud pendiente por integrante y viaje: evita que un doble tap
-- le mande dos veces la misma solicitud al líder.
CREATE UNIQUE INDEX "solicitud_parada_pendiente_unica"
  ON "solicitud_parada"("viaje_id", "solicitante_id")
  WHERE "estado" = 'pendiente';

ALTER TABLE "solicitud_parada"
  ADD CONSTRAINT "solicitud_parada_viaje_id_fkey"
  FOREIGN KEY ("viaje_id") REFERENCES "viaje"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "solicitud_parada"
  ADD CONSTRAINT "solicitud_parada_solicitante_id_fkey"
  FOREIGN KEY ("solicitante_id") REFERENCES "usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "solicitud_parada"
  ADD CONSTRAINT "solicitud_parada_resuelta_por_id_fkey"
  FOREIGN KEY ("resuelta_por_id") REFERENCES "usuario"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
