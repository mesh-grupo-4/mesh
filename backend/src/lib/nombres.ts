/**
 * Nombre visible de un usuario.
 *
 * `usuario.nombre` ya guarda el nombre completo: el frontend sincroniza "Nombre Apellido"
 * en ese campo y además manda el apellido por separado. Si se concatenan los dos sin más
 * sale "Franco Giorda Giorda". Por eso el apellido solo se agrega cuando `nombre` no
 * termina ya con él (cuentas que guardaron solo el nombre de pila).
 */
export function nombreVisible(
  nombre: string | null | undefined,
  apellido: string | null | undefined
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
  apellido: string | null | undefined
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
