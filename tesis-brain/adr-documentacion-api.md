# ADR — Documentación de la API: spec-first con test de contrato

> **Decisión de arquitectura** · Proyecto Final 2026 · UTN FRC · Grupo 4 · Curso 5K1
> Estado: **aceptada** · Fecha: 18/08/2026
> Relacionado: [[reglas-de-negocio]], [[us-compartir-ruta]], [[us-ranking-viaje]]

---

## Contexto

El backend expone **55 endpoints REST** y **7 eventos Socket.io**. Antes de esta decisión la
documentación consistía en cuatro archivos YAML sueltos en `backend/openapi/`, escritos a
mano y sin ninguna conexión con el código.

El resultado fue el previsible: se desincronizaron.

- `viajes.yaml` (versión 3.1.0) documentaba autenticación por header `x-user-id`, cuando el
  backend ya había migrado a Firebase ID tokens.
- `grupos.yaml` declaraba `POST /api/usuarios/sync` como endpoint público, cuando ya exigía
  autenticación.
- Nueve endpoints no figuraban en ningún archivo.
- Cada archivo repetía sus `components` y declaraba su propia `info.version`, divergentes
  entre sí (1.0.0 contra 3.1.0).
- Ningún archivo se servía por HTTP ni se importaba desde el código.

El problema de fondo no era que la documentación estuviera vieja, sino que **nada podía
detectar que lo estaba**. Volver a escribirla sin resolver eso solo habría reiniciado el reloj.

## Decisión

### 1. Spec-first modular, no generación desde el código

El spec OpenAPI 3.0.3 se escribe a mano y es la fuente de verdad de la API REST, en línea con
el principio API-First del proyecto: todo endpoint nuevo se documenta junto con su
implementación.

Se descartó generarlo desde los schemas Zod (`zod-to-openapi`) porque Zod solo describe la
**entrada**. Las respuestas, los códigos de estado y las reglas de negocio asociadas a cada
error habría que escribirlos a mano igual, y a cambio se perderían las 3085 líneas de spec
ya redactadas.

Estructura, con un archivo de paths por módulo de dominio:

```
backend/openapi/
├── openapi.yaml          # raíz: info, servers, security, tags, 48 pathItems por $ref
├── components/           # securitySchemes, parameters, responses, schemas
└── paths/                # health, usuarios, amistades, grupos, viajes, rutas-compartidas
```

### 2. Un test de contrato como garantía, no la disciplina del equipo

`backend/src/docs/contrato.test.ts` recorre la tabla de montajes de `routes/index.ts` y el
`stack` de cada router de Express, y compara la superficie REST **real** contra el spec.
Falla el build si aparece un endpoint sin documentar, una operación documentada que ya no
existe, un `operationId` faltante o repetido, una operación autenticada sin su 401, un
parámetro de path sin declarar o una operación sin respuesta 2xx.

Esta es la pieza central de la decisión. Sin ella, cualquier spec vuelve a envejecer en dos
sprints; con ella, la divergencia es un test rojo y no un descubrimiento tardío.

Para que el test pueda enumerar las rutas sin inferir prefijos desde los regex internos de
Express, `routes/index.ts` declara sus montajes como una tabla exportada.

### 3. El spec bundleado viaja como JSON dentro de `src/`

`redocly bundle` resuelve los `$ref` externos y emite `src/docs/openapi.bundled.json`, que se
importa desde TypeScript. Como `resolveJsonModule` está activo, `tsc` lo copia a `dist/docs/`
en el build.

Se eligió así porque el `build` es `tsc` a secas: **nunca copia archivos no-TS**. Leer el YAML
en runtime habría dependido del `cwd` del proceso y habría fallado en producción. El JSON
importado no depende de nada externo.

El archivo es un artefacto generado y no se versiona: `predev`, `pretest` y `build` lo
regeneran siempre, así que no puede quedar viejo ni entrar en conflicto en un merge.

### 4. Los WebSockets se documentan en Markdown

OpenAPI describe HTTP y no cubre WebSockets. Se evaluó AsyncAPI 3.0 y se descartó: introduce
un segundo estándar y una segunda herramienta para especificar siete eventos. La
documentación vive en `backend/docs/websockets.md`, con payloads, acks y reglas de
autorización.

### 5. Contrato de errores uniforme

Toda respuesta de error tiene la forma `{ error, code }` — texto en español para mostrar al
usuario, más un código estable para que el cliente ramifique lógica. Los errores de validación
Zod agregan `details`.

Para que el spec pudiera documentar esto sin excepciones, se completaron los tres puntos donde
el backend devolvía `{ error }` sin `code`: los 401 y el 500 de `requireUser`, el error Zod
genérico y el 404 de `GET /api/usuarios/me`. El catálogo de 51 códigos está en el schema
`ErrorCode` del spec.

## Consecuencias

**A favor**

- La documentación no puede volver a divergir del código sin romper el build.
- Swagger UI queda disponible en `/api/docs`, con soporte para probar los endpoints.
- El contrato de errores es uniforme y está enumerado, lo que simplifica el manejo en el frontend.
- El spec sirve de entregable de tesis y de referencia para el equipo, sin trabajo extra.

**En contra**

- Documentar un endpoint nuevo cuesta un archivo de paths más sus schemas. Es trabajo manual
  deliberado: es lo que mantiene la calidad de las descripciones y los ejemplos.
- Dos dependencias nuevas: `swagger-ui-express` en producción y `@redocly/cli` en desarrollo.

**Cambio de comportamiento observable**

Los path params `:viajeId` pasaron a validarse con Zod, cosa que antes no ocurría. Un UUID
malformado devuelve ahora **400 `VALIDATION_ERROR`** en vez del **500** que producía el error
de Prisma. Es la respuesta correcta, pero es un cambio para el frontend.

## Alternativas descartadas

| Alternativa | Motivo del descarte |
|---|---|
| Generar el spec desde Zod | Solo cubre la entrada; las respuestas se escriben a mano igual |
| Enfoque híbrido Zod + YAML | El doble de maquinaria para el alcance de una tesis |
| Dejar los YAML sin servir | Es el statu quo que produjo la divergencia |
| AsyncAPI para los WebSockets | Un segundo estándar y una segunda herramienta para 7 eventos |
| Copiar el YAML a `dist/` en el build | Depende del `cwd`; el JSON importado no depende de nada |

## Referencias

- Spec: `backend/openapi/openapi.yaml`
- Test de contrato: `backend/src/docs/contrato.test.ts`
- Eventos de tiempo real: `backend/docs/websockets.md`
- Reglas involucradas: RN-011, RN-021, RN-030, RN-031, RN-038, RN-070, RN-105/106/107
