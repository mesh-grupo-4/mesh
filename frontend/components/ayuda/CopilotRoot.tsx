import { CopilotProvider } from 'react-native-copilot'
import { useTheme } from '@/components/MeshUI'
import { TooltipAyuda } from './TooltipAyuda'

/** Envuelve el stack de pantallas para habilitar los tours de ayuda ("?") en
 * toda la app. Centraliza acá la configuración de react-native-copilot
 * (tooltip tematizado, labels en español) para no repetirla por pantalla. */
export function CopilotRoot({ children }: { children: React.ReactNode }) {
  const theme = useTheme()

  return (
    <CopilotProvider
      tooltipComponent={TooltipAyuda}
      overlay="svg"
      animated
      backdropColor={theme.scrim}
      labels={{ previous: 'Anterior', next: 'Siguiente', skip: 'Saltar', finish: 'Listo' }}
      androidStatusBarVisible
    >
      {children}
    </CopilotProvider>
  )
}
