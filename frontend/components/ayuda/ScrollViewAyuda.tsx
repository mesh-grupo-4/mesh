import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { ScrollView, type ScrollViewProps } from 'react-native'
import { useCopilot } from 'react-native-copilot'

/** Espacio que se deja arriba del paso al scrollear hasta él. */
const MARGEN_SUPERIOR = 24
/** Tiempo para que el scroll se aplique antes de reubicar el resaltado. */
const ESPERA_REUBICAR_MS = 80

type Registro = { registrar: (nombre: string) => () => void }

const ScrollAyudaContext = createContext<Registro | null>(null)

/** Usado por `PasoAyuda` para avisar que está dentro de un `ScrollViewAyuda`. */
export function useRegistroScrollAyuda() {
  return useContext(ScrollAyudaContext)
}

type Rect = { y: number; height: number }
/** Lo que usamos del `Step` de copilot (el tipo no se exporta). */
type PasoCopilot = { name: string; measure: () => Promise<Rect> }

/** Posición en pantalla del área visible de la lista. */
function medirLista(lista: ScrollView | null): Promise<Rect | null> {
  return new Promise((resolve) => {
    const nodo = lista?.getNativeScrollRef?.()
    if (!nodo) return resolve(null)
    nodo.measure((_x, _y, _w, height, _pageX, pageY) => resolve({ y: pageY, height }))
  })
}

/**
 * `ScrollView` que, durante un tour de ayuda, scrollea solo hasta el paso
 * actual si quedó fuera de la vista. Reemplazo directo de `ScrollView` en las
 * pantallas que tienen `PasoAyuda` dentro de una lista scrolleable.
 *
 * No usamos el scroll que trae react-native-copilot (`start(paso, scrollView)`):
 * guarda la `ScrollView` una sola vez para toda la app, así que después de
 * usarlo en una pantalla las demás quedaban apuntando a una lista ajena.
 */
export function ScrollViewAyuda({ onScroll, scrollEventThrottle, ...props }: ScrollViewProps) {
  const scrollRef = useRef<ScrollView>(null)
  const offsetY = useRef(0)
  const pasos = useRef(new Set<string>())
  const ultimoScrolleado = useRef<string | null>(null)

  const { copilotEvents, goToNth, currentStepNumber } = useCopilot()
  // El evento `stepChange` se emite antes de que copilot re-renderice: leemos
  // estos valores recién en el timeout, cuando ya están actualizados.
  const goToNthRef = useRef(goToNth)
  const numeroRef = useRef(currentStepNumber)
  goToNthRef.current = goToNth
  numeroRef.current = currentStepNumber

  const registrar = useCallback((nombre: string) => {
    pasos.current.add(nombre)
    return () => {
      pasos.current.delete(nombre)
    }
  }, [])
  const registro = useMemo(() => ({ registrar }), [registrar])

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined

    const alCambiarPaso = (paso: PasoCopilot | undefined) => {
      if (!paso || !pasos.current.has(paso.name)) {
        ultimoScrolleado.current = null
        return
      }
      // Copilot vuelve a emitir el mismo paso cuando lo reubicamos: no
      // scrolleamos de nuevo (evita un ciclo con pasos más altos que la vista).
      if (ultimoScrolleado.current === paso.name) {
        ultimoScrolleado.current = null
        return
      }

      void Promise.all([medirLista(scrollRef.current), paso.measure()]).then(([vista, objetivo]) => {
        if (!vista || !objetivo) return
        const arriba = objetivo.y
        const abajo = objetivo.y + objetivo.height
        const visible = arriba >= vista.y && abajo <= vista.y + vista.height
        if (visible) return

        // Si entra en la vista se centra; si es más alto, se alinea arriba.
        const desplazamiento =
          objetivo.height + MARGEN_SUPERIOR * 2 <= vista.height
            ? arriba - vista.y - (vista.height - objetivo.height) / 2
            : arriba - vista.y - MARGEN_SUPERIOR
        const destino = Math.max(0, offsetY.current + desplazamiento)

        scrollRef.current?.scrollTo({ y: destino, animated: false })
        ultimoScrolleado.current = paso.name
        clearTimeout(timeout)
        // Copilot ya midió el paso en su posición vieja: lo hacemos volver a
        // medir para que el resaltado y la tarjeta queden sobre el elemento.
        timeout = setTimeout(() => void goToNthRef.current(numeroRef.current), ESPERA_REUBICAR_MS)
      })
    }

    copilotEvents.on('stepChange', alCambiarPaso)
    return () => {
      copilotEvents.off('stepChange', alCambiarPaso)
      clearTimeout(timeout)
    }
  }, [copilotEvents])

  return (
    <ScrollAyudaContext.Provider value={registro}>
      <ScrollView
        ref={scrollRef}
        scrollEventThrottle={scrollEventThrottle ?? 16}
        onScroll={(e) => {
          offsetY.current = e.nativeEvent.contentOffset.y
          onScroll?.(e)
        }}
        {...props}
      />
    </ScrollAyudaContext.Provider>
  )
}
