/**
 * Arma el nombre visible de un usuario a partir de nombre + apellido.
 * Refleja el mismo criterio que `nombreVisible` del backend (`backend/src/lib/nombres.ts`),
 * para que nombres e iniciales del avatar sean consistentes en toda la app (E04).
 *
 * `usuario.nombre` en la BD ya guarda el nombre completo ("Franco Giorda") y el apellido
 * viaja aparte: el apellido solo se agrega si `nombre` no termina ya con él, para no
 * mostrar "Franco Giorda Giorda".
 */
export function nombreCompleto(
  nombre: string | null | undefined,
  apellido?: string | null
): string {
  const n = (nombre ?? '').trim().replace(/\s+/g, ' ')
  const a = (apellido ?? '').trim().replace(/\s+/g, ' ')
  if (!a) return n
  if (!n) return a
  const nMin = n.toLocaleLowerCase('es')
  const aMin = a.toLocaleLowerCase('es')
  if (nMin === aMin || nMin.endsWith(` ${aMin}`)) return n
  return `${n} ${a}`
}
