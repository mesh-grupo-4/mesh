import { useEffect, useRef, useSyncExternalStore, type ReactElement, type RefObject } from 'react'
import { BlurTargetView } from 'expo-blur'
import { StyleSheet, type View } from 'react-native'

type Objetivo = RefObject<View | null>

const objetivos = new Map<string, Objetivo>()
const oyentes = new Set<() => void>()

function avisar() {
  oyentes.forEach((oyente) => oyente())
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

/** Contenido que la tab bar desenfoca en Android mientras esta pestaña está activa. */
function BlurTargetTab({ nombre, children }: { nombre: string; children: ReactElement }) {
  const ref = useRef<View>(null)

  useEffect(() => {
    objetivos.set(nombre, ref)
    avisar()
    return () => {
      objetivos.delete(nombre)
      avisar()
    }
  }, [nombre])

  return (
    <BlurTargetView ref={ref} style={styles.objetivo}>
      {children}
    </BlurTargetView>
  )
}

export function useBlurTargetTab(nombre: string): Objetivo | undefined {
  return useSyncExternalStore(suscribir, () => objetivos.get(nombre))
}

/** `screenLayout` de las pestañas. Inicio queda afuera: el blur de Android no captura el mapa. */
export function capaBlurTab({
  route,
  children,
}: {
  route: { name: string }
  children: ReactElement
}): ReactElement {
  if (route.name === 'index') return children
  return <BlurTargetTab nombre={route.name}>{children}</BlurTargetTab>
}

const styles = StyleSheet.create({
  objetivo: { flex: 1 },
})
