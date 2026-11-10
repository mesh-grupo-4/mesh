-- RN-081: nota del autor y checklist opcionales al publicar un recorrido.
ALTER TABLE "recorrido_publicado"
  ADD COLUMN "comentario" VARCHAR(280),
  ADD COLUMN "checklist" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- RN-084: la plantilla puede guardar también el checklist del recorrido.
ALTER TABLE "ruta_plantilla"
  ADD COLUMN "checklist" TEXT[] DEFAULT ARRAY[]::TEXT[];
