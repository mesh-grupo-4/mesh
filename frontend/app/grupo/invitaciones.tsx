import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
import {
  listarInvitacionesPendientes,
  responderInvitacion,
  type InvitacionPendienteApi,
} from '@/lib/gruposApi';
import { setInvitacionesPendientesCount } from '@/lib/pendientesStore';
import { formatearHaceCuanto } from '@/lib/tiempoArg';
import { meshError } from '@/lib/meshAlert';
import { vibrarExito, vibrarSuave } from '@/lib/haptica';
import { PantallaPendientes } from '@/components/notificaciones/PantallaPendientes';
import { Destacado, FilaNotificacion } from '@/components/notificaciones/FilaNotificacion';

/** Campanita de la pestaña Grupos: invitaciones a grupos sin responder. */
export default function InvitacionesGruposScreen() {
  const { backendUserId } = useAuth();
  const [respondiendoId, setRespondiendoId] = useState<string | null>(null);

  const cargar = useCallback(
    () => listarInvitacionesPendientes(resolveBackendUserId(backendUserId)),
    [backendUserId]
  );

  const responder = async (
    inv: InvitacionPendienteApi,
    accion: 'aceptar' | 'rechazar',
    quitar: () => void
  ) => {
    setRespondiendoId(inv.id);
    try {
      const resultado = await responderInvitacion(
        inv.id,
        accion,
        resolveBackendUserId(backendUserId)
      );
      if (accion === 'aceptar') {
        vibrarExito();
        router.replace({ pathname: '/grupo/[grupoId]', params: { grupoId: resultado.grupo_id } });
      } else {
        vibrarSuave();
        quitar();
      }
    } catch (e: unknown) {
      meshError('Error', e instanceof Error ? e.message : 'No se pudo responder la invitación.');
    } finally {
      setRespondiendoId(null);
    }
  };

  return (
    <PantallaPendientes
      titulo="Invitaciones a grupos"
      textoVacio="Cuando alguien te invite a un grupo, lo vas a ver acá."
      cargar={cargar}
      onCantidad={setInvitacionesPendientesCount}
      renderItem={(inv, quitar) => (
        <FilaNotificacion
          nombre={inv.invitado_por.nombre}
          usuarioId={inv.invitado_por.id}
          mensaje={
            <>
              <Destacado>{inv.invitado_por.nombre}</Destacado> te invitó a{' '}
              <Destacado>{inv.grupo.nombre}</Destacado>
            </>
          }
          meta={
            inv.grupo_origen
              ? `Desde ${inv.grupo_origen.nombre} · ${formatearHaceCuanto(inv.created_at)}`
              : formatearHaceCuanto(inv.created_at)
          }
          etiquetaAceptar="Unirme"
          procesando={respondiendoId === inv.id}
          onAceptar={() => void responder(inv, 'aceptar', quitar)}
          onRechazar={() => void responder(inv, 'rechazar', quitar)}
          onPressAvatar={() =>
            router.push({
              pathname: '/usuario/[usuarioId]',
              params: { usuarioId: inv.invitado_por.id },
            })
          }
        />
      )}
    />
  );
}
