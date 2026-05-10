export {}

declare global {
  namespace Express {
    interface Request {
      /** Identidad temporal vía header `x-user-id` (stub hasta Firebase). */
      userId?: string
    }
  }
}
