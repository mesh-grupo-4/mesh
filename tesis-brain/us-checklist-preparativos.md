# US — Checklist de preparativos pre-ruta

> **Estado:** backend y frontend implementados.
> **Jira:** SCRUM-22 (3 pts) · Sprint 8 (25/08/2026 – 08/09/2026).
> **Epic:** **E03** — Planificación de viajes y rutas.
> **OpenAPI:** `backend/openapi/paths/checklist.yaml` (spec modular, ver [[adr-documentacion-api]]).
> **RN:** RN-026 (checklist), RN-021 (tipos de actividad), RN-030 (autorización en backend), RN-105/106 (fechas en UTC).
> **Dependencias:** viaje creado con `tipo_actividad` e integrantes confirmados. Ninguna sobre ruta ni GPS.

---

## La US

**Como** usuario
**quiero** completar una lista de verificación de equipamiento antes de salir
**para** no olvidarme nada.

### Criterios de aceptación

- [x] El sistema sugiere ítems según tipo de actividad.
- [x] El usuario puede agregar ítems personalizados.
- [x] El checklist se guarda y puede reutilizarse.

---

## Decisiones de diseño

| Decisión | Qué se resolvió | Por qué |
|---|---|---|
| **Checklist personal** | Una fila por integrante (`usuario_id` siempre presente), no un checklist único del viaje | El equipamiento que lleva uno no es el que lleva otro; con estado compartido, "completado" pierde sentido apenas hay dos personas |
| **Base del creador + personal** | El creador puede marcar ítems como base del grupo; el resto agrega los suyos | Cubre el caso real "nadie sale sin chaleco reflectivo" sin quitarle a cada uno su lista |
| **Autoridad = `creador_id`** | La base del viaje la define el creador, no el rol `líder` de un grupo | Consistente con RN-030: en viajes manda `creador_id`, el rol de grupo es otra cosa |
| **Copia por integrante, no fila compartida** | El ítem base se **copia** al checklist de cada uno, con `origen_item_id` al original | Deja que cada persona tenga su propio `completado` sin una segunda tabla de tildes |
| **Sincronización perezosa** | El `GET` siembra sugeridos y trae los ítems base faltantes antes de responder | Quien se une tarde al viaje recibe la base sin necesidad de un job ni de un fan-out con carrera |
| **Sugeridos en código** | `checklistDefaults.ts`, junto a `activityDefaults.ts` | Mismo patrón que RN-021, testeable, sin seed ni tabla de catálogo |
| **Reutilizar = importar** | `POST /checklist/importar` copia los ítems propios de otro viaje | Cumple "reutilizable" sin introducir el concepto de plantilla con nombre, CRUD y pantallas propias |
| **Importado entra como `personal`** | Aunque en el viaje origen fuera un ítem base | La obligación que puso el creador de aquel viaje no rige en este |
| **Editable hasta `finalizado`** | Se usa en `planificado` y sigue en `en_curso`; en `finalizado` es solo lectura | Es pre-ruta, pero uno termina tildando cosas mientras arranca. Un viaje terminado es registro histórico |
| **Sin Socket.io** | El checklist no emite eventos de tiempo real | Es preparación previa, no coordinación en movimiento. Sumar la room del viaje sería ruido |

---

## Modelo de datos

Ver `ChecklistItem` en la sección de entidades de [[reglas-de-negocio]].
Migración: `backend/prisma/migrations/20260826120000_checklist_preparativos`.

Dos invariantes viven en la base, no solo en código:

```sql
-- Un mismo texto no se repite en el checklist de una persona dentro de un viaje.
-- Hace idempotentes la siembra de sugeridos y la importación desde otro viaje.
CREATE UNIQUE INDEX checklist_item_viaje_id_usuario_id_texto_key
  ON checklist_item(viaje_id, usuario_id, texto);

-- El creador borra un ítem base y las copias del grupo se van con él.
ALTER TABLE checklist_item
  ADD CONSTRAINT checklist_item_origen_item_id_fkey
  FOREIGN KEY (origen_item_id) REFERENCES checklist_item(id) ON DELETE CASCADE;
```

### Los tres orígenes

