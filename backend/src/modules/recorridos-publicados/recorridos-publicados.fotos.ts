import type { SupabaseClient } from '@supabase/supabase-js'
import { BUCKET_AVATARES, supabaseStorage, urlPublicaAvatar } from '../../config/supabase'
import { HttpError } from '../../lib/httpError'
import { FOTO_MAX_BYTES } from '../usuarios/usuarios.fotos'

/** Carpeta del recorrido dentro del bucket `avatares`: no choca con las de usuarios ni grupos. */
export function carpetaFotoRecorrido(usuarioId: string, viajeId: string) {
  return `recorridos/${usuarioId}/${viajeId}`
}

/**
 * RN-081: foto opcional de un recorrido publicado (Supabase Storage, mismo bucket que
 * las fotos de perfil). Mismo flujo de tres pasos que la foto de perfil, pero el paso 3
 * es el propio publicar:
 *
 * 1. `crearSubida`: el backend elige la ruta y devuelve una URL firmada solo para ella.
 * 2. La app sube el JPEG directo a Storage.
 * 3. `POST /viajes/:id/recorrido/publicar` con `fotoPath`: `verificar` comprueba que el
 *    archivo exista en la carpeta de quien publica, con tipo y tamaño válidos.
 *
 * Quién puede subir (participó del viaje, finalizado) lo decide el servicio de
 * recorridos antes de llamar acá (RN-030).
 */
export class FotosRecorridoService {
  constructor(private readonly storage: () => SupabaseClient | null = supabaseStorage) {}

  private bucket() {
    const cliente = this.storage()
    if (!cliente) {
      throw new HttpError(503, 'Las fotos no están disponibles', 'FOTOS_NO_DISPONIBLES')
    }
    return cliente.storage.from(BUCKET_AVATARES)
  }

  async crearSubida(usuarioId: string, viajeId: string) {
    const path = `${carpetaFotoRecorrido(usuarioId, viajeId)}/${Date.now()}.jpg`
    const { data, error } = await this.bucket().createSignedUploadUrl(path)
    if (error || !data) {
      throw new HttpError(502, 'No se pudo preparar la subida de la foto', 'FOTO_SUBIDA_FALLIDA')
    }
    return { path, upload_url: data.signedUrl }
  }

  /** Comprueba la foto subida y devuelve su URL pública. Si no es válida la borra y responde 400. */
  async verificar(usuarioId: string, viajeId: string, path: string): Promise<string> {
    const carpeta = carpetaFotoRecorrido(usuarioId, viajeId)
    const archivo = path.startsWith(`${carpeta}/`) ? path.slice(carpeta.length + 1) : ''
    if (!/^\d{13}\.jpg$/.test(archivo)) {
      throw new HttpError(400, 'La ruta de la foto no es válida', 'FOTO_PATH_INVALIDO')
    }

    const bucket = this.bucket()
    const { data: archivos, error } = await bucket.list(carpeta, { limit: 100 })
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
    return urlPublicaAvatar(path)
  }

  /**
   * Después de publicar: borra todo lo de la carpeta menos la foto vigente (la anterior al
   * republicar y cualquier subida que nunca se publicó). `conservar` null = publicó sin
   * foto, se borra todo. Nunca falla: un archivo huérfano no justifica cortar la publicación.
   */
  async borrarSobrantes(usuarioId: string, viajeId: string, conservar: string | null): Promise<void> {
    const cliente = this.storage()
    if (!cliente) return
    const carpeta = carpetaFotoRecorrido(usuarioId, viajeId)
    try {
      const bucket = cliente.storage.from(BUCKET_AVATARES)
      const { data } = await bucket.list(carpeta, { limit: 100 })
      const sobrantes = (data ?? [])
        .map((a) => `${carpeta}/${a.name}`)
        .filter((path) => path !== conservar)
      if (sobrantes.length > 0) await bucket.remove(sobrantes)
    } catch {
      // Queda un archivo huérfano en Storage: no afecta a nadie.
    }
  }
}
