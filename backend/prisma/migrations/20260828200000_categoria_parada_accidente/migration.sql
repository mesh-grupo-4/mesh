-- RN-022: la categoría de parada "kiosco" pasa a ser "accidente".
-- El sheet de "¿por qué parás?" del viaje en vivo reemplaza el botón "Kiosco"
-- por "Accidente" (destacado), que además dispara una alerta al grupo.
-- RENAME VALUE preserva las filas existentes (kiosco -> accidente).
ALTER TYPE "CategoriaParada" RENAME VALUE 'kiosco' TO 'accidente';
