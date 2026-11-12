import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
import {
  listarInvitacionesViajePendientes,
  responderInvitacionViaje,
  type InvitacionViajePendienteApi,
} from '@/lib/viajesApi';
import { etiquetaActividad } from '@/lib/activityDefaults';
import { formatearEnArg } from '@/lib/tiempoArg';
import { meshError } from '@/lib/meshAlert';
import { vibrarExito, vibrarSuave } from '@/lib/haptica';
import { PantallaPendientes } from '@/components/notificaciones/PantallaPendientes';
import { Destacado, FilaNotificacion } from '@/components/notificaciones/FilaNotificacion';

type Invitacion = InvitacionViajePendienteApi & { id: string };

/** El contador de la campanita lo calcula cada pestaña, que se recarga al volver. */
const sinContador = () => {};

/**
 * Campanita de las pestañas Viajes y Entrenar: invitaciones a viajes sin responder.
 * Los entrenamientos son viajes: comparten esta bandeja y se distinguen por `modo`.
 */
export default function InvitacionesViajesScreen() {
  const { backendUserId } = useAuth();
  const [respondiendoId, setRespondiendoId] = useState<string | null>(null);

  const cargar = useCallback(
    async (): Promise<Invitacion[]> =>
      (await listarInvitacionesViajePendientes(resolveBackendUserId(backendUserId))).map((i) => ({
        ...i,
        id: i.viaje_id,
      })),
    [backendUserId]
  );

  const responder = async (inv: Invitacion, accion: 'aceptar' | 'rechazar', quitar: () => void) => {
    setRespondiendoId(inv.id);
    try {
      await responderInvitacionViaje(inv.viaje_id, accion, resolveBackendUserId(backendUserId));
      if (accion === 'aceptar') {
        vibrarExito();
        router.replace({ pathname: '/viaje/[viajeId]', params: { viajeId: inv.viaje_id } });
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
      titulo="Invitaciones a viajes"
      textoVacio="Cuando alguien te invite a un viaje, lo vas a ver acá."
      cargar={cargar}
      onCantidad={sinContador}
      renderItem={(inv, quitar) => {
        const fecha = formatearEnArg(inv.fecha_programada, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
        const esEntrenamiento = inv.modo === 'entrenamiento';
        return (
          <FilaNotificacion
            nombre={inv.creador.nombre}
            usuarioId={inv.creador.id}
            mensaje={
              <>
                <Destacado>{inv.creador.nombre}</Destacado> te invitó a{' '}
                {inv.nombre ? (
                  <Destacado>{inv.nombre}</Destacado>
                ) : (
                  <>
                    {esEntrenamiento ? 'un entrenamiento' : 'un viaje'} de <Destacado>{etiquetaActividad(inv.tipo_actividad)}</Destacado>
                  </>
                )}
              </>
            }
            meta={[
              // Con nombre propio el mensaje no dice qué es: lo aclara la línea de abajo.
              inv.nombre && esEntrenamiento ? 'Entrenamiento' : null,
              inv.nombre ? etiquetaActividad(inv.tipo_actividad) : null,
              fecha,
              inv.grupo_origen ? `Grupo ${inv.grupo_origen.nombre}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            etiquetaAceptar="Unirme"
            procesando={respondiendoId === inv.id}
            onAceptar={() => void responder(inv, 'aceptar', quitar)}
            onRechazar={() => void responder(inv, 'rechazar', quitar)}
            onPressAvatar={() =>
              router.push({ pathname: '/usuario/[usuarioId]', params: { usuarioId: inv.creador.id } })
            }
          />
        );
      }}
    />
  );
}
