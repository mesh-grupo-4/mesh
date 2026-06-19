-- CreateTable
CREATE TABLE "viaje_grupo" (
    "viaje_id" UUID NOT NULL,
    "grupo_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "viaje_grupo_pkey" PRIMARY KEY ("viaje_id","grupo_id")
);

-- CreateIndex
CREATE INDEX "viaje_grupo_grupo_id_idx" ON "viaje_grupo"("grupo_id");

-- AddForeignKey
ALTER TABLE "viaje_grupo" ADD CONSTRAINT "viaje_grupo_viaje_id_fkey" FOREIGN KEY ("viaje_id") REFERENCES "viaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viaje_grupo" ADD CONSTRAINT "viaje_grupo_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
