import { Router } from 'express'
import { amistadesRouter } from '../modules/amistades/amistades.router'
import { geocodingRouter } from '../modules/geocoding/geocoding.router'
import { gruposRouter } from '../modules/grupos/grupos.router'
import { insigniasRouter } from '../modules/insignias/insignias.router'
import { rachasRouter } from '../modules/rachas/rachas.router'
import { tablaPosicionesRouter } from '../modules/tabla-posiciones/tabla-posiciones.router'
import { recorridosPublicadosRouter } from '../modules/recorridos-publicados/recorridos-publicados.router'
import { lugaresRouter } from '../modules/lugares/lugares.router'
import { routingRouter } from '../modules/routing/routing.router'
import { usuariosRouter } from '../modules/usuarios/usuarios.router'
import { viajesRouter } from '../modules/viajes/viajes.router'
import {
  rutasCompartidasRouter,
  rutasPlantillaRouter,
} from '../modules/rutas-compartidas/rutas-compartidas.router'
import { adminRouter } from '../modules/admin/admin.router'
import { reportesRouter } from '../modules/reportes/reportes.router'
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
  { prefijo: '/geocoding', router: geocodingRouter },
  { prefijo: '/routing', router: routingRouter },
  { prefijo: '/lugares', router: lugaresRouter },
  { prefijo: '/grupos', router: gruposRouter },
  { prefijo: '/insignias', router: insigniasRouter },
  { prefijo: '/rachas', router: rachasRouter },
  { prefijo: '/tabla-posiciones', router: tablaPosicionesRouter },
  { prefijo: '/recorridos-publicados', router: recorridosPublicadosRouter },
  { prefijo: '/viajes', router: viajesRouter },
  { prefijo: '/rutas-compartidas', router: rutasCompartidasRouter },
  { prefijo: '/rutas-plantilla', router: rutasPlantillaRouter },
  // Antes que '/admin': si no, sus requests pasarían también por el guard de adminRouter.
  { prefijo: '/admin/reportes', router: reportesRouter },
  { prefijo: '/admin', router: adminRouter },
] as const

for (const { prefijo, router: subRouter } of montajes) {
  router.use(prefijo, subRouter)
}

// Documentación interactiva en /api/docs. Se puede apagar en producción con
// DOCS_ENABLED=false sin tocar el código.
if (process.env.DOCS_ENABLED !== 'false') {
  router.use(docsRouter)
}
