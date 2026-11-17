-- RN-134: el superadmin define cuántos minutos dura en promedio una parada planificada
-- según su categoría. Sin fila para una categoría rigen los minutos en código
-- (duracionesParada.ts).

-- CreateTable
CREATE TABLE "duracion_parada" (
    "id" UUID NOT NULL,
    "categoria" "CategoriaParada" NOT NULL,
    "minutos" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "duracion_parada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "duracion_parada_categoria_key" ON "duracion_parada"("categoria");
