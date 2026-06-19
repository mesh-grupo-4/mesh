-- CreateTable
CREATE TABLE "ubicacion_viva" (
    "usuario_id" UUID NOT NULL,
    "viaje_id" UUID NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "precision_m" DOUBLE PRECISION,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ubicacion_viva_pkey" PRIMARY KEY ("usuario_id")
);

-- CreateIndex
CREATE INDEX "ubicacion_viva_viaje_id_idx" ON "ubicacion_viva"("viaje_id");

-- AddForeignKey
ALTER TABLE "ubicacion_viva" ADD CONSTRAINT "ubicacion_viva_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ubicacion_viva" ADD CONSTRAINT "ubicacion_viva_viaje_id_fkey" FOREIGN KEY ("viaje_id") REFERENCES "viaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: lectura anon para Supabase Realtime (escrituras solo vía backend/Prisma)
ALTER TABLE "ubicacion_viva" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lectura_anon_por_viaje"
  ON "ubicacion_viva"
  FOR SELECT
  TO anon
  USING (true);
