import type { RequestHandler } from 'express'
import { prisma } from '../../config/prisma'

export const getMe: RequestHandler = async (req, res) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, nombre: true },
  })
  if (!usuario) {
    res.status(404).json({ error: 'Usuario no encontrado' })
    return
  }
  res.json(usuario)
}
