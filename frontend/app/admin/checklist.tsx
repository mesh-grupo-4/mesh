import { Feather } from '@expo/vector-icons'
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import {
  AdminScreen,
  ETIQUETA_ACTIVIDAD,
  Fila,
  Seccion,
  fechaAdmin,
  mensajeError,
} from '@/components/admin/AdminUI'
import { Btn, Chip, ChipRow, Field, useTheme } from '@/components/MeshUI'
import { Pressable } from '@/components/Pressable'
import {
  definirChecklistActividadAdmin,
  listarChecklistActividadesAdmin,
  restaurarChecklistActividadAdmin,
  type ChecklistActividadAdmin,
} from '@/lib/adminApi'
import { meshAlert, meshConfirmDestructive, meshSuccess } from '@/lib/meshAlert'
import type { ActividadPreferidaApi } from '@/lib/usuariosApi'

// Mismos límites que valida el backend (RN-132).
const MAX_ITEMS = 30
const MAX_TEXTO = 120

/**
 * RN-132: el superadmin define qué ítems se sugieren al armar el checklist de
 * preparativos (RN-026) de cada actividad. Los cambios valen para los checklists
 * que se armen de acá en adelante; los que ya existen son de cada persona.
 */
export default function AdminChecklistScreen() {
  const theme = useTheme()
  const [actividades, setActividades] = useState<ChecklistActividadAdmin[] | null>(null)
  const [tipo, setTipo] = useState<ActividadPreferidaApi>('moto')
  // Ediciones sin guardar por actividad: cambiar de chip no las pierde.
  const [borradores, setBorradores] = useState<Partial<Record<ActividadPreferidaApi, string[]>>>({})
  const [nuevo, setNuevo] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const { items } = await listarChecklistActividadesAdmin()
      setActividades(items)
      setBorradores({})
    } catch (e) {
      meshAlert('No se pudo cargar el checklist', mensajeError(e))
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  if (!actividades) return <AdminScreen title="Checklist de preparativos" cargando>{null}</AdminScreen>

  const actual = actividades.find((a) => a.tipo_actividad === tipo)!
  const items = borradores[tipo] ?? actual.items
  const cambiado = JSON.stringify(items) !== JSON.stringify(actual.items)

  const editar = (siguiente: string[]) => setBorradores((b) => ({ ...b, [tipo]: siguiente }))

  const mover = (desde: number, hacia: number) => {
    const copia = [...items]
    const [item] = copia.splice(desde, 1)
    copia.splice(hacia, 0, item!)
    editar(copia)
  }

  const textoNuevo = nuevo.trim()
  const repetido = items.includes(textoNuevo)

  const agregar = () => {
    if (!textoNuevo || repetido || items.length >= MAX_ITEMS) return
    editar([...items, textoNuevo])
    setNuevo('')
  }

  const reemplazar = (guardado: ChecklistActividadAdmin) => {
    setActividades((lista) =>
      lista!.map((a) => (a.tipo_actividad === guardado.tipo_actividad ? guardado : a))
    )
    setBorradores(({ [guardado.tipo_actividad]: _, ...resto }) => resto)
  }

  const guardar = async () => {
    setOcupado(true)
    try {
      reemplazar(await definirChecklistActividadAdmin(tipo, items))
      meshSuccess('Checklist guardado', 'Se va a sugerir en los checklists que se armen desde ahora.')
    } catch (e) {
      meshAlert('No se pudo guardar', mensajeError(e))
    } finally {
      setOcupado(false)
    }
  }

  const restaurar = () =>
    meshConfirmDestructive({
      title: 'Volver a la lista por defecto',
      message: `Se descarta la lista que definiste para ${ETIQUETA_ACTIVIDAD[tipo]} y vuelven a regir los sugeridos del sistema.`,
      confirmLabel: 'Restaurar',
      onConfirm: async () => {
        setOcupado(true)
        try {
          reemplazar(await restaurarChecklistActividadAdmin(tipo))
        } catch (e) {
          meshAlert('No se pudo restaurar', mensajeError(e))
        } finally {
          setOcupado(false)
        }
      },
    })

  return (
    <AdminScreen
      title="Checklist de preparativos"
      sub="Ítems sugeridos por actividad"
      onRefresh={() => void cargar()}
    >
      <ChipRow>
        {actividades.map((a) => (
          <Chip
            key={a.tipo_actividad}
            active={a.tipo_actividad === tipo}
            onPress={() => {
              setTipo(a.tipo_actividad)
              setNuevo('')
            }}
          >
            {ETIQUETA_ACTIVIDAD[a.tipo_actividad]}
          </Chip>
        ))}
      </ChipRow>

      <Seccion
        titulo={ETIQUETA_ACTIVIDAD[tipo]}
        descripcion="Se siembran en este orden la primera vez que alguien abre su checklist. Los checklists ya armados no cambian."
      >
        <Fila
          titulo="Lista vigente"
          detalle={actual.updated_at ? `Editada el ${fechaAdmin(actual.updated_at)}` : undefined}
          etiqueta={actual.personalizado ? 'Personalizada' : 'Por defecto'}
          tonoEtiqueta={actual.personalizado ? 'accent' : 'mute'}
        />
        {items.map((item, i) => (
          <View key={item} style={[styles.item, { borderTopColor: theme.border }]}>
            <Text style={[styles.itemTxt, { color: theme.text }]}>{item}</Text>
            <Pressable
              onPress={() => mover(i, i - 1)}
              disabled={i === 0 || ocupado}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Subir ${item}`}
              style={styles.accion}
            >
              <Feather name="arrow-up" size={20} color={i === 0 ? theme.border : theme.textDim} />
            </Pressable>
            <Pressable
              onPress={() => mover(i, i + 1)}
              disabled={i === items.length - 1 || ocupado}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Bajar ${item}`}
              style={styles.accion}
            >
              <Feather
                name="arrow-down"
                size={20}
                color={i === items.length - 1 ? theme.border : theme.textDim}
              />
            </Pressable>
            <Pressable
              onPress={() => editar(items.filter((_, j) => j !== i))}
              disabled={ocupado}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Quitar ${item}`}
              style={styles.accion}
            >
              <Feather name="x" size={20} color={theme.danger} />
            </Pressable>
          </View>
        ))}
        {items.length === 0 ? (
          <Text style={[styles.aviso, { color: theme.danger }]}>
            Dejá al menos un ítem sugerido.
          </Text>
        ) : null}

        <View style={styles.alta}>
          <Field
            label="Nuevo ítem"
            placeholder="Ej.: Chaleco reflectivo"
            value={nuevo}
            onChangeText={setNuevo}
            onSubmitEditing={agregar}
            maxLength={MAX_TEXTO}
            returnKeyType="done"
            error={repetido ? 'Ya está en la lista' : undefined}
          />
          <Btn
            variant="outline"
            block
            icon="plus"
            disabled={!textoNuevo || repetido || items.length >= MAX_ITEMS || ocupado}
            onPress={agregar}
          >
            {items.length >= MAX_ITEMS ? `Máximo ${MAX_ITEMS} ítems` : 'Agregar ítem'}
          </Btn>
        </View>
      </Seccion>

      <Seccion descripcion="Guardar y restaurar quedan registrados en la auditoría.">
        <View style={styles.acciones}>
          <Btn
            block
            icon="check"
            loading={ocupado}
            disabled={!cambiado || items.length === 0 || ocupado}
            onPress={() => void guardar()}
          >
            Guardar cambios
          </Btn>
          {cambiado ? (
            <Btn variant="ghost" block disabled={ocupado} onPress={() => editar(actual.items)}>
              Descartar cambios
            </Btn>
          ) : null}
          {actual.personalizado ? (
            <Btn variant="danger-outline" block icon="rotate-ccw" disabled={ocupado} onPress={restaurar}>
              Volver a la lista por defecto
            </Btn>
          ) : null}
        </View>
      </Seccion>
    </AdminScreen>
  )
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  itemTxt: { flex: 1, fontSize: 16 },
  accion: { padding: 6 },
  aviso: { fontSize: 14, marginTop: 8 },
  alta: { gap: 10, marginTop: 12 },
  acciones: { gap: 10 },
})
