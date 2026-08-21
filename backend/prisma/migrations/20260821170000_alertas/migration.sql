-- Alertas del viaje creadas por el líder (US1, RN-040 / RN-041 / RN-043).

-- CreateEnum
CREATE TYPE "TipoAlerta" AS ENUM ('parada', 'combustible', 'desvio', 'peligro', 'informacion');
CREATE TYPE "OrigenAlerta" AS ENUM ('lider', 'sistema');
CREATE TYPE "EstadoAlerta" AS ENUM ('activa', 'pausada', 'cancelada', 'resuelta');

-- CreateTable
CREATE TABLE "alerta" (
    "id" UUID NOT NULL,
    "viaje_id" UUID NOT NULL,
    "creada_por_id" UUID,
    "tipo" "TipoAlerta" NOT NULL,
    "origen" "OrigenAlerta" NOT NULL DEFAULT 'lider',
    "mensaje" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "estado" "EstadoAlerta" NOT NULL DEFAULT 'activa',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "alerta_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "alerta_viaje_id_created_at_idx" ON "alerta"("viaje_id", "created_at");

ALTER TABLE "alerta"
  ADD CONSTRAINT "alerta_viaje_id_fkey"
  FOREIGN KEY ("viaje_id") REFERENCES "viaje"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- El autor puede borrar su cuenta sin que se pierda el historial del viaje.
ALTER TABLE "alerta"
  ADD CONSTRAINT "alerta_creada_por_id_fkey"
  FOREIGN KEY ("creada_por_id") REFERENCES "usuario"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
