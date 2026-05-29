export {}

declare global {
  namespace Express {
    interface Request {
      /** UUID interno del Usuario autenticado (resuelto por requireUser vía Firebase). */
      userId?: string
    }
  }
}
