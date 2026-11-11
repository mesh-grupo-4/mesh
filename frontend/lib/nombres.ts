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
  const pila = nombreDePila(n, a)
  if (pila === n) return `${n} ${a}`
  // `nombre` ya traía el apellido: se conserva como estaba escrito ahí, una sola vez.
  const escrito = n.slice(n.length - a.length)
  return pila ? `${pila} ${escrito}` : escrito
}

/**
 * Nombre sin el apellido al final ("Franco Giorda" → "Franco"). Lo quita todas las
 * veces que aparezca repetido: hubo cuentas que quedaron guardadas como
 * "Franco Giorda Giorda".
 */
export function nombreDePila(
  nombre: string | null | undefined,
  apellido?: string | null
): string {
  let n = (nombre ?? '').trim().replace(/\s+/g, ' ')
  const a = (apellido ?? '').trim().replace(/\s+/g, ' ')
  if (!a) return n
  const aMin = a.toLocaleLowerCase('es')
  for (;;) {
    const nMin = n.toLocaleLowerCase('es')
    if (nMin === aMin) return ''
    if (!nMin.endsWith(` ${aMin}`)) return n
    n = n.slice(0, n.length - a.length).trimEnd()
  }
}
