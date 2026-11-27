# Guion de la defensa — Mesh

Guion para las 31 pantallas de `index.html`. Duración objetivo: **37 minutos**, con unos 3 de margen.

- **Lo que va entre comillas se dice.** No hay que leerlo: es la idea y el tono. Mejor decirlo con
  palabras propias que recitarlo.
- **▸ clic** marca cada clic derecho. Si la pantalla tiene puntos que aparecen de a uno, cada clic
  muestra el siguiente; con el último, el próximo clic pasa de pantalla.
- La pantalla dice poco a propósito: **el detalle lo pone quien habla.** Por eso abajo hay números y
  datos que ya no están escritos en las diapositivas.
- `T` muestra el cronómetro, que arranca con el primer clic. Las marcas de tiempo `[mm:ss]` indican
  dónde conviene estar al **terminar** cada bloque.

## Reparto (propuesta, a ajustar)

Los cambios de presentador coinciden con las pantallas "Le pasamos el mouse a quien sigue".

| Bloque | Pantallas | Tiempo | Presenta |
|---|---|---|---|
| 1. El problema y la solución | 1 a 9 | 5:00 | Manuel (PO) |
| 2. Cómo lo construimos | 10 a 14 | 4:00 | Pedro (SM) |
| 3. Mesh, por dentro | 15 a 17 | 3:30 | Un dev |
| 4. Demo en vivo | 18 a 26 | 20:00 | Un narrador con el mouse y dos devs con los celulares (líder y participante) |
| 5. Cierre | 27 a 31 | 4:00 + ~2:00 del Viaje YA (a ajustar) | Un dev, Gon en el Viaje YA y Manuel en las gracias |

**Demo:** quien narra maneja el mouse y nunca toca los celulares. Quienes tienen los teléfonos
solo hacen lo que el narrador va diciendo. Para avanzar se hace clic **en los costados**: un clic sobre
la ventana de un celular es un toque en ese teléfono.

---

## Bloque 1 · El problema y la solución (1 a 9) · 5:00

### 1 · Portada — 0:20
"Buenas tardes. Somos el Grupo 4 de 5K1 y les vamos a presentar Mesh: una app de coordinación grupal en
tiempo real para salir en grupo."
▸ clic

### 2 · Salimos en grupo — 0:30
"Piensen en la última vez que salieron con otros: una vuelta en moto, una salida en bici, un trekking.
Casi nunca lo hacemos solos."
▸ clic Moto ▸ clic Bici ▸ clic Trekking ▸ clic

### 3 · Lejos de la ciudad — 0:25
"Y esas salidas pasan lejos de la ciudad: rutas de montaña, senderos, caminos de tierra. Con poca señal,
y casi nunca se ve a todo el grupo al mismo tiempo."
▸ clic

### 4 · El grupo se estira — 0:40
"Porque en el camino el grupo se estira. Y aparecen tres preguntas:"
▸ clic "¿Quién se quedó atrás?"
▸ clic "¿Quién paró a propósito, a cargar nafta o sacar una foto?"
▸ clic "¿Y quién puede estar en problemas?"
"Hoy eso se resuelve con un grupo de WhatsApp, llamadas y esperando en una banquina."
▸ clic

### 5 · Lo que hay hoy — 0:40
▸ clic "Hay muy buenas apps: Strava, Komoot, Garmin, Google Maps, Life360."
▸ clic "Pero resuelven otra cosa: el rendimiento de cada uno o cómo llegar de un punto a otro."
▸ clic "Ninguna entiende qué le pasa al grupo como conjunto."
▸ clic

### 6 · Mesh mira al grupo — 0:50
"Mesh mira al grupo. En el servidor hay un motor de eventos que compara la posición de cada integrante con
la ruta planificada y avisa solo, sin que nadie tenga que mandar un mensaje. Detecta cuatro situaciones:"
▸ clic "Un desvío de la ruta."
▸ clic "Un atraso respecto del resto del grupo."
▸ clic "Una parada avisada."
▸ clic "Y un posible incidente: alguien que quedó quieto sin avisar."
▸ clic

