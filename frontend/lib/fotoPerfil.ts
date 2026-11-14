import { Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { File } from 'expo-file-system'
import { confirmarFoto, crearSubidaFoto, eliminarFoto } from '@/lib/usuariosApi'
import { confirmarFotoGrupo, crearSubidaFotoGrupo, eliminarFotoGrupo } from '@/lib/gruposApi'
import { crearSubidaFotoRecorrido } from '@/lib/recorridosPublicadosApi'

/** Lado del cuadrado que se sube: alcanza para el avatar más grande (128 pt en 3x ≈ 384 px). */
const LADO_PX = 512
const CALIDAD_JPEG = 0.8
/** Foto de un recorrido: 4:3 a 1280 px de ancho (~250 KB), sobra para una tarjeta a pantalla completa. */
const RECORRIDO_PX = { ancho: 1280, alto: 960 }

/** Cuadrada para avatares; 4:3 para la foto de un recorrido publicado. */
export type FormatoFoto = 'cuadrada' | 'recorrido'

export type OrigenFoto = 'galeria' | 'camara'

export class PermisoFotoDenegado extends Error {}

/**
 * Abre la galería o la cámara con recorte cuadrado y devuelve un JPEG de
 * 512×512 listo para subir (~60 KB). Con formato `recorrido`, recorte 4:3 a
 * 1280×960. Null si la persona canceló.
 */
export async function elegirFoto(
  origen: OrigenFoto,
  formato: FormatoFoto = 'cuadrada'
): Promise<string | null> {
  const permiso =
    origen === 'camara'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permiso.granted) throw new PermisoFotoDenegado()

  const opciones: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: formato === 'recorrido' ? [4, 3] : [1, 1],
    quality: 1,
  }
  const resultado =
    origen === 'camara'
      ? await ImagePicker.launchCameraAsync(opciones)
      : await ImagePicker.launchImageLibraryAsync(opciones)
  if (resultado.canceled || !resultado.assets[0]) return null

  const medida =
    formato === 'recorrido'
      ? { width: RECORRIDO_PX.ancho, height: RECORRIDO_PX.alto }
      : { width: LADO_PX, height: LADO_PX }
  const imagen = await ImageManipulator.manipulate(resultado.assets[0].uri)
    .resize(medida)
    .renderAsync()
  const guardada = await imagen.saveAsync({ compress: CALIDAD_JPEG, format: SaveFormat.JPEG })
  return guardada.uri
}

async function leerBytes(uri: string): Promise<ArrayBuffer | Blob> {
  if (Platform.OS === 'web') return (await fetch(uri)).blob()
  return new File(uri).arrayBuffer()
}

/**
 * Sube la foto con el flujo de tres pasos del backend: URL firmada → PUT directo
 * a Supabase Storage → confirmación. Devuelve la URL pública guardada.
 */
export async function subirFotoPerfil(uriLocal: string): Promise<string> {
  const { path, upload_url } = await crearSubidaFoto()
  await subirAUrlFirmada(upload_url, uriLocal)
  const { foto_perfil } = await confirmarFoto(path)
  return foto_perfil
}

export async function quitarFotoPerfil(): Promise<void> {
  await eliminarFoto()
}

/** Mismo flujo para la foto de un grupo. Devuelve la URL pública guardada. */
export async function subirFotoGrupo(grupoId: string, uriLocal: string): Promise<string> {
  const { path, upload_url } = await crearSubidaFotoGrupo(grupoId)
  await subirAUrlFirmada(upload_url, uriLocal)
  const { foto } = await confirmarFotoGrupo(grupoId, path)
  return foto
}

export async function quitarFotoGrupo(grupoId: string): Promise<void> {
  await eliminarFotoGrupo(grupoId)
}

/**
 * Pasos 1 y 2 de la foto de un recorrido: URL firmada y PUT a Storage. Devuelve el `path`
 * que se manda al publicar (`fotoPath`); el backend la verifica en ese momento.
 */
export async function subirFotoRecorrido(viajeId: string, uriLocal: string): Promise<string> {
  const { path, upload_url } = await crearSubidaFotoRecorrido(viajeId)
  await subirAUrlFirmada(upload_url, uriLocal)
  return path
}

/** Paso 2: PUT directo del JPEG a Supabase Storage con la URL firmada. */
async function subirAUrlFirmada(uploadUrl: string, uriLocal: string): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: await leerBytes(uriLocal),
  })
  if (!res.ok) throw new Error('No se pudo subir la foto. Revisá tu conexión e intentá de nuevo.')
}
