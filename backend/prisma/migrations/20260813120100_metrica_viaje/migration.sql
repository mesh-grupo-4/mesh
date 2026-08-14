-- Métricas individuales por integrante (RN-061), calculadas desde registro_gps
-- al finalizar el viaje.

-- CreateTable
CREATE TABLE "metrica_viaje" (
    "id" UUID NOT NULL,
    "viaje_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "distancia_m" DOUBLE PRECISION NOT NULL,
    "tiempo_movimiento_seg" INTEGER NOT NULL,
    "velocidad_promedio_kmh" DOUBLE PRECISION,
    "generado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrica_viaje_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "metrica_viaje_viaje_id_usuario_id_key" ON "metrica_viaje"("viaje_id", "usuario_id");

-- CreateIndex
CREATE INDEX "metrica_viaje_usuario_id_idx" ON "metrica_viaje"("usuario_id");

-- AddForeignKey
ALTER TABLE "metrica_viaje" ADD CONSTRAINT "metrica_viaje_viaje_id_fkey" FOREIGN KEY ("viaje_id") REFERENCES "viaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrica_viaje" ADD CONSTRAINT "metrica_viaje_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
