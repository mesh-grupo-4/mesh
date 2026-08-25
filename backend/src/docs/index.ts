import spec from './openapi.bundled.json'

/**
 * Spec OpenAPI de la API, ya bundleado (sin `$ref` externos).
 *
 * El archivo `openapi.bundled.json` es un artefacto generado: lo produce
 * `npm run docs:bundle` a partir de `openapi/openapi.yaml`, y los hooks `predev`,
 * `pretest` y `build` lo regeneran siempre. No se versiona.
 *
 * Se importa como JSON —en vez de leer el YAML en runtime— para que `tsc` lo copie
 * a `dist/docs/` y el spec esté disponible en producción sin depender del `cwd`
 * ni de pasos de copia manuales.
 */
export const openapiSpec = spec as unknown as Record<string, unknown>

export { docsRouter } from './router'
