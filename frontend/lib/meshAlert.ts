import type { MeshAlertConfig } from '@/context/MeshDialogContext'

type ShowFn = (config: MeshAlertConfig) => void

let showFn: ShowFn | null = null

export function registerMeshAlert(fn: ShowFn | null) {
  showFn = fn
}

export function meshAlert(
  title: string,
  message?: string,
  buttons?: MeshAlertConfig['buttons']
) {
  if (!showFn) {
    console.warn('[meshAlert] MeshDialogProvider no montado:', title, message)
    return
  }
  showFn({ title, message, buttons })
}

export function meshConfirmDestructive(opts: {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
}) {
  meshAlert(opts.title, opts.message, [
    { text: opts.cancelLabel ?? 'Cancelar', style: 'cancel', onPress: opts.onCancel },
    {
      text: opts.confirmLabel ?? 'Eliminar',
      style: 'destructive',
      onPress: () => void opts.onConfirm(),
    },
  ])
}

export function meshSuccess(title: string, message?: string, onOk?: () => void) {
  meshAlert(title, message, [{ text: 'OK', onPress: onOk }])
}

export function meshError(title: string, message?: string, onOk?: () => void) {
  if (!showFn) {
    console.warn('[meshAlert] MeshDialogProvider no montado:', title, message)
    return
  }
  showFn({
    title,
    message,
    variant: 'warning',
    buttons: [{ text: 'OK', onPress: onOk }],
  })
}

function meshAlertWithVariant(
  title: string,
  message: string | undefined,
  buttons: MeshAlertConfig['buttons'] | undefined,
  variant: MeshAlertConfig['variant']
) {
  if (!showFn) {
    console.warn('[meshAlert] MeshDialogProvider no montado:', title, message)
    return
  }
  showFn({ title, message, buttons, variant })
}

// Sobrecarga interna para variantes
export function meshWarning(title: string, message?: string, onOk?: () => void) {
  meshAlertWithVariant(title, message, [{ text: 'Entendido', onPress: onOk }], 'warning')
}
