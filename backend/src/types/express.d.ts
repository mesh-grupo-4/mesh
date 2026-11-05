import type { RolSistema } from '@prisma/client'

export {}

declare global {
  namespace Express {
    interface Request {
      /** UUID interno del Usuario autenticado (resuelto por requireUser vía Firebase). */
      userId?: string
      /** Rol de plataforma (RN-120), resuelto junto con `userId`. */
      rolSistema?: RolSistema
    }
  }
}
