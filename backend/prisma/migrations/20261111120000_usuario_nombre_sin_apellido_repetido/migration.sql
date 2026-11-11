-- Corrección de datos (sin cambios de esquema).
-- `usuario.nombre` guarda el nombre completo. Algunas cuentas quedaron con el
-- apellido repetido al final ("Franco Giorda Giorda"): el cliente armaba el nombre
-- completo concatenando el apellido a un nombre que ya lo traía.
-- Se quita una repetición por pasada; van dos por si alguna quedó triple.
-- `right(...) =` y no LIKE: un "%" o "_" en el apellido no actúa como comodín.

UPDATE "usuario"
SET "nombre" = left("nombre", length("nombre") - length(btrim("apellido")) - 1)
WHERE "apellido" IS NOT NULL
  AND btrim("apellido") <> ''
  AND right(lower("nombre"), 2 * length(btrim("apellido")) + 2)
      = ' ' || lower(btrim("apellido")) || ' ' || lower(btrim("apellido"));

UPDATE "usuario"
SET "nombre" = left("nombre", length("nombre") - length(btrim("apellido")) - 1)
WHERE "apellido" IS NOT NULL
  AND btrim("apellido") <> ''
  AND right(lower("nombre"), 2 * length(btrim("apellido")) + 2)
      = ' ' || lower(btrim("apellido")) || ' ' || lower(btrim("apellido"));
