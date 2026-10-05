import { Platform } from 'react-native'
import { io, type Socket } from 'socket.io-client'

import { API_BASE_URL } from '@/constants/Config'
import { getFirebaseIdToken } from '@/lib/apiClient'

/**
 * Un único socket para toda la app. Antes se destruía y recreaba cada vez que
 * no estaba conectado, y los listeners que los hooks habían colgado del socket
 * anterior (posiciones, alertas, paradas, fin de viaje) quedaban muertos.
 */
let socket: Socket | null = null

/**
 * Salas `viaje:<id>` que la app quiere escuchar. Las salas no sobreviven a una
 * reconexión de Socket.io (el servidor crea un socket nuevo), así que en cada
 * `connect` se vuelven a pedir todas.
 */
const roomsDeseadas = new Set<string>()

function waitForConnect(sock: Socket, ms = 12_000): Promise<Socket> {
  if (sock.connected) return Promise.resolve(sock)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Socket connect timeout'))
    }, ms)
    const onConnect = () => {
      clearTimeout(timer)
      cleanup()
      resolve(sock)
    }
    const onError = (err: Error) => {
      clearTimeout(timer)
      cleanup()
      reject(err)
    }
    const cleanup = () => {
      sock.off('connect', onConnect)
      sock.off('connect_error', onError)
    }
    sock.once('connect', onConnect)
    sock.once('connect_error', onError)
  })
}

function aplicarToken(sock: Socket, token: string): void {
  sock.auth = { token }
  sock.io.opts.extraHeaders = { Authorization: `Bearer ${token}` }
}

function rejoinRooms(sock: Socket): void {
  for (const viajeId of roomsDeseadas) {
    sock.emit('join_viaje', { viajeId })
  }
}

/**
 * Socket.io en React Native iOS no envía `extraHeaders` con transport websocket.
 * Usamos `auth.token` (leído en backend) y polling primero en iOS.
 */
export async function connectMeshSocket(): Promise<Socket> {
  if (socket?.connected) return socket

  const token = await getFirebaseIdToken()

  if (socket) {
    // Ya existe: refrescar el token y, si no está reintentando solo, reconectar.
    aplicarToken(socket, token)
    if (!socket.active) socket.connect()
    return esperarOSeguirIntentando(socket)
  }

  const url = API_BASE_URL.replace(/\/$/, '')
  const sock = io(url, {
    auth: { token },
    extraHeaders: { Authorization: `Bearer ${token}` },
    transports: Platform.OS === 'ios' ? ['polling', 'websocket'] : ['websocket', 'polling'],
    reconnection: true,
    // Un túnel o una zona sin señal pueden durar más que 8 intentos: sin límite,
    // el socket sigue intentando hasta que vuelva la red (RN-038).
    reconnectionAttempts: Infinity,
    reconnectionDelayMax: 10_000,
  })
  socket = sock

  sock.io.on('reconnect_attempt', () => {
    void getFirebaseIdToken(true).then((freshToken) => {
      if (socket === sock) aplicarToken(sock, freshToken)
    })
  })

  sock.on('connect', () => rejoinRooms(sock))

  return esperarOSeguirIntentando(sock)
}

/**
 * Devuelve el socket aunque todavía no haya conectado: Socket.io sigue
 * reintentando solo, y quien lo pidió puede colgar sus listeners ya mismo (se
 * disparan apenas conecte). Antes, el primer `connect_error` dejaba a los hooks
 * sin listeners hasta que la pantalla se volviera a montar.
 */
async function esperarOSeguirIntentando(sock: Socket): Promise<Socket> {
  try {
    return await waitForConnect(sock)
  } catch (e) {
    if (__DEV__) console.warn('[meshSocket] sin conexión por ahora, se sigue reintentando:', e)
    return sock
  }
}

export function getMeshSocket(): Socket | null {
  return socket
}

/**
 * Suscribe a la sala de un viaje y la recuerda para re-suscribirla tras cada
 * reconexión. Si el socket todavía no conectó, el `connect` la pide solo.
 */
export function joinViajeRoom(
  viajeId: string,
  ack?: (res?: { ok: boolean; error?: string }) => void
): void {
  if (!viajeId) return
  roomsDeseadas.add(viajeId)
  if (socket?.connected) {
    socket.emit('join_viaje', { viajeId }, ack)
  }
}

export function leaveViajeRoom(viajeId: string): void {
  roomsDeseadas.delete(viajeId)
  if (socket?.connected) socket.emit('leave_viaje', { viajeId })
}

/**
 * Avisa cada vez que el socket (re)conecta. Sirve para que los hooks vuelvan a
 * pedir por REST lo que se perdió mientras la conexión estuvo caída.
 */
export function onMeshSocketConnect(cb: () => void): () => void {
  const sock = socket
  if (!sock) return () => {}
  sock.on('connect', cb)
  return () => {
    sock.off('connect', cb)
  }
}

export function disconnectMeshSocket(): void {
  roomsDeseadas.clear()
  socket?.removeAllListeners()
  socket?.disconnect()
  socket = null
}
