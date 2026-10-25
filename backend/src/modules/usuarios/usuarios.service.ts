import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '../../config/prisma'
import { firebaseAuth } from '../../config/firebase'
import { HttpError } from '../../lib/httpError'
import type { SyncUsuarioInput } from './usuarios.schemas'
import { AmistadesService } from '../amistades/amistades.service'
import { InsigniasService } from '../insignias/insignias.service'
import { RachasService } from '../rachas/rachas.service'
import { ViajesService } from '../viajes/viajes.service'

function esConflictoUnico(err: unknown): boolean {
  return (
    !!err &&
    typeof err === 'object' &&
    'code' in err &&
    String((err as { code: unknown }).code) === 'P2002'
  )
}

// Resuelve la fila del usuario cuando otra request concurrente ganó la carrera del create.
async function releerTrasConflicto(firebaseUid: string, email: string) {
  const porUid = await defaultPrisma.usuario.findUnique({
    where: { firebase_uid: firebaseUid },
  })
  if (porUid) return porUid

  if (email) {
    const porEmail = await defaultPrisma.usuario.findUnique({ where: { email } })
    if (porEmail) {
      return defaultPrisma.usuario.update({
        where: { id: porEmail.id },
        data: { firebase_uid: firebaseUid },
      })
    }
  }

  return null
}

// Usado por requireUser — encuentra o crea el usuario a partir del UID de Firebase.
// Al iniciar sesión el frontend dispara varias requests casi simultáneas: sin manejo de
// carrera, dos de ellas ejecutan el create a la vez y la perdedora choca contra el unique
// de firebase_uid / email (P2002), que requireUser traduce a un 500 espurio.
export async function findOrCreateByFirebaseUid(firebaseUid: string) {
  const existing = await defaultPrisma.usuario.findUnique({
    where: { firebase_uid: firebaseUid },
  })
  if (existing) return existing

  const firebaseUser = await firebaseAuth.getUser(firebaseUid)
  const email = firebaseUser.email ?? ''

  try {
    // Cuenta legacy: mismo email en BD con firebase_uid desactualizado (migración / re-login).
    if (email) {
      const byEmail = await defaultPrisma.usuario.findUnique({ where: { email } })
      if (byEmail) {
        return await defaultPrisma.usuario.update({
          where: { id: byEmail.id },
          data: { firebase_uid: firebaseUid },
        })
      }
    }

    return await defaultPrisma.usuario.create({
      data: {
        firebase_uid: firebaseUid,
        email,
        nombre: firebaseUser.displayName ?? email.split('@')[0] ?? 'Usuario',
      },
    })
  } catch (err) {
    if (!esConflictoUnico(err)) throw err
    const resuelto = await releerTrasConflicto(firebaseUid, email)
    if (resuelto) return resuelto
    throw err
  }
}

export class UsuariosService {
  private readonly amistades: AmistadesService
  private readonly insignias: InsigniasService
  private readonly rachas: RachasService
  private readonly viajes: ViajesService

  constructor(private readonly prisma: PrismaClient) {
    this.amistades = new AmistadesService(prisma)
    this.insignias = new InsigniasService(prisma)
    this.rachas = new RachasService(prisma)
    this.viajes = new ViajesService(prisma)
  }

  async getMe(userId: string) {
    return this.prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        telefono: true,
        actividad_preferida: true,
        rol_sistema: true,
      },
    })
  }

  async upsertPushToken(userId: string, token: string): Promise<void> {
    await this.prisma.usuario.update({
      where: { id: userId },
      data: { push_token: token },
    })
  }

  async sync(userId: string, input: SyncUsuarioInput) {
    return this.prisma.usuario.update({
      where: { id: userId },
      data: {
        nombre: input.nombre,
        // undefined → no se toca el campo; null → se limpia
        ...(input.apellido !== undefined ? { apellido: input.apellido } : {}),
        ...(input.telefono !== undefined ? { telefono: input.telefono } : {}),
        ...(input.actividad_preferida !== undefined
          ? { actividad_preferida: input.actividad_preferida }
          : {}),
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        telefono: true,
        actividad_preferida: true,
        rol_sistema: true,
      },
    })
  }

  /**
   * Perfil de un usuario visible para cualquiera de la comunidad (no hace falta
   * ser amigos ni compartir un viaje): nombre, actividad preferida, estadísticas
   * agregadas (RN-070: nunca velocidad), insignias (RN-074) y racha (RN-075).
   */
  async perfilPublico(usuarioObjetivoId: string, solicitanteId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioObjetivoId },
      select: { id: true, nombre: true, apellido: true, actividad_preferida: true },
    })
    if (!usuario) {
      throw new HttpError(404, 'Usuario no encontrado', 'USER_NOT_FOUND')
    }

    const esYo = usuario.id === solicitanteId
    const [estadisticas, insignias, racha, relacionAmistad] = await Promise.all([
      this.viajes.estadisticasUsuario(usuario.id),
      this.insignias.listarDeUsuario(usuario.id),
      this.rachas.obtenerRachaVigente(usuario.id),
      esYo ? Promise.resolve(null) : this.amistades.obtenerRelacion(solicitanteId, usuario.id),
    ])

    return {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      actividad_preferida: usuario.actividad_preferida,
      es_yo: esYo,
      relacion_amistad: relacionAmistad,
      racha,
      estadisticas,
      insignias,
    }
  }
}
