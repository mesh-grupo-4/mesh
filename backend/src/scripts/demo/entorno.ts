/**
 * Variables de entorno del seed de demo. Tiene que ser el primer import de `seed.ts`:
 * `config/prisma.ts` y `config/firebase.ts` leen `process.env` al cargarse.
 *
 * Si existe `backend/.env.demo` se usa ese archivo en lugar de `.env`. Sirve para que el
 * seed escriba en la base que usa la app desplegada sin cambiar la configuración del
 * backend local. `.env.demo` no se commitea.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'

const raizBackend = path.resolve(__dirname, '../../..')

export const ARCHIVO_ENV = existsSync(path.join(raizBackend, '.env.demo')) ? '.env.demo' : '.env'

config({ path: path.join(raizBackend, ARCHIVO_ENV), quiet: true })

/** A qué base se va a escribir, sin la contraseña: para mostrarlo antes de tocar nada. */
export function baseDestino(): string {
  try {
    const url = new URL(process.env.DATABASE_URL ?? '')
    return `${url.hostname} · ${url.username}`
  } catch {
    return 'DATABASE_URL inválida o sin definir'
  }
}
