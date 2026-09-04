/** Piso de tamaño de texto para uso outdoor (RN-052). */
export const FONT_SIZE_MIN_OUTDOOR = 15

export function tamanoOutdoor(base: number): number {
  return Math.max(base, FONT_SIZE_MIN_OUTDOOR)
}
