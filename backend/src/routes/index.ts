import { Router } from 'express'
import { amistadesRouter } from '../modules/amistades/amistades.router'
import { gruposRouter } from '../modules/grupos/grupos.router'
import { usuariosRouter } from '../modules/usuarios/usuarios.router'
import { viajesRouter } from '../modules/viajes/viajes.router'
import {
  rutasCompartidasRouter,
  rutasPlantillaRouter,
} from '../modules/rutas-compartidas/rutas-compartidas.router'
import { docsRouter } from '../docs/router'

export const router = Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

/**
 * Tabla de montaje de los routers de dominio.
 *
 * Se declara como dato —en vez de encadenar `router.use(...)` sueltos— para que
 * `src/docs/contrato.test.ts` pueda enumerar la superficie REST real sin tener que
 * inferir los prefijos desde los regex internos de Express.
 */
export const montajes = [
  { prefijo: '/usuarios', router: usuariosRouter },
  { prefijo: '/amistades', router: amistadesRouter },
  { prefijo: '/grupos', router: gruposRouter },
  { prefijo: '/viajes', router: viajesRouter },
  { prefijo: '/rutas-compartidas', router: rutasCompartidasRouter },
  { prefijo: '/rutas-plantilla', router: rutasPlantillaRouter },
] as const

for (const { prefijo, router: subRouter } of montajes) {
  router.use(prefijo, subRouter)
}

// Documentación interactiva en /api/docs. Se puede apagar en producción con
// DOCS_ENABLED=false sin tocar el código.
if (process.env.DOCS_ENABLED !== 'false') {
  router.use(docsRouter)
}
