-- RN-065 (SCRUM-47/48): modo del viaje. `entrenamiento` habilita las métricas de
-- sesión (splits por km, ritmo, evolución entre sesiones). `competitivo` queda
-- reservado para E07 y todavía no se acepta desde la API.
CREATE TYPE "ModoViaje" AS ENUM ('recreativo', 'competitivo', 'entrenamiento');

ALTER TABLE "viaje" ADD COLUMN "modo" "ModoViaje" NOT NULL DEFAULT 'recreativo';
