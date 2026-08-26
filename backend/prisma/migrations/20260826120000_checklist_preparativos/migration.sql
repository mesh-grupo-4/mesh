-- Checklist de preparativos pre-ruta (SCRUM-22, RN-026).
--
-- El checklist es personal: cada fila pertenece a un integrante del viaje. Los ítems
-- que el creador define como base para todos se copian a cada integrante, y la copia
-- guarda en `origen_item_id` una referencia al ítem original para poder sincronizar
-- altas y bajas sin comparar textos.

-- CreateEnum
CREATE TYPE "OrigenChecklistItem" AS ENUM ('sugerido', 'lider', 'personal');

-- CreateTable
CREATE TABLE "checklist_item" (
    "id" UUID NOT NULL,
    "viaje_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "origen_item_id" UUID,
    "texto" VARCHAR(120) NOT NULL,
    "origen" "OrigenChecklistItem" NOT NULL,
    "completado" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_item_pkey" PRIMARY KEY ("id")
);

-- Un mismo texto no se repite dentro del checklist de una persona en un viaje: hace
-- idempotentes la siembra de sugeridos y la importación desde otro viaje.
CREATE UNIQUE INDEX "checklist_item_viaje_id_usuario_id_texto_key"
  ON "checklist_item"("viaje_id", "usuario_id", "texto");

CREATE INDEX "checklist_item_viaje_id_usuario_id_orden_idx"
  ON "checklist_item"("viaje_id", "usuario_id", "orden");

CREATE INDEX "checklist_item_origen_item_id_idx"
  ON "checklist_item"("origen_item_id");

ALTER TABLE "checklist_item"
  ADD CONSTRAINT "checklist_item_viaje_id_fkey"
  FOREIGN KEY ("viaje_id") REFERENCES "viaje"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "checklist_item"
  ADD CONSTRAINT "checklist_item_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Si el creador borra un ítem base, sus copias se van con él.
ALTER TABLE "checklist_item"
  ADD CONSTRAINT "checklist_item_origen_item_id_fkey"
  FOREIGN KEY ("origen_item_id") REFERENCES "checklist_item"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
