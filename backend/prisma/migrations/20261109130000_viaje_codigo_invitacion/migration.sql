-- RN-015: código corto e irrepetible para sumarse a un viaje escribiéndolo.
-- Alfabeto de 32 símbolos sin 0/O ni 1/I, que se confunden al dictarlos.
-- Usa los bytes 8 a 15 del UUID porque los anteriores llevan fija la versión.
CREATE FUNCTION generar_codigo_viaje() RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  alfabeto CONSTANT TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  bytes BYTEA;
  codigo TEXT;
BEGIN
  LOOP
    bytes := uuid_send(gen_random_uuid());
    codigo := '';
    FOR i IN 8..15 LOOP
      codigo := codigo || substr(alfabeto, get_byte(bytes, i) % 32 + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM "viaje" WHERE "codigo_invitacion" = codigo);
  END LOOP;
  RETURN codigo;
END;
$$;

ALTER TABLE "viaje" ADD COLUMN "codigo_invitacion" TEXT;

-- Fila por fila: dentro de un único UPDATE la función no vería los códigos que
-- ese mismo UPDATE va asignando.
DO $$
DECLARE
  fila RECORD;
BEGIN
  FOR fila IN SELECT "id" FROM "viaje" LOOP
    UPDATE "viaje" SET "codigo_invitacion" = generar_codigo_viaje() WHERE "id" = fila."id";
  END LOOP;
END;
$$;

ALTER TABLE "viaje"
  ALTER COLUMN "codigo_invitacion" SET NOT NULL,
  ALTER COLUMN "codigo_invitacion" SET DEFAULT generar_codigo_viaje();

CREATE UNIQUE INDEX "viaje_codigo_invitacion_key" ON "viaje"("codigo_invitacion");
