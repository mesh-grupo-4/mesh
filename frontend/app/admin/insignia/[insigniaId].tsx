import { Feather } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, Switch, Text, View } from 'react-native'

import { AdminScreen, ETIQUETA_ACTIVIDAD, Fila, Seccion, fechaAdmin, mensajeError } from '@/components/admin/AdminUI'
import {
  ICONOS_INSIGNIA,
  codigoDesdeNombre,
  describirCriterios,
  formatearDecimal,
  leerDecimal,
} from '@/components/admin/insignias'
import { Btn, Chip, ChipRow, Field, useTheme } from '@/components/MeshUI'
import { ETIQUETA_RAREZA, InsigniaChip, coloresRareza } from '@/components/perfil/InsigniaChip'
import { Pressable } from '@/components/Pressable'
import {
  actualizarInsigniaAdmin,
  crearInsigniaAdmin,
  eliminarInsigniaAdmin,
  listarInsigniasAdmin,
  type DatosInsigniaAdmin,
  type InsigniaAdmin,
} from '@/lib/adminApi'
import type { RarezaInsigniaApi } from '@/lib/insigniasApi'
import { meshAlert, meshConfirmDestructive, meshSuccess } from '@/lib/meshAlert'
import type { TipoActividadApi } from '@/lib/viajesApi'

// Mismos límites que valida el backend (RN-133).
const MAX_NOMBRE = 60
const MAX_DESCRIPCION = 200
const MAX_KM = 1000
const MAX_MIN = 7 * 24 * 60
const CODIGO_VALIDO = /^[a-z0-9]+(_[a-z0-9]+)*$/

const RAREZAS: RarezaInsigniaApi[] = ['comun', 'rara', 'epica', 'legendaria']
const ACTIVIDADES: TipoActividadApi[] = ['moto', 'auto', 'bici', 'running', 'trekking', 'otro']

type Formulario = {
  codigo: string
  nombre: string
  descripcion: string
  icono: string
  rareza: RarezaInsigniaApi
  distanciaKm: string
  duracionMin: string
  actividad: TipoActividadApi | null
  activa: boolean
}

const VACIO: Formulario = {
  codigo: '',
  nombre: '',
  descripcion: '',
  icono: 'award',
  rareza: 'comun',
  distanciaKm: '',
  duracionMin: '',
  actividad: null,
  activa: true,
}

function aFormulario(i: InsigniaAdmin): Formulario {
  return {
    codigo: i.codigo,
    nombre: i.nombre,
    descripcion: i.descripcion ?? '',
    icono: i.icono,
    rareza: i.rareza,
    distanciaKm: i.criterio_distancia_m == null ? '' : formatearDecimal(i.criterio_distancia_m / 1000),
    duracionMin: i.criterio_duracion_seg == null ? '' : formatearDecimal(i.criterio_duracion_seg / 60),
    actividad: i.criterio_actividad,
    activa: i.activa,
  }
}

/** Valida como el backend y devuelve los datos listos para mandar, o los errores por campo. */
function validar(f: Formulario, esAlta: boolean) {
  const errores: Partial<Record<keyof Formulario, string>> = {}
  const km = leerDecimal(f.distanciaKm)
  const min = leerDecimal(f.duracionMin)

  if (esAlta && f.codigo.length < 3) errores.codigo = 'Al menos 3 caracteres'
  else if (esAlta && !CODIGO_VALIDO.test(f.codigo)) {
    errores.codigo = 'Solo minúsculas, números y guiones bajos'
  }
  if (!f.nombre.trim()) errores.nombre = 'El nombre es obligatorio'
  if (km !== null && (Number.isNaN(km) || km <= 0 || km > MAX_KM)) {
    errores.distanciaKm = `Entre 0 y ${MAX_KM} km`
  }
  // Se guarda en segundos enteros: menos de medio segundo redondearía a 0.
  if (min !== null && (Number.isNaN(min) || Math.round(min * 60) < 1 || min > MAX_MIN)) {
    errores.duracionMin = 'Entre 1 minuto y 7 días'
  }

  const datos: DatosInsigniaAdmin = {
    nombre: f.nombre.trim(),
    descripcion: f.descripcion.trim() || null,
    icono: f.icono,
    rareza: f.rareza,
    criterio_distancia_m: km === null || Number.isNaN(km) ? null : Math.round(km * 1000 * 1000) / 1000,
    criterio_duracion_seg: min === null || Number.isNaN(min) ? null : Math.round(min * 60),
    criterio_actividad: f.actividad,
    activa: f.activa,
  }
  return { errores, datos }
}

