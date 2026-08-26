-- Corrige drift: "alerta"."mensaje" quedó NOT NULL en la base real, pero
-- siempre fue opcional en el schema (el tipo de alerta ya comunica lo
-- esencial; el líder puede crearla sin mensaje).
ALTER TABLE "alerta" ALTER COLUMN "mensaje" DROP NOT NULL;
