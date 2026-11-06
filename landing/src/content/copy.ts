// Todo el texto de la landing. Antes de cambiarlo, revisar el plan, sección 2:
// veracidad, seguridad vial y privacidad tienen prioridad sobre cualquier idea creativa.
import type { ActividadId } from '../config/actividades'

export const AVISO_SEGURIDAD =
  'Mesh ayuda a coordinar al grupo. No reemplaza a los servicios de emergencia ni garantiza la detección de incidentes: necesita GPS, batería y conexión para que los avisos lleguen. Ante una emergencia, llamá al 911.'

export const ROTULO_EJEMPLO = 'Simulación con datos de ejemplo'
export const ESLOGAN = 'Salen juntos. Llegan juntos.'

export const SEO = {
  titulo: 'Mesh · La app para salir en grupo y llegar todos juntos',
  descripcion:
    'Todo tu grupo en un solo mapa, con avisos automáticos si alguien se desvía, se atrasa o se queda quieto. Para moto, bici, running y trekking.',
}

export const NAV = {
  hitos: [
    { texto: 'Salida', href: '#inicio' },
    { texto: 'El problema', href: '#problema' },
    { texto: 'Probalo', href: '#simulador' },
    { texto: 'Tu actividad', href: '#actividades' },
    { texto: 'Llegada', href: '#llegada' },
  ],
}

export const CTA = {
  principal: 'Bajá Mesh',
  avisame: 'Avisame cuando esté',
  mirar: 'Mirá cómo funciona',
  apk: 'Descargar para Android (APK)',
  apkNota: 'Al abrir el archivo, Android te pide permitir la instalación desde el navegador.',
  googlePlay: 'Bajala en Google Play',
  appStore: 'Bajala en la App Store',
  proxAndroid: 'Próximamente en Android',
  proxIos: 'Próximamente en iPhone',
  compartir: 'Pasáselo al grupo',
  compartido: 'Link copiado',
  qr: 'Apuntá con la cámara',
}

export const HERO = {
  etiqueta: 'Para salir en grupo · Moto · Bici · Running · Trekking',
  h1: ['¿Y', 'el', 'Gonza?'],
  sub: 'Mesh muestra a todo tu grupo en un solo mapa y avisa solo si alguien se desvía, se atrasa o se queda quieto sin avisar.',
  cta2: 'Probalo acá, sin instalar nada ↓',
  pie: ESLOGAN,
  alerta: 'Gonza quedó atrás · 450 m',
}

export const PROBLEMA = {
  etiqueta: 'Km 0 · Lo que pasa siempre',
  h2: 'Toda salida grupal tiene este chat.',
  chatTitulo: 'Salida del domingo',
  chatSub: '6 integrantes',
  mensajes: [
    ['Cami', '¿Dónde están?'],
    ['Nico', 'Paramos en la estación'],
    ['Cami', '¿Cuál estación?'],
    ['Flor', 'Yo sigo, los espero en el puente'],
    ['Tomi', '¿Qué puente?'],
    ['Nico', '¿Alguien vio al Gonza?'],
    ['Vale', 'Estaba atrás tuyo'],
    ['Nico', 'Atrás mío no hay nadie'],
    ['Cami', 'Lo llamo'],
    ['Cami', 'No contesta'],
    ['Flor', 'Se ve que se quedó sin señal'],
    ['Gonza', 'Che, ¿para dónde agarraron?'],
    ['Gonza', 'Ya estoy en Mina Clavero'],
    ['Nico', 'Gonza, salimos para Carlos Paz'],
  ] as const,
  remate: 'Una salida. 14 mensajes. Cero idea de dónde está cada uno.',
  pie: 'Así no se coordina. Así se pierde media mañana.',
}

export const COMO = {
  etiqueta: 'Posta 1 · Cómo funciona',
  h2: 'Del "arrancamos" al "llegamos" en cuatro pasos.',
  pasos: [
    { titulo: 'Armá la salida', texto: 'Ruta con paradas, o Viaje YA y salís en un par de toques.' },
    { titulo: 'Sumá al grupo', texto: 'Muestran el QR, escanean y listo. Sin alta de contactos, sin esperar a nadie.' },
    { titulo: 'Salgan', texto: 'Todos en un solo mapa. Si pasa algo, Mesh avisa solo.' },
    { titulo: 'Lleguen', texto: 'Se cierra el viaje y queda el resumen de la salida, listo.' },
  ],
}

