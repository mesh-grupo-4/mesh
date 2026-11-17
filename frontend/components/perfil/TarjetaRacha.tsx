import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '@/components/MeshUI'
import type { SemanaActividad } from '@/lib/actividadPersonal'
import { HITOS_RACHA, nivelRacha, proximoHito, type RachaApi } from '@/lib/rachasApi'
import { formatearEnArg } from '@/lib/tiempoArg'

const HITO_MAXIMO = HITOS_RACHA[HITOS_RACHA.length - 1]!
const TAMANO_MARCA = 14

type Props = {
  racha: RachaApi | null
  /** `true` en el perfil propio (textos en segunda persona). */
  propia: boolean
  /**
   * Últimas semanas, de la más vieja a la actual. Solo en el perfil propio: del de
   * otra persona no tenemos su historial, y dibujar semanas vacías sería mentir.
   */
  semanas?: SemanaActividad[]
}

/**
 * RN-075: semanas seguidas con al menos un viaje terminado. La progresión se lee en la
 * escala de hitos (3, 5 y 10 semanas) y en el marco de la tarjeta, que gana presencia
 * con cada hito alcanzado. Sin emojis ni animaciones.
 */
export function TarjetaRacha({ racha, propia, semanas }: Props) {
  const theme = useTheme()
  const cantidad = racha?.semanas_consecutivas ?? 0
  const enRiesgo = racha?.en_riesgo ?? false
  const nivel = nivelRacha(cantidad)
  const siguiente = proximoHito(cantidad)
  // Con racha y sin riesgo, el backend ya contó un viaje de esta semana.
  const estaSemanaCuenta = cantidad > 0 && !enRiesgo

  const titulo =
    cantidad === 0
      ? 'Sin racha activa'
      : cantidad === 1
        ? '1 semana'
        : `${cantidad} semanas seguidas`

  const detalle = propia
    ? enRiesgo
      ? 'Esta semana todavía no saliste. Si termina sin viajes, la racha se corta.'
      : estaSemanaCuenta
        ? 'Esta semana ya cuenta.'
        : 'Terminá un viaje esta semana para arrancar una.'
    : enRiesgo
      ? 'Esta semana todavía no salió.'
      : estaSemanaCuenta
        ? 'Esta semana ya salió.'
        : 'Todavía no arrancó una racha.'

  const faltan = siguiente == null ? 0 : siguiente - cantidad
  const textoHito =
    siguiente == null
      ? `${propia ? 'Pasaste' : 'Pasó'} el hito más alto: ${HITO_MAXIMO} semanas.`
      : `${propia ? 'Te faltan' : 'Le faltan'} ${faltan} ${
          faltan === 1 ? 'semana' : 'semanas'
        } para el hito de ${siguiente}.`

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: nivel === 0 ? theme.border : nivel === 3 ? theme.accent : theme.accentLine,
          borderWidth: nivel >= 2 ? 2 : 1,
        },
      ]}
    >
      <View style={styles.encabezado}>
        <Text style={[styles.titulo, { color: theme.text }]}>{titulo}</Text>
        {nivel > 0 ? (
          <View style={[styles.sello, { backgroundColor: theme.accentWeak }]}>
            <Text style={[styles.selloTexto, { color: theme.text }]}>
              Hito {HITOS_RACHA[nivel - 1]}
            </Text>
          </View>
        ) : null}
      </View>

      {semanas && semanas.length > 0 ? (
        <View
          style={styles.tira}
          accessible
          accessibilityLabel={`Últimas ${semanas.length} semanas: ${
            semanas.filter((s) => s.activa).length
          } con viajes`}
        >
          <View style={styles.casillas}>
            {semanas.map((s, i) => {
              const actual = i === semanas.length - 1
              return (
                <View
                  key={s.inicio.toISOString()}
                  style={[
                    styles.casilla,
                    s.activa
                      ? { backgroundColor: theme.accent, borderColor: theme.accent }
                      : {
                          backgroundColor: theme.surface2,
                          borderColor: actual ? theme.borderStrong : theme.border,
                          borderStyle: actual ? 'dashed' : 'solid',
                        },
                  ]}
                />
              )
            })}
          </View>
          <View style={styles.extremos}>
            <Text style={[styles.extremo, { color: theme.textMute }]}>
              {formatearEnArg(semanas[0]!.inicio, { day: 'numeric', month: 'short' })}
            </Text>
            <Text style={[styles.extremo, { color: theme.textMute }]}>esta semana</Text>
          </View>
        </View>
      ) : null}

      <Text style={[styles.detalle, { color: enRiesgo ? theme.danger : theme.textDim }]}>
        {detalle}
      </Text>

      {/* Escala de hitos: la barra avanza una semana por vez hasta el hito más alto. */}
      <View
        style={[styles.hitos, { borderTopColor: theme.border }]}
        accessible
        accessibilityLabel={`Hitos de racha: ${HITOS_RACHA.join(', ')} semanas. ${textoHito}`}
      >
        <View style={styles.escala}>
          <View style={[styles.riel, { backgroundColor: theme.surface2 }]}>
            <View
              style={[
                styles.avance,
                {
                  backgroundColor: theme.accent,
                  width: `${Math.min(cantidad / HITO_MAXIMO, 1) * 100}%`,
                },
              ]}
            />
          </View>
          {HITOS_RACHA.map((hito) => {
            const alcanzado = cantidad >= hito
            return (
              <View
                key={hito}
                style={[styles.marcaCaja, { left: `${(hito / HITO_MAXIMO) * 100}%` }]}
              >
                <View
                  style={[
                    styles.marca,
                    alcanzado
                      ? { backgroundColor: theme.accent, borderColor: theme.surface }
                      : { backgroundColor: theme.surface, borderColor: theme.borderStrong },
                  ]}
                />
                <Text
                  style={[
                    styles.marcaTexto,
                    { color: alcanzado ? theme.text : theme.textMute },
                    alcanzado && styles.marcaTextoAlcanzado,
                  ]}
                >
                  {hito}
                </Text>
              </View>
            )
          })}
        </View>
        <Text style={[styles.hitoTexto, { color: theme.textDim }]}>
          {textoHito}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 16, gap: 10 },
  encabezado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  titulo: { fontSize: 17, fontWeight: '800', flexShrink: 1 },
  sello: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  selloTexto: { fontSize: 12, fontWeight: '700' },
  tira: { gap: 6 },
  casillas: { flexDirection: 'row', gap: 6 },
  casilla: { flex: 1, height: 22, borderRadius: 5, borderWidth: 1 },
  extremos: { flexDirection: 'row', justifyContent: 'space-between' },
  extremo: { fontSize: 11.5 },
  detalle: { fontSize: 13.5, lineHeight: 19 },

  hitos: { gap: 8, paddingTop: 12, borderTopWidth: 1 },
  // El margen deja lugar a la marca del último hito, que cae justo en el borde.
  escala: { height: 34, marginRight: TAMANO_MARCA / 2 },
  riel: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (TAMANO_MARCA - 4) / 2,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  avance: { height: 4, borderRadius: 2 },
  marcaCaja: {
    position: 'absolute',
    top: 0,
    width: 28,
    marginLeft: -14,
    alignItems: 'center',
    gap: 3,
  },
  marca: { width: TAMANO_MARCA, height: TAMANO_MARCA, borderRadius: TAMANO_MARCA / 2, borderWidth: 2 },
  marcaTexto: { fontSize: 11.5 },
  marcaTextoAlcanzado: { fontWeight: '800' },
  hitoTexto: { fontSize: 12.5 },
})
