import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { crearPrivacidadController } from './privacidad.controller'
import { PrivacidadService } from './privacidad.service'

const service = new PrivacidadService(prisma)
const c = crearPrivacidadController(service)

/**
 * La privacidad de ubicación tiene dos alcances y cada uno cuelga de su router:
 * el perfil (consentimiento y default) en `/api/usuarios`, y el interruptor por
 * viaje junto al resto de `/api/viajes/:viajeId`.
 */
export const privacidadUsuarioHandlers = {
  obtener: [requireUser, c.miPrivacidad] as const,
  actualizar: [requireUser, c.actualizarMiPrivacidad] as const,
  accesos: [requireUser, c.misAccesos] as const,
}

export const privacidadViajeHandlers = {
  obtener: [requireUser, c.privacidadViaje] as const,
  actualizar: [requireUser, c.actualizarPrivacidadViaje] as const,
  accesos: [requireUser, c.accesosViaje] as const,
}
