import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useCopilot } from 'react-native-copilot'

import { AdminScreen, mensajeError } from '@/components/admin/AdminUI'
import { PasoAyuda } from '@/components/ayuda/PasoAyuda'
import { AYUDA_ADMIN_REPORTES } from '@/components/ayuda/contenidoAyuda'
import {
  SeccionAdopcion,
  SeccionComunidad,
  SeccionCrecimiento,
  SeccionDestinos,
  SeccionGastos,
  SeccionResumen,
  SeccionRetencion,
  SeccionSeguridad,
  SeccionViajes,
} from '@/components/admin/reportes/Secciones'
import { Btn, Chip, useTheme } from '@/components/MeshUI'
import { meshAlert } from '@/lib/meshAlert'
import {
  reporteAdopcion,
  reporteComunidad,
  reporteCrecimiento,
  reporteDestinos,
  reporteGastos,
  reporteResumen,
  reporteRetencion,
  reporteSeguridad,
  reporteViajes,
  type Actividad,
  type FiltroReporte,
} from '@/lib/reportesApi'
import {
  compartirCsv,
  tablasAdopcion,
  tablasComunidad,
  tablasCrecimiento,
  tablasDestinos,
  tablasGastos,
  tablasResumen,
  tablasRetencion,
  tablasSeguridad,
  tablasViajes,
} from '@/lib/reportesTablas'
import type { Tabla } from '@/components/admin/charts'

/* eslint-disable @typescript-eslint/no-explicit-any -- cada sección tipa su propio reporte */
type Seccion = {
  clave: string
  titulo: string
  conActividad: boolean
  cargar: (f: FiltroReporte, mesesRetencion: number) => Promise<any>
  tablas: (r: any) => Tabla[]
  Vista: (p: { r: any }) => React.ReactElement
}

const SECCIONES: Seccion[] = [
  { clave: 'resumen', titulo: 'Resumen', conActividad: false, cargar: reporteResumen, tablas: tablasResumen, Vista: SeccionResumen },
  { clave: 'crecimiento', titulo: 'Crecimiento', conActividad: false, cargar: reporteCrecimiento, tablas: tablasCrecimiento, Vista: SeccionCrecimiento },
  { clave: 'retencion', titulo: 'Retención', conActividad: false, cargar: (_f, m) => reporteRetencion(m), tablas: tablasRetencion, Vista: SeccionRetencion },
  { clave: 'viajes', titulo: 'Viajes', conActividad: true, cargar: reporteViajes, tablas: tablasViajes, Vista: SeccionViajes },
  { clave: 'comunidad', titulo: 'Comunidad', conActividad: false, cargar: reporteComunidad, tablas: tablasComunidad, Vista: SeccionComunidad },
  { clave: 'seguridad', titulo: 'Seguridad', conActividad: true, cargar: reporteSeguridad, tablas: tablasSeguridad, Vista: SeccionSeguridad },
  { clave: 'destinos', titulo: 'Destinos', conActividad: true, cargar: reporteDestinos, tablas: tablasDestinos, Vista: SeccionDestinos },
  { clave: 'adopcion', titulo: 'Adopción', conActividad: false, cargar: reporteAdopcion, tablas: tablasAdopcion, Vista: SeccionAdopcion },
  { clave: 'gastos', titulo: 'Gastos', conActividad: true, cargar: reporteGastos, tablas: tablasGastos, Vista: SeccionGastos },
]
/* eslint-enable @typescript-eslint/no-explicit-any */

type Preset = '30d' | '90d' | '12m' | 'anio'
const PRESETS: { clave: Preset; label: string }[] = [
  { clave: '30d', label: 'Últimos 30 días' },
  { clave: '90d', label: 'Últimos 90 días' },
  { clave: '12m', label: 'Últimos 12 meses' },
  { clave: 'anio', label: 'Este año' },
]

const ACTIVIDADES: { clave: Actividad; label: string }[] = [
  { clave: 'moto', label: 'Moto' },
  { clave: 'bici', label: 'Bici' },
  { clave: 'running', label: 'Running' },
  { clave: 'trekking', label: 'Trekking' },
  { clave: 'otro', label: 'Otro' },
]

/** Hoy en hora argentina (RN-105), como fecha calendario AAAA-MM-DD. */
function hoyArg(): string {
  return new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)
}

function restarDias(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10)
}

function rangoDe(preset: Preset): { desde: string; hasta: string } {
  const hasta = hoyArg()
  switch (preset) {
    case '30d':
      return { desde: restarDias(hasta, 29), hasta }
    case '90d':
      return { desde: restarDias(hasta, 89), hasta }
    case '12m':
      return { desde: restarDias(hasta, 364), hasta }
    case 'anio':
      return { desde: `${hasta.slice(0, 4)}-01-01`, hasta }
  }
}

