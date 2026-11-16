/** Teléfono argentino: 10 dígitos, con o sin +54 / 9 / 0 inicial. */
export function telefonoArgentinoValido(tel: string): boolean {
  const soloDigitos = tel.replace(/\D/g, '')
  const sinPrefijo = soloDigitos.startsWith('54')
    ? soloDigitos.slice(2).replace(/^9/, '')
    : soloDigitos.replace(/^0/, '')
  return /^\d{10}$/.test(sinPrefijo)
}
