import { Feather } from '@expo/vector-icons'
import { useEffect, useState, type ReactNode } from 'react'
import { Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ActivityTile, Btn, useTheme } from '@/components/MeshUI'
import { Pressable } from '@/components/Pressable'
import { SegmentTabs } from '@/components/SegmentTabs'
import { ACTIVIDADES } from '@/lib/activityDefaults'
import {
  ETIQUETA_ESTADO_PROXIMOS,
  ETIQUETA_MODO,
  ETIQUETA_ORDEN_PASADOS,
  ETIQUETA_PERIODO_PASADOS,
  ETIQUETA_PERIODO_PROXIMOS,
  alternar,
  filtrosActivos,
  limpiarFiltros,
  type FiltrosViajes,
  type OrdenPasados,
  type PestanaViajes,
} from '@/lib/filtrosViajes'
import type { ModoViajeApi } from '@/lib/viajesApi'

type Props = {
  visible: boolean
  pestana: PestanaViajes
  /** Filtros aplicados: la hoja trabaja sobre una copia y solo los reemplaza al confirmar. */
  filtros: FiltrosViajes
  /** Cuántos viajes quedarían con estos filtros, para mostrarlo antes de aplicar. */
  contar: (filtros: FiltrosViajes) => number
  onAplicar: (filtros: FiltrosViajes) => void
  onCerrar: () => void
}

const MODOS: { id: ModoViajeApi; icono: keyof typeof Feather.glyphMap; detalle: string }[] = [
  { id: 'recreativo', icono: 'sun', detalle: 'Navegación y alertas, sin comparaciones.' },
  { id: 'entrenamiento', icono: 'activity', detalle: 'Ritmo, splits y evolución de tus sesiones.' },
  { id: 'competitivo', icono: 'flag', detalle: 'Clasificación en vivo y recap con puestos.' },
]

const ICONO_ORDEN: Record<OrdenPasados, keyof typeof Feather.glyphMap> = {
  recientes: 'arrow-down',
  antiguos: 'arrow-up',
  distancia: 'trending-up',
}

function Seccion({ titulo, ayuda, children }: { titulo: string; ayuda?: string; children: ReactNode }) {
  const theme = useTheme()
  return (
    <View style={styles.seccion}>
      <View style={styles.seccionCabecera}>
        <Text style={[styles.seccionTitulo, { color: theme.text }]}>{titulo}</Text>
        {ayuda ? <Text style={[styles.seccionAyuda, { color: theme.textMute }]}>{ayuda}</Text> : null}
      </View>
      {children}
    </View>
  )
}

/** Opción tipo chip, con tamaño de toque cómodo para usar en exteriores (RN-052). */
function Opcion({
  etiqueta,
  activa,
  onPress,
  icono,
}: {
  etiqueta: string
  activa: boolean
  onPress: () => void
  icono?: ReactNode
}) {
  const theme = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: activa }}
      style={[
        styles.opcion,
        {
          backgroundColor: activa ? theme.accentWeak : theme.surface,
          borderColor: activa ? theme.accent : theme.border,
        },
      ]}
    >
      {icono}
      <Text style={[styles.opcionTexto, { color: activa ? theme.accent : theme.text }]}>{etiqueta}</Text>
      {activa ? <Feather name="check" size={15} color={theme.accent} /> : null}
    </Pressable>
  )
}

/**
 * Hoja de filtros de la pestaña Viajes. Muestra solo lo que tiene sentido en la
 * pestaña abierta (cuándo y estado en "Mis viajes"; período y orden en "Pasados").
 */
