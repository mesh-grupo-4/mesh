# US — Viaje YA (salida inmediata) + Inicio con mapa

> **Epic:** **E03** — Planificación de viajes / **E02** — Grupos e invitaciones.
> **OpenAPI:** `POST /api/viajes` (`inmediato`), `POST /api/viajes/{viajeId}/invitaciones` en `backend/openapi/paths/viajes.yaml`.
> **RN:** RN-107 (excepción de fecha), RN-015 (QR vigente hasta iniciar), RN-028/029 (invitaciones), RN-030 (solo el líder).

---

## Descripción

**Como** líder de una salida improvisada
**quiero** crear y arrancar un viaje en pocos toques
**para** salir ya sin pasar por fecha, parámetros ni configuración de ruta.

## Flujo

1. **Inicio** es la pestaña del medio de la barra (Viajes · Grupos · **Inicio** · Rutas · Perfil). Muestra el mapa (Google Maps, `MeshMapView`) centrado en la ubicación del dispositivo; esa ubicación es solo local, no se publica (RN-110/111).
2. Arriba a la derecha está **"Viaje YA"**. Además, **toda** entrada a "Nuevo viaje" (mantener y deslizar el botón del medio, tab Viajes, detalle de grupo, Mis rutas, recorridos publicados) abre primero el selector **Viaje YA / Planificar viaje** (`app/nuevo-viaje.tsx`), que le pasa a la opción elegida el contexto con el que se abrió (plantilla, grupo).
3. **Viaje YA** (`app/viaje/rapido.tsx`):
   - Elegir actividad (`moto`, `bici`, `running`, `trekking`, `otro`).
   - Destino **opcional**: mover el mapa o buscar un lugar, o "Saltear". Si se elige, la ruta (ubicación actual → destino, sin paradas) la calcula el backend (`/api/routing/calcular`).
   - Con una ruta de "Mis rutas" (plantilla) no se pregunta actividad ni destino: los trae la plantilla.
   - Si se entró desde un grupo, ese grupo queda invitado.
   - Se crea con `inmediato: true`, nombre automático `Viaje rápido · <Actividad> · <HH:MM>` (UTC-3, RN-105), `esGrupal: true`, modo `recreativo`.
4. **Sala de espera** (`app/viaje/[viajeId]/sala.tsx`, solo el líder):
   - QR + compartir link (RN-015/016).
   - Invitar grupos o amigos en cualquier momento (`POST /invitaciones`, RN-028/029).
   - Agregar o cambiar el destino.
   - Lista de quién se sumó (confirmado) y quién está invitado (pendiente); se refresca cada 5 s.
   - **Arrancar viaje**: aviso de ubicación (RN-110) → `POST /iniciar` → mapa en vivo. Desde ahí el QR deja de valer (RN-015).

## Reglas

- El viaje nace `planificado` aunque sea inmediato: así el QR sigue vigente mientras la gente se suma. La transición a `en_curso` la hace el líder (RN-030).
- `inmediato` y `fechaProgramada` no se combinan (400). Sin `inmediato`, `fechaProgramada` es obligatoria y futura (RN-107).
- `POST /invitaciones`: solo el líder, viaje grupal y `planificado`. Las mismas validaciones que al crear (`NOT_GROUP_MEMBER`, `NOT_FRIEND`). No reinvita a quien ya figura en el viaje.
- RN-070 no cambia: el viaje rápido es `recreativo` y no habilita rankings.

## Criterios de aceptación

- [ ] Inicio está en el medio de la barra y muestra el mapa con mi ubicación.
- [ ] "Viaje YA" pide actividad, permite saltear el destino y lleva a la sala de espera con el QR.
- [ ] Toda entrada a "Nuevo viaje" pregunta Viaje YA / Planificar.
- [ ] Desde la sala puedo invitar grupos y amigos, y veo quién se va sumando.
- [ ] "Arrancar viaje" inicia el viaje y abre el mapa en vivo.
- [ ] Si hay un viaje en curso, Inicio muestra una tarjeta flotante para volver al mapa en vivo.
