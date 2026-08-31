-- Red de seguridad contra duplicados (RN-038): un mismo punto GPS puede llegar
-- dos veces (una vez por el canal en vivo — PUT /ubicacion-viva o socket
-- viaje:gps_ping — y otra por el batch de sincronización offline POST /posiciones
-- con source: offline_sync). El frontend ya evita reenviar lo confirmado, pero esto
-- garantiza que un duplicado residual no infle la traza ni las métricas.
CREATE UNIQUE INDEX "registro_gps_viaje_id_usuario_id_timestamp_key"
  ON "registro_gps"("viaje_id", "usuario_id", "timestamp");
