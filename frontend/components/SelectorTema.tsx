import type { ComponentProps } from 'react'
import { Feather } from '@expo/vector-icons'

import { Chip, ChipRow } from '@/components/MeshUI'
import {
  elegirPreferenciaTema,
  usePreferenciaTema,
  type PreferenciaTema,
} from '@/lib/temaApp'

type Opcion = {
  id: PreferenciaTema
  etiqueta: string
  icono: ComponentProps<typeof Feather>['name']
}

const OPCIONES: Opcion[] = [
  { id: 'sistema', etiqueta: 'Igual que el teléfono', icono: 'smartphone' },
  { id: 'claro', etiqueta: 'Claro', icono: 'sun' },
  { id: 'oscuro', etiqueta: 'Oscuro', icono: 'moon' },
]

export function etiquetaTema(preferencia: PreferenciaTema): string {
  return OPCIONES.find((opcion) => opcion.id === preferencia)?.etiqueta ?? ''
}

/** Opciones para elegir el tema de la app, en la pantalla de Apariencia. */
export function SelectorTema() {
  const preferencia = usePreferenciaTema()

  return (
    <ChipRow>
      {OPCIONES.map((opcion) => (
        <Chip
          key={opcion.id}
          icon={opcion.icono}
          active={opcion.id === preferencia}
          onPress={() => elegirPreferenciaTema(opcion.id)}
        >
          {opcion.etiqueta}
        </Chip>
      ))}
    </ChipRow>
  )
}
