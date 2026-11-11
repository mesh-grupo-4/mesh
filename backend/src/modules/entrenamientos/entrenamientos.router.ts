import { Router } from 'express'
import { prisma } from '../../config/prisma'
import { requireUser } from '../../middleware/requireUser'
import { crearEntrenamientosController } from './entrenamientos.controller'
import { EntrenamientosService } from './entrenamientos.service'

const service = new EntrenamientosService(prisma)
const c = crearEntrenamientosController(service)

/** RN-066: entrenamientos como serie (sesiones y circuitos de quien consulta). */
export const entrenamientosRouter = Router()

entrenamientosRouter.get('/sesiones', requireUser, c.listarSesiones)
entrenamientosRouter.get('/sesiones/:viajeId', requireUser, c.obtenerSesion)
entrenamientosRouter.get('/circuitos', requireUser, c.listarCircuitos)
entrenamientosRouter.patch('/circuitos/:circuitoId', requireUser, c.renombrarCircuito)
entrenamientosRouter.delete('/circuitos/:circuitoId/sesiones/:viajeId', requireUser, c.sacarSesion)
