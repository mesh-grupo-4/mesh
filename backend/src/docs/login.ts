import type { RequestHandler } from 'express'
import { z } from 'zod'
import { HttpError } from '../lib/httpError'

/**
 * Login de conveniencia para la documentación interactiva.
 *
 * La API no tiene login propio: el usuario se autentica contra Firebase desde la app y
 * el backend solo verifica el ID token resultante (ver `src/middleware/requireUser.ts`).
 * Eso deja a Swagger UI sin forma de conseguir un token, y obliga a pegarlo a mano en
 * cada sesión.
 *
 * Este handler resuelve `POST /api/docs/login`, que proxea a la REST API de Firebase
 * (`accounts:signInWithPassword`) y devuelve el ID token. Vive en `src/docs/` —y no en
 * `src/modules/`— a propósito: **es una herramienta de la documentación, no parte del
 * contrato de la API que consume la app**. Lo monta el `docsRouter`, así que
 * `DOCS_ENABLED=false` lo apaga junto con Swagger UI.
 */

const loginSchema = z.object({
  email: z.string().trim().email('Email inválido'),
  password: z.string().min(1, 'La contraseña no puede estar vacía'),
})

const FIREBASE_SIGN_IN =
  'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword'

/**
 * Mensajes de Firebase → error del dominio. Firebase unificó credenciales inválidas
 * bajo `INVALID_LOGIN_CREDENTIALS` para no revelar si el email existe; se respeta ese
 * criterio y no se distingue en la respuesta.
 */
function traducirErrorFirebase(mensaje: string): HttpError {
  const base = mensaje.split(' :')[0]

  switch (base) {
    case 'EMAIL_NOT_FOUND':
    case 'INVALID_PASSWORD':
    case 'INVALID_LOGIN_CREDENTIALS':
      return new HttpError(401, 'Email o contraseña incorrectos', 'INVALID_CREDENTIALS')
    case 'USER_DISABLED':
      return new HttpError(403, 'La cuenta está deshabilitada', 'USER_DISABLED')
    case 'TOO_MANY_ATTEMPTS_TRY_LATER':
      // RN-005: Firebase aplica su propio bloqueo temporal tras repetidos fallos.
      return new HttpError(
        429,
        'Demasiados intentos fallidos. Esperá unos minutos antes de reintentar.',
        'TOO_MANY_ATTEMPTS'
      )
    default:
      return new HttpError(401, 'No se pudo iniciar sesión', 'LOGIN_FAILED')
  }
}

/**
 * Límite de intentos por IP, en memoria.
 *
 * Firebase ya frena el abuso del lado de su API, pero este endpoint acepta contraseñas
 * en texto plano y conviene no dejarlo como oráculo de fuerza bruta gratuito. Ventana
 * deslizante simple: alcanza para una herramienta de documentación y no agrega
 * dependencias ni estado externo.
 */
const MAX_INTENTOS = 10
const VENTANA_MS = 5 * 60 * 1000
const intentos = new Map<string, number[]>()

function registrarIntento(ip: string): boolean {
  const ahora = Date.now()
  const previos = (intentos.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS)
  previos.push(ahora)
  intentos.set(ip, previos)

  // La doc la usa un puñado de personas; limpiar acá evita que el Map crezca sin techo.
  if (intentos.size > 500) {
    for (const [clave, marcas] of intentos) {
      if (marcas.every((t) => ahora - t >= VENTANA_MS)) intentos.delete(clave)
    }
  }

  return previos.length <= MAX_INTENTOS
}

export const loginDocsHandler: RequestHandler = async (req, res, next) => {
  try {
    const apiKey = process.env.FIREBASE_WEB_API_KEY
    if (!apiKey) {
      throw new HttpError(
        503,
        'El login de la documentación no está configurado: falta FIREBASE_WEB_API_KEY en el .env del backend.',
        'DOCS_LOGIN_NOT_CONFIGURED'
      )
    }

    if (!registrarIntento(req.ip ?? 'desconocida')) {
      throw new HttpError(
        429,
        'Demasiados intentos de login. Esperá unos minutos antes de reintentar.',
        'TOO_MANY_ATTEMPTS'
      )
    }

    const { email, password } = loginSchema.parse(req.body)

    const respuesta = await fetch(`${FIREBASE_SIGN_IN}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    })

    const cuerpo = (await respuesta.json()) as {
      idToken?: string
      localId?: string
      email?: string
      expiresIn?: string
      error?: { message?: string }
    }

    if (!respuesta.ok || !cuerpo.idToken) {
      throw traducirErrorFirebase(cuerpo.error?.message ?? '')
    }

    res.json({
      idToken: cuerpo.idToken,
      // Firebase lo manda como string de segundos; se normaliza a número.
      expiresIn: Number(cuerpo.expiresIn ?? 3600),
      email: cuerpo.email ?? email,
      uid: cuerpo.localId ?? null,
    })
  } catch (err) {
    next(err)
  }
}