/** Solo lo que cambió: así la auditoría registra los campos que se tocaron de verdad. */
function cambios(original: InsigniaAdmin, datos: DatosInsigniaAdmin): Partial<DatosInsigniaAdmin> {
  const resultado: Partial<DatosInsigniaAdmin> = {}
  for (const clave of Object.keys(datos) as (keyof DatosInsigniaAdmin)[]) {
    if (datos[clave] !== original[clave]) Object.assign(resultado, { [clave]: datos[clave] })
  }
  return resultado
}

/** RN-133: alta (`nueva`) y edición de una insignia del catálogo. */
export default function AdminInsigniaScreen() {
  const { insigniaId } = useLocalSearchParams<{ insigniaId: string }>()
  const esAlta = insigniaId === 'nueva'
  const router = useRouter()
  const theme = useTheme()
  const [original, setOriginal] = useState<InsigniaAdmin | null>(null)
  const [form, setForm] = useState<Formulario | null>(esAlta ? VACIO : null)
  // Mientras no lo toquen, el código se sugiere a partir del nombre.
  const [codigoManual, setCodigoManual] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    if (esAlta) return
    try {
      const encontrada = (await listarInsigniasAdmin()).items.find((i) => i.id === insigniaId)
      if (!encontrada) {
        meshAlert('Insignia no encontrada', 'Puede que otro superadmin la haya eliminado.', [
          { text: 'Volver', onPress: () => router.back() },
        ])
        return
      }
      setOriginal(encontrada)
      setForm(aFormulario(encontrada))
    } catch (e) {
      meshAlert('No se pudo cargar la insignia', mensajeError(e))
    }
  }, [esAlta, insigniaId, router])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const validacion = useMemo(() => (form ? validar(form, esAlta) : null), [form, esAlta])

  if (!form || !validacion) {
    return <AdminScreen title="Insignia" cargando>{null}</AdminScreen>
  }

  const { errores, datos } = validacion
  const hayErrores = Object.keys(errores).length > 0
  const pendientes = original ? cambios(original, datos) : datos
  const sinCambios = !esAlta && Object.keys(pendientes).length === 0
  const otorgadas = original?.cantidad_otorgadas ?? 0

  const editar = (parcial: Partial<Formulario>) => setForm((f) => ({ ...f!, ...parcial }))

  const guardar = async () => {
    setOcupado(true)
    try {
      if (esAlta) {
        await crearInsigniaAdmin({ ...datos, codigo: form.codigo })
        meshSuccess('Insignia creada', 'Se va a otorgar desde el próximo viaje que se finalice.', () =>
          router.back()
        )
      } else {
        const guardada = await actualizarInsigniaAdmin(original!.id, pendientes)
        setOriginal(guardada)
        setForm(aFormulario(guardada))
        meshSuccess('Cambios guardados', 'Los criterios nuevos rigen para los próximos viajes finalizados.')
      }
    } catch (e) {
      meshAlert('No se pudo guardar', mensajeError(e))
    } finally {
      setOcupado(false)
    }
  }

  const eliminar = () =>
    meshConfirmDestructive({
      title: 'Eliminar insignia',
      message: `"${original!.nombre}" se borra del catálogo. Es definitivo.`,
      confirmLabel: 'Eliminar',
      onConfirm: async () => {
        setOcupado(true)
        try {
          await eliminarInsigniaAdmin(original!.id)
          meshSuccess('Insignia eliminada', undefined, () => router.back())
        } catch (e) {
          meshAlert('No se pudo eliminar', mensajeError(e))
        } finally {
          setOcupado(false)
        }
      },
    })

  const vistaPrevia = {
    id: 'vista-previa',
    insignia_id: 'vista-previa',
    codigo: form.codigo,
    nombre: form.nombre.trim() || 'Nombre',
    descripcion: datos.descripcion,
    icono: form.icono,
    rareza: form.rareza,
    viaje_id: null,
    obtenida_at: new Date().toISOString(),
  }

  return (
    <AdminScreen
      title={esAlta ? 'Nueva insignia' : original!.nombre}
      sub={esAlta ? 'Catálogo de insignias' : original!.codigo}
    >
      <View style={styles.vistaPrevia}>
        <InsigniaChip insignia={vistaPrevia} />
        <Text style={[styles.ayuda, { color: theme.textDim }]}>{describirCriterios(datos)}</Text>
      </View>

      <Seccion titulo="Datos" descripcion="Lo que ve la persona en su perfil.">
        <View style={styles.campos}>
          <Field
            label="Nombre"
            placeholder="Ej.: Maratón"
            value={form.nombre}
            maxLength={MAX_NOMBRE}
            onChangeText={(nombre) =>
              editar(esAlta && !codigoManual ? { nombre, codigo: codigoDesdeNombre(nombre) } : { nombre })
            }
            error={errores.nombre}
          />
          {esAlta ? (
            <Field
              label="Código"
              placeholder="maraton"
              value={form.codigo}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={40}
              onChangeText={(codigo) => {
                setCodigoManual(true)
                editar({ codigo: codigo.toLowerCase() })
              }}
              error={form.codigo ? errores.codigo : undefined}
            />
          ) : null}
          {esAlta ? (
            <Text style={[styles.ayuda, { color: theme.textDim }]}>
              Identificador interno. No se puede cambiar después de crearla.
            </Text>
          ) : null}
          <Field
            label="Descripción (opcional)"
            placeholder="Ej.: Corriste 42 km o más en un mismo viaje."
            value={form.descripcion}
            maxLength={MAX_DESCRIPCION}
            multiline
            onChangeText={(descripcion) => editar({ descripcion })}
          />
        </View>
      </Seccion>

      <Seccion titulo="Ícono">
        <View style={styles.iconos}>
          {(ICONOS_INSIGNIA as readonly string[]).concat(
            ICONOS_INSIGNIA.includes(form.icono as never) ? [] : [form.icono]
          ).map((nombre) => {
            const elegido = nombre === form.icono
            return (
              <Pressable
                key={nombre}
                onPress={() => editar({ icono: nombre })}
                accessibilityRole="button"
                accessibilityLabel={`Ícono ${nombre}`}
                accessibilityState={{ selected: elegido }}
                style={[
                  styles.icono,
                  {
                    borderColor: elegido ? theme.accent : theme.border,
                    backgroundColor: elegido ? theme.accentWeak : theme.surface,
                  },
                ]}
              >
                <Feather
                  name={nombre as keyof typeof Feather.glyphMap}
                  size={22}
                  color={elegido ? theme.accent : theme.textDim}
                />
              </Pressable>
            )
          })}
        </View>
      </Seccion>

      <Seccion titulo="Rareza" descripcion="Solo cambia cómo se ve. No afecta cuándo se otorga.">
        <ChipRow>
          {RAREZAS.map((r) => (
            <Chip key={r} active={form.rareza === r} onPress={() => editar({ rareza: r })}>
              {ETIQUETA_RAREZA[r]}
            </Chip>
          ))}
        </ChipRow>
        <View style={[styles.muestraRareza, { backgroundColor: coloresRareza(theme, form.rareza).fondo }]} />
      </Seccion>

      <Seccion
        titulo="Criterios"
        descripcion="Se evalúan contra un solo viaje al finalizarlo y tienen que cumplirse todos los que completes. Nunca por velocidad."
      >
        <Text style={[styles.subtitulo, { color: theme.textDim }]}>Actividad</Text>
        <ChipRow>
          <Chip active={form.actividad === null} onPress={() => editar({ actividad: null })}>
            Cualquiera
          </Chip>
          {ACTIVIDADES.map((a) => (
            <Chip key={a} active={form.actividad === a} onPress={() => editar({ actividad: a })}>
              {ETIQUETA_ACTIVIDAD[a]}
            </Chip>
          ))}
        </ChipRow>
        <View style={styles.campos}>
          <Field
            label="Distancia mínima (km)"
            placeholder="Sin mínimo"
            keyboardType="decimal-pad"
            value={form.distanciaKm}
            onChangeText={(distanciaKm) => editar({ distanciaKm })}
            error={errores.distanciaKm}
          />
          <Field
            label="Tiempo mínimo en movimiento (minutos)"
            placeholder="Sin mínimo"
            keyboardType="decimal-pad"
            value={form.duracionMin}
            onChangeText={(duracionMin) => editar({ duracionMin })}
            error={errores.duracionMin}
          />
        </View>
        {datos.criterio_distancia_m === null &&
        datos.criterio_duracion_seg === null &&
        datos.criterio_actividad === null ? (
          <Text style={[styles.ayuda, { color: theme.gold }]}>
            Sin criterios, se otorga a cualquiera que finalice un viaje.
          </Text>
        ) : null}
      </Seccion>

      <Seccion>
        <View style={styles.activa}>
          <View style={styles.activaTexto}>
            <Text style={[styles.subtituloFuerte, { color: theme.text }]}>Activa</Text>
            <Text style={[styles.ayuda, { color: theme.textDim }]}>
              Inactiva no se otorga más ni aparece en el catálogo, pero quien ya la tiene la conserva.
            </Text>
          </View>
          <Switch
            value={form.activa}
            onValueChange={(activa) => editar({ activa })}
            trackColor={{ true: theme.accent }}
            accessibilityLabel="Insignia activa"
          />
        </View>
      </Seccion>

      {original ? (
        <Seccion>
          <Fila
            titulo={
              otorgadas === 0
                ? 'Nadie la obtuvo todavía'
                : otorgadas === 1
                  ? '1 persona la obtuvo'
                  : `${otorgadas} personas la obtuvieron`
            }
            detalle={`Creada el ${fechaAdmin(original.created_at)}`}
          />
        </Seccion>
      ) : null}

      <Seccion descripcion="Crear, editar y eliminar quedan registrados en la auditoría.">
        <View style={styles.acciones}>
          <Btn
            block
            icon="check"
            loading={ocupado}
            disabled={hayErrores || sinCambios || ocupado}
            onPress={() => void guardar()}
          >
            {esAlta ? 'Crear insignia' : 'Guardar cambios'}
          </Btn>
          {!esAlta && !sinCambios ? (
            <Btn variant="ghost" block disabled={ocupado} onPress={() => setForm(aFormulario(original!))}>
              Descartar cambios
            </Btn>
          ) : null}
          {original ? (
            otorgadas === 0 ? (
              <Btn variant="danger-outline" block icon="trash-2" disabled={ocupado} onPress={eliminar}>
                Eliminar insignia
              </Btn>
            ) : (
              <Text style={[styles.ayuda, { color: theme.textDim }]}>
                No se puede eliminar porque ya se otorgó: borrarla le quitaría el logro a esas personas.
                Para retirarla, desactivala.
              </Text>
            )
          ) : null}
        </View>
      </Seccion>
    </AdminScreen>
  )
}

const styles = StyleSheet.create({
  vistaPrevia: { alignItems: 'center', gap: 8, paddingVertical: 4 },
  campos: { gap: 10, marginTop: 8 },
  ayuda: { fontSize: 14, lineHeight: 19 },
  subtitulo: { fontSize: 14, fontWeight: '600', marginTop: 8, marginBottom: 6 },
  subtituloFuerte: { fontSize: 16, fontWeight: '700' },
  iconos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  icono: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muestraRareza: { height: 4, borderRadius: 2, marginTop: 10 },
  activa: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activaTexto: { flex: 1, gap: 4 },
  acciones: { gap: 10 },
})