export const SIM = {
  etiqueta: 'Posta 2 · Probalo acá',
  h2: 'Jugá a ser líder. Armá lío.',
  sub: 'Tocá una situación y mirá qué haría Mesh.',
  leyendaSinJs:
    'El mapa muestra a seis integrantes de ejemplo sobre una ruta por las sierras. Con JavaScript activado podés provocar cuatro situaciones: un desvío, un atraso, una parada avisada y una detención sin aviso. Mesh avisa según corresponda en cada caso.',
  mapaDescripcion: 'Mapa de ejemplo de una ruta por las sierras con seis integrantes y las líneas que los unen.',
  telefono: 'Teléfono del líder',
  sinAvisos: 'Sin novedades. Provocá algo.',
  meta: 'Esto, pero con tu grupo de verdad.',
  contador: 'situaciones',
  situaciones: {
    desvio: {
      boton: 'Gonza agarra para cualquier lado',
      aviso: 'Gonza se desvió de la ruta',
      destino: 'Le llega al líder',
      salida: 'Que vuelva',
      chip: 'Se desvió',
    },
    atraso: {
      boton: 'Flor se queda atrás',
      aviso: 'Flor quedó lejos del grupo',
      destino: 'Le llega al líder',
      salida: 'Esperarla',
      chip: 'Lejos',
    },
    parada: {
      boton: 'Nico para a cargar nafta',
      aviso: 'Nico paró · Combustible',
      destino: 'Le llega al grupo',
      salida: 'Reanudar',
      chip: 'Parada',
      nota: 'Avisó, así que nadie se preocupa.',
      categorias: ['Combustible', 'Comida', 'Descanso'],
    },
    incidente: {
      boton: 'Cami se queda quieta sin avisar',
      aviso: 'Posible incidente · Cami',
      detalle: 'Con su ubicación en el mapa',
      destino: 'Le llega a todo el grupo',
      chip: 'Posible incidente',
      cartel: '3 min después',
      pregunta: '¿Estás bien?',
      preguntaDetalle: 'Quedaste detenida unos minutos sin marcar una parada.',
      telefonoCami: 'En el teléfono de Cami',
      bien: 'Estoy bien',
      mal: 'Estoy mal',
      avisoBien: 'Cami está bien · aviso cancelado',
      avisoMal: 'Peligro · Cami pidió ayuda',
      notaMal: 'Mesh avisa a tu grupo. Ante una emergencia, llamá al 911.',
      cerrar: 'Volver al viaje',
    },
  },
}

export const TRANSICION = 'No es lo mismo salir en moto que salir a correr. Mesh tampoco.'

export const ACT = {
  etiqueta: 'Posta 3 · Tu actividad',
  h2: '¿En qué salís?',
  selector: 'Elegí tu actividad',
  pie: 'Valores iniciales. El líder los ajusta en cada viaje.',
  etiquetas: {
    separacion: 'Separación antes de avisar',
    tolerancia: 'Tolerancia de atraso',
    detencion: 'Detención antes de preguntar',
    feedback: 'Feedback',
  },
  frases: {
    moto: { frase: 'Con guantes, al sol y sin distraerte.', detalle: 'Pantalla completa, alto contraste, botones extra grandes.' },
    bici: { frase: 'Un pelotón es un organismo.', detalle: 'Si alguien pincha, te enterás antes de la próxima loma.' },
    running: { frase: 'Mirá para adelante. Mesh vibra.', detalle: 'La vibración manda; la pantalla acompaña.' },
    trekking: { frase: 'Donde se acaba la señal, seguís sumando metros.', detalle: 'Tu recorrido se guarda aunque no haya conexión.' },
  } satisfies Record<ActividadId, { frase: string; detalle: string }>,
}

export const OFFLINE = {
  etiqueta: 'Posta 4 · Sin señal',
  h2: 'Se acabó la señal. Tu recorrido, no.',
  sub: 'Sin conexión, Mesh guarda tu recorrido en el teléfono y lo sincroniza solo al volver.',
  contador: 'Guardados en el teléfono',
  puntos: 'puntos',
  sinSenal: 'Sin señal',
  conSenal: 'Con señal',
  sincronizado: 'Sincronizado ✓',
  vinetas: [
    { titulo: 'Con señal', texto: 'Gonza avanza por la ruta y el grupo lo ve en el mapa.' },
    { titulo: 'Sin señal', texto: 'Entra en las sierras. Para el resto del grupo, su rueda queda atenuada.' },
    { titulo: 'Se guarda', texto: 'Sigue andando. Guardados en el teléfono: 72 puntos, uno cada 5 segundos.' },
    { titulo: 'Sincronizado ✓', texto: 'Vuelve la señal, los puntos viajan al mapa y la línea queda completa.' },
  ],
  remate: 'Cero metros perdidos.',
  pie: 'Mientras no hay conexión, el grupo no recibe tu posición en vivo ni los avisos que dependen de ella. Apenas volvés, se pone al día.',
}

