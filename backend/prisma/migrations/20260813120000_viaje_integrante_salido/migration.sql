-- Salida blanda del viaje: el integrante que se va conserva su fila para seguir
-- figurando en el resumen con lo que recorrió, en lugar de borrarse.
--
-- IMPORTANTE: `ALTER TYPE ... ADD VALUE` no puede USARSE en la misma transacción
-- que lo declara, y Prisma corre cada archivo de migración en una transacción.
-- Por eso este archivo no contiene ningún DML que escriba 'salido'.

-- AlterEnum
ALTER TYPE "EstadoViajeIntegrante" ADD VALUE IF NOT EXISTS 'salido';

-- AlterTable
ALTER TABLE "viaje_integrante" ADD COLUMN IF NOT EXISTS "fecha_salida" TIMESTAMP(3);
