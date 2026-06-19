# Supabase Realtime — `ubicacion_viva`

La migración `20260619140000_ubicacion_viva` crea la tabla y habilita RLS con lectura `anon`.

## Paso manual obligatorio (Dashboard Supabase)

1. **Database → Replication** (o **Publications** según versión del dashboard).
2. Agregar la tabla `ubicacion_viva` a la publicación `supabase_realtime`.
3. Verificar que el proyecto tenga Realtime habilitado.

Sin este paso, el frontend no recibirá eventos `postgres_changes`.

## Políticas RLS (incluidas en migración)

- `SELECT` para rol `anon`: permitido (MVP tesis; el filtro por `viaje_id` ocurre en la suscripción del cliente).
- `INSERT` / `UPDATE`: sin policy para `anon` — solo el backend escribe vía Prisma (`DATABASE_URL`).

## Verificación rápida

Tras `npx prisma migrate deploy`, en SQL Editor:

```sql
SELECT * FROM ubicacion_viva LIMIT 5;
```

En la app, al enviar `PUT /api/viajes/:id/ubicacion-viva`, debe aparecer una fila y el canal Realtime del frontend debe recibir el evento.
