/**
 * Copys y `order` de los tours de ayuda, centralizados para que se puedan
 * iterar sin tocar el código de cada pantalla. Cada pantalla reserva un rango
 * de 100 en `ORDEN_PANTALLA` para evitar colisiones de `order` (ver
 * `PasoAyuda.tsx` para el aislamiento real por foco).
 */

export const ORDEN_PANTALLA = {
  inicio: 100,
  grupos: 200,
  viajes: 300,
  rutas: 400,
  perfil: 500,
  viajeCrear: 600,
  viajeDetalle: 700,
  viajeLive: 800,
  viajeChecklist: 900,
  viajeAlertas: 1000,
  grupoDetalle: 1100,
  configurarRuta: 1200,
  viajeMiembros: 1300,
  viajeGastos: 1400,
  viajeMetricas: 1500,
  viajeRecap: 1600,
  viajeResumen: 1700,
  viajePrivacidad: 1800,
  viajeQr: 1900,
  grupoEditar: 2000,
  grupoMiembros: 2100,
  grupoInvitar: 2200,
} as const

export type PasoDefinicion = {
  nombre: string
  orden: number
  texto: string
}

export const AYUDA_INICIO: PasoDefinicion[] = [
  {
    nombre: 'inicio.estadisticas',
    orden: ORDEN_PANTALLA.inicio,
    texto: 'Acá vas viendo tu actividad: kilómetros, viajes y tiempo total en ruta.',
  },
  {
    nombre: 'inicio.accesos',
    orden: ORDEN_PANTALLA.inicio + 1,
    texto: 'Armá un viaje nuevo, unite escaneando un QR, o revisá todos tus viajes.',
  },
  {
    nombre: 'inicio.enCurso',
    orden: ORDEN_PANTALLA.inicio + 2,
    texto: 'Si tenés un viaje en curso, lo vas a ver destacado acá arriba para entrar directo al mapa en vivo.',
  },
]

export const AYUDA_GRUPOS: PasoDefinicion[] = [
  {
    nombre: 'grupos.segmentos',
    orden: ORDEN_PANTALLA.grupos,
    texto: 'Cambiá entre tus grupos y tus amigos con estas pestañas.',
  },
  {
    nombre: 'grupos.lista',
    orden: ORDEN_PANTALLA.grupos + 1,
    texto: 'Tocá un grupo para ver sus miembros y armar un viaje juntos.',
  },
  {
    nombre: 'grupos.fab',
    orden: ORDEN_PANTALLA.grupos + 2,
    texto: 'Creá un grupo nuevo para coordinar viajes con tu gente.',
  },
]

export const AYUDA_VIAJES: PasoDefinicion[] = [
  {
    nombre: 'viajes.header',
    orden: ORDEN_PANTALLA.viajes,
    texto: 'Escaneá un QR para unirte a un viaje, o revisá tus invitaciones pendientes acá.',
  },
  {
    nombre: 'viajes.tabs',
    orden: ORDEN_PANTALLA.viajes + 1,
    texto: 'Alterná entre tus próximos viajes y los que ya terminaron.',
  },
  {
    nombre: 'viajes.filtros',
    orden: ORDEN_PANTALLA.viajes + 2,
    texto: 'Buscá por nombre o filtrá por actividad y tu rol en el viaje.',
  },
  {
    nombre: 'viajes.nuevo',
    orden: ORDEN_PANTALLA.viajes + 3,
    texto: 'Creá un viaje nuevo para organizar tu próxima salida.',
  },
]

export const AYUDA_RUTAS: PasoDefinicion[] = [
  {
    nombre: 'rutas.segmentos',
    orden: ORDEN_PANTALLA.rutas,
    texto: 'Alterná entre tus rutas guardadas y explorar rutas públicas de la comunidad.',
  },
  {
    nombre: 'rutas.panel',
    orden: ORDEN_PANTALLA.rutas + 1,
    texto: 'Tocá una ruta para usarla como base de un viaje nuevo.',
  },
]

