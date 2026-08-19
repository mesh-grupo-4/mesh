import { describe, expect, it, vi } from 'vitest'

// El grafo de imports de los routers arrastra la config de Firebase y de Prisma,
// que exigirían credenciales reales. El test solo inspecciona la forma de las rutas,
// nunca las ejecuta, así que alcanza con stubs vacíos.
vi.mock('../config/firebase', () => ({
  firebaseAuth: { verifyIdToken: vi.fn() },
}))
vi.mock('../config/prisma', () => ({ prisma: {} }))

const { montajes } = await import('../routes')
const { openapiSpec } = await import('./index')

const METODOS_HTTP = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const

type Operacion = {
  operationId?: string
  summary?: string
  tags?: string[]
  security?: unknown[]
  responses?: Record<string, unknown>
  parameters?: { name?: string; in?: string; $ref?: string }[]
}
type Parametro = { name?: string; in?: string; $ref?: string }
type Spec = {
  paths: Record<string, Record<string, Operacion> & { parameters?: Parametro[] }>
  tags?: { name: string }[]
  components?: Record<string, Record<string, unknown>>
}

const spec = openapiSpec as unknown as Spec

/**
 * Resuelve un `$ref` interno del tipo `#/components/parameters/ViajeId`.
 * El bundle de Redocly hoistea los componentes compartidos, así que los parámetros
 * llegan como referencia y no como objeto literal.
 */
function resolverRef<T>(nodo: T & { $ref?: string }): T {
  if (!nodo?.$ref) return nodo
  const partes = nodo.$ref.replace(/^#\//, '').split('/')
  let actual: unknown = spec
  for (const parte of partes) {
    actual = (actual as Record<string, unknown>)?.[parte.replace(/~1/g, '/').replace(/~0/g, '~')]
  }
  return actual as T
}

/** `/:viajeId/ruta` → `/{viajeId}/ruta` */
function aPlantillaOpenApi(pathExpress: string): string {
  return pathExpress.replace(/:([A-Za-z0-9_]+)/g, '{$1}')
}

/**
 * Enumera la superficie REST real recorriendo la tabla de montajes de
 * `src/routes/index.ts` y el `stack` de cada sub-router de Express.
 */
function rutasReales(): string[] {
  const rutas: string[] = ['GET /api/health']

  for (const { prefijo, router } of montajes) {
    const stack = (router as unknown as { stack: { route?: { path: string; methods: Record<string, boolean> } }[] })
      .stack

    for (const layer of stack) {
      if (!layer.route) continue
      const sufijo = layer.route.path === '/' ? '' : aPlantillaOpenApi(layer.route.path)
      const path = `/api${prefijo}${sufijo}`

      for (const metodo of Object.keys(layer.route.methods)) {
        if (metodo === '_all') continue
        rutas.push(`${metodo.toUpperCase()} ${path}`)
      }
    }
  }

  return rutas.sort()
}

/** Enumera las operaciones declaradas en el spec, en el mismo formato. */
function rutasDocumentadas(): string[] {
  const rutas: string[] = []
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const metodo of METODOS_HTTP) {
      if (pathItem[metodo]) rutas.push(`${metodo.toUpperCase()} ${path}`)
    }
  }
  return rutas.sort()
}

/** Recorre cada operación del spec junto con su path y método. */
function operaciones(): { path: string; metodo: string; clave: string; op: Operacion }[] {
  const out: { path: string; metodo: string; clave: string; op: Operacion }[] = []
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const metodo of METODOS_HTTP) {
      const op = pathItem[metodo]
      if (op) out.push({ path, metodo, clave: `${metodo.toUpperCase()} ${path}`, op })
    }
  }
  return out
}

describe('contrato OpenAPI ↔ router de Express', () => {
  it('no hay endpoints sin documentar', () => {
    const documentadas = new Set(rutasDocumentadas())
    const sinDocumentar = rutasReales().filter((r) => !documentadas.has(r))

    expect(
      sinDocumentar,
      `Estos endpoints existen en el código pero faltan en openapi/: \n  ${sinDocumentar.join('\n  ')}`
    ).toEqual([])
  })

  it('no hay documentación fantasma', () => {
    const reales = new Set(rutasReales())
    const fantasma = rutasDocumentadas().filter((r) => !reales.has(r))

    expect(
      fantasma,
      `Estas operaciones están documentadas pero ya no existen en el router: \n  ${fantasma.join('\n  ')}`
    ).toEqual([])
  })

  it('toda operación declara operationId, summary y tags', () => {
    const incompletas = operaciones()
      .filter(({ op }) => !op.operationId || !op.summary || !op.tags?.length)
      .map(({ clave }) => clave)

    expect(incompletas, `Operaciones sin metadatos obligatorios: ${incompletas.join(', ')}`).toEqual(
      []
    )
  })

  it('los operationId son únicos', () => {
    const vistos = new Map<string, string>()
    const duplicados: string[] = []

    for (const { clave, op } of operaciones()) {
      const id = op.operationId
      if (!id) continue
      const previo = vistos.get(id)
      if (previo) duplicados.push(`${id}: ${previo} y ${clave}`)
      else vistos.set(id, clave)
    }

    expect(duplicados, `operationId repetidos: ${duplicados.join(' | ')}`).toEqual([])
  })

  it('los tags usados están declarados en la raíz del spec', () => {
    const declarados = new Set((spec.tags ?? []).map((t) => t.name))
    const huerfanos = [
      ...new Set(operaciones().flatMap(({ op }) => op.tags ?? []).filter((t) => !declarados.has(t))),
    ]

    expect(huerfanos, `Tags sin declarar en la raíz: ${huerfanos.join(', ')}`).toEqual([])
  })

  it('toda operación autenticada documenta 401, y solo /api/health es pública', () => {
    // `security: []` marca una operación como pública (RN-030: el resto exige token).
    const publicas = operaciones()
      .filter(({ op }) => Array.isArray(op.security) && op.security.length === 0)
      .map(({ clave }) => clave)

    expect(publicas).toEqual(['GET /api/health'])

    const sin401 = operaciones()
      .filter(({ op }) => !(Array.isArray(op.security) && op.security.length === 0))
      .filter(({ op }) => !op.responses?.['401'])
      .map(({ clave }) => clave)

    expect(sin401, `Operaciones autenticadas sin respuesta 401: ${sin401.join(', ')}`).toEqual([])
  })

  it('toda operación documenta los parámetros de path que usa', () => {
    const faltantes: string[] = []

    for (const { path, metodo, clave, op } of operaciones()) {
      const enPath = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1])
      const heredados = spec.paths[path].parameters ?? []
      const declarados = new Set(
        [...heredados, ...(op.parameters ?? [])]
          .map(resolverRef)
          .filter((p) => p.in === 'path')
          .map((p) => p.name)
      )
      void metodo
      for (const nombre of enPath) {
        if (!declarados.has(nombre)) faltantes.push(`${clave} → {${nombre}}`)
      }
    }

    expect(faltantes, `Parámetros de path sin declarar: ${faltantes.join(', ')}`).toEqual([])
  })

  it('toda operación documenta al menos una respuesta 2xx', () => {
    const sin2xx = operaciones()
      .filter(({ op }) => !Object.keys(op.responses ?? {}).some((c) => c.startsWith('2')))
      .map(({ clave }) => clave)

    expect(sin2xx, `Operaciones sin respuesta de éxito: ${sin2xx.join(', ')}`).toEqual([])
  })
})