### 7 · Para quién — 0:35
"¿Para quién es?"
▸ clic "Para cinco actividades: moto, auto, bici, running y trekking. Cada una con sus propios parámetros."
▸ clic "Para adultos de 18 a 65 años, con foco en Córdoba."
▸ clic "Y con dos roles, nada más: el líder, que arma y guía el viaje, y los participantes."
▸ clic

### 8 · El equipo — 0:30
"Lo hicimos entre seis." (Cada uno levanta la mano cuando aparece su nombre.)
▸ clic ×6, uno por integrante
▸ clic

### 9 · Cómo lo construimos — 0:10 · **[5:00]**
"Ahora les cuento cómo lo construimos." → se pasa el mouse.
▸ clic

---

## Bloque 2 · Cómo lo construimos (10 a 14) · 4:00

### 10 · Lo que nos propusimos — 1:00
"Arrancamos en abril con un estudio inicial y una encuesta a 86 personas que salen en grupo. Lo más
pedido fue justamente esto: planificar el recorrido, saber si alguien se detiene y ver al grupo en vivo."
▸ clic "Eso se convirtió en 87 historias de usuario…"
▸ clic "…en 14 épicas…"
▸ clic "…y tuvimos un cambio de alcance, formal y acordado con el Product Owner: salieron 9 historias
deseables que dependían de servicios de terceros, como la asistencia con IA, y entraron dos épicas
nuevas: el backoffice con reportes y la ayuda en línea."
▸ clic "La regla fue siempre la misma: primero el núcleo, después lo que suma."
▸ clic

### 11 · Scrum — 0:50
"Trabajamos con Scrum, en sprints de 15 días."
▸ clic "Con ceremonias fijas: planning los lunes, review con el PO y retrospectiva."
▸ clic "Todo el backlog en Jira, estimado con Planning Poker; el código en GitHub y la comunicación en
Discord."
▸ clic "Y nada entra a la rama de desarrollo sin code review y sin cumplir la Definition of Done."
▸ clic

### 12 · 13 sprints — 0:50
(La línea se dibuja sola: dejarla terminar.)
"Fueron 13 sprints, de mayo a noviembre. Las bases en los tres primeros: usuarios, grupos, el mapa. Julio
fue receso y mesas, sin desarrollo. Del 6 al 9, el núcleo: tiempo real, alertas, offline y el backend en
la nube. En el 10 hicimos una jornada de muestra con gente real. El 11 y el 12 completaron el producto. Y
el 13 fue un sprint entero de testing."
▸ clic

### 13 · Velocity — 0:50
"Y aprendimos nuestro ritmo. Arrancamos con 11 puntos en el primer sprint y llegamos a 75 en el 11, el
sprint en que entraron las dos épicas nuevas. En total, 294 puntos, con un promedio de 24,5 por sprint.
Los huecos no son falta de trabajo: son parciales, receso, mesas y la jornada de muestra."
▸ clic

### 14 · Mesh, por dentro — 0:10 · **[9:00]**
"Ahora, cómo está hecho por dentro." → se pasa el mouse.
▸ clic

---

## Bloque 3 · Mesh, por dentro (15 a 17) · 3:30

### 15 · Arquitectura — 1:10
"La arquitectura son tres piezas y un canal en vivo. Una app móvil hecha con Expo y React Native. Un
backend en Node con Express, donde toda entrada se valida con Zod. Y una base PostgreSQL con PostGIS en
Supabase: las distancias y los desvíos se calculan en la base, no en el código. La app y el backend
hablan por Socket.io en tiempo real."
▸ clic "Alrededor: Firebase para la identidad, Google Maps para mapas y rutas, siempre desde el backend
para que las claves nunca lleguen al celular, y OpenStreetMap como respaldo automático si Google no
responde. Cada merge corre las pruebas y despliega al VPS."
▸ clic