export const AYUDA_PERFIL: PasoDefinicion[] = [
  {
    nombre: 'perfil.stats',
    orden: ORDEN_PANTALLA.perfil,
    texto: 'Tocá cualquier número para ir directo a esa sección: viajes, grupos, amigos o rutas.',
  },
  {
    nombre: 'perfil.datos',
    orden: ORDEN_PANTALLA.perfil + 1,
    texto: 'Editá tu nombre, apellido, teléfono y actividad preferida.',
  },
  {
    nombre: 'perfil.privacidad',
    orden: ORDEN_PANTALLA.perfil + 2,
    texto: 'Gestioná qué compartís de tu ubicación en cada viaje.',
  },
]

export const AYUDA_VIAJE_CREAR: PasoDefinicion[] = [
  {
    nombre: 'crear.actividad',
    orden: ORDEN_PANTALLA.viajeCrear,
    texto: 'Elegí la actividad: cambia la velocidad esperada, la separación máxima del grupo y las alertas.',
  },
  {
    nombre: 'crear.modalidad',
    orden: ORDEN_PANTALLA.viajeCrear + 1,
    texto: 'Armalo solo o invitá gente desde el arranque.',
  },
  {
    nombre: 'crear.fecha',
    orden: ORDEN_PANTALLA.viajeCrear + 2,
    texto: 'Elegí cuándo sale el viaje. Tiene que ser una fecha futura.',
  },
  {
    nombre: 'crear.invitar',
    orden: ORDEN_PANTALLA.viajeCrear + 3,
    texto: 'Sumá grupos completos o amigos sueltos; cada uno recibe una invitación para confirmar.',
  },
]

export const AYUDA_VIAJE_DETALLE: PasoDefinicion[] = [
  {
    nombre: 'viajeDetalle.mapa',
    orden: ORDEN_PANTALLA.viajeDetalle,
    texto: 'Tocá el mapa para configurar o revisar el recorrido planificado.',
  },
  {
    nombre: 'viajeDetalle.stats',
    orden: ORDEN_PANTALLA.viajeDetalle + 1,
    texto: 'Distancia, hora y fecha del viaje. Tocá la hora o la fecha para editarlas.',
  },
  {
    nombre: 'viajeDetalle.acciones',
    orden: ORDEN_PANTALLA.viajeDetalle + 2,
    texto: 'Invitá gente, armá el checklist de preparativos o llevá las cuentas de gastos compartidos.',
  },
  {
    nombre: 'viajeDetalle.principal',
    orden: ORDEN_PANTALLA.viajeDetalle + 3,
    texto: 'Acá abajo tenés la acción principal: iniciar el viaje, entrar al mapa en vivo, o salir.',
  },
]

export const AYUDA_VIAJE_LIVE: PasoDefinicion[] = [
  {
    nombre: 'live.mapa',
    orden: ORDEN_PANTALLA.viajeLive,
    texto: 'Acá ves en vivo a todo el grupo en el mapa. Tu posición y la del resto se actualizan solas.',
  },
  {
    nombre: 'live.encabezado',
    orden: ORDEN_PANTALLA.viajeLive + 1,
    texto: 'El nombre del viaje, la próxima parada y quién está en el grupo. Tocá para expandir.',
  },
  {
    nombre: 'live.alertas',
    orden: ORDEN_PANTALLA.viajeLive + 2,
    texto: 'Si hay un problema (pinchadura, accidente, parada), avisá al grupo acá. Todos lo ven al instante.',
  },
  {
    nombre: 'live.panel',
    orden: ORDEN_PANTALLA.viajeLive + 3,
    texto: 'Tiempo y distancia del viaje, y los botones para detenerte o finalizar.',
  },
]

