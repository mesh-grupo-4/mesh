import { Platform } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { File } from 'expo-file-system'
import { confirmarFoto, crearSubidaFoto, eliminarFoto } from '@/lib/usuariosApi'

/** Lado del cuadrado que se sube: alcanza para el avatar más grande (128 pt en 3x ≈ 384 px). */
const LADO_PX = 512
const CALIDAD_JPEG = 0.8

export type OrigenFoto = 'galeria' | 'camara'

export class PermisoFotoDenegado extends Error {}

/**
 * Abre la galería o la cámara con recorte cuadrado y devuelve un JPEG de
 * 512×512 listo para subir (~60 KB). Null si la persona canceló.
 */
export async function elegirFoto(origen: OrigenFoto): Promise<string | null> {
  const permiso =
    origen === 'camara'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permiso.granted) throw new PermisoFotoDenegado()

  const opciones: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  }
  const resultado =
    origen === 'camara'
      ? await ImagePicker.launchCameraAsync(opciones)
      : await ImagePicker.launchImageLibraryAsync(opciones)
  if (resultado.canceled || !resultado.assets[0]) return null

  const imagen = await ImageManipulator.manipulate(resultado.assets[0].uri)
    .resize({ width: LADO_PX, height: LADO_PX })
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

  const res = await fetch(upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: await leerBytes(uriLocal),
  })
  if (!res.ok) throw new Error('No se pudo subir la foto. Revisá tu conexión e intentá de nuevo.')

  const { foto_perfil } = await confirmarFoto(path)
  return foto_perfil
}

export async function quitarFotoPerfil(): Promise<void> {
  await eliminarFoto()
}
