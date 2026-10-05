-- RN-025 (SCRUM-26): el líder puede ajustar la tolerancia de atraso del viaje.
-- NULL = se usa el default por tipo de actividad (motorEventos.config.ts).
ALTER TABLE "viaje" ADD COLUMN "tolerancia_atraso_min" INTEGER;
