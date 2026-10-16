import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import {
  AdminScreen,
  Fila,
  Seccion,
  fechaAdmin,
  mensajeError,
  nombreCompleto,
} from '@/components/admin/AdminUI'
import { Btn, Field, useTheme } from '@/components/MeshUI'
import { useAuth } from '@/context/AuthContext'
import {
  cambiarRolSistemaAdmin,
  eliminarUsuarioAdmin,
  obtenerUsuarioAdmin,
  reactivarUsuarioAdmin,
  suspenderUsuarioAdmin,
  type UsuarioAdminDetalle,
} from '@/lib/adminApi'
import { meshAlert, meshConfirmDestructive, meshSuccess } from '@/lib/meshAlert'

export default function AdminUsuarioScreen() {
  const { usuarioId } = useLocalSearchParams<{ usuarioId: string }>()
  const router = useRouter()
  const theme = useTheme()
  const { backendUserId } = useAuth()
  const [usuario, setUsuario] = useState<UsuarioAdminDetalle | null>(null)
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(async () => {
    try {
      setUsuario(await obtenerUsuarioAdmin(usuarioId))
    } catch (e) {
      meshAlert('No se pudo cargar el usuario', mensajeError(e))
    }
  }, [usuarioId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const ejecutar = useCallback(
    async (accion: () => Promise<unknown>, exito?: string) => {
      setOcupado(true)
      try {
        await accion()
        if (exito) meshSuccess(exito)
        await cargar()
      } catch (e) {
        meshAlert('No se pudo completar la acción', mensajeError(e))
      } finally {
        setOcupado(false)
      }
    },
    [cargar]
  )

  if (!usuario) return <AdminScreen title="Usuario" cargando>{null}</AdminScreen>

  const esYo = usuario.id === backendUserId
  const suspendida = !!usuario.suspendido_at
  const esSuperadmin = usuario.rol_sistema === 'superadmin'

  const suspender = () =>
    meshConfirmDestructive({
      title: 'Suspender cuenta',
      message: `${usuario.email} no va a poder usar Mesh hasta que la reactives. Sus datos se conservan.`,
      confirmLabel: 'Suspender',
      onConfirm: () =>
        ejecutar(async () => {
          await suspenderUsuarioAdmin(usuario.id, motivo.trim())
          setMotivo('')
        }, 'Cuenta suspendida'),
    })

  const cambiarRol = () =>
    meshConfirmDestructive({
      title: esSuperadmin ? 'Quitar rol superadmin' : 'Otorgar rol superadmin',
      message: esSuperadmin
        ? `${usuario.email} pierde el acceso al backoffice.`
        : `${usuario.email} va a poder gestionar todas las cuentas, grupos y viajes de Mesh.`,
      confirmLabel: esSuperadmin ? 'Quitar' : 'Otorgar',
      onConfirm: () =>
        ejecutar(() => cambiarRolSistemaAdmin(usuario.id, esSuperadmin ? 'usuario' : 'superadmin')),
    })

  const eliminar = () =>
    meshConfirmDestructive({
      title: 'Eliminar cuenta',
      message:
        'Es definitivo. Los grupos y viajes que lidera pasan al integrante más antiguo; los que no tengan a nadie más se eliminan. Su historial de GPS y métricas se borra.',
      confirmLabel: 'Eliminar definitivamente',
      onConfirm: async () => {
        setOcupado(true)
        try {
          const r = await eliminarUsuarioAdmin(usuario.id)
          meshSuccess(
            'Cuenta eliminada',
            `Grupos transferidos: ${r.grupos_transferidos} · eliminados: ${r.grupos_eliminados}\n` +
              `Viajes transferidos: ${r.viajes_transferidos} · eliminados: ${r.viajes_eliminados}`,
            () => router.back()
          )
        } catch (e) {
          meshAlert('No se pudo eliminar la cuenta', mensajeError(e))
        } finally {
          setOcupado(false)
        }
      },
    })

  return (
    <AdminScreen title={nombreCompleto(usuario)} sub={usuario.email} onRefresh={() => void cargar()}>
      <Seccion titulo="Cuenta">
        <Fila titulo="Rol de plataforma" etiqueta={esSuperadmin ? 'Superadmin' : 'Usuario'} tonoEtiqueta="accent" />
        <Fila
          titulo="Estado"
          detalle={suspendida ? `Desde ${fechaAdmin(usuario.suspendido_at)} · ${usuario.motivo_suspension ?? ''}` : undefined}
          etiqueta={suspendida ? 'Suspendida' : 'Activa'}
          tonoEtiqueta={suspendida ? 'danger' : 'good'}
        />
        <Fila titulo="Alta" detalle={fechaAdmin(usuario.created_at)} />
        <Fila titulo="Teléfono" detalle={usuario.telefono ?? 'Sin cargar'} />
        <Fila
          titulo="Actividad"
          detalle={`${usuario.totales.viajes_creados} viajes creados · ${usuario.totales.participaciones_viaje} participaciones · lidera ${usuario.totales.grupos_liderados} grupos`}
        />
      </Seccion>

      <Seccion titulo="Grupos">
        {usuario.grupos.length === 0 ? (
          <Text style={{ color: theme.textMute }}>No pertenece a ningún grupo.</Text>
        ) : (
          usuario.grupos.map((g) => (
            <Fila
              key={g.id}
              titulo={g.nombre}
              etiqueta={g.rol === 'lider' ? 'Líder' : 'Participante'}
              onPress={() => router.push({ pathname: '/admin/grupo/[grupoId]', params: { grupoId: g.id } })}
            />
          ))
        )}
      </Seccion>

      {esYo ? (
        <Text style={[styles.aviso, { color: theme.textDim }]}>
          Es tu propia cuenta: no podés suspenderla, eliminarla ni cambiar su rol.
        </Text>
      ) : (
        <Seccion titulo="Acciones">
          <View style={styles.acciones}>
            {suspendida ? (
              <Btn
                variant="outline"
                block
                icon="unlock"
                disabled={ocupado}
                onPress={() => void ejecutar(() => reactivarUsuarioAdmin(usuario.id), 'Cuenta reactivada')}
              >
                Reactivar cuenta
              </Btn>
            ) : (
              <>
                <Field
                  label="Motivo de la suspensión"
                  placeholder="Queda registrado en la auditoría"
                  value={motivo}
                  onChangeText={setMotivo}
                  maxLength={500}
                />
                <Btn
                  variant="danger-outline"
                  block
                  icon="slash"
                  disabled={ocupado || motivo.trim().length < 3}
                  onPress={suspender}
                >
                  Suspender cuenta
                </Btn>
              </>
            )}
            <Btn variant="outline" block icon="shield" disabled={ocupado} onPress={cambiarRol}>
              {esSuperadmin ? 'Quitar rol superadmin' : 'Otorgar rol superadmin'}
            </Btn>
            <Btn variant="danger" block icon="trash-2" disabled={ocupado} onPress={eliminar}>
              Eliminar cuenta
            </Btn>
          </View>
        </Seccion>
      )}
    </AdminScreen>
  )
}

const styles = StyleSheet.create({
  acciones: { gap: 10, marginTop: 4 },
  aviso: { fontSize: 14, textAlign: 'center' },
})
