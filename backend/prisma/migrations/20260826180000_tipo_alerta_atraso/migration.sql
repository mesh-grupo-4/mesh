-- RN-035: alertas de atraso generadas por el motor de eventos.
ALTER TYPE "TipoAlerta" ADD VALUE IF NOT EXISTS 'atraso';
