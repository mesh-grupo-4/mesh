-- CreateEnum
CREATE TYPE "GpsSource" AS ENUM ('live', 'offline_sync');

-- CreateTable
CREATE TABLE "registro_gps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "viaje_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "precision_m" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "source" "GpsSource" NOT NULL DEFAULT 'live',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_gps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registro_gps_viaje_id_timestamp_idx" ON "registro_gps"("viaje_id", "timestamp");

-- CreateIndex
CREATE INDEX "registro_gps_usuario_id_timestamp_idx" ON "registro_gps"("usuario_id", "timestamp");

-- AddForeignKey
ALTER TABLE "registro_gps" ADD CONSTRAINT "registro_gps_viaje_id_fkey" FOREIGN KEY ("viaje_id") REFERENCES "viaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_gps" ADD CONSTRAINT "registro_gps_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
