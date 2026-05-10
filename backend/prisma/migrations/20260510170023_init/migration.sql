CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateEnum
CREATE TYPE "RolMiembro" AS ENUM ('lider', 'participante');

-- CreateEnum
CREATE TYPE "TipoActividad" AS ENUM ('moto', 'bici', 'running', 'trekking');

-- CreateEnum
CREATE TYPE "EstadoViaje" AS ENUM ('planificado', 'en_curso', 'finalizado');

-- CreateEnum
CREATE TYPE "CategoriaParada" AS ENUM ('combustible', 'descanso', 'gastronomia', 'sanitario', 'otro');

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lider_id" UUID NOT NULL,

    CONSTRAINT "grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupo_miembro" (
    "grupo_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "rol" "RolMiembro" NOT NULL,
    "fecha_union" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grupo_miembro_pkey" PRIMARY KEY ("grupo_id","usuario_id")
);

-- CreateTable
CREATE TABLE "viaje" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "creador_id" UUID NOT NULL,
    "grupo_id" UUID,
    "es_grupal" BOOLEAN NOT NULL,
    "tipo_actividad" "TipoActividad" NOT NULL,
    "estado" "EstadoViaje" NOT NULL DEFAULT 'planificado',
    "fecha_programada" TIMESTAMP(3) NOT NULL,
    "fecha_inicio_real" TIMESTAMP(3),
    "fecha_fin_real" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "viaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ruta" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "viaje_id" UUID NOT NULL,
    "origen_lat" DOUBLE PRECISION NOT NULL,
    "origen_lng" DOUBLE PRECISION NOT NULL,
    "destino_lat" DOUBLE PRECISION NOT NULL,
    "destino_lng" DOUBLE PRECISION NOT NULL,
    "linestring_geojson" JSONB NOT NULL,
    "distancia_planeada_m" DOUBLE PRECISION,
    "tiempo_estimado_seg" INTEGER,

    CONSTRAINT "ruta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parada_intermedia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ruta_id" UUID NOT NULL,
    "orden" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "categoria" "CategoriaParada" NOT NULL DEFAULT 'otro',

    CONSTRAINT "parada_intermedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resumen_viaje" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "viaje_id" UUID NOT NULL,
    "duracion_segundos" INTEGER,
    "distancia_planeada_m" DOUBLE PRECISION,
    "distancia_real_m" DOUBLE PRECISION,
    "cantidad_paradas" INTEGER NOT NULL DEFAULT 0,
    "generado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resumen_viaje_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "viaje_creador_id_idx" ON "viaje"("creador_id");

-- CreateIndex
CREATE INDEX "viaje_grupo_id_idx" ON "viaje"("grupo_id");

-- CreateIndex
CREATE UNIQUE INDEX "ruta_viaje_id_key" ON "ruta"("viaje_id");

-- CreateIndex
CREATE INDEX "parada_intermedia_ruta_id_orden_idx" ON "parada_intermedia"("ruta_id", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "resumen_viaje_viaje_id_key" ON "resumen_viaje"("viaje_id");

-- AddForeignKey
ALTER TABLE "grupo" ADD CONSTRAINT "grupo_lider_id_fkey" FOREIGN KEY ("lider_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_miembro" ADD CONSTRAINT "grupo_miembro_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_miembro" ADD CONSTRAINT "grupo_miembro_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viaje" ADD CONSTRAINT "viaje_creador_id_fkey" FOREIGN KEY ("creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "viaje" ADD CONSTRAINT "viaje_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruta" ADD CONSTRAINT "ruta_viaje_id_fkey" FOREIGN KEY ("viaje_id") REFERENCES "viaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parada_intermedia" ADD CONSTRAINT "parada_intermedia_ruta_id_fkey" FOREIGN KEY ("ruta_id") REFERENCES "ruta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumen_viaje" ADD CONSTRAINT "resumen_viaje_viaje_id_fkey" FOREIGN KEY ("viaje_id") REFERENCES "viaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;
