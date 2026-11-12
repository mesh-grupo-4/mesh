import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { resolveBackendUserId } from '@/lib/apiClient';
import {
  listarSolicitudesAmistadPendientes,
  responderSolicitudAmistad,
  type SolicitudAmistadPendienteApi,
} from '@/lib/amistadesApi';
import { setSolicitudesPendientesCount } from '@/lib/pendientesStore';
import { formatearHaceCuanto } from '@/lib/tiempoArg';
import { meshError } from '@/lib/meshAlert';
import { vibrarExito, vibrarSuave } from '@/lib/haptica';
import { PantallaPendientes } from '@/components/notificaciones/PantallaPendientes';
import { Destacado, FilaNotificacion } from '@/components/notificaciones/FilaNotificacion';

/** Campanita de la pestaña Amigos: solicitudes de amistad recibidas. */
export default function SolicitudesAmistadScreen() {
  const { backendUserId } = useAuth();
  const [respondiendoId, setRespondiendoId] = useState<string | null>(null);

  const cargar = useCallback(
    () => listarSolicitudesAmistadPendientes(resolveBackendUserId(backendUserId)),
    [backendUserId]
  );

  const responder = async (
    s: SolicitudAmistadPendienteApi,
    accion: 'aceptar' | 'rechazar',
    quitar: () => void
  ) => {
    setRespondiendoId(s.id);
    try {
      await responderSolicitudAmistad(s.id, accion, resolveBackendUserId(backendUserId));
      if (accion === 'aceptar') vibrarExito();
      else vibrarSuave();
      quitar();
    } catch (e: unknown) {
      meshError('Error', e instanceof Error ? e.message : 'No se pudo responder la solicitud.');
    } finally {
      setRespondiendoId(null);
    }
  };

  return (
    <PantallaPendientes
      titulo="Solicitudes de amistad"
      textoVacio="Cuando alguien quiera sumarte como amigo, lo vas a ver acá."
      cargar={cargar}
      onCantidad={setSolicitudesPendientesCount}
      renderItem={(s, quitar) => (
        <FilaNotificacion
          nombre={s.solicitante.nombre}
          usuarioId={s.solicitante.id}
          mensaje={
            <>
              <Destacado>{s.solicitante.nombre}</Destacado> quiere agregarte como amigo
            </>
          }
          meta={formatearHaceCuanto(s.created_at)}
          etiquetaAceptar="Aceptar"
          procesando={respondiendoId === s.id}
          onAceptar={() => void responder(s, 'aceptar', quitar)}
          onRechazar={() => void responder(s, 'rechazar', quitar)}
          onPressAvatar={() =>
            router.push({
              pathname: '/usuario/[usuarioId]',
              params: { usuarioId: s.solicitante.id },
            })
          }
        />
      )}
    />
  );
}
