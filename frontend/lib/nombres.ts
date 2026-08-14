/**
 * Arma el nombre visible de un usuario a partir de nombre + apellido.
 * Refleja el mismo criterio que aplica el backend en `listarUbicacionesVivas`,
 * para que las iniciales del avatar sean consistentes en toda la app (E04).
 */
export function nombreCompleto(
  nombre: string | null | undefined,
  apellido?: string | null
): string {
  return [nombre, apellido].filter(Boolean).join(' ').trim()
}