/**
 * Reportería de negocio (RN-127 a RN-131): tableros para el PO y el directorio.
 * Todo agregado; el backend valida el rol superadmin en cada pedido.
 */
export default function AdminReportesScreen() {
  const theme = useTheme()
  const { start } = useCopilot()
  const [seccion, setSeccion] = useState('resumen')
  const [preset, setPreset] = useState<Preset>('90d')
  const [actividad, setActividad] = useState<Actividad | undefined>(undefined)
  const [mesesRetencion, setMesesRetencion] = useState(6)
  // Los datos van con la sección que los pidió: al cambiar de sección, la vista nueva
  // nunca recibe el reporte de la anterior (tienen formas distintas).
  const [datos, setDatos] = useState<{ clave: string; r: unknown } | null>(null)
  const pedido = useRef(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exportando, setExportando] = useState(false)

  const actual = SECCIONES.find((s) => s.clave === seccion)!
  const filtro = useMemo<FiltroReporte>(
    () => ({ ...rangoDe(preset), actividad: actual.conActividad ? actividad : undefined }),
    [preset, actividad, actual.conActividad]
  )

  const cargar = useCallback(async () => {
    // Si el usuario cambia de filtro antes de que llegue la respuesta, la vieja se descarta.
    const id = ++pedido.current
    setCargando(true)
    setError(null)
    try {
      const r = await actual.cargar(filtro, mesesRetencion)
      if (id === pedido.current) setDatos({ clave: actual.clave, r })
    } catch (e) {
      if (id === pedido.current) {
        setDatos(null)
        setError(mensajeError(e))
      }
    } finally {
      if (id === pedido.current) setCargando(false)
    }
  }, [actual, filtro, mesesRetencion])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const exportar = useCallback(async () => {
    if (!datos || datos.clave !== seccion) return
    setExportando(true)
    try {
      const sufijo = seccion === 'retencion' ? `${mesesRetencion}-meses` : `${filtro.desde}_${filtro.hasta}`
      await compartirCsv(`mesh-${seccion}-${sufijo}`, actual.tablas(datos.r))
    } catch (e) {
      meshAlert('No se pudo exportar', mensajeError(e))
    } finally {
      setExportando(false)
    }
  }, [actual, datos, filtro, mesesRetencion, seccion])

  const Vista = actual.Vista

  return (
    <AdminScreen
      title="Reportes"
      sub="Indicadores para decisiones de negocio"
      onRefresh={() => void cargar()}
      onAyuda={() => start()}
    >
      <PasoAyuda {...AYUDA_ADMIN_REPORTES[0]!}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {SECCIONES.map((s) => (
            <Chip key={s.clave} active={s.clave === seccion} onPress={() => setSeccion(s.clave)}>
              {s.titulo}
            </Chip>
          ))}
        </ScrollView>
      </PasoAyuda>

      <PasoAyuda {...AYUDA_ADMIN_REPORTES[1]!}>
        <View style={[styles.filtros, { borderColor: theme.border }]}>
          {seccion === 'retencion' ? (
            <View style={styles.chipsFila}>
              {[3, 6, 12].map((m) => (
                <Chip key={m} active={mesesRetencion === m} onPress={() => setMesesRetencion(m)}>
                  {`${m} meses`}
                </Chip>
              ))}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {PRESETS.map((p) => (
                <Chip key={p.clave} active={p.clave === preset} onPress={() => setPreset(p.clave)}>
                  {p.label}
                </Chip>
              ))}
            </ScrollView>
          )}
          {actual.conActividad ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip active={!actividad} onPress={() => setActividad(undefined)}>
                Todas
              </Chip>
              {ACTIVIDADES.map((a) => (
                <Chip key={a.clave} active={actividad === a.clave} onPress={() => setActividad(a.clave)}>
                  {a.label}
                </Chip>
              ))}
            </ScrollView>
          ) : null}
        </View>
      </PasoAyuda>

      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : error ? (
        <View style={styles.centro}>
          <Text style={{ color: theme.danger, textAlign: 'center' }}>{error}</Text>
          <Btn variant="outline" size="sm" onPress={() => void cargar()}>
            Reintentar
          </Btn>
        </View>
      ) : datos && datos.clave === seccion ? (
        <>
          <Vista r={datos.r} />
          <PasoAyuda {...AYUDA_ADMIN_REPORTES[2]!}>
            <Btn variant="outline" block icon="share" loading={exportando} onPress={() => void exportar()}>
              Exportar a CSV
            </Btn>
          </PasoAyuda>
        </>
      ) : null}
    </AdminScreen>
  )
}

const styles = StyleSheet.create({
  chips: { gap: 8, paddingRight: 8 },
  chipsFila: { flexDirection: 'row', gap: 8 },
  filtros: { gap: 8, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  centro: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 40 },
})
