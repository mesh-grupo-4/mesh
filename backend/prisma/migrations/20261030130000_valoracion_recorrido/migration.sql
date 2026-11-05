-- E10 / SCRUM-63 / RN-082: valoración binaria de un recorrido publicado.
-- Una sola valoración por usuario y recorrido (PK compuesta). Sin texto (RN-083).

-- CreateTable
CREATE TABLE "valoracion_recorrido" (
    "recorrido_publicado_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "recomiendo" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "valoracion_recorrido_pkey" PRIMARY KEY ("recorrido_publicado_id", "usuario_id")
);

CREATE INDEX "valoracion_recorrido_usuario_id_idx" ON "valoracion_recorrido"("usuario_id");

ALTER TABLE "valoracion_recorrido"
  ADD CONSTRAINT "valoracion_recorrido_recorrido_publicado_id_fkey"
  FOREIGN KEY ("recorrido_publicado_id") REFERENCES "recorrido_publicado"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "valoracion_recorrido"
  ADD CONSTRAINT "valoracion_recorrido_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
