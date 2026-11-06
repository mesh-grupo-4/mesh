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
  const nMin = n.toLocaleLowerCase('es')
  const aMin = a.toLocaleLowerCase('es')
  if (nMin === aMin || nMin.endsWith(` ${aMin}`)) return n
  return `${n} ${a}`
}
