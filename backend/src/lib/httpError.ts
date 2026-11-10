export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    /** Campos adicionales que viajan en el cuerpo del error, junto a `error` y `code`. */
    public readonly datos?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'HttpError'
  }
}
