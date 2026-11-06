-- RN-132: el superadmin redefine los ítems sugeridos del checklist por tipo de actividad.
-- Sin fila para una actividad rigen los sugeridos en código (checklistDefaults.ts).

-- CreateTable
CREATE TABLE "checklist_actividad" (
    "id" UUID NOT NULL,
    "tipo_actividad" "TipoActividad" NOT NULL,
    "items" TEXT[],
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_actividad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "checklist_actividad_tipo_actividad_key" ON "checklist_actividad"("tipo_actividad");
