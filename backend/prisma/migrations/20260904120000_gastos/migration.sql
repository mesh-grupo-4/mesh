-- Gastos compartidos del viaje y su liquidación (US: registrar y prorratear gastos).
--
-- Un gasto se prorratea entre quienes elige la persona que lo registra, no entre
-- todo el viaje: `gasto_participante` guarda esa lista por gasto. El balance final
-- (quién le debe a quién) se calcula on-demand a partir de estas dos tablas, una
-- vez que el viaje está finalizado; no se persiste una liquidación aparte.

-- CreateTable
CREATE TABLE "gasto" (
    "id" UUID NOT NULL,
    "viaje_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "descripcion" VARCHAR(140) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gasto_participante" (
    "gasto_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,

    CONSTRAINT "gasto_participante_pkey" PRIMARY KEY ("gasto_id","usuario_id")
);

CREATE INDEX "gasto_viaje_id_created_at_idx"
  ON "gasto"("viaje_id", "created_at");

ALTER TABLE "gasto"
  ADD CONSTRAINT "gasto_viaje_id_fkey"
  FOREIGN KEY ("viaje_id") REFERENCES "viaje"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gasto"
  ADD CONSTRAINT "gasto_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gasto_participante"
  ADD CONSTRAINT "gasto_participante_gasto_id_fkey"
  FOREIGN KEY ("gasto_id") REFERENCES "gasto"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gasto_participante"
  ADD CONSTRAINT "gasto_participante_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