### 16 · Motor de eventos — 1:10
"El corazón es el motor de eventos. Cada 5 segundos, cada celular manda su posición. Se valida, se
identifica a la persona y se aplica la privacidad: si alguien no dio su consentimiento o apagó el
compartir, la posición se guarda pero no se publica. Después, PostGIS mide la distancia a la ruta y el
avance de cada uno respecto del grupo. Si hace falta, sale una alerta a todos, en vivo y por notificación."
▸ clic "Así salen las cuatro alertas que vimos al principio. Y sin señal no se pierde nada: las posiciones
quedan en el teléfono y se sincronizan al volver."
▸ clic

### 17 · El producto — 1:10 · **[12:30]**
"Todo eso se traduce en un producto que acompaña la salida completa."
▸ clic "Antes: grupos con invitación por QR, el viaje planificado con clima y gastos, o el Viaje Ya para
salir en el momento."
▸ clic "Durante: el grupo en vivo en el mapa, las alertas automáticas, funciona sin señal y muestra lo que
hay cerca."
▸ clic "Después: métricas, entrenar contra tu propio fantasma, insignias y rachas, y compartir rutas. Por
seguridad vial, moto y auto quedan afuera de todo ranking y comparación de velocidad."
▸ clic "Y para la plataforma: backoffice, reportes y ayuda en cada pantalla."
"Pero mejor que contarlo es mostrarlo."
▸ clic

---

## Bloque 4 · Demo en vivo (18 a 26) · 20:00

Antes de empezar: los dos teléfonos desbloqueados, con datos y el GPS encendido; la sesión del líder
y la del participante ya iniciadas. Si algo falla, el script se maneja con las teclas de
`docs/presentacion/README.md` (`Ctrl+Alt+R` reconecta, `Ctrl+Alt+1/2` deja un solo celular).

### 18 · Ahora, en vivo — 0:30
"Tenemos dos celulares: a la izquierda, el líder; a la derecha, un participante. Vamos a recorrer ocho
flujos."
▸ clic (aparecen los 8) ▸ clic

### 19 · Demo 1: Invitación — 1:30
▸ clic Llega la invitación: "El líder invita al participante a su grupo y le llega al instante."
▸ clic Ver el grupo antes: "Antes de aceptar, ve quiénes lo forman y qué viajes tiene."
▸ clic Aceptar: "Acepta y ya es parte."
Detrás de escena: "Dentro de un grupo hay dos roles, nada más, y el backend valida el rol antes de cada
acción del líder. La pantalla solo orienta."
▸ clic

### 20 · Demo 2: Viaje planificado — 3:00
▸ clic Ruta y paradas: "El líder busca el destino, arma la ruta y agrega paradas."
▸ clic Amigos: "Invita al grupo o a amigos sueltos."
▸ clic Clima: "Ve el clima del día de la salida."
▸ clic Preparativos: "Define qué tiene que llevar cada uno."
▸ clic Gastos: "Y los gastos compartidos, para no hacer cuentas después."
Detrás de escena: "La búsqueda y el trazado van por Google Maps desde el backend; si no responde, la ruta
se calcula igual con OpenStreetMap."
▸ clic

### 21 · Demo 3: Viaje Ya — 2:00
▸ clic Salir ya: "A veces no hay nada que planificar: Viaje Ya arranca en el momento."
▸ clic Invitar: "Invita a quien quiera."
▸ clic Sumarse con QR: "O el otro escanea el QR y se suma."
▸ clic Sin ruta: "Aunque no haya ruta, el grupo se sigue igual en el mapa."
Detrás de escena: "El QR es único por viaje y vence cuando el viaje arranca. Si quien lo escanea no tiene
la app, llega a una página que lo guía."
▸ clic

### 22 · Demo 4: El viaje en vivo — 4:30 (el flujo más importante)
▸ clic El grupo en el mapa: "Los dos se ven en el mapa, en vivo."
▸ clic Una parada: "El participante avisa una parada, y el líder la ve con su motivo: nadie se alarma."
▸ clic Alerta de desvío: "Ahora se aleja de la ruta. Nadie toca nada: a los pocos segundos le llega la
alerta de desvío al líder."
▸ clic Cerca mío: "Y en el camino, qué hay cerca: combustible, comida, descanso."
Detrás de escena: "Una posición cada 5 segundos. El desvío lo detecta el motor comparando contra la ruta,
no una persona."
(Si existe `videos/demo-en-movimiento.mp4`, esta pantalla muestra la grabación de una salida real en
lugar de los celulares: se narra igual.)
▸ clic

