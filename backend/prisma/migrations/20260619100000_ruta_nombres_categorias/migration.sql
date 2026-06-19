-- AlterEnum
ALTER TYPE "CategoriaParada" ADD VALUE IF NOT EXISTS 'kiosco';
ALTER TYPE "CategoriaParada" ADD VALUE IF NOT EXISTS 'punto_control';

-- AlterTable
ALTER TABLE "ruta" ADD COLUMN IF NOT EXISTS "origen_nombre" TEXT;
ALTER TABLE "ruta" ADD COLUMN IF NOT EXISTS "destino_nombre" TEXT;

-- AlterTable
ALTER TABLE "parada_intermedia" ADD COLUMN IF NOT EXISTS "nombre" TEXT;
