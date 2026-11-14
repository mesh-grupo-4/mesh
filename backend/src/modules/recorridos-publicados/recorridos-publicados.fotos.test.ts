import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { FotosRecorridoService } from './recorridos-publicados.fotos'
import { HttpError } from '../../lib/httpError'

const usuarioId = '11111111-1111-1111-1111-111111111111'
const otroUsuarioId = '33333333-3333-3333-3333-333333333333'
const viajeId = '22222222-2222-2222-2222-222222222222'
const BASE = 'https://proyecto.supabase.co'
const carpeta = `recorridos/${usuarioId}/${viajeId}`
const archivo = '1792000000000.jpg'
const path = `${carpeta}/${archivo}`

function crearMocks() {
  const bucket = {
    createSignedUploadUrl: vi.fn(),
    list: vi.fn(),
    remove: vi.fn().mockResolvedValue({ data: [], error: null }),
  }
  const storage = { storage: { from: vi.fn(() => bucket) } } as unknown as SupabaseClient
  return { bucket, service: new FotosRecorridoService(() => storage) }
}

function jpeg(name: string, size = 180_000) {
  return { name, metadata: { size, mimetype: 'image/jpeg' } }
}

async function codigoDeError(promesa: Promise<unknown>): Promise<string | undefined> {
  try {
    await promesa
  } catch (e) {
    return e instanceof HttpError ? e.code : undefined
  }
  return undefined
}

describe('FotosRecorridoService', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = BASE
  })

  it('prepara la subida dentro de la carpeta de quien publica para ese viaje', async () => {
    const { bucket, service } = crearMocks()
    bucket.createSignedUploadUrl.mockResolvedValue({
      data: { signedUrl: 'https://firmada', token: 't', path: 'x' },
      error: null,
    })

    const r = await service.crearSubida(usuarioId, viajeId)

    expect(r.path).toMatch(new RegExp(`^${carpeta}/\\d{13}\\.jpg$`))
    expect(r.upload_url).toBe('https://firmada')
  })

  it('verifica la foto subida y devuelve su URL pública', async () => {
    const { bucket, service } = crearMocks()
    bucket.list.mockResolvedValue({ data: [jpeg(archivo)], error: null })

    const url = await service.verificar(usuarioId, viajeId, path)

    expect(bucket.list).toHaveBeenCalledWith(carpeta, { limit: 100 })
    expect(url).toBe(`${BASE}/storage/v1/object/public/avatares/${path}`)
  })

  it('rechaza una ruta de otra persona o de otro viaje sin consultar Storage', async () => {
    const { bucket, service } = crearMocks()
    const ajena = `recorridos/${otroUsuarioId}/${viajeId}/${archivo}`
    expect(await codigoDeError(service.verificar(usuarioId, viajeId, ajena))).toBe('FOTO_PATH_INVALIDO')
    expect(await codigoDeError(service.verificar(usuarioId, viajeId, `${carpeta}/../x.jpg`))).toBe(
      'FOTO_PATH_INVALIDO'
    )
    expect(bucket.list).not.toHaveBeenCalled()
  })

  it('400 si el archivo todavía no se subió', async () => {
    const { bucket, service } = crearMocks()
    bucket.list.mockResolvedValue({ data: [], error: null })
    expect(await codigoDeError(service.verificar(usuarioId, viajeId, path))).toBe('FOTO_NO_SUBIDA')
  })

  it('borra y rechaza un archivo que no es JPEG o supera los 2 MB', async () => {
    const { bucket, service } = crearMocks()
    bucket.list.mockResolvedValue({ data: [jpeg(archivo, 3 * 1024 * 1024)], error: null })

    expect(await codigoDeError(service.verificar(usuarioId, viajeId, path))).toBe('FOTO_INVALIDA')
    expect(bucket.remove).toHaveBeenCalledWith([path])
  })

  it('después de publicar borra todo menos la foto vigente', async () => {
    const { bucket, service } = crearMocks()
    bucket.list.mockResolvedValue({
      data: [jpeg('1700000000000.jpg'), jpeg(archivo)],
      error: null,
    })

    await service.borrarSobrantes(usuarioId, viajeId, path)

    expect(bucket.remove).toHaveBeenCalledWith([`${carpeta}/1700000000000.jpg`])
  })

  it('sin Storage configurado, borrar sobrantes no falla y la subida responde 503', async () => {
    const service = new FotosRecorridoService(() => null)
    await expect(service.borrarSobrantes(usuarioId, viajeId, null)).resolves.toBeUndefined()
    expect(await codigoDeError(service.crearSubida(usuarioId, viajeId))).toBe('FOTOS_NO_DISPONIBLES')
  })
})