export const PRIV = {
  etiqueta: 'Posta 5 · Tu ubicación',
  h2: 'Vos decidís quién te ve.',
  interruptor: 'Compartir mi ubicación',
  mapaGrupo: 'Mapa del grupo',
  mapaDescripcion: 'Mapa de ejemplo del grupo. Tu rueda aparece solo si compartís tu ubicación.',
  encendido: 'El grupo te ve en el mapa.',
  apagado: 'El grupo no te ve.',
  contador: 'Tu recorrido, guardado solo para vos',
  consecuencia: 'Con el compartir apagado, el grupo no te ve y Mesh no genera alertas sobre vos.',
  puntos: [
    { icono: 'map-pin', titulo: 'Solo durante el viaje.', texto: 'Tu posición se lee cada 5 segundos mientras el viaje está en curso. Termina, y deja de leerse.' },
    { icono: 'users', titulo: 'Solo tu grupo de ese viaje.', texto: 'Ninguna otra persona.' },
    { icono: 'eye-off', titulo: 'Viaje por viaje.', texto: 'Lo apagás cuando quieras, y nadie puede decidirlo por vos. Ni el líder.' },
    { icono: 'list', titulo: 'Sin secretos.', texto: 'Podés consultar quién accedió a tu posición.' },
  ],
}

export const BENTO = {
  etiqueta: 'Posta 6 · Y además',
  h2: 'Todo lo que una salida necesita. Y nada que estorbe.',
  celdas: [
    { id: 'viaje-ya', tam: 'grande', titulo: 'Viaje YA', texto: '¿Salen ahora? Sin planificar nada. Elegí actividad y arrancá.' },
    { id: 'clima', tam: 'mediana', titulo: '¿Llueve?', texto: 'Pronóstico de lluvia y viento sobre tu ruta, antes de salir.' },
    { id: 'qr', tam: 'mediana', titulo: 'Sumá con un QR', texto: 'Sin invitar uno por uno.' },
    { id: 'paradas', tam: 'grande', titulo: 'Paradas que no dispersan', texto: 'Combustible, comida, descanso. Un toque y el grupo sabe por qué paraste.' },
    { id: 'pedido', tam: 'chica', titulo: 'Pedí parada', texto: 'El líder aprueba o rechaza. Se acabó el "¿paramos?" en el chat.' },
    { id: 'checklist', tam: 'mediana', titulo: 'Checklist', texto: 'Que nadie se olvide nada. Sugerido por actividad.' },
    { id: 'gastos', tam: 'mediana', titulo: 'Gastos', texto: 'Dividan la nafta y el asado, sin planilla.' },
    { id: 'comunidad', tam: 'grande', titulo: 'Recorridos de la comunidad', texto: 'Encontrá rutas cerca tuyo, mirá cuánto las recomiendan e importalas.' },
    { id: 'insignias', tam: 'chica', titulo: 'Insignias y rachas', texto: 'Por kilómetros y constancia, nunca por velocidad.' },
    { id: 'resumen', tam: 'mediana', titulo: 'El resumen de la salida', texto: 'Distancia, tiempo y paradas al cerrar el viaje.' },
  ],
}

export const COMPETIR = {
  etiqueta: 'Posta 7 · Competir',
  h2a: '¿Competir? Sí.',
  h2b: 'En moto, nunca.',
  primero:
    'En bici, running o trekking, activá el modo competitivo: tabla en vivo, posiciones, y hasta un fantasma de tu recorrido anterior para correrle a tu mejor versión.',
  tablaTitulo: 'Salida en bici · Tabla en vivo',
  tabla: [
    ['Flor', 'Adelante'],
    ['Nico', 'a 120 m'],
    ['Vale', 'a 180 m'],
    ['Cami', 'a 260 m'],
    ['Tomi', 'a 410 m'],
    ['Gonza', 'a 1,3 km'],
  ] as const,
  gonza: 'Gonza, último. Pero contento.',
  manifiesto: ['En moto no hay rankings, ni tablas, ni fantasma.', 'No es un olvido: es una decisión.', 'En la ruta, la única meta es volver a casa.'],
}

