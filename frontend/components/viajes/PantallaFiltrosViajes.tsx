import { Feather } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { ActivityTile, useTheme } from '@/components/MeshUI'
import { Pressable } from '@/components/Pressable'
import {
  OpcionFiltro as Opcion,
  OpcionesFiltro,
  PantallaFiltros,
  SeccionFiltro as Seccion,
} from '@/components/PantallaFiltros'
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

/**
 * Pantalla de filtros de la pestaña Viajes. Muestra solo lo que tiene sentido en la
 * pestaña abierta (cuándo y estado en "Mis viajes"; período y orden en "Pasados").
 */
export function PantallaFiltrosViajes({ visible, pestana, filtros, contar, onAplicar, onCerrar }: Props) {
  const theme = useTheme()
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
    <PantallaFiltros
      visible={visible}
      titulo="Filtrar viajes"
      onCerrar={onCerrar}
      onLimpiar={() => setBorrador(limpiarFiltros(borrador))}
      puedeLimpiar={hayFiltros}
      textoAplicar={
        cantidad === 0
          ? 'Sin resultados con estos filtros'
          : cantidad === 1
            ? 'Ver 1 viaje'
            : `Ver ${cantidad} viajes`
      }
      onAplicar={() => onAplicar(borrador)}
    >
      <Seccion titulo="Actividad" ayuda="Podés elegir varias">
        <OpcionesFiltro>
          {ACTIVIDADES.map((a) => (
            <Opcion
              key={a.id}
              etiqueta={a.label}
              multiple
              activa={borrador.actividades.includes(a.id)}
              onPress={() => editar({ actividades: alternar(borrador.actividades, a.id) })}
              icono={<ActivityTile activity={a.id} size={24} />}
            />
          ))}
        </OpcionesFiltro>
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
            <OpcionesFiltro>
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
            </OpcionesFiltro>
          </Seccion>

          <Seccion titulo="Ordenar por">
            <OpcionesFiltro>
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
            </OpcionesFiltro>
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
            <OpcionesFiltro>
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
            </OpcionesFiltro>
          </Seccion>
        </>
      )}
    </PantallaFiltros>
  )
}

const styles = StyleSheet.create({
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
})
