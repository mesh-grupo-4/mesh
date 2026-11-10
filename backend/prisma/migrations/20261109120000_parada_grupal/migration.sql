-- RN-045: parada que el líder abre para todo el grupo.
ALTER TABLE "parada" ADD COLUMN "grupal" BOOLEAN NOT NULL DEFAULT false;