export const DIFERENCIA = {
  etiqueta: 'Posta 8 · Por qué Mesh',
  h2: 'Tu app de siempre mira al que corre. Mesh mira al grupo.',
  columnas: ['Cuando...', 'Sin Mesh', 'Con Mesh'],
  filas: [
    ['Querés saber dónde está cada uno', 'Preguntás en el chat y esperás', 'Todos en un solo mapa'],
    ['Alguien se sale de la ruta', 'Te enterás en la próxima parada', 'Avisa solo al líder'],
    ['Alguien queda lejos del grupo', 'Nadie lo nota hasta que falta', 'Avisa solo al líder'],
    ['Alguien para a cargar nafta', 'Nadie sabe por qué se frenó', 'Un toque y el grupo sabe el motivo'],
    ['Alguien se queda quieto sin avisar', 'Llamadas que nadie contesta', 'Mesh le pregunta y avisa al grupo'],
    ['Se suma gente a la salida', 'Invitar uno por uno', 'Escanean el QR y listo'],
  ],
}

export const FAQ_TITULO = { etiqueta: 'Última posta · Preguntas', h2: 'Lo que te falta saber.' }

/** La pregunta sobre teléfonos se completa en Faq.astro desde la configuración de descarga. */
export const FAQ = [
  ['¿Tienen que tener Mesh todos?', 'Para aparecer en el mapa, sí. Pero entrar es fácil: escanean el QR y se suman.'],
  ['¿Y si en la ruta no hay señal?', 'Tu recorrido se guarda en el teléfono y se sincroniza solo cuando vuelve la conexión. Mientras tanto, el grupo no recibe tu posición en vivo ni los avisos que dependen de ella.'],
  ['¿Quién ve dónde estoy?', 'Solo las personas confirmadas en ese viaje, y solo mientras está en curso. Podés apagarlo cuando quieras, y consultar quién accedió a tu posición.'],
  ['¿Si apago el compartir, sigo protegido por las alertas?', 'No. Con el compartir apagado, Mesh no genera alertas automáticas sobre vos, porque incluirían tu ubicación.'],
  ['¿Detecta accidentes?', 'Detecta si alguien queda detenido varios minutos sin marcar una parada: le pregunta si está bien y avisa al grupo. No reemplaza a los servicios de emergencia. Ante una emergencia, llamá al 911.'],
  ['¿Hay rankings en moto?', 'No, ni los va a haber. La competencia de velocidad en moto no tiene lugar en Mesh.'],
  ['¿Gasta mucha batería?', 'Mesh usa el GPS cada 5 segundos durante el viaje, así que consume más que una app común. Para salidas largas, llevá un cargador.'],
  ['¿Sirve solo para grupos grandes?', 'No. De dos amigos a una caravana entera. También podés registrar una salida individual.'],
  ['¿Puede usarla un menor de 18?', 'Por ahora no. Mesh es solo para mayores de 18 años.'],
] as const

export const FAQ_TELEFONOS = '¿En qué teléfonos funciona?'

export const LLEGADA = {
  falta: 'Falta uno.',
  grande: 'Llegó el Gonza. Ahora sí.',
  h2: 'Tu próxima salida, con todos.',
  sub: 'Bajá Mesh, armá el viaje y mandales el QR.',
  subSinDescarga: 'Muy pronto: bajá Mesh, armá el viaje y mandales el QR.',
  pie: ESLOGAN,
}

export const FOOTER = {
  linea: 'Mesh · Proyecto Final 2026 · UTN FRC · Grupo 4 · Curso 5K1',
  edad: 'Disponible para mayores de 18 años.',
  pausar: 'Pausar animaciones',
  reanudar: 'Reanudar animaciones',
  atribucion: 'Tipografías Bricolage Grotesque, Plus Jakarta Sans y Space Mono (OFL). Iconos Feather (MIT).',
}

export const ERROR_404 = {
  titulo: 'Página no encontrada · Mesh',
  h1: 'Esta ruta no existe.',
  sub: 'Ni el Gonza llegó hasta acá.',
  volver: 'Volver a Mesh',
}

export const LEGAL = {
  banner: 'Borrador. Pendiente de revisión legal',
  volver: '← Volver a Mesh',
}
