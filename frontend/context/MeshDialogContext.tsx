import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  MeshDialog,
  type MeshDialogButton,
  type MeshDialogVariant,
} from '@/components/MeshDialog'
import { registerMeshAlert } from '@/lib/meshAlert'

export type MeshAlertButton = {
  text: string
  onPress?: () => void
  style?: 'default' | 'cancel' | 'destructive'
  loading?: boolean
}

export type MeshAlertConfig = {
  title: string
  message?: string
  variant?: MeshDialogVariant
  buttons?: MeshAlertButton[]
}

type DialogState = MeshAlertConfig & {
  visible: boolean
  buttons: MeshDialogButton[]
}

function mapButtons(buttons?: MeshAlertButton[]): MeshDialogButton[] {
  if (!buttons || buttons.length === 0) {
    return [{ label: 'OK', variant: 'primary' }]
  }

  return buttons.map((btn) => ({
    label: btn.text,
    loading: btn.loading,
    variant:
      btn.style === 'destructive'
        ? 'danger'
        : btn.style === 'cancel'
          ? 'ghost'
          : 'primary',
    onPress: btn.onPress,
  }))
}

type MeshDialogContextValue = {
  show: (config: MeshAlertConfig) => void
}

const MeshDialogContext = createContext<MeshDialogContextValue | null>(null)

export function MeshDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hide = useCallback(() => {
    setDialog((prev) => (prev ? { ...prev, visible: false } : null))
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setDialog(null), 220)
  }, [])

  const show = useCallback(
    (config: MeshAlertConfig) => {
      if (closeTimer.current) clearTimeout(closeTimer.current)

      const mapped = mapButtons(config.buttons).map((btn) => ({
        ...btn,
        onPress: () => {
          hide()
          btn.onPress?.()
        },
      }))

      setDialog({
        ...config,
        visible: true,
        buttons: mapped,
      })
    },
    [hide]
  )

  useEffect(() => {
    registerMeshAlert(show)
    return () => registerMeshAlert(null)
  }, [show])

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  return (
    <MeshDialogContext.Provider value={{ show }}>
      {children}
      {dialog ? (
        <MeshDialog
          visible={dialog.visible}
          title={dialog.title}
          message={dialog.message}
          variant={dialog.variant}
          buttons={dialog.buttons}
          onRequestClose={hide}
        />
      ) : null}
    </MeshDialogContext.Provider>
  )
}

export function useMeshDialog() {
  const ctx = useContext(MeshDialogContext)
  if (!ctx) {
    throw new Error('useMeshDialog debe usarse dentro de MeshDialogProvider')
  }
  return ctx
}
