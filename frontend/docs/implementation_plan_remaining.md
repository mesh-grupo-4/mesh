# Implementación de Nuevas Funcionalidades (Fase 2)

Este plan de implementación detalla el desarrollo de las pantallas, flujos e integraciones que **aún no están implementados o son marcadores de posición (placeholders)** en la app Mesh, completando la visión funcional premium planteada en el prototipo de Claude Design.

## User Review Required

> [!WARNING]
> - **Integración de Mapas en Tiempo Real**: La migración de `live.tsx` requerirá enriquecer la página HTML de Leaflet actual en el WebView para recibir coordenadas dinámicas de múltiples ciclistas/conductores vía WebSockets, graficarlos en tiempo real y mostrar líneas de conexión ("mesh links") visuales.
> - **Navegación y Rutas**: Se añadirá la nueva pestaña de "Viajes" (`viajes.tsx`) al Tab Navigator de Expo Router, lo que requiere actualizar `_layout.tsx` de la carpeta `(tabs)`.

---

## Proposed Changes

### 1. Pantalla de Bienvenida y Onboarding

#### [NEW] [onboarding.tsx](file:///Users/joaquinpenafort/Documents/mesh/frontend/app/(auth)/onboarding.tsx)
- Crear la pantalla de inicio del flujo de autenticación.
- Añadir el componente de fondo animado `MeshBackdrop` usando `react-native-reanimated` o una vista SVG dinámica que simule los nodos moviéndose a la deriva por la red.
- Mostrar el badge animado "EN VIVO · GRUPAL", el título descriptivo "Rodá en grupo. Sin perder a nadie." y los botones de acción para "Crear cuenta" e "Ingresar".

---

### 2. Tablero de Inicio / Dashboard Principal

#### [MODIFY] [index.tsx](file:///Users/joaquinpenafort/Documents/mesh/frontend/app/(tabs)/index.tsx)
- Reemplazar la vista "Próximamente" por la pantalla de inicio del mock:
  - **Cabecera**: Logotipo de la app, botón para abrir el escáner y botón de notificaciones con punto de alerta.
  - **Widget de Viaje Activo (En Vivo)**: Sección que aparece arriba solo si hay un viaje actual con estado `en_curso`, con fondo degradado animado, distancia recorrida, avatar stack de los participantes y botón para abrir el mapa en vivo.
  - **Acciones Rápidas**: Dos tarjetas en paralelo para "Nuevo viaje" (redirige al wizard de creación) y "Unirme por QR" (redirige al escáner).
  - **Próximos Viajes**: Listado con las próximas salidas planificadas.
  - **Mis Grupos**: Listado de acceso directo a los grupos del usuario.

---

### 3. Pestaña de Historial y Lista de Viajes

#### [NEW] [viajes.tsx](file:///Users/joaquinpenafort/Documents/mesh/frontend/app/(tabs)/viajes.tsx)
- Crear una nueva pestaña para el listado de viajes.
- Implementar la barra superior con los chips de filtro ("Todos", "En curso", "Próximos", "Pasados").
- Mostrar las tarjetas de viajes detallando: tipo de actividad con icono, título, grupo organizador, badge de estado, trayecto (origen → destino), fecha y hora, avatares de participantes, distancia en kilómetros y duración.
- Incluir un botón de acción flotante (FAB) para iniciar la creación de un viaje.

#### [MODIFY] [_layout.tsx](file:///Users/joaquinpenafort/Documents/mesh/frontend/app/(tabs)/_layout.tsx)
- Agregar la pestaña `viajes` al menú inferior del Tab Navigator, asignando el ícono correspondiente y su etiqueta.

---

### 4. Asistente para la Creación de Viajes (Wizard)

#### [MODIFY] [crear.tsx](file:///Users/joaquinpenafort/Documents/mesh/frontend/app/viaje/crear.tsx)
- Transformar la pantalla simple en un asistente de 3 pasos con indicador de progreso superior:
  - **Paso 1: ¿Qué van a hacer?**: Selección de la actividad (Moto, Bici, Running, Trekking) en cuadrícula de tarjetas de gran tamaño.
  - **Paso 2: El recorrido**: Formulario para definir el punto de salida, destino, fecha y hora del viaje.
  - **Paso 3: ¿Quiénes van?**: Configuración de modalidad (Individual o Grupal con selección multiselección de los grupos disponibles).
- Al finalizar, enviar la petición al backend y redirigir al usuario a la pantalla de invitación QR del viaje.

---

### 5. Tablero de Control y Mapa en Tiempo Real (Live Tracking)

#### [MODIFY] [live.tsx](file:///Users/joaquinpenafort/Documents/mesh/frontend/app/viaje/[viajeId]/live.tsx)
- Reemplazar la lista de texto plano por el panel de tracking avanzado en tiempo real:
  - **Mapa de Leaflet Embebido**: Integrar el mapa de OpenStreetMap en el WebView. Graficar la línea de ruta y los marcadores de posición dinámicos de cada participante (identificados por sus iniciales y estado en colores verde/naranja/rojo).
  - **Panel de Estadísticas Flotante**: Mostrar en la parte superior el ritmo del usuario actual, kilómetros faltantes, tiempo estimado de arribo (ETA) y la posición relativa en el grupo.
  - **Hoja Deslizable (Bottom Sheet)**: Fila con el número total de participantes al día y lista deslizable que detalla la velocidad de cada uno, avance en kilómetros y estado en tiempo real.
  - **Alerta de Incidentes / Detenciones**: Banner llamativo de alerta roja cuando el backend notifica que un integrante se detuvo sin previo aviso, proporcionando el botón de acción rápida para llamarlo telefónicamente.
  - **Botón de Fin de Viaje**: Botón exclusivo para el líder que permite dar por terminado el viaje y detener el seguimiento GPS de fondo.

---

## Verification Plan

### Manual Verification
1. Probar el flujo de onboarding y navegación entre las 4 pestañas en el dispositivo.
2. Simular un viaje en curso en el backend y verificar que aparezca correctamente el widget con degradado coral en el inicio.
3. Crear un viaje usando el nuevo asistente de 3 pasos, configurando salida/destino y seleccionando un grupo piloto.
4. Ingresar a la pantalla de seguimiento en vivo con múltiples emuladores/dispositivos (o inyectando posiciones GPS de prueba al WebSocket) y comprobar:
   - Los marcadores se mueven dinámicamente sobre el mapa Leaflet.
   - Las líneas punteadas de la red ("mesh links") se dibujan correctamente desde la posición del usuario actual.
   - El panel de estadísticas calcula correctamente la distancia restante y el ETA.
   - Las detenciones simuladas disparan de inmediato el banner de alerta roja de forma visualmente atractiva.
5. Presionar "Finalizar viaje" como líder y verificar que todos los clientes dejen de enviar ubicaciones y sean redirigidos.
