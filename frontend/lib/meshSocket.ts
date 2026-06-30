import { Platform } from 'react-native'
import { io, type Socket } from 'socket.io-client'

import { API_BASE_URL } from '@/constants/Config'
import { getFirebaseIdToken } from '@/lib/apiClient'

let socket: Socket | null = null

function waitForConnect(sock: Socket, ms = 12_000): Promise<Socket> {
  if (sock.connected) return Promise.resolve(sock)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket connect timeout')), ms)
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

/**
 * Socket.io en React Native iOS no envía `extraHeaders` con transport websocket.
 * Usamos `auth.token` (leído en backend) y polling primero en iOS.
 */
export async function connectMeshSocket(): Promise<Socket> {
  if (socket?.connected) return socket

  socket?.disconnect()
  const token = await getFirebaseIdToken()
  const url = API_BASE_URL.replace(/\/$/, '')

  socket = io(url, {
    auth: { token },
    extraHeaders: { Authorization: `Bearer ${token}` },
    transports: Platform.OS === 'ios' ? ['polling', 'websocket'] : ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 8,
  })

  socket.io.on('reconnect_attempt', () => {
    void getFirebaseIdToken(true).then((freshToken) => {
      if (!socket) return
      socket.auth = { token: freshToken }
      socket.io.opts.extraHeaders = { Authorization: `Bearer ${freshToken}` }
    })
  })

  return waitForConnect(socket)
}

export function getMeshSocket(): Socket | null {
  return socket
}

export function disconnectMeshSocket(): void {
  socket?.disconnect()
  socket = null
}
