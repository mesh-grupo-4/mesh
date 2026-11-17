import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import { AdminScreen, Fila, Seccion, fechaAdmin, mensajeError } from '@/components/admin/AdminUI'
import { Btn, Field } from '@/components/MeshUI'
import type { StopCategory } from '@/components/route-config/routeTypes'
import {
  definirDuracionParadaAdmin,
  listarDuracionesParadaAdmin,
  restaurarDuracionParadaAdmin,
  type DuracionParadaAdmin,
} from '@/lib/adminApi'
import { meshAlert, meshConfirmDestructive, meshSuccess } from '@/lib/meshAlert'
import { CATEGORIAS_PARADA } from '@/lib/paradasApi'

// Mismo tope que valida el backend (RN-134).
const MAX_MINUTOS = 240

function etiqueta(categoria: StopCategory): string {
  const c = CATEGORIAS_PARADA.find((x) => x.id === categoria)
  return c ? `${c.emoji}  ${c.label}` : categoria
}

/** Minutos válidos (entero de 0 a 240) o null si el texto no lo es. */
function minutosValidos(texto: string): number | null {
  if (!/^\d{1,3}$/.test(texto.trim())) return null
  const n = Number(texto.trim())
  return n <= MAX_MINUTOS ? n : null
}

/**
 * RN-134: el superadmin define cuántos minutos dura en promedio cada tipo de parada.
 * Se suman al tiempo en movimiento para estimar la duración total de un viaje.
 */
export default function AdminDuracionesParadaScreen() {
  const [duraciones, setDuraciones] = useState<DuracionParadaAdmin[] | null>(null)
  // Ediciones sin guardar por categoría, como texto del input.
  const [borradores, setBorradores] = useState<Partial<Record<StopCategory, string>>>({})
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const { items } = await listarDuracionesParadaAdmin()
      setDuraciones(items)
      setBorradores({})
    } catch (e) {
      meshAlert('No se pudieron cargar las duraciones', mensajeError(e))
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  if (!duraciones) return <AdminScreen title="Duración de paradas" cargando>{null}</AdminScreen>

  const cambios = duraciones.filter((d) => {
    const b = borradores[d.categoria]
    return b !== undefined && minutosValidos(b) !== d.minutos
  })
  const hayInvalidos = cambios.some((d) => minutosValidos(borradores[d.categoria]!) == null)

  const reemplazar = (guardada: DuracionParadaAdmin) => {
    setDuraciones((lista) => lista!.map((d) => (d.categoria === guardada.categoria ? guardada : d)))
    setBorradores(({ [guardada.categoria]: _, ...resto }) => resto)
  }

  const guardar = async () => {
    setOcupado(true)
    try {
      for (const d of cambios) {
        reemplazar(await definirDuracionParadaAdmin(d.categoria, minutosValidos(borradores[d.categoria]!)!))
      }
      meshSuccess('Duraciones guardadas', 'Las estimaciones de tiempo ya usan los minutos nuevos.')
    } catch (e) {
      meshAlert('No se pudo guardar', mensajeError(e))
    } finally {
      setOcupado(false)
    }
  }

  const restaurar = (d: DuracionParadaAdmin) =>
    meshConfirmDestructive({
      title: 'Volver al valor por defecto',
      message: `${etiqueta(d.categoria).trim()} vuelve a sumar ${d.minutos_por_defecto} min por parada.`,
      confirmLabel: 'Restaurar',
      onConfirm: async () => {
        setOcupado(true)
        try {
          reemplazar(await restaurarDuracionParadaAdmin(d.categoria))
        } catch (e) {
          meshAlert('No se pudo restaurar', mensajeError(e))
        } finally {
          setOcupado(false)
        }
      },
    })

  return (
    <AdminScreen title="Duración de paradas" sub="Minutos promedio por tipo de parada" onRefresh={() => void cargar()}>
      <Seccion descripcion="Cada parada planificada en una ruta suma estos minutos al tiempo estimado del viaje. El cambio rige también para las rutas ya guardadas.">
        {duraciones.map((d) => {
          const texto = borradores[d.categoria] ?? String(d.minutos)
          const invalido = minutosValidos(texto) == null
          return (
            <View key={d.categoria} style={styles.categoria}>
              <Fila
                titulo={etiqueta(d.categoria)}
                detalle={
                  d.updated_at
                    ? `Por defecto: ${d.minutos_por_defecto} min · Editada el ${fechaAdmin(d.updated_at)}`
                    : `Por defecto: ${d.minutos_por_defecto} min`
                }
                etiqueta={d.personalizado ? 'Personalizada' : 'Por defecto'}
                tonoEtiqueta={d.personalizado ? 'accent' : 'mute'}
              />
              <Field
                label="Minutos"
                value={texto}
                onChangeText={(t) => setBorradores((b) => ({ ...b, [d.categoria]: t }))}
                keyboardType="number-pad"
                maxLength={3}
                editable={!ocupado}
                error={invalido ? `Entre 0 y ${MAX_MINUTOS} minutos` : undefined}
              />
              {d.personalizado ? (
                <Btn
                  variant="danger-outline"
                  size="sm"
                  icon="rotate-ccw"
                  disabled={ocupado}
                  onPress={() => restaurar(d)}
                >
                  Volver a {d.minutos_por_defecto} min
                </Btn>
              ) : null}
            </View>
          )
        })}
      </Seccion>

      <Seccion descripcion="Guardar y restaurar quedan registrados en la auditoría.">
        <View style={styles.acciones}>
          <Btn
            block
            icon="check"
            loading={ocupado}
            disabled={cambios.length === 0 || hayInvalidos || ocupado}
            onPress={() => void guardar()}
          >
            Guardar cambios
          </Btn>
          {cambios.length > 0 ? (
            <Btn variant="ghost" block disabled={ocupado} onPress={() => setBorradores({})}>
              Descartar cambios
            </Btn>
          ) : null}
        </View>
      </Seccion>
    </AdminScreen>
  )
}

const styles = StyleSheet.create({
  categoria: { gap: 8, marginBottom: 12 },
  acciones: { gap: 10 },
})
