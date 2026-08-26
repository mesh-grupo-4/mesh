-- Agrega el grupo puntual que originó la invitación al viaje, para poder
-- mostrarlo y para desambiguar de qué grupo se hereda el rol cuando el
-- viaje invitó a más de un grupo.
ALTER TABLE "viaje_integrante" ADD COLUMN "grupo_origen_id" UUID;

ALTER TABLE "viaje_integrante"
  ADD CONSTRAINT "viaje_integrante_grupo_origen_id_fkey"
  FOREIGN KEY ("grupo_origen_id") REFERENCES "grupo"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