export const AYUDA_VIAJE_CHECKLIST: PasoDefinicion[] = [
  {
    nombre: 'checklist.lista',
    orden: ORDEN_PANTALLA.viajeChecklist,
    texto: 'Marcá lo que ya tenés listo antes de salir. Lo que agrega el líder "para todos" aparece acá también.',
  },
  {
    nombre: 'checklist.agregar',
    orden: ORDEN_PANTALLA.viajeChecklist + 1,
    texto: 'Agregá lo que no querés olvidarte antes de salir.',
  },
  {
    nombre: 'checklist.importar',
    orden: ORDEN_PANTALLA.viajeChecklist + 2,
    texto: 'Traé el checklist completo de otro viaje para no armarlo de nuevo.',
  },
]

export const AYUDA_VIAJE_ALERTAS: PasoDefinicion[] = [
  {
    nombre: 'alertas.lista',
    orden: ORDEN_PANTALLA.viajeAlertas,
    texto: 'Historial de alertas del viaje: desvíos, atrasos, incidentes y avisos manuales.',
  },
  {
    nombre: 'alertas.nueva',
    orden: ORDEN_PANTALLA.viajeAlertas + 1,
    texto: 'Creá una alerta manual para avisarle algo al grupo durante el viaje.',
  },
]

export const AYUDA_GRUPO_DETALLE: PasoDefinicion[] = [
  {
    nombre: 'grupo.stats',
    orden: ORDEN_PANTALLA.grupoDetalle,
    texto: 'Cuántos son, cuántos viajes hicieron juntos y desde cuándo existe el grupo.',
  },
  {
    nombre: 'grupo.nuevoViaje',
    orden: ORDEN_PANTALLA.grupoDetalle + 1,
    texto: 'Armá un viaje nuevo para este grupo en un toque.',
  },
  {
    nombre: 'grupo.miembros',
    orden: ORDEN_PANTALLA.grupoDetalle + 2,
    texto: 'Mirá quién está en el grupo y qué rol tiene cada uno.',
  },
  {
    nombre: 'grupo.invitar',
    orden: ORDEN_PANTALLA.grupoDetalle + 3,
    texto: 'Como líder, podés sumar gente nueva por usuario o invitando desde otro grupo.',
  },
]

export const AYUDA_CONFIGURAR_RUTA: PasoDefinicion[] = [
  {
    nombre: 'configurarRuta.mapa',
    orden: ORDEN_PANTALLA.configurarRuta,
    texto: 'Tocá el mapa para marcar origen, destino o paradas intermedias.',
  },
  {
    nombre: 'configurarRuta.estilo',
    orden: ORDEN_PANTALLA.configurarRuta + 1,
    texto: 'Cambiá el estilo del mapa si te cuesta ver el recorrido.',
  },
  {
    nombre: 'configurarRuta.hoja',
    orden: ORDEN_PANTALLA.configurarRuta + 2,
    texto: 'Acá vas agregando y ordenando origen, paradas y destino. Guardá cuando esté listo.',
  },
]

export const AYUDA_VIAJE_MIEMBROS: PasoDefinicion[] = [
  {
    nombre: 'viajeMiembros.lista',
    orden: ORDEN_PANTALLA.viajeMiembros,
    texto: 'Quién confirmó, quién está pendiente y quién salió del viaje. El badge te dice el estado de cada uno.',
  },
]

export const AYUDA_VIAJE_GASTOS: PasoDefinicion[] = [
  {
    nombre: 'gastos.lista',
    orden: ORDEN_PANTALLA.viajeGastos,
    texto: 'Los gastos que se van registrando, quién pagó cada uno y entre cuántos se reparte.',
  },
  {
    nombre: 'gastos.agregar',
    orden: ORDEN_PANTALLA.viajeGastos + 1,
    texto: 'Registrá un gasto: monto, descripción, y elegí entre quiénes se reparte.',
  },
]

export const AYUDA_VIAJE_METRICAS: PasoDefinicion[] = [
  {
    nombre: 'metricas.hero',
    orden: ORDEN_PANTALLA.viajeMetricas,
    texto: 'El detalle completo de tu recorrido: distancia, tiempo, velocidad y gráficos si fue un entrenamiento.',
  },
  {
    nombre: 'metricas.recorrido',
    orden: ORDEN_PANTALLA.viajeMetricas + 1,
    texto: 'Distancia total, duración y tiempo que estuviste realmente en movimiento.',
  },
]