### 23 · Demo 5: Fantasma — 2:30
▸ clic Elegir un recorrido: "Para entrenar, se elige un recorrido ya hecho."
▸ clic Salir contra el fantasma: "Y se sale contra la propia versión grabada."
▸ clic ¿Adelante o atrás?: "En vivo se ve si vas adelante o atrás de tu fantasma."
Detrás de escena: "En moto y auto no hay fantasma ni rankings, por seguridad vial. Y no es solo la
pantalla: el backend lo rechaza."
▸ clic

### 24 · Demo 6: Rutas de la comunidad — 2:00
▸ clic Compartir: "Una ruta hecha se puede compartir."
▸ clic Explorar: "Se exploran las de otros."
▸ clic Valorar: "Se valoran con Recomiendo o No recomiendo."
▸ clic Usarla de nuevo: "Y se usan como base del próximo viaje."
Detrás de escena: "Sin comentarios a propósito: no queríamos otra red social, sino rutas útiles."
▸ clic

### 25 · Demo 7: Perfil — 1:30
▸ clic Tus datos ▸ clic Estadísticas e insignias ▸ clic Privacidad
"En el perfil están los datos, la actividad, las insignias y las rachas, y la privacidad. Sin
consentimiento vigente, el backend no publica la posición. Pero el recorrido se guarda igual, para no
perderlo."
▸ clic

### 26 · Demo 8: Superadmin — 2:30 · **[32:30]**
▸ clic Usuarios, grupos y viajes: "Para operar la plataforma hay un backoffice de superadmin."
▸ clic Auditoría: "Cada acción del administrador queda auditada."
▸ clic Reportes: "Y los reportes son solo agregados: sin datos personales, sin posiciones y sin
velocidades."
"Eso es Mesh."
▸ clic (los celulares se esconden)

---

## Bloque 5 · Cierre (27 a 31) · 4:00

### 27 · Lo que nos llevamos — 0:10
→ se pasa el mouse. ▸ clic

### 28 · Conclusiones — 1:30
"Implementamos las 87 historias. No fue sin costo:"
▸ clic "El receso, las mesas y la muestra nos cortaban sprints: ajustamos la capacidad de cada uno, y la
velocidad creció igual."
▸ clic "Era un stack nuevo para casi todos: investigamos antes de implementar y repartimos las historias
entre dos o tres personas."
▸ clic "El primer mapa no alcanzaba: migramos a Google Maps y dejamos OpenStreetMap de respaldo."
▸ clic "El alcance cambió, y lo hicimos de manera formal, con el PO."
▸ clic "Las rutas no tienen señal: por eso todo es offline-first."
▸ clic "Y usamos IA como herramienta, siempre con revisión humana: entender todo lo que se integra."
▸ clic

### 29 · Lecciones — 1:00
"Si arrancáramos de nuevo…"
▸ clic "Repetiríamos: delegar la autenticación en Firebase, diseñar primero la API y desplegar temprano, y
tener un plan B para los mapas."
▸ clic "Cambiaríamos: planificar con el calendario académico desde el primer día, probar la tecnología
con datos reales antes de diseñar, y registrar cada cambio de alcance en la WBS, el cronograma y el
presupuesto."
▸ clic

