/**
 * Bootstrap del rol superadmin (RN-122).
 *
 * El primer superadmin no puede nombrarlo nadie desde la API, así que se promueve
 * desde la terminal de alguien con acceso a la base:
 *
 *   npm run admin:promover -- persona@mail.com
 *   npm run admin:promover -- persona@mail.com --quitar
 *
 * La persona tiene que haber iniciado sesión al menos una vez (así existe su fila
 * en `usuario`). Queda registrado en `auditoria_admin` sin actor (origen: cli).
 */
import 'dotenv/config'
import { prisma } from '../config/prisma'

async function main() {
  const args = process.argv.slice(2)
  const email = args.find((a) => !a.startsWith('--'))?.trim().toLowerCase()
  const quitar = args.includes('--quitar')

  if (!email) {
    console.error('Uso: npm run admin:promover -- <email> [--quitar]')
    process.exitCode = 1
    return
  }

  const usuario = await prisma.usuario.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true, rol_sistema: true },
  })
  if (!usuario) {
    console.error(`No existe un usuario con email ${email}. Tiene que iniciar sesión al menos una vez.`)
    process.exitCode = 1
    return
  }

  const rol = quitar ? 'usuario' : 'superadmin'
  if (usuario.rol_sistema === rol) {
    console.log(`${usuario.email} ya tiene rol ${rol}. Nada que hacer.`)
    return
  }

  await prisma.$transaction([
    prisma.usuario.update({ where: { id: usuario.id }, data: { rol_sistema: rol } }),
    prisma.auditoriaAdmin.create({
      data: {
        actor_id: null,
        accion: 'usuario.cambiar_rol',
        entidad: 'usuario',
        entidad_id: usuario.id,
        detalle: { email: usuario.email, de: usuario.rol_sistema, a: rol, origen: 'cli' },
      },
    }),
  ])
  console.log(`${usuario.email}: ${usuario.rol_sistema} → ${rol}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => void prisma.$disconnect())
