import type { PrismaClient } from '@prisma/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  BUCKET_AVATARES,
  pathDesdeUrlAvatar,
  supabaseStorage,
  urlPublicaAvatar,
} from '../../config/supabase'
import { HttpError } from '../../lib/httpError'
import { FOTO_MAX_BYTES } from '../usuarios/usuarios.fotos'

/** Carpeta del grupo dentro del bucket `avatares`: no choca con las de usuarios (UUID). */
function carpetaDe(grupoId: string) {
  return `grupos/${grupoId}`
}

/**
 * Foto del grupo (Supabase Storage, mismo bucket que las fotos de perfil).
 * Cualquier integrante la puede cambiar o quitar; el backend valida la
 * membresía en cada paso (RN-030). Mismo flujo de tres pasos que la foto de
 * perfil: URL firmada → subida directa a Storage → confirmación.
 */
export class FotosGrupoService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: () => SupabaseClient | null = supabaseStorage
  ) {}

  private bucket() {
    const cliente = this.storage()
    if (!cliente) {
      throw new HttpError(503, 'Las fotos no están disponibles', 'FOTOS_NO_DISPONIBLES')
    }
    return cliente.storage.from(BUCKET_AVATARES)
  }

  /** Líder o participante del grupo; si no, 403. Devuelve la foto actual. */
  private async assertMiembro(usuarioId: string, grupoId: string) {
    const grupo = await this.prisma.grupo.findUnique({
      where: { id: grupoId },
      select: {
        lider_id: true,
        foto: true,
        miembros: { where: { usuario_id: usuarioId }, select: { usuario_id: true } },
      },
    })
    if (!grupo) {
      throw new HttpError(404, 'Grupo no encontrado', 'GRUPO_NOT_FOUND')
    }
    if (grupo.lider_id !== usuarioId && grupo.miembros.length === 0) {
      throw new HttpError(403, 'No tenés acceso a este grupo', 'NOT_GROUP_MEMBER')
    }
    return grupo
  }

  async crearSubida(usuarioId: string, grupoId: string) {
    await this.assertMiembro(usuarioId, grupoId)
    const path = `${carpetaDe(grupoId)}/${Date.now()}.jpg`
    const { data, error } = await this.bucket().createSignedUploadUrl(path)
    if (error || !data) {
      throw new HttpError(502, 'No se pudo preparar la subida de la foto', 'FOTO_SUBIDA_FALLIDA')
    }
    return { path, upload_url: data.signedUrl }
  }

  async confirmar(usuarioId: string, grupoId: string, path: string) {
    const partes = path.split('/')
    const archivo = partes[2]
    if (
      partes.length !== 3 ||
      `${partes[0]}/${partes[1]}` !== carpetaDe(grupoId) ||
      !archivo ||
      !/^\d{13}\.jpg$/.test(archivo)
    ) {
      throw new HttpError(400, 'La ruta de la foto no es válida', 'FOTO_PATH_INVALIDO')
    }
    await this.assertMiembro(usuarioId, grupoId)

    const bucket = this.bucket()
    const { data: archivos, error } = await bucket.list(carpetaDe(grupoId), { limit: 100 })
    if (error) {
      throw new HttpError(502, 'No se pudo verificar la foto', 'FOTO_SUBIDA_FALLIDA')
    }
    const subido = archivos?.find((a) => a.name === archivo)
    if (!subido) {
      throw new HttpError(400, 'La foto todavía no se subió', 'FOTO_NO_SUBIDA')
    }

    const tamanio = Number(subido.metadata?.size ?? 0)
    const tipo = String(subido.metadata?.mimetype ?? '')
    if (tipo !== 'image/jpeg' || tamanio <= 0 || tamanio > FOTO_MAX_BYTES) {
      await bucket.remove([path])
      throw new HttpError(400, 'La foto tiene que ser un JPEG de hasta 2 MB', 'FOTO_INVALIDA')
    }

    const url = urlPublicaAvatar(path)
    await this.prisma.grupo.update({ where: { id: grupoId }, data: { foto: url } })

    // Limpia la foto anterior y cualquier subida que nunca se confirmó.
    const sobrantes = (archivos ?? [])
      .filter((a) => a.name !== archivo)
      .map((a) => `${carpetaDe(grupoId)}/${a.name}`)
    if (sobrantes.length > 0) await bucket.remove(sobrantes)

    return { foto: url }
  }

  async eliminar(usuarioId: string, grupoId: string) {
    const grupo = await this.assertMiembro(usuarioId, grupoId)
    await this.prisma.grupo.update({ where: { id: grupoId }, data: { foto: null } })

    const path = grupo.foto ? pathDesdeUrlAvatar(grupo.foto) : null
    // Si Storage no está configurado, alcanza con desvincularla: el archivo queda huérfano.
    const cliente = this.storage()
    if (path && cliente) await cliente.storage.from(BUCKET_AVATARES).remove([path])

    return { foto: null }
  }

  /** Al eliminarse el grupo: borra su carpeta. Nunca falla, para no trabar el borrado. */
  async borrarCarpeta(grupoId: string): Promise<void> {
    const cliente = this.storage()
    if (!cliente) return
    try {
      const bucket = cliente.storage.from(BUCKET_AVATARES)
      const { data } = await bucket.list(carpetaDe(grupoId), { limit: 100 })
      if (data && data.length > 0) {
        await bucket.remove(data.map((a) => `${carpetaDe(grupoId)}/${a.name}`))
      }
    } catch {
      // Queda un archivo huérfano en Storage: no afecta a nadie y no vale cortar el borrado.
    }
  }
}
