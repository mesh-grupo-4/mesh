import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'

import {
  AdminScreen,
  Fila,
  Seccion,
  fechaAdmin,
  mensajeError,
  nombreCompleto,
} from '@/components/admin/AdminUI'
import { Btn } from '@/components/MeshUI'
import {
  eliminarGrupoAdmin,
  obtenerGrupoAdmin,
  quitarMiembroAdmin,
  reasignarLiderAdmin,
  type GrupoAdminDetalle,
} from '@/lib/adminApi'
import { meshAlert, meshConfirmDestructive, meshSuccess } from '@/lib/meshAlert'

export default function AdminGrupoScreen() {
  const { grupoId } = useLocalSearchParams<{ grupoId: string }>()
  const router = useRouter()
  const [grupo, setGrupo] = useState<GrupoAdminDetalle | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    try {
      setGrupo(await obtenerGrupoAdmin(grupoId))
    } catch (e) {
      meshAlert('No se pudo cargar el grupo', mensajeError(e))
    }
  }, [grupoId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const ejecutar = useCallback(
    async (accion: () => Promise<unknown>) => {
      setOcupado(true)
      try {
        await accion()
      } catch (e) {
        meshAlert('No se pudo completar la acción', mensajeError(e))
      } finally {
        setOcupado(false)
      }
    },
    []
  )

  if (!grupo) return <AdminScreen title="Grupo" cargando>{null}</AdminScreen>

  const hacerLider = (usuarioId: string, nombre: string) =>
    meshConfirmDestructive({
      title: 'Reasignar líder',
      message: `${nombre} pasa a ser líder y el líder actual queda como participante.`,
      confirmLabel: 'Reasignar',
      onConfirm: () =>
        ejecutar(async () => {
          await reasignarLiderAdmin(grupo.id, usuarioId)
          await cargar()
        }),
    })

  const quitar = (usuarioId: string, nombre: string, esLider: boolean) =>
    meshConfirmDestructive({
      title: 'Quitar del grupo',
      message: esLider
        ? `${nombre} es líder: el rol pasa al integrante más antiguo. Si no queda nadie, el grupo se elimina.`
        : `${nombre} deja de pertenecer al grupo.`,
      confirmLabel: 'Quitar',
      onConfirm: () =>
        ejecutar(async () => {
          const r = await quitarMiembroAdmin(grupo.id, usuarioId)
          if (r.accion === 'grupo_eliminado') {
            meshSuccess('Grupo eliminado', 'No quedaba nadie más en el grupo.', () => router.back())
          } else {
            await cargar()
          }
        }),
    })

  const eliminar = () =>
    meshConfirmDestructive({
      title: 'Eliminar grupo',
      message: `Se borra "${grupo.nombre}" con sus integrantes e invitaciones. Los viajes no se borran.`,
      confirmLabel: 'Eliminar',
      onConfirm: () =>
        ejecutar(async () => {
          await eliminarGrupoAdmin(grupo.id)
          meshSuccess('Grupo eliminado', undefined, () => router.back())
        }),
    })

  return (
    <AdminScreen
      title={grupo.nombre}
      sub={`Creado el ${fechaAdmin(grupo.fecha_creacion)} · ${grupo.cantidad_viajes} viajes`}
      onRefresh={() => void cargar()}
    >
      <Seccion titulo={`Integrantes (${grupo.miembros.length})`}>
        {grupo.miembros.map((m) => {
          const nombre = nombreCompleto(m)
          const esLider = m.rol === 'lider'
          return (
            <Fila
              key={m.id}
              titulo={nombre}
              detalle={m.email}
              etiqueta={esLider ? 'Líder' : undefined}
              tonoEtiqueta="accent"
              acciones={
                <>
                  {!esLider ? (
                    <Btn size="sm" variant="outline" disabled={ocupado} onPress={() => hacerLider(m.id, nombre)}>
                      Hacer líder
                    </Btn>
                  ) : null}
                  <Btn
                    size="sm"
                    variant="danger-outline"
                    disabled={ocupado}
                    onPress={() => quitar(m.id, nombre, esLider)}
                  >
                    Quitar
                  </Btn>
                  <Btn
                    size="sm"
                    variant="ghost"
                    onPress={() =>
                      router.push({ pathname: '/admin/usuario/[usuarioId]', params: { usuarioId: m.id } })
                    }
                  >
                    Ver cuenta
                  </Btn>
                </>
              }
            />
          )
        })}
      </Seccion>
      <Btn variant="danger" block icon="trash-2" disabled={ocupado} onPress={eliminar}>
        Eliminar grupo
      </Btn>
    </AdminScreen>
  )
}
