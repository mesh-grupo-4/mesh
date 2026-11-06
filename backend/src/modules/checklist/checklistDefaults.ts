import type { TipoActividad } from '@prisma/client'

/**
 * RN-026: ítems que el sistema sugiere al armar el checklist de preparativos,
 * según el tipo de actividad del viaje.
 *
 * El orden importa: se siembran en este orden y define cómo se ve la lista.
 * Son sugerencias, no obligaciones: el integrante puede borrar las que no le sirven
 * y agregar las suyas.
 */
const SUGERIDOS: Record<TipoActividad, readonly string[]> = {
  moto: [
    'Casco',
    'Guantes',
    'Campera con protecciones',
    'Cédula verde y seguro al día',
    'Licencia de conducir',
    'Tanque lleno',
    'Presión de cubiertas',
    'Kit de herramientas',
    'Agua',
    'Cargador de celular',
  ],
  auto: [
    'Licencia de conducir',
    'Cédula verde y seguro al día',
    'VTV vigente',
    'Tanque lleno',
    'Presión de cubiertas',
    'Rueda de auxilio y gato',
    'Matafuegos',
    'Balizas',
    'Agua',
    'Cargador de celular',
  ],
  bici: [
    'Casco',
    'Luces delantera y trasera',
    'Cámara de repuesto',
    'Inflador',
    'Kit de parches',
    'Juego de llaves Allen',
    'Bidón de agua',
    'Barritas o fruta',
    'Powerbank',
  ],
  running: [
    'Zapatillas de running',
    'Ropa técnica',
    'Hidratación',
    'Gorra',
    'Protector solar',
    'Gel o barrita energética',
    'Celular cargado',
    'Riñonera o cinturón',
  ],
  trekking: [
    'Calzado de trekking',
    'Mochila',
    'Agua (2 litros)',
    'Comida para el día',
    'Campera rompeviento',
    'Protector solar',
    'Linterna frontal',
    'Botiquín',
    'Mapa o GPS offline',
    'Abrigo extra',
  ],
  otro: ['Agua', 'Celular cargado', 'Documento', 'Botiquín', 'Abrigo'],
}

/** Los tipos de actividad de RN-021, en el orden de la lista de arriba. */
export const ACTIVIDADES_CHECKLIST = Object.keys(SUGERIDOS) as TipoActividad[]

/**
 * RN-026: ítems sugeridos por defecto para el tipo de actividad del viaje.
 * Rigen mientras el superadmin no los redefina (RN-132, tabla `checklist_actividad`).
 */
export function itemsSugeridos(tipo: TipoActividad): readonly string[] {
  return SUGERIDOS[tipo]
}