| `origen` | Quién lo crea | `origen_item_id` | `puede_editar` |
|---|---|---|---|
| `sugerido` | El sistema, según `tipo_actividad` (RN-021) | `null` | sí — se puede borrar si no aplica |
| `lider` (original) | El creador del viaje, con `paraTodos: true` | `null` | sí, solo para el creador |
| `lider` (copia) | El sistema, al sincronizar el checklist del integrante | id del original | **no** — se marca, no se edita ni se borra |
| `personal` | El integrante, o una importación | `null` | sí |

`puede_editar` lo calcula el backend y viaja en la respuesta: el frontend solo orienta
visualmente (RN-030), no decide permisos.

---

## API

| Método | Ruta | Quién |
|---|---|---|
| `GET` | `/api/viajes/{viajeId}/checklist` | Integrante confirmado o creador — devuelve **su** checklist, ya sincronizado |
| `POST` | `/api/viajes/{viajeId}/checklist` | Ídem. `paraTodos: true` **solo el creador** (403 `NOT_CREATOR`) |
| `PATCH` | `/api/viajes/{viajeId}/checklist/{itemId}` | El dueño del ítem. `texto` no se acepta sobre copias base (403 `ITEM_OBLIGATORIO`) |
| `DELETE` | `/api/viajes/{viajeId}/checklist/{itemId}` | El dueño del ítem, salvo copias base |
| `POST` | `/api/viajes/{viajeId}/checklist/importar` | Integrante confirmado, que además participe del viaje origen |

Códigos nuevos en `ErrorCode`: `ITEM_NOT_FOUND`, `ITEM_DUPLICADO`, `ITEM_OBLIGATORIO`,
`MISMO_VIAJE`, `VIAJE_ORIGEN_NOT_FOUND`.

`created_at` y `updated_at` viajan en **UTC** (RN-105/106); la conversión a hora de
Argentina la hace el frontend con `lib/tiempoArg.ts`.

---

## Ítems sugeridos por actividad (RN-026 + RN-021)

Definidos en `backend/src/modules/checklist/checklistDefaults.ts`. Son sugerencias,
no obligaciones: se pueden borrar.

| Actividad | Ejemplos |
|---|---|
| **moto** | Casco · Guantes · Campera con protecciones · Cédula verde y seguro · Tanque lleno · Presión de cubiertas |
| **bici** | Casco · Luces · Cámara de repuesto · Inflador · Kit de parches · Bidón de agua |
| **running** | Zapatillas · Ropa técnica · Hidratación · Gorra · Protector solar |
| **trekking** | Calzado de trekking · Mochila · Agua (2 L) · Comida · Linterna frontal · Botiquín |
| **otro** | Agua · Celular cargado · Documento · Botiquín · Abrigo |

---

## Frontend

Pantalla `frontend/app/viaje/[viajeId]/checklist.tsx`, con módulo API
`frontend/lib/checklistApi.ts`. Se entra desde el detalle del viaje con el botón
**"Checklist de preparativos"**, visible para el creador y los participantes
confirmados mientras el viaje no esté `finalizado`.

Incluye:

- Lista con tilde por ítem (marca **optimista**: no espera la red, revierte si falla).
- Barra de progreso "N/total listos".
- Alta de ítem con input; para el creador, interruptor **"Agregar para todo el grupo"**
  (`paraTodos`), oculto al resto (el 403 `NOT_CREATOR` es la última línea de defensa).
- Borrado solo de los ítems con `puede_editar` (los `Del grupo` copiados no se borran).
- **Importar de otro viaje**: hoja modal que lista viajes planificados y finalizados
  del usuario y llama al endpoint de importar.
- Viaje `finalizado`: solo lectura, sin pie de acciones.

Verificado con `tsc --noEmit`: la pantalla no agrega errores de tipos sobre el baseline
del repo. No se corrió contra la API real por el bloqueo de Firebase en el backend.

## Pendiente

- **Editar el texto** de un ítem propio desde la UI: el backend lo soporta (`PATCH texto`),
  la pantalla de hoy resuelve el caso con borrar + volver a agregar. Mejora menor.
- Probar el flujo completo contra el backend cuando levante (credencial Firebase).
- Decidir con el PO si el checklist incompleto debe advertir algo al iniciar el viaje.
  Hoy **no** bloquea: RN-030 no lo pide y bloquear la salida por un tilde sería hostil.
