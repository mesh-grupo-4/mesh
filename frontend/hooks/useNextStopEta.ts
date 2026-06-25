import { useMemo } from 'react'

import { calcNextStop, type NextStopInfo, type RouteStop } from '@/lib/geo/nextStop'

type Options = {
  currentPos: { lat: number; lng: number } | null
  stops: RouteStop[]
  speedKmh: number
}

export function useNextStopEta({ currentPos, stops, speedKmh }: Options): NextStopInfo | null {
  return useMemo(() => {
    if (!currentPos) return null
    return calcNextStop(currentPos.lat, currentPos.lng, stops, speedKmh)
  }, [currentPos, stops, speedKmh])
}
