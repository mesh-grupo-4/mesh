import { useCallback } from 'react'
import { Text } from 'react-native'

import {
  AdminScreen,
  Fila,
  Paginador,
  Seccion,
  Vacio,
  fechaAdmin,
  nombreCompleto,
  useListadoAdmin,
} from '@/components/admin/AdminUI'
import { useTheme } from '@/components/MeshUI'
import { listarAuditoriaAdmin, type EntradaAuditoria } from '@/lib/adminApi'

const DESCRIPCION_ACCION: Record<string, string> = {
  'usuario.editar': 'Editó un perfil',
  'usuario.cambiar_rol': 'Cambió un rol de plataforma',
  'usuario.suspender': 'Suspendió una cuenta',
  'usuario.reactivar': 'Reactivó una cuenta',
  'usuario.eliminar': 'Eliminó una cuenta',
  'grupo.reasignar_lider': 'Reasignó el líder de un grupo',
  'grupo.quitar_miembro': 'Quitó a alguien de un grupo',
  'grupo.eliminar': 'Eliminó un grupo',
  'viaje.finalizar': 'Forzó la finalización de un viaje',
  'viaje.eliminar': 'Eliminó un viaje',
}

/** Lo más legible del `detalle`: a quién o a qué afectó la acción. */
function objetivo(e: EntradaAuditoria): string {
  const d = e.detalle ?? {}
  const valor = d.email ?? d.nombre
  return typeof valor === 'string' && valor ? valor : e.entidad_id.slice(0, 8)
}

/** RN-121: bitácora de cada acción del backoffice. */
export default function AdminAuditoriaScreen() {
  const theme = useTheme()
  const cargar = useCallback((pagina: number) => listarAuditoriaAdmin({ pagina }), [])
  const { datos, error, setPagina, recargar } = useListadoAdmin(cargar, '')

  return (
    <AdminScreen
      title="Auditoría"
      sub={datos ? `${datos.total} acciones registradas` : undefined}
      onRefresh={() => void recargar()}
    >
      {error ? <Text style={{ color: theme.danger }}>{error}</Text> : null}
      <Seccion>
        {datos?.items.length === 0 ? <Vacio texto="Todavía no hay acciones registradas." /> : null}
        {datos?.items.map((e) => (
          <Fila
            key={e.id}
            titulo={`${DESCRIPCION_ACCION[e.accion] ?? e.accion}: ${objetivo(e)}`}
            detalle={`${e.actor ? nombreCompleto(e.actor) : 'Consola (CLI)'} · ${fechaAdmin(e.created_at)}${
              typeof e.detalle?.motivo === 'string' ? ` · ${e.detalle.motivo}` : ''
            }`}
          />
        ))}
      </Seccion>
      <Paginador datos={datos} onCambiar={setPagina} />
    </AdminScreen>
  )
}
