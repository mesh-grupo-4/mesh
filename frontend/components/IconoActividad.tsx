import { useId } from 'react'
import { Feather, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons'
import Svg, { Circle, G, Mask, Path, Rect } from 'react-native-svg'

/**
 * Ícono suelto de una actividad, sin el recuadro de color de `ActivityTile`. Trekking y bici
 * van dibujados a medida: el de la librería de trekking no se entendía y la bici sola se
 * confundía con la moto, así que son un caminante con bastón delante de una montaña y una
 * persona pedaleando.
 */
export function IconoActividad({
  actividad,
  size = 22,
  color,
}: {
  actividad: string
  size?: number
  color: string
}) {
  switch (actividad) {
    case 'trekking':
      return <IconoTrekking size={size} color={color} />
    case 'bici':
      return <IconoCiclista size={size} color={color} />
    case 'moto':
      return <MaterialCommunityIcons name="motorbike" size={size} color={color} />
    case 'auto':
      return <MaterialCommunityIcons name="car" size={size} color={color} />
    case 'running':
      return <FontAwesome5 name="running" size={size * 0.86} color={color} />
    case 'otro':
      return <MaterialCommunityIcons name="dots-horizontal" size={size} color={color} />
    default:
      return <Feather name="map" size={size * 0.9} color={color} />
  }
}

/** Id de máscara válido para `url(#...)`: el de `useId` trae dos puntos. */
function useIdMascara(prefijo: string): string {
  return `${prefijo}${useId().replace(/[^a-zA-Z0-9]/g, '')}`
}

const CAMINANTE_CABEZA = { cx: 16.2, cy: 4.1, r: 1.7 }
const CAMINANTE_MOCHILA = 'M12.8 7.4h2.3v4.4H12.8a.9.9 0 0 1-.9-.9V8.3a.9.9 0 0 1 .9-.9z'
const CAMINANTE_CUERPO =
  'M15.8 6.6l-.8 5.6M15 12.2l2.1 3.6v4.4M15 12.2l-1.9 3.7-1.2 4.3M15.7 8.2l2.6 2.6M19.2 6.4l1.6 13.8'

/**
 * Caminante con mochila y bastón, con un pico nevado al costado. La montaña va más tenue y
 * se corta alrededor de la persona (máscara), así ninguna línea la cruza.
 */
function IconoTrekking({ size, color }: { size: number; color: string }) {
  const idMascara = useIdMascara('trek')
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Mask id={idMascara} x="0" y="0" width="24" height="24" maskUnits="userSpaceOnUse">
        <Rect x="0" y="0" width="24" height="24" fill="white" />
        <G fill="black" stroke="black" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round">
          <Circle {...CAMINANTE_CABEZA} />
          <Path d={CAMINANTE_MOCHILA} />
          <Path d={CAMINANTE_CUERPO} />
        </G>
      </Mask>
      <G
        mask={`url(#${idMascara})`}
        stroke={color}
        strokeOpacity={0.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M0.8 20.5L7.6 8l5.6 9.2" strokeWidth={1.5} />
        <Path d="M5.2 12.3l1.2.9 1.2-1.3 1.2 1.3 1.1-.9" strokeWidth={1.3} />
        <Path d="M0.8 20.5h22.4" strokeWidth={1.5} />
      </G>
      <Circle {...CAMINANTE_CABEZA} fill={color} />
      <Path d={CAMINANTE_MOCHILA} fill={color} />
      <Path
        d={CAMINANTE_CUERPO}
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

const CICLISTA_CABEZA = { cx: 12.4, cy: 2.9, r: 1.6 }
const CICLISTA_CUERPO = 'M9.2 9.6l2.4-4.7M11.6 4.9l3.9 3.7M9.2 9.6l4 3-1 6M9.2 9.6l2.2 4.4-1.5 2.4'

/**
 * Persona erguida pedaleando, con manubrio alto: se lee como bici de paseo y no como moto.
 * El cuadro se corta alrededor del cuerpo (máscara) para que la figura se separe de la bici.
 */
function IconoCiclista({ size, color }: { size: number; color: string }) {
  const idMascara = useIdMascara('bici')
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Mask id={idMascara} x="0" y="0" width="24" height="24" maskUnits="userSpaceOnUse">
        <Rect x="0" y="0" width="24" height="24" fill="white" />
        <G fill="black" stroke="black" strokeWidth={3.8} strokeLinecap="round" strokeLinejoin="round">
          <Circle {...CICLISTA_CABEZA} />
          <Path d={CICLISTA_CUERPO} />
        </G>
      </Mask>
      <G
        mask={`url(#${idMascara})`}
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Circle cx="5" cy="17.5" r="3.9" />
        <Circle cx="19" cy="17.5" r="3.9" />
        <Path d="M5 17.5H11l5-6.7M5 17.5l4.2-6.7H16M11 17.5L8.8 10M7.6 10h2.4M16 10.8l3 6.7M16 10.8l-.6-2.3h2.2" />
        <Circle cx="11" cy="17.5" r="1" fill={color} stroke="none" />
      </G>
      <Circle {...CICLISTA_CABEZA} fill={color} />
      <Path
        d={CICLISTA_CUERPO}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
