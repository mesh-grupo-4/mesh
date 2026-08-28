-- Configuración por viaje de alertas automáticas de posible incidente (RN-036).
ALTER TABLE "viaje"
  ADD COLUMN "alerta_incidente_habilitada" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "alerta_incidente_minutos" INTEGER;
