import type { PrismaClient } from '@prisma/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  BUCKET_AVATARES,
  pathDesdeUrlAvatar,
  supabaseStorage,
  urlPublicaAvatar,
} from '../../config/supabase'
import { HttpError } from '../../lib/httpError'

/** Tope del archivo ya comprimido. La app manda ~60 KB (512×512 JPEG); el bucket aplica el mismo límite. */
export const FOTO_MAX_BYTES = 2 * 1024 * 1024

/**
 * Fotos de perfil (Supabase Storage). El flujo de subida tiene tres pasos para
 * que el backend decida todo (RN-030) sin que los bytes pasen por el VPS:
 *
 * 1. `crearSubida`: el backend elige la ruta (`{usuarioId}/{timestamp}.jpg`) y
 *    devuelve una URL firmada que solo sirve para esa ruta.
 * 2. La app sube el JPEG directo a Storage con esa URL.
 * 3. `confirmar`: el backend verifica que el archivo exista en la carpeta del
 *    usuario, con tipo y tamaño válidos, y recién ahí lo guarda en `foto_perfil`.
 */
export class FotosPerfilService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly storage: () => SupabaseClient | null = supabaseStorage
  ) {}

  private bucket() {
    const cliente = this.storage()
    if (!cliente) {
      throw new HttpError(503, 'Las fotos de perfil no están disponibles', 'FOTOS_NO_DISPONIBLES')
    }
    return cliente.storage.from(BUCKET_AVATARES)
  }

  async crearSubida(usuarioId: string) {
    const path = `${usuarioId}/${Date.now()}.jpg`
    const { data, error } = await this.bucket().createSignedUploadUrl(path)
    if (error || !data) {
      throw new HttpError(502, 'No se pudo preparar la subida de la foto', 'FOTO_SUBIDA_FALLIDA')
    }
    return { path, upload_url: data.signedUrl }
  }

  async confirmar(usuarioId: string, path: string) {
    const [carpeta, archivo] = path.split('/')
    if (carpeta !== usuarioId || !archivo || !/^\d{13}\.jpg$/.test(archivo) || path.split('/').length !== 2) {
      throw new HttpError(400, 'La ruta de la foto no es válida', 'FOTO_PATH_INVALIDO')
    }

    const bucket = this.bucket()
    const { data: archivos, error } = await bucket.list(usuarioId, { limit: 100 })
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
    await this.prisma.usuario.update({ where: { id: usuarioId }, data: { foto_perfil: url } })

    // Limpia la foto anterior y cualquier subida que nunca se confirmó.
    const sobrantes = (archivos ?? [])
      .filter((a) => a.name !== archivo)
      .map((a) => `${usuarioId}/${a.name}`)
    if (sobrantes.length > 0) await bucket.remove(sobrantes)

    return { foto_perfil: url }
  }

  async eliminar(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { foto_perfil: true },
    })
    if (!usuario) {
      throw new HttpError(404, 'Usuario no encontrado', 'USER_NOT_FOUND')
    }

    await this.prisma.usuario.update({ where: { id: usuarioId }, data: { foto_perfil: null } })

    const path = usuario.foto_perfil ? pathDesdeUrlAvatar(usuario.foto_perfil) : null
    // Si Storage no está configurado, alcanza con desvincularla: el archivo queda huérfano.
    const cliente = this.storage()
    if (path && cliente) await cliente.storage.from(BUCKET_AVATARES).remove([path])

    return { foto_perfil: null }
  }

  /** Al eliminar la cuenta: borra toda su carpeta. Nunca falla, para no trabar el borrado. */
  async borrarCarpeta(usuarioId: string): Promise<void> {
    const cliente = this.storage()
    if (!cliente) return
    try {
      const bucket = cliente.storage.from(BUCKET_AVATARES)
      const { data } = await bucket.list(usuarioId, { limit: 100 })
      if (data && data.length > 0) await bucket.remove(data.map((a) => `${usuarioId}/${a.name}`))
    } catch {
      // Queda un archivo huérfano en Storage: no afecta a nadie y no vale cortar el borrado.
    }
  }

  /** Fotos de varios usuarios a la vez. Solo vuelven los que tienen foto. */
  async fotosDe(ids: string[]): Promise<Record<string, string>> {
    const usuarios = await this.prisma.usuario.findMany({
      where: { id: { in: ids }, foto_perfil: { not: null } },
      select: { id: true, foto_perfil: true },
    })
    return Object.fromEntries(usuarios.map((u) => [u.id, u.foto_perfil!]))
  }
}
