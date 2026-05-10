import { io, type Socket } from 'socket.io-client'

import { API_BASE_URL } from '@/constants/Config'

let socket: Socket | null = null
let currentUserId: string | null = null

export function connectMeshSocket(userId: string): Socket {
  if (socket && currentUserId === userId && socket.connected) return socket
  socket?.disconnect()
  currentUserId = userId
  const url = API_BASE_URL.replace(/\/$/, '')
  socket = io(url, {
    extraHeaders: { 'x-user-id': userId },
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
  currentUserId = null
}