export const AYUDA_VIAJE_RECAP: PasoDefinicion[] = [
  {
    nombre: 'recap.criterios',
    orden: ORDEN_PANTALLA.viajeRecap,
    texto: 'Cambiá el criterio para ver el ranking por distancia, ritmo o tiempo en movimiento.',
  },
  {
    nombre: 'recap.podio',
    orden: ORDEN_PANTALLA.viajeRecap + 1,
    texto: 'Quién va primero en el criterio que elegiste.',
  },
]

export const AYUDA_VIAJE_RESUMEN: PasoDefinicion[] = [
  {
    nombre: 'resumen.mapa',
    orden: ORDEN_PANTALLA.viajeResumen,
    texto: 'El trazado real que hizo el grupo, no el planificado.',
  },
  {
    nombre: 'resumen.elViaje',
    orden: ORDEN_PANTALLA.viajeResumen + 1,
    texto: 'Totales del viaje completo: duración, distancia recorrida e integrantes.',
  },
  {
    nombre: 'resumen.metricasCta',
    orden: ORDEN_PANTALLA.viajeResumen + 2,
    texto: 'Entrá acá para ver tus métricas individuales con más detalle y gráficos.',
  },
]

export const AYUDA_VIAJE_PRIVACIDAD: PasoDefinicion[] = [
  {
    nombre: 'privacidad.switch',
    orden: ORDEN_PANTALLA.viajePrivacidad,
    texto: 'Prendé o apagá si el grupo ve tu posición en este viaje. Tu GPS se sigue guardando igual para tus métricas.',
  },
  {
    nombre: 'privacidad.consentimiento',
    orden: ORDEN_PANTALLA.viajePrivacidad + 1,
    texto: 'Sin aceptar este consentimiento, tu posición no se comparte aunque el interruptor esté prendido.',
  },
  {
    nombre: 'privacidad.accesos',
    orden: ORDEN_PANTALLA.viajePrivacidad + 2,
    texto: 'Quién accedió a tu ubicación y cuándo, agrupado en ventanas de 10 minutos.',
  },
]

export const AYUDA_VIAJE_QR: PasoDefinicion[] = [
  {
    nombre: 'qr.codigo',
    orden: ORDEN_PANTALLA.viajeQr,
    texto: 'Que el resto escanee este código con la cámara o desde la app para sumarse al viaje.',
  },
  {
    nombre: 'qr.compartir',
    orden: ORDEN_PANTALLA.viajeQr + 1,
    texto: 'O mandá el enlace o la imagen del QR por cualquier app.',
  },
]

export const AYUDA_GRUPO_EDITAR: PasoDefinicion[] = [
  {
    nombre: 'grupoEditar.zonaPeligro',
    orden: ORDEN_PANTALLA.grupoEditar,
    texto: 'Abandonar o eliminar el grupo son acciones permanentes y no se pueden deshacer.',
  },
]

export const AYUDA_GRUPO_MIEMBROS: PasoDefinicion[] = [
  {
    nombre: 'grupoMiembros.lista',
    orden: ORDEN_PANTALLA.grupoMiembros,
    texto: 'Como líder, tocá los tres puntos junto a cualquier integrante para cambiar su rol.',
  },
]

export const AYUDA_GRUPO_INVITAR: PasoDefinicion[] = [
  {
    nombre: 'grupoInvitar.buscador',
    orden: ORDEN_PANTALLA.grupoInvitar,
    texto: 'Buscá por nombre para invitar a cualquier usuario de la plataforma, no solo a tus amigos.',
  },
  {
    nombre: 'grupoInvitar.lista',
    orden: ORDEN_PANTALLA.grupoInvitar + 1,
    texto: 'Invitá directamente, o primero agregalo de amigo si todavía no lo es.',
  },
]
