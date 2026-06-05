import { io, type Socket } from 'socket.io-client'

import { API_BASE_URL } from '@/constants/Config'
import { getFirebaseIdToken } from '@/lib/apiClient'

let socket: Socket | null = null

export async function connectMeshSocket(): Promise<Socket> {
  if (socket?.connected) return socket

  socket?.disconnect()
  const token = await getFirebaseIdToken()
  const url = API_BASE_URL.replace(/\/$/, '')
  socket = io(url, {
    extraHeaders: { Authorization: `Bearer ${token}` },
    transports: ['websocket', 'polling'],
    reconnection: true,
  })
  return socket
}

export function getMeshSocket(): Socket | null {
  return socket
}

export function disconnectMeshSocket(): void {
  socket?.disconnect()
  socket = null
}
