/** Minúsculas y sin acentos, para que "cordoba" encuentre "Córdoba". */
export function normalizarBusqueda(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * true si alguno de los campos contiene la consulta (ya normalizada con normalizarBusqueda).
 * Una consulta vacía coincide con todo.
 */
export function coincideBusqueda(
  consulta: string,
  campos: (string | null | undefined)[]
): boolean {
  if (!consulta) return true;
  return campos.some((campo) => campo != null && normalizarBusqueda(campo).includes(consulta));
}