### 30 · Viaje YA y la M de Mesh — Gon — ~2:00 (a ajustar)
Un celular con la app en el centro. Cada clic hace una acción en la app; lo que se dice, a definir.
▸ clic toca *Viaje YA*
▸ clic elige *Auto*
▸ clic escribe "Buen Pastor" y aparecen las sugerencias
▸ clic elige el Paseo del Buen Pastor y *Ir a este destino* → sala de espera con Gon
▸ clic se une Manuel ▸ clic Pedro ▸ clic Joaco ▸ clic Franco ▸ clic Bauti (cada uno suena y aparece su cartel)
▸ clic *Arrancar viaje*: la ruta UTN → Buen Pastor y los seis en la UTN
▸ clic la ruta se convierte en la M, el grupo la recorre y queda *MESH* con "Muchas gracias por su atención."
(La música de fondo sube con cada clic.)
▸ clic

### 31 · Gracias — 0:50 — **[37:00]**
▸ clic "A nuestros docentes, Cecilia Ortiz, María Irene Mac William y José Luis D'Agostino."
▸ clic "A quienes respondieron la encuesta y salieron a probar la app."
▸ clic "Y a nuestras familias, amigos, compañeros y a la UTN."
Queda esta pantalla para las preguntas. Al terminar: `Ctrl+Alt+Q`, y la pantalla se funde a negro.

---

## Datos a mano para las preguntas

Ya no están en las pantallas, pero pueden preguntarlos.

| Tema | Respuesta corta |
|---|---|
| **Validación** | Encuesta de abril de 2026 a 86 personas que salen en grupo. Lo más votado: planificar el recorrido en el mapa (48), aviso si alguien se detiene (47) y ver al grupo en tiempo real (45). Problemas antes de salir: demoras para arrancar (39) y falta de confirmación de asistencia (30). |
| **Presupuesto** | USD 138.358 entre mayo y noviembre. Es un proyecto académico sin gastos reales: el presupuesto dimensiona el esfuerzo. Developers: 2.121 h, USD 103.801,74 (76 %). PO: 363 h, USD 19.122,84. SM: 263 h, USD 13.854,84. Costos fijos: 1,1 %. Tarifas: USD 52,68/h para PO y SM, USD 48,94/h para developers. |
| **Riesgos** | 13 riesgos identificados. Los de mayor exposición: rechazo en las tiendas por el GPS en segundo plano (0,48), demanda de otras materias o del trabajo (0,36), observaciones a la arquitectura (0,24) y superar la capa gratuita de los mapas (0,20). Se materializaron tres: la demanda de otras materias, estimaciones inconsistentes y la curva de aprendizaje. La contingencia de los mapas funcionó: quedó implementado el respaldo a OpenStreetMap. |
| **Calidad** | 193 casos de prueba documentados en 28 módulos. 172 operaciones REST documentadas en OpenAPI y verificadas por un test de contrato. CI/CD en cada merge. El S13 fue un sprint de testing con dos integrantes dedicados. Además, pruebas de campo en salidas reales: encontraron errores de trazado y de tracking que las pruebas automáticas no veían. |
| **Escala** | El objetivo es soportar 150 a 200 personas por viaje. La posición llega cada 5 segundos y el mapa se actualiza en menos de 10. |
| **Sin señal** | Las posiciones quedan guardadas en el teléfono y se mandan en lote al reconectar, respetando el orden en el tiempo. No se pierde ningún punto. |
| **¿Por qué Google Maps?** | El mapa y el trazado con OpenStreetMap no alcanzaban. Las claves se usan solo desde el backend, y si Google falla, se usa OpenStreetMap (Nominatim, OSRM y Valhalla) sin cambiar nada en la app. |
| **Privacidad** | Consentimiento informado con versión del texto aceptado. Cada persona decide, viaje por viaje, si comparte su ubicación. Apagado, el GPS se guarda pero no se publica ni se evalúa. Los accesos a la posición quedan registrados. |
| **Seguridad vial** | Moto y auto están excluidos de rankings, fantasma y cualquier comparación de velocidad. Lo controla el backend, no solo la pantalla. |
| **Roles** | Solo líder y participante dentro del grupo. Si el líder se va, el rol pasa al integrante más antiguo. El superadmin es un rol de la plataforma, no del grupo, y nunca ve ubicaciones. |
| **Uso de IA** | Como herramienta de desarrollo, con una política de uso y siempre con revisión humana: no se integra nada que el equipo no entienda. |