export function HojaFiltrosViajes({ visible, pestana, filtros, contar, onAplicar, onCerrar }: Props) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [borrador, setBorrador] = useState(filtros)

  // Cada vez que se abre arranca desde lo aplicado: cerrar sin confirmar descarta los cambios.
  useEffect(() => {
    if (visible) setBorrador(filtros)
  }, [visible, filtros])

  const editar = (parcial: Partial<FiltrosViajes>) => setBorrador((b) => ({ ...b, ...parcial }))
  const cantidad = contar(borrador)
  const hayFiltros = filtrosActivos(borrador, pestana).length > 0
  const esPasados = pestana === 'pasados'

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onCerrar}
    >
      <SafeAreaView
        style={[
          styles.raiz,
          { backgroundColor: theme.background },
          Platform.OS === 'android' && { paddingTop: insets.top },
        ]}
      >
        <View style={[styles.cabecera, { borderBottomColor: theme.border }]}>
          <Pressable onPress={onCerrar} hitSlop={8} style={styles.cerrar} accessibilityLabel="Cerrar sin aplicar">
            <Feather name="x" size={22} color={theme.text} />
          </Pressable>
          <Text style={[styles.titulo, { color: theme.text }]}>Filtrar viajes</Text>
          <Pressable
            onPress={() => setBorrador(limpiarFiltros(borrador))}
            disabled={!hayFiltros}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ disabled: !hayFiltros }}
          >
            <Text style={[styles.limpiar, { color: hayFiltros ? theme.accent : theme.textMute }]}>Limpiar</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.contenido}>
          <Seccion titulo="Actividad" ayuda="Podés elegir varias">
            <View style={styles.opciones}>
              {ACTIVIDADES.map((a) => (
                <Opcion
                  key={a.id}
                  etiqueta={a.label}
                  activa={borrador.actividades.includes(a.id)}
                  onPress={() => editar({ actividades: alternar(borrador.actividades, a.id) })}
                  icono={<ActivityTile activity={a.id} size={24} />}
                />
              ))}
            </View>
          </Seccion>

          <Seccion titulo="Tipo de viaje" ayuda="Podés elegir varios">
            <View style={styles.modos}>
              {MODOS.map((m) => {
                const activo = borrador.modos.includes(m.id)
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => editar({ modos: alternar(borrador.modos, m.id) })}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: activo }}
                    accessibilityLabel={`${ETIQUETA_MODO[m.id]}. ${m.detalle}`}
                    style={[
                      styles.modo,
                      {
                        backgroundColor: activo ? theme.accentWeak : theme.surface,
                        borderColor: activo ? theme.accent : theme.border,
                      },
                    ]}
                  >
                    <View style={[styles.modoIcono, { backgroundColor: activo ? theme.surface : theme.surface2 }]}>
                      <Feather name={m.icono} size={18} color={activo ? theme.accent : theme.textDim} />
                    </View>
                    <View style={styles.modoTexto}>
                      <Text style={[styles.modoTitulo, { color: theme.text }]}>{ETIQUETA_MODO[m.id]}</Text>
                      <Text style={[styles.modoDetalle, { color: theme.textDim }]}>{m.detalle}</Text>
                    </View>
                    <Feather
                      name={activo ? 'check-square' : 'square'}
                      size={20}
                      color={activo ? theme.accent : theme.textMute}
                    />
                  </Pressable>
                )
              })}
            </View>
          </Seccion>

          <Seccion titulo="Con quién">
            <SegmentTabs
              tabs={[
                { key: 'todos', label: 'Todos' },
                { key: 'solo', label: 'Solo' },
                { key: 'grupal', label: 'Grupal' },
              ]}
              active={borrador.formato}
              onChange={(k) => editar({ formato: k as FiltrosViajes['formato'] })}
              theme={theme}
            />
          </Seccion>

          <Seccion titulo="Mi rol">
            <SegmentTabs
              tabs={[
                { key: 'todos', label: 'Todos' },
                { key: 'creador', label: 'Organizo yo' },
                { key: 'participante', label: 'Participo' },
              ]}
              active={borrador.rol}
              onChange={(k) => editar({ rol: k as FiltrosViajes['rol'] })}
              theme={theme}
            />
          </Seccion>

          {esPasados ? (
            <>
              <Seccion titulo="Cuándo">
                <View style={styles.opciones}>
                  <Opcion
                    etiqueta="Cualquier fecha"
                    activa={borrador.periodoPasados === 'todos'}
                    onPress={() => editar({ periodoPasados: 'todos' })}
                  />
                  {(Object.keys(ETIQUETA_PERIODO_PASADOS) as (keyof typeof ETIQUETA_PERIODO_PASADOS)[]).map((p) => (
                    <Opcion
                      key={p}
                      etiqueta={ETIQUETA_PERIODO_PASADOS[p]}
                      activa={borrador.periodoPasados === p}
                      onPress={() => editar({ periodoPasados: p })}
                    />
                  ))}
                </View>
              </Seccion>

              <Seccion titulo="Ordenar por">
                <View style={styles.opciones}>
                  {(Object.keys(ETIQUETA_ORDEN_PASADOS) as OrdenPasados[]).map((o) => (
                    <Opcion
                      key={o}
                      etiqueta={ETIQUETA_ORDEN_PASADOS[o]}
                      activa={borrador.ordenPasados === o}
                      onPress={() => editar({ ordenPasados: o })}
                      icono={
                        <Feather
                          name={ICONO_ORDEN[o]}
                          size={15}
                          color={borrador.ordenPasados === o ? theme.accent : theme.textDim}
                        />
                      }
                    />
                  ))}
                </View>
              </Seccion>
            </>
          ) : (
            <>
              <Seccion titulo="Estado">
                <SegmentTabs
                  tabs={[
                    { key: 'todos', label: 'Todos' },
                    { key: 'en_curso', label: ETIQUETA_ESTADO_PROXIMOS.en_curso },
                    { key: 'planificado', label: ETIQUETA_ESTADO_PROXIMOS.planificado },
                  ]}
                  active={borrador.estadoProximos}
                  onChange={(k) => editar({ estadoProximos: k as FiltrosViajes['estadoProximos'] })}
                  theme={theme}
                />
              </Seccion>

              <Seccion titulo="Cuándo" ayuda="Los viajes en curso siempre aparecen">
                <View style={styles.opciones}>
                  <Opcion
                    etiqueta="Cualquier fecha"
                    activa={borrador.periodoProximos === 'todos'}
                    onPress={() => editar({ periodoProximos: 'todos' })}
                  />
                  {(Object.keys(ETIQUETA_PERIODO_PROXIMOS) as (keyof typeof ETIQUETA_PERIODO_PROXIMOS)[]).map((p) => (
                    <Opcion
                      key={p}
                      etiqueta={ETIQUETA_PERIODO_PROXIMOS[p]}
                      activa={borrador.periodoProximos === p}
                      onPress={() => editar({ periodoProximos: p })}
                    />
                  ))}
                </View>
              </Seccion>
            </>
          )}
        </ScrollView>

        <View
          style={[
            styles.pie,
            { borderTopColor: theme.border, backgroundColor: theme.background, paddingBottom: insets.bottom + 12 },
          ]}
        >
          <Btn block size="lg" icon={cantidad === 0 ? undefined : 'check'} onPress={() => onAplicar(borrador)}>
            {cantidad === 0 ? 'Sin resultados con estos filtros' : cantidad === 1 ? 'Ver 1 viaje' : `Ver ${cantidad} viajes`}
          </Btn>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  cerrar: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  titulo: { flex: 1, fontSize: 18, fontWeight: '800' },
  limpiar: { fontSize: 15, fontWeight: '700', paddingHorizontal: 4 },
  contenido: { padding: 20, gap: 26, paddingBottom: 32 },
  seccion: { gap: 12 },
  seccionCabecera: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  seccionTitulo: { fontSize: 16, fontWeight: '800' },
  seccionAyuda: { fontSize: 13 },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  opcionTexto: { fontSize: 15, fontWeight: '600' },
  modos: { gap: 8 },
  modo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
  },
  modoIcono: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modoTexto: { flex: 1, gap: 2 },
  modoTitulo: { fontSize: 15, fontWeight: '700' },
  modoDetalle: { fontSize: 13, lineHeight: 17 },
  pie: { borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12 },
})
