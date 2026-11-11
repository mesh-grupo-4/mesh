import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { FotosPerfilService } from './usuarios.fotos'
import { HttpError } from '../../lib/httpError'

const usuarioId = '11111111-1111-1111-1111-111111111111'
const otroId = '22222222-2222-2222-2222-222222222222'
const BASE = 'https://proyecto.supabase.co'
const archivo = '1792000000000.jpg'
const path = `${usuarioId}/${archivo}`

function crearMocks() {
  const bucket = {
    createSignedUploadUrl: vi.fn(),
    list: vi.fn(),
    remove: vi.fn().mockResolvedValue({ data: [], error: null }),
  }
  const storage = { storage: { from: vi.fn(() => bucket) } } as unknown as SupabaseClient
  const prisma = {
    usuario: {
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  }
  const service = new FotosPerfilService(prisma as unknown as PrismaClient, () => storage)
  return { bucket, prisma, service }
}

async function codigoDeError(promesa: Promise<unknown>): Promise<string | undefined> {
  try {
    await promesa
  } catch (e) {
    return e instanceof HttpError ? e.code : undefined
  }
  return undefined
}

describe('FotosPerfilService', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = BASE
  })

  it('crearSubida firma una ruta dentro de la carpeta del usuario', async () => {
    const { bucket, service } = crearMocks()
    bucket.createSignedUploadUrl.mockResolvedValue({
      data: { signedUrl: 'https://firmada', token: 't', path: 'x' },
      error: null,
    })

    const r = await service.crearSubida(usuarioId)

    expect(r.path).toMatch(new RegExp(`^${usuarioId}/\\d{13}\\.jpg$`))
    expect(r.upload_url).toBe('https://firmada')
    expect(bucket.createSignedUploadUrl).toHaveBeenCalledWith(r.path)
  })

  it('responde 503 si Storage no está configurado', async () => {
    const service = new FotosPerfilService({} as PrismaClient, () => null)
    expect(await codigoDeError(service.crearSubida(usuarioId))).toBe('FOTOS_NO_DISPONIBLES')
  })

  it('rechaza confirmar una ruta de otro usuario', async () => {
    const { bucket, service } = crearMocks()
    expect(await codigoDeError(service.confirmar(usuarioId, `${otroId}/${archivo}`))).toBe(
      'FOTO_PATH_INVALIDO'
    )
    expect(await codigoDeError(service.confirmar(usuarioId, `${usuarioId}/../x.jpg`))).toBe(
      'FOTO_PATH_INVALIDO'
    )
    expect(bucket.list).not.toHaveBeenCalled()
  })

  it('rechaza confirmar si el archivo no se subió', async () => {
    const { bucket, prisma, service } = crearMocks()
    bucket.list.mockResolvedValue({ data: [], error: null })

    expect(await codigoDeError(service.confirmar(usuarioId, path))).toBe('FOTO_NO_SUBIDA')
    expect(prisma.usuario.update).not.toHaveBeenCalled()
  })

  it('borra y rechaza un archivo que no es JPEG', async () => {
    const { bucket, prisma, service } = crearMocks()
    bucket.list.mockResolvedValue({
      data: [{ name: archivo, metadata: { size: 1000, mimetype: 'image/png' } }],
      error: null,
    })

    expect(await codigoDeError(service.confirmar(usuarioId, path))).toBe('FOTO_INVALIDA')
    expect(bucket.remove).toHaveBeenCalledWith([path])
    expect(prisma.usuario.update).not.toHaveBeenCalled()
  })

  it('guarda la URL pública y limpia la foto anterior', async () => {
    const { bucket, prisma, service } = crearMocks()
    bucket.list.mockResolvedValue({
      data: [
        { name: archivo, metadata: { size: 60_000, mimetype: 'image/jpeg' } },
        { name: '1791000000000.jpg', metadata: { size: 50_000, mimetype: 'image/jpeg' } },
      ],
      error: null,
    })

    const r = await service.confirmar(usuarioId, path)

    const url = `${BASE}/storage/v1/object/public/avatares/${path}`
    expect(r).toEqual({ foto_perfil: url })
    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: usuarioId },
      data: { foto_perfil: url },
    })
    expect(bucket.remove).toHaveBeenCalledWith([`${usuarioId}/1791000000000.jpg`])
  })

  it('eliminar desvincula la foto y borra el archivo', async () => {
    const { bucket, prisma, service } = crearMocks()
    prisma.usuario.findUnique.mockResolvedValue({
      foto_perfil: `${BASE}/storage/v1/object/public/avatares/${path}`,
    })

    expect(await service.eliminar(usuarioId)).toEqual({ foto_perfil: null })
    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: usuarioId },
      data: { foto_perfil: null },
    })
    expect(bucket.remove).toHaveBeenCalledWith([path])
  })

  it('fotosDe devuelve un mapa id → URL solo con quienes tienen foto', async () => {
    const { prisma, service } = crearMocks()
    prisma.usuario.findMany.mockResolvedValue([{ id: usuarioId, foto_perfil: 'https://f' }])

    expect(await service.fotosDe([usuarioId, otroId])).toEqual({ [usuarioId]: 'https://f' })
    expect(prisma.usuario.findMany).toHaveBeenCalledWith({
      where: { id: { in: [usuarioId, otroId] }, foto_perfil: { not: null } },
      select: { id: true, foto_perfil: true },
    })
  })
})
