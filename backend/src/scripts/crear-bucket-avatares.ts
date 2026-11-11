/**
 * Crea (o ajusta) el bucket público `avatares` de Supabase Storage para las
 * fotos de perfil. Es idempotente: se puede correr en cada entorno (dev, test,
 * prod) las veces que haga falta.
 *
 *   npm run storage:setup
 *
 * Necesita `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el `.env`.
 */
import 'dotenv/config'
import { BUCKET_AVATARES, supabaseStorage } from '../config/supabase'
import { FOTO_MAX_BYTES } from '../modules/usuarios/usuarios.fotos'

async function main() {
  const cliente = supabaseStorage()
  if (!cliente) {
    console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el .env')
    process.exitCode = 1
    return
  }

  // Público: las fotos se leen por URL directa. Escribir solo se puede con URL firmada del backend.
  const opciones = {
    public: true,
    fileSizeLimit: FOTO_MAX_BYTES,
    allowedMimeTypes: ['image/jpeg'],
  }

  const { data: existente } = await cliente.storage.getBucket(BUCKET_AVATARES)
  const { error } = existente
    ? await cliente.storage.updateBucket(BUCKET_AVATARES, opciones)
    : await cliente.storage.createBucket(BUCKET_AVATARES, opciones)

  if (error) {
    console.error(`No se pudo configurar el bucket "${BUCKET_AVATARES}": ${error.message}`)
    process.exitCode = 1
    return
  }
  console.log(`Bucket "${BUCKET_AVATARES}" ${existente ? 'actualizado' : 'creado'}: público, JPEG de hasta 2 MB.`)
}

void main()
