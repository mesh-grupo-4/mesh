import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { FotosGrupoService } from './grupos.fotos'
import { HttpError } from '../../lib/httpError'

const grupoId = '33333333-3333-3333-3333-333333333333'
const otroGrupoId = '44444444-4444-4444-4444-444444444444'
const liderId = '11111111-1111-1111-1111-111111111111'
const participanteId = '22222222-2222-2222-2222-222222222222'
const ajenoId = '55555555-5555-5555-5555-555555555555'
const BASE = 'https://proyecto.supabase.co'
const archivo = '1792000000000.jpg'
const path = `grupos/${grupoId}/${archivo}`

function crearMocks() {
  const bucket = {
    createSignedUploadUrl: vi.fn(),
    list: vi.fn(),
    remove: vi.fn().mockResolvedValue({ data: [], error: null }),
  }
  const storage = { storage: { from: vi.fn(() => bucket) } } as unknown as SupabaseClient
  const prisma = {
    grupo: {
      // Por defecto: el grupo existe, lo lidera `liderId` y `participanteId` es integrante.
      findUnique: vi.fn(
        async ({ select }: { select: { miembros: { where: { usuario_id: string } } } }) => ({
          lider_id: liderId,
          foto: null as string | null,
          miembros:
            select.miembros.where.usuario_id === participanteId ? [{ usuario_id: participanteId }] : [],
        })
      ),
      update: vi.fn().mockResolvedValue({}),
    },
  }
  const service = new FotosGrupoService(prisma as unknown as PrismaClient, () => storage)
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

describe('FotosGrupoService', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = BASE
  })

  it('cualquier integrante puede preparar la subida, dentro de la carpeta del grupo', async () => {
    const { bucket, service } = crearMocks()
    bucket.createSignedUploadUrl.mockResolvedValue({
      data: { signedUrl: 'https://firmada', token: 't', path: 'x' },
      error: null,
    })

    const r = await service.crearSubida(participanteId, grupoId)

    expect(r.path).toMatch(new RegExp(`^grupos/${grupoId}/\\d{13}\\.jpg$`))
    expect(r.upload_url).toBe('https://firmada')
  })

  it('rechaza a quien no es del grupo (RN-030)', async () => {
    const { bucket, service } = crearMocks()
    expect(await codigoDeError(service.crearSubida(ajenoId, grupoId))).toBe('NOT_GROUP_MEMBER')
    expect(await codigoDeError(service.eliminar(ajenoId, grupoId))).toBe('NOT_GROUP_MEMBER')
    expect(bucket.createSignedUploadUrl).not.toHaveBeenCalled()
  })

  it('responde 404 si el grupo no existe', async () => {
    const { prisma, service } = crearMocks()
    prisma.grupo.findUnique.mockResolvedValueOnce(null as never)
    expect(await codigoDeError(service.crearSubida(liderId, grupoId))).toBe('GRUPO_NOT_FOUND')
  })

  it('responde 503 si Storage no está configurado', async () => {
    const { prisma } = crearMocks()
    const service = new FotosGrupoService(prisma as unknown as PrismaClient, () => null)
    expect(await codigoDeError(service.crearSubida(liderId, grupoId))).toBe('FOTOS_NO_DISPONIBLES')
  })

  it('rechaza confirmar una ruta de otro grupo o fuera de la carpeta', async () => {
    const { bucket, service } = crearMocks()
    for (const ruta of [
      `grupos/${otroGrupoId}/${archivo}`,
      `grupos/${grupoId}/../x.jpg`,
      `${liderId}/${archivo}`,
      `grupos/${grupoId}/sub/${archivo}`,
    ]) {
      expect(await codigoDeError(service.confirmar(liderId, grupoId, ruta))).toBe('FOTO_PATH_INVALIDO')
    }
    expect(bucket.list).not.toHaveBeenCalled()
  })

  it('borra y rechaza un archivo que no es JPEG', async () => {
    const { bucket, prisma, service } = crearMocks()
    bucket.list.mockResolvedValue({
      data: [{ name: archivo, metadata: { size: 1000, mimetype: 'image/png' } }],
      error: null,
    })

    expect(await codigoDeError(service.confirmar(liderId, grupoId, path))).toBe('FOTO_INVALIDA')
    expect(bucket.remove).toHaveBeenCalledWith([path])
    expect(prisma.grupo.update).not.toHaveBeenCalled()
  })

  it('un participante confirma: guarda la URL y limpia la foto anterior', async () => {
    const { bucket, prisma, service } = crearMocks()
    bucket.list.mockResolvedValue({
      data: [
        { name: archivo, metadata: { size: 60_000, mimetype: 'image/jpeg' } },
        { name: '1791000000000.jpg', metadata: { size: 50_000, mimetype: 'image/jpeg' } },
      ],
      error: null,
    })

    const r = await service.confirmar(participanteId, grupoId, path)

    const url = `${BASE}/storage/v1/object/public/avatares/${path}`
    expect(r).toEqual({ foto: url })
    expect(prisma.grupo.update).toHaveBeenCalledWith({ where: { id: grupoId }, data: { foto: url } })
    expect(bucket.list).toHaveBeenCalledWith(`grupos/${grupoId}`, { limit: 100 })
    expect(bucket.remove).toHaveBeenCalledWith([`grupos/${grupoId}/1791000000000.jpg`])
  })

  it('eliminar desvincula la foto y borra el archivo', async () => {
    const { bucket, prisma, service } = crearMocks()
    prisma.grupo.findUnique.mockResolvedValueOnce({
      lider_id: liderId,
      foto: `${BASE}/storage/v1/object/public/avatares/${path}`,
      miembros: [],
    } as never)

    expect(await service.eliminar(liderId, grupoId)).toEqual({ foto: null })
    expect(prisma.grupo.update).toHaveBeenCalledWith({ where: { id: grupoId }, data: { foto: null } })
    expect(bucket.remove).toHaveBeenCalledWith([path])
  })

  it('borrarCarpeta nunca falla, aunque Storage tire error', async () => {
    const { bucket, service } = crearMocks()
    bucket.list.mockRejectedValue(new Error('caído'))
    await expect(service.borrarCarpeta(grupoId)).resolves.toBeUndefined()
  })
})
