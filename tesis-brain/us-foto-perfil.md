# US — Foto de perfil

> **Estado:** implementada (backend + frontend).
> **Epic:** **E01** — Usuarios y autenticación. Tier Core.
> **OpenAPI:** `backend/openapi/paths/usuarios.yaml` (`SubidaFotoPerfil`, `FotoPerfil`, `FotosUsuarios`).
> **RN:** RN-008 (formato y tamaño), RN-030 (el backend valida).

---

## Flujo de subida

1. `POST /api/usuarios/me/foto/subida`: el backend elige la ruta `{usuarioId}/{timestamp}.jpg` y devuelve una URL firmada de Supabase Storage que solo sirve para esa ruta (vence a las 2 h).
2. La app sube el JPEG directo a Storage con un `PUT` a esa URL. Los bytes no pasan por el VPS.
3. `PUT /api/usuarios/me/foto`: el backend verifica que el archivo exista en la carpeta del usuario, que sea `image/jpeg` y pese hasta 2 MB. Si es válido guarda la URL en `usuario.foto_perfil` y borra la foto anterior y las subidas sin confirmar; si no, borra el archivo y responde `400`.

`DELETE /api/usuarios/me/foto` vuelve a las iniciales y borra el archivo. Al eliminar la cuenta desde el backoffice se borra la carpeta entera.

## Decisiones de diseño

| Decisión | Qué se resolvió | Por qué |
|---|---|---|
| **Supabase Storage, bucket público `avatares`** | Lectura por URL pública; escritura solo con URL firmada emitida por el backend con la service role key | La DB ya está en Supabase. La key nunca llega al dispositivo, igual que la de Google Maps |
| **El backend confirma** | Elegir la ruta y validar tipo/tamaño es del backend, no de la app | RN-030: el frontend solo orienta |
| **La app recomprime** | Recorte cuadrado + JPEG 512×512 al 80 % (~60 KB) con `expo-image-manipulator` | Alcanza para el avatar más grande (128 pt en 3x) y sube rápido con datos móviles |
| **Fotos por lote** | `POST /api/usuarios/fotos` devuelve `{ usuarioId: url }` para hasta 200 ids. En la app, `lib/fotosPerfilStore.ts` junta los avatares de una pantalla en una sola llamada y cachea 10 min | No hubo que tocar cada endpoint que devuelve personas (grupos, gastos, rankings, amistades…) |
| **Sin foto en el mapa** | Los marcadores del mapa y la barra de integrantes del viaje en vivo mantienen las iniciales: esos `AvatarFallback` no reciben `usuarioId` | Legibilidad a simple vista en movimiento (RN-052) y no depender de la red en el viaje en curso |
| **Opcional por entorno** | Sin `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` el backend arranca igual y los endpoints de foto responden `503 FOTOS_NO_DISPONIBLES` | El resto de la app no depende de Storage |

## Configuración por entorno

1. En el `.env` del backend (local y en el VPS): `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. La key es la secret key `sb_secret_...` (Supabase → Project Settings → API Keys) o, en proyectos viejos, la `service_role` de *Legacy API Keys*.
2. `npm run storage:setup` crea o ajusta el bucket `avatares` (público, JPEG, 2 MB). Es idempotente y usa `ts-node`, así que se corre desde una copia del repo (el release del VPS solo tiene `dist/`), una vez por proyecto Supabase.
3. La migración `20261111180000_usuario_foto_perfil` la aplica el deploy (`deploy-backend.yml` → `activar.sh`).
