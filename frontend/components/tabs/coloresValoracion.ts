import type { ComponentProps } from 'react';
import type { Feather } from '@expo/vector-icons';

import type { useTheme } from '@/components/MeshUI';
import type { ValoracionRecorridoApi } from '@/lib/recorridosPublicadosApi';

type Theme = ReturnType<typeof useTheme>;

/**
 * Escalón de la valoración de un recorrido publicado (RN-082), del peor al mejor. "Muy
 * recomendado" lo decide el backend (80 % o más con al menos 3 valoraciones); el resto
 * sale del porcentaje. Nada de esto usa velocidad (RN-070).
 */
export type NivelValoracion = 'sin' | 'baja' | 'media' | 'buena' | 'muy_buena';

export function nivelValoracion(v: ValoracionRecorridoApi): NivelValoracion {
  if (v.muy_recomendado) return 'muy_buena';
  if (v.total === 0 || v.porcentaje_recomienda === null) return 'sin';
  if (v.porcentaje_recomienda >= 70) return 'buena';
  if (v.porcentaje_recomienda >= 40) return 'media';
  return 'baja';
}

export type ColoresValoracion = {
  /** Ícono y texto de la valoración. */
  color: string;
  /** Borde de la tarjeta; null deja el borde por defecto. */
  borde: string | null;
  icono: ComponentProps<typeof Feather>['name'];
};

/** Rojo → naranja → verde → dorado, según qué tan recomendado está. */
export function coloresValoracion(nivel: NivelValoracion, theme: Theme): ColoresValoracion {
  switch (nivel) {
    case 'muy_buena':
      return { color: theme.gold, borde: theme.goldLine, icono: 'thumbs-up' };
    case 'buena':
      return { color: theme.good, borde: theme.goodLine, icono: 'thumbs-up' };
    case 'media':
      return { color: theme.fire, borde: theme.fireLine, icono: 'thumbs-up' };
    case 'baja':
      // Sin borde rojo: no queremos que la tarjeta parezca un error.
      return { color: theme.danger, borde: null, icono: 'thumbs-down' };
    default:
      return { color: theme.textMute, borde: null, icono: 'thumbs-up' };
  }
}
