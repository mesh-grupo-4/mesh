# REVISION_TESIS.md — Auditoría pre-defensa de Mesh

> Estado: **FINAL** (16/11/2026). Rama auditada: `pre-defensa` @ `750d5d7` (14/11/2026), árbol limpio.
> Solo diagnóstico: no se modificó código. El único archivo creado es este.
> Método: herramientas automáticas (tsc, tests, export de Metro, chequeos contra la API desplegada) + lectura de código por módulo. **No se ejecutó la app en un dispositivo**: todo lo que depende de verlo en pantalla figura como "a verificar".

## 1. Veredicto

1. **No encontré ningún P0 determinista**: login, crear grupo, crear viaje, iniciar, mapa en vivo y finalizar están completos de punta a punta, la API desplegada responde y coincide con esta rama, los 765 tests del backend pasan y el bundle JS compila para iOS y Android.
2. **Lo que puede arruinar la demo es el entorno y el estado de los datos**, no un bug fijo: mala red (hay pantallas que quedan vacías o trabadas sin mensaje), un viaje de ensayo sin finalizar (bloquea "Iniciar"), cuentas sin consentimiento de ubicación o sin check-in (no aparecen en el mapa) y el mapa en iPhone (Apple Maps ignora el zoom y el arrastre).
3. **Para el tribunal, lo más delicado es que el repositorio de GitHub es público y su historial contiene `backend/.env.demo` con credenciales**; después vienen la documentación desactualizada (READMEs, DER) y la falta de tests en el frontend.

## 2. Tabla de hallazgos

Rutas relativas a la raíz del repo. "A verificar" = lo vi en el código pero no pude confirmar el efecto sin dispositivo o sin acceso al servidor.

### P0 — puede romper la demo (todos condicionales)

| Prioridad | Archivo:línea | Problema | Impacto en la demo | Fix sugerido (1 línea) | Esfuerzo (min) |
|---|---|---|---|---|---|
| P0 (entorno) | `frontend/ios`, `frontend/android` (no existen), `backend/.env` (0 bytes) | En esta Mac no hay proyectos nativos ni variables del backend. | Si el build de Xcode sale de esta máquina, hay que hacer prebuild + pods + compilar hoy; no hay backend local de respaldo. | Compilar e instalar hoy en los dos teléfonos y no recompilar mañana. | 30–60 |
| P0 condicional | `backend/src/index.ts` (sin `process.on`) | No hay handler de `unhandledRejection` / `uncaughtException`. | Una promesa rechazada sin catch tira el proceso: se caen los sockets y el estado en memoria del motor. A verificar si `/srv/mesh/bin/activar.sh` lo reinicia solo. | Agregar los dos handlers que logueen sin salir. | 5 + deploy |
| P0 condicional | `backend/src/modules/motor-eventos/motorEventos.service.ts:727`, `:798` | `void this.emitirLeaderboard(...)` sin catch y con consulta a la base. | Solo en viajes competitivos no motorizados: si esa consulta falla, dispara el caso de la fila anterior. Poco probable. | Agregar `.catch()` que loguee. | 3 + deploy |
| P0 a verificar | `frontend/lib/fotoPerfil.ts`, `frontend/app/editar-perfil.tsx` | Subir foto son 3 pasos (URL firmada, PUT a Supabase Storage, confirmación); depende del bucket en el deploy. | Si mostrás cambio de foto y Storage no está configurado, falla en vivo. | Probarlo hoy una vez; si falla, sacarlo del guion. | 5 (prueba) |
| P0 a verificar (improbable) | `frontend/components/intro/IntroMesh.tsx:348-357` | El fundido final de la intro espera a que termine la carga de sesión. | Con mala red al abrir, la intro puede quedar tapando la app. | Abrir la app antes de empezar y dejarla en segundo plano. | 0 |

### P1 — flujo de viaje

| Prioridad | Archivo:línea | Problema | Impacto en la demo | Fix sugerido (1 línea) | Esfuerzo (min) |
|---|---|---|---|---|---|
| P1 | `frontend/app/viaje/[viajeId]/live.tsx:700-725` | La carga inicial (`Promise.all` de viaje, participantes y ruta) tiene `try/finally` sin `catch`. | Con un fallo de red o timeout de 12 s el mapa en vivo queda vacío, sin mensaje ni reintento. | Agregar `catch` con aviso y botón "Reintentar". | 10 |
| P1 | `backend/src/modules/viajes/viajes.service.ts:1075-1117` | 409 `OTRO_VIAJE_EN_CURSO` si la cuenta ya tiene un viaje en curso (el front lo muestra como alerta). | Un ensayo sin finalizar bloquea "Iniciar" delante del tribunal. | Sin código: finalizar todos los viajes en curso de las cuentas de la demo. | 5 |
| P1 | `backend/src/modules/privacidad/privacidad.acceso.ts:42`, `frontend/lib/privacidadApi.ts:98-104` | Sin consentimiento de ubicación el backend no publica la posición (RN-110), y si el registro del consentimiento falla el front solo hace `console.warn`. | El viaje arranca pero esa persona no aparece en el mapa. Las cuentas "nuevo" del seed no tienen consentimiento (`backend/src/scripts/demo/seed.ts:226`). | Sin código: hacer un viaje de prueba con cada cuenta hoy. | 10 |
| P1 | `backend/src/modules/viajes/viajes.service.ts:2310` | Participante sin check-in (`NOT_CHECKED_IN`) no emite posición. | El segundo teléfono no aparece en el mapa si no tocó "Me sumo". | Sin código: incluir el check-in en el guion. | 0 |
| P1 | `backend/src/modules/viajes/viajes.service.ts:590` | El QR da 410 `QR_EXPIRED` si el viaje ya no está `planificado` (RN-015, es lo esperado). | Escanear después de iniciar falla. | Sin código: escanear antes de iniciar. | 0 |
| P1 | `frontend/app/escanear-qr.tsx:74-92`, `frontend/lib/joinViajeQr.ts:12-27` | Si la unión falla, `ejecutarUnionPorQr` devuelve `false` sin lanzar y nunca se hace `setProcesando(false)`. | Tras un QR vencido el escáner queda muerto; hay que salir y volver a entrar. | `setProcesando(false)` cuando devuelve `false`. | 2 |
| P1 | `frontend/app/unirse.tsx:25-35` | Mismo patrón al unirse por link. | Spinner infinito sin botón para salir. | Mostrar error con botón "Volver". | 10 |
| P1 | `frontend/components/maps/MeshMapView.tsx:203-208` | `initialCamera` manda `zoom` sin `altitude`; Apple Maps ignora `zoom`. | En iPhone el mapa puede abrir con un encuadre raro hasta que corre un `fitBounds`. Efecto visual a verificar. | Agregar `altitude` derivada del zoom cuando el proveedor no es Google. | 20 |
| P1 | `frontend/components/maps/MeshMapView.tsx:220-226` | `animateTo` usa `animateCamera({center, zoom})`; el zoom no se aplica en Apple Maps. | En iPhone "centrar en mí" centra pero no acerca (`frontend/components/live/LiveMapView.tsx:190,224`). | Igual que la fila anterior. | 10 |
| P1 | `frontend/components/maps/MeshMapView.tsx:274-276`, `frontend/app/viaje/[viajeId]/live.tsx:1244` | `onUserDrag` depende de `details.isGesture`, que Apple Maps no envía. | En iPhone arrastrar el mapa en vivo no pausa el seguimiento: el mapa "vuelve solo". | Usar `onPanDrag` en iOS. | 10 |
| P1 | `frontend/app/viaje/[viajeId]/live.tsx:800-845`, `frontend/lib/tracking/trackingControl.ts:227-234` | El arranque del tracking no tiene `catch`; en Android, si `startLocationUpdatesAsync` falla no hay alternativa (en iOS sí). | El teléfono Android no emitiría posición. Fallo en runtime a verificar. | `catch` con caída a seguimiento en primer plano. | 15 |
| P1 | `backend/src/modules/routing/routing.service.ts`, `frontend/lib/apiClient.ts:5` | La cadena Google → OSRM → Valhalla puede tardar ~60 s; el cliente corta a los 12 s. | Si Google Routes falla, "calcular ruta" da timeout. A verificar que `GOOGLE_MAPS_API_KEY` esté en el VPS. | Sin código: llevar un viaje con la ruta ya configurada. | 0 |
| P1 | `frontend/lib/tracking/gpsQueue.ts` (flush) | `fetch` directo sin timeout al sincronizar la cola offline. | Con red colgada la sincronización puede quedar esperando. A verificar. | Agregar `AbortController` con timeout. | 10 |
| P1 | `backend/src/modules/viajes/viajes.service.ts:2552`, `:2671` | Un ping duplicado (mismo usuario y timestamp) da 500 por `P2002` sin manejar. | No se ve en la app; aparece en los logs si los muestran. | Capturar `P2002` y tratarlo como idempotente. | 10 |

### P1 — login, registro y grupos

| Prioridad | Archivo:línea | Problema | Impacto en la demo | Fix sugerido (1 línea) | Esfuerzo (min) |
|---|---|---|---|---|---|
| P1 | `frontend/app/(tabs)/grupos.tsx:254-263`, `frontend/context/AuthContext.tsx:105-118` | Si el primer `GET /api/usuarios/me` falla o supera 12 s tras un login, no hay reintento. | Social queda con un texto pensado para desarrolladores. | Reintento automático y botón "Reintentar". | 15 |
| P1 | `frontend/context/AuthContext.tsx:110-116`, `frontend/lib/apiClient.ts:55-63,72` | Los avisos de error de red muestran la URL del servidor y texto técnico. | Si falla la red delante del tribunal, se ve un mensaje de desarrollo. | Reemplazar por "No pudimos conectar. Reintentá." | 5 |
| P1 | `frontend/app/(auth)/register.tsx:83-89` | La actividad elegida en el paso 2 del registro no se guarda (el closure tiene `user` en null). | Si registrás una cuenta en vivo y después mostrás el perfil, la actividad no coincide. | Guardar la actividad después de que exista el usuario. | 10 |
| P1 | `frontend/app/(auth)/register.tsx` (paso 1) | No valida el formato del email; lo rechaza Firebase con su propio error. | Mensaje poco claro si se tipea mal. | Validar con regex antes de enviar. | 5 |
| P1 | `frontend/app/(auth)/login.tsx` (`mensajeFirebase`) | Sin caso para `auth/network-request-failed` ni `auth/too-many-requests`. | Mensaje genérico ante falta de red o varios intentos fallidos. | Agregar los dos casos. | 3 |
| P1 | `frontend/app/grupo/[grupoId]/index.tsx:90-92` | El detalle del grupo carga solo al montar. | Tras pasar el liderazgo siguen visibles las acciones de líder y dan 403. | Recargar al volver a foco. | 5 |
| P1 | `frontend/app/grupo/[grupoId]/invitar-desde-grupos.tsx:123-134` | Un segundo toque en "Agregar amigo" muestra alerta 409. | Alerta de error por un doble toque. | Deshabilitar el botón tras el primer toque. | 5 |
| P1 | `frontend/app/grupo/[grupoId]/index.tsx:453` | El subtítulo promete invitar "desde otros grupos", algo que no existe en la UI. | Pregunta del tribunal si lo leen. | Corregir el texto. | 1 |
| P1 | `frontend/app/grupo/[grupoId]/miembros.tsx` | No existe expulsar a un miembro (ni front ni back). | "¿Cómo saca el líder a alguien?" No se puede. | No tocar; contarlo como limitación. | — |
| P1 | `backend/src/modules/grupos/grupos.service.ts:372-437` | RN-013 parcial: el líder tiene que elegir sucesor; la transferencia automática al más antiguo solo existe en admin. | Diferencia entre lo documentado y lo que se ve. | No tocar; saber explicarlo. | — |
| P1 | `frontend/components/HojaInferior.tsx:30-33` | `KeyboardAvoidingView` sin `behavior` en Android. | El teclado puede tapar "Crear grupo". A verificar en el APK. | Probarlo hoy en el APK. | 5 (prueba) |
| P1 | `frontend/app/(auth)/login.tsx:33`, `frontend/app/(auth)/register.tsx:91` | `router.replace('/(tabs)')` duplica al guard del layout. | Podría pisar un link pendiente tras el login. A verificar. | No tocar antes de la defensa. | — |
| P1 | `frontend/context/AuthContext.tsx:198-245` | Posible carrera entre `GET /me` y `POST /sync` en el registro. | Podría pisar nombre o teléfono de una cuenta recién creada. A verificar. | No tocar; usar cuentas ya creadas. | — |
| P1 | `frontend/app/(auth)/forgot-password.tsx:91` | Promete que el link vence en 24 h; el vencimiento lo define Firebase. A verificar. | Pregunta posible sobre RN-007. | Confirmar la configuración en la consola de Firebase. | 5 |

### P1 — pantallas secundarias

| Prioridad | Archivo:línea | Problema | Impacto en la demo | Fix sugerido (1 línea) | Esfuerzo (min) |
|---|---|---|---|---|---|
| P1 | `frontend/app/editar-perfil.tsx:131-137` | Si el backend rechaza el guardado, la pantalla vuelve atrás como si hubiera salido bien y aparece una alerta técnica. | Confuso si falla en vivo. | Volver atrás solo si la respuesta fue correcta. | 20 |
| P1 | `frontend/app/estadisticas.tsx:41-52` | `.catch(() => null)`: un fallo de red se muestra como "0 viajes / 0 km". | Estadísticas en cero delante del tribunal. | Mostrar estado de error con reintento. | 10 |
| P1 | `frontend/app/privacidad.tsx:71-85` | Si falla la carga, muestra los valores por defecto como si fueran los guardados. | Mala imagen justo en la pantalla de privacidad. | Mostrar estado de error. | 10 |
| P1 | `frontend/app/admin/usuario/[usuarioId].tsx:39-45,67` (igual en `admin/grupo`, `admin/viaje`, `admin/insignia`) | Spinner infinito si falla la carga del detalle. | Solo si mostrás el backoffice con mala red. | Agregar estado de error. | 15 |
| P1 | `frontend/app/_layout.tsx:170` | `ThemeProvider value={DarkTheme}` fijo. | En modo claro los headers nativos quedan oscuros. Modo claro sin verificar en dispositivo. | Sin código: hacer la demo en modo oscuro. | 0 |
| P1 | `frontend/app/+not-found.tsx:9-14` | Textos de la plantilla en inglés ("Oops!", "This screen doesn't exist."). | Solo se ve con un link roto. | Traducir. | 3 |
| P1 | `frontend/app/(tabs)/perfil.tsx:312`, `:201` | Pie fijo "Mesh · v1.0" (el build es 1.0.1); "Cargando..." permanente si `profile` es null. | Detalle visible en Perfil. | Leer la versión de `expo-constants`. | 3 |
| P1 | `frontend/lib/format.ts:21`, `:25-30` | `formatKmCompact` muestra km sin unidad; `formatKm` usa punto decimal y los montos coma. | Inconsistencia visible en métricas. | Unificar formato. | 10 |
| P1 | `frontend/app/(tabs)/entrenar.tsx` | La alerta de error se repite en cada foco con mala red. | Alertas repetidas. | Mostrarla una sola vez. | 10 |
| P1 | `frontend/app/editar-perfil.tsx:120`, `backend/src/modules/usuarios/usuarios.schemas.ts:7` | El teléfono no se valida al editar. | Pregunta por validaciones. | Validar formato en el schema Zod. | 10 |
| P1 | `frontend/app/viaje/[viajeId]/checklist.tsx` | Eliminar un ítem no pide confirmación. | Borrado accidental en vivo. | Confirmar antes de borrar. | 5 |
| P1 | `frontend/app/(tabs)/grupos.tsx:237`, `frontend/app/grupo/[grupoId]/index.tsx:221`, `frontend/app/grupo/[grupoId]/miembros.tsx:106` | Tuteo mezclado con voseo (también en `frontend/components/TransferirLiderazgoModal.tsx:52`). | Inconsistencia de textos. | Pasar a voseo. | 5 |
| P1 | `frontend/app/(tabs)/_layout.tsx` | La tab se llama "Social" y el resto de la app dice "Grupos" / "Mis amigos". | Inconsistencia de nombres. | No tocar antes de la defensa. | — |

### P2 — preguntas del tribunal

| Prioridad | Archivo:línea | Problema | Impacto en la demo | Fix sugerido (1 línea) | Esfuerzo (min) |
|---|---|---|---|---|---|
| **P2 crítico** | historial git: `backend/.env.demo` en `54d47c7` (quitado en `0974554`) | El repo `mesh-grupo-4/mesh` es **público** (verificado sin autenticación) y ese archivo es accesible con `DATABASE_URL`, `DIRECT_URL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` y `GOOGLE_MAPS_API_KEY` con valor. A verificar si siguen vigentes y si son las de producción. | No rompe la demo. Es la peor pregunta posible y un riesgo real para la base. | Pasar el repo a privado hoy; rotar las claves después de la defensa. | 1 |
| P2 | `frontend/.env` (versionado) | Incluye `GOOGLE_MAPS_ANDROID_API_KEY` y la anon key de Supabase. Ambas van dentro del build igual, pero el archivo está en git. | "¿Por qué hay un `.env` en el repo?" | Respuesta: son claves de cliente, restringidas por paquete y por RLS. A verificar las restricciones en Google Cloud. | 5 |
| P2 | `backend/src/modules/viajes/viajes.service.ts:574` | El QR es el UUID del viaje, sin token ni firma. | Pregunta de seguridad: quien conozca el UUID puede unirse mientras esté planificado. | No tocar; contarlo como mejora futura. | — |
| P2 | `backend/src/app.ts:11`, `backend/src/index.ts:23` | Sin rate limiting; `cors({ origin: true })`; origen por defecto de Socket.io `http://localhost:5173`. | Pregunta de seguridad. No afecta a la app nativa. | No tocar; contarlo como mejora futura. | — |
| P2 | `backend/src/middleware/requireUser.ts:28` | `verifyIdToken` sin `checkRevoked`. | Un token revocado sigue sirviendo hasta que vence (1 h). | No tocar. | — |
| P2 | `backend/src/modules/usuarios/usuarios.service.ts:57-63` | Re-vinculación de cuenta por email sin exigir `email_verified`. A verificar si es explotable. | Pregunta de seguridad. | No tocar. | — |
| P2 | `backend/src/modules/viajes/viajes.service.ts:497`, `:2447`; `backend/src/modules/grupos/grupos.service.ts:508`; `backend/src/modules/amistades/amistades.service.ts:223-226` | Las respuestas incluyen el email de otros usuarios. | Pregunta de privacidad. | No tocar. | — |
| P2 | `backend/src/modules/viajes/viajes.service.ts:2720`; `backend/src/modules/privacidad/privacidad.acceso.ts:42`, `:87` | RN-112 se registra solo en la lectura por REST, no en el envío por socket; el camino caliente no compara la versión del consentimiento. | RN-110 y RN-112 están implementadas en parte. | Saber explicarlo. | — |
| P2 | `backend/prisma/schema.prisma:635-655` | `Alerta` no tiene `usuario_afectado_id`: el afectado viaja como prefijo `[afectado:uuid]` dentro de `mensaje`. | Contradice el modelo de datos documentado. | No tocar (requiere migración). | — |
| P2 | `backend/prisma/schema.prisma` (`RegistroGPS`, `UbicacionViva`, `Ruta`), `backend/src/lib/postgis.ts` | No hay columnas PostGIS: lat/lng son `Float` y la ruta es `Json`. PostGIS se usa solo dentro de las consultas. | "¿Dónde están los POINT y LINESTRING?" | Respuesta: se construyen en la consulta con `ST_MakePoint`. | — |
| P2 | `backend/src/modules/motor-eventos/motorEventos.service.ts:158` | El estado del motor vive en memoria y hace varias consultas por ping. Sin pruebas de carga. | RN-033 (150–200 usuarios) no tiene evidencia. | Decirlo como limitación conocida. | — |
| P2 | `backend/src/routes/index.ts` (`/health`) | No consulta la base: "ok" no garantiza que la base responda. | Pregunta de operación. | No tocar. | — |
| P2 | controllers con `req.params.x as string` (`viajes.controller.ts:38`, `paradas.controller.ts:19-74`, y en desvíos, alertas, insignias, rachas) | Parámetros de ruta sin Zod: un id mal formado probablemente da 500 en vez de 400. | Solo si prueban la API a mano. | No tocar. | — |
| P2 | RN-003, RN-005, RN-007 | Delegadas a Firebase; no hay contador propio de 5 intentos. | "¿Dónde está el bloqueo por intentos?" | Respuesta: lo aplica Firebase Auth. | — |
| P2 | `frontend/package.json` (sin script `test`) | El frontend no tiene tests ejecutables; `backend` sin tests en `sockets/` ni `jobs/`; `supertest` instalado y sin uso. | El DoD de `CLAUDE.md:295-309` habla de tests de integración. | Mostrar los 765 tests del backend y el test de contrato OpenAPI. | — |
| P2 | `frontend/README.md:11-18,24,44-78,86,110` | Documenta Expo 54 / RN 0.81.5 / TS 5.9.2 (real: Expo 57 / RN 0.86.3 / TS 6.0.3), habla de Expo Go, conserva texto de la plantilla y pide un `.env.example` que no existe. | Documentación contra realidad. | Actualizar la tabla del stack. | 10 |
| P2 | `ESTRUCTURA.md:44,53,74` | Dice "Sin Google Maps ni Mapbox" y mapa OSM; contradice `tesis-brain/adr-mapas-google.md` y el código. | Documentación contra realidad. | Corregir las tres líneas. | 5 |
| P2 | `backend/DER.mmd`, `backend/DER.svg` | 23 tablas contra 34 modelos en `schema.prisma` (faltan insignias, rachas, privacidad, entrenamientos, auditoría, recorridos publicados). | Si el DER va en la presentación, está viejo. | Regenerarlo o aclarar la fecha. | 30 |
| P2 | `CLAUDE.md:76,85,261,295-309` | "Managed Workflow" / "Expo Go" (se necesita development build); rama `dev` que no existe; "Asistencia IA" sin código. | Documentación contra realidad. | No tocar; saber explicarlo. | — |
| P2 | historial git | 215 commits con autoría muy despareja (un integrante ~115, "unknown" 23, Manuel Viale 5); 94 commits entre el 05/11 y el 14/11, algunos de más de 3.000 líneas; mensajes como "6 prompts". | "¿Quién hizo qué?" y "¿cuánto se generó con IA?" | Tener preparada la respuesta; no reescribir el historial. | — |
| P2 | `graphify-out/cache`, `.cursorrules`, `frontend/mock/`, `frontend/docs/implementation_plan_remaining.md` | Artefactos de herramientas de IA y un prototipo que nadie importa, todos versionados. | Refuerzan la pregunta anterior. | No tocar. | — |
| P2 | `frontend/app/modal.tsx:10`, `frontend/app/mis-rutas.tsx`, `frontend/app/amigos/index.tsx`, `frontend/app/grupo/[grupoId]/qr/[viajeId].tsx`, `frontend/app/(tabs)/two.tsx` | Rutas huérfanas y nombres de plantilla (`two.tsx` es la tab "Viajes"). | Código muerto visible al recorrer el repo. | No tocar (renombrar rompe rutas). | — |
| P2 | `frontend/package.json`, `backend/package.json` | Dependencias sin uso (`@mapbox/polyline`, `react-native-draggable-flatlist`, `react-dom`, `react-native-web`, `react-test-renderer` 19.1.0, `@types/socket.io`, `supertest`). | Pregunta menor. | No tocar. | — |
| P2 | `frontend/app.json:4,13,44` | Slug `frontend`, paquete `com.frangiorda1.frontend`. | Pregunta menor. | No tocar: cambia la firma y la restricción de la key de Maps. | — |
| P2 | `frontend/components/live/LiveMapView.tsx:469,484`, `frontend/components/route-config/RouteMapView.tsx:154`, `frontend/components/RecorridoMapView.tsx:65,74`, `frontend/components/route-config/mapStyles.ts` | `anchor` solo aplica en Google Maps y la capa "Terreno" no hace nada en Apple Maps. | Pines corridos y capa sin efecto en iPhone. A verificar. | No tocar. | — |
| P2 | `frontend/app/viaje/[viajeId]/sala.tsx:~388`, `:378-396`; `frontend/app/viaje/[viajeId]/index.tsx:523-526` | El botón dice "Abrir ajustes de Android/iOS" con las dos plataformas; el botón del modal de permisos no tiene guard propio contra doble toque (a verificar). | Detalle de texto; posible doble `POST iniciar`. | Mostrar la plataforma con `Platform.OS`. | 3 |
| P2 | `frontend/app/viaje/[viajeId]/index.tsx:595-607` | Finalizar desde el detalle no lleva al resumen (desde el mapa en vivo sí). | Inconsistencia si finalizás desde el detalle. | Sin código: finalizar siempre desde el mapa en vivo. | 0 |
| P2 | `frontend/app/viaje/[viajeId]/live.tsx:727-796` | La limpieza de listeners se asigna después de un `await` y no hay `leave_viaje`. | Posibles eventos duplicados si entrás y salís rápido. A verificar. | No tocar. | — |
| P2 | `frontend/hooks/usePushNotifications.ts:81,173` | `getExpoPushTokenAsync` sin try/catch. | A lo sumo un warning. | No tocar. | — |
| P2 | `frontend/constants/Config.ts:115` | Fallback a `http://localhost:3000` si el build se generó sin `.env`. | Una app que no conecta a nada. A verificar en el build instalado: si el login funciona, está bien. | Verificar hoy. | 2 |
| P2 | `frontend/.expo/types/router.d.ts` | `tsc --noEmit` da 56 errores, todos de rutas tipadas viejas. No afecta el runtime. | Solo si corren `tsc` delante del tribunal. | Levantar `expo start` una vez para regenerar los tipos. | 2 |

Descartado tras revisar: `EXPO_PUBLIC_DEV_USER_ID` (`frontend/constants/Config.ts:125`) **no** es un bypass de autenticación: el backend no lee nada equivalente y la variable no está definida.

## 3. Quick wins para esta noche

Ordenados por impacto. Los primeros cinco no tocan código.

| # | Acción | Min |
|---|---|---|
| 1 | **Pasar el repo de GitHub a privado** (Settings → Danger Zone). Confirmar antes que el tribunal no necesite acceso; si lo necesita, invitarlos como colaboradores. | 1 |
| 2 | **Finalizar todos los viajes en curso** de las cuentas que vas a usar (evita `OTRO_VIAJE_EN_CURSO`). | 5 |
| 3 | **Ensayo completo con las cuentas y los teléfonos reales**: aceptar consentimiento de ubicación, dar "Permitir siempre" y notificaciones, hacer check-in, iniciar, ver los dos puntos en el mapa, finalizar. | 20 |
| 4 | **Probar hoy lo que no pude verificar**: subir foto de perfil, teclado sobre "Crear grupo" en el APK, calcular una ruta nueva (confirma la key de Google en el VPS). | 10 |
| 5 | **Dejar instalado el build definitivo** en los dos teléfonos y no recompilar mañana. | — |
| 6 | `frontend/app/viaje/[viajeId]/live.tsx:700-725`: `catch` con aviso y "Reintentar" en la carga inicial. | 10 |
| 7 | `frontend/app/escanear-qr.tsx:74-92`: `setProcesando(false)` cuando la unión devuelve `false`. | 2 |
| 8 | `frontend/app/unirse.tsx:25-35`: error con botón "Volver" en vez de spinner infinito. | 10 |
| 9 | `frontend/lib/apiClient.ts:55-63,72` y `frontend/context/AuthContext.tsx:110-116`: sacar la URL y el texto técnico de los avisos de error. | 5 |
| 10 | `frontend/app/(auth)/login.tsx`: mensajes para `network-request-failed` y `too-many-requests`. | 3 |
| 11 | Textos: `+not-found.tsx:9-14` en español, pie "v1.0" en `perfil.tsx:312`, subtítulo de `grupo/[grupoId]/index.tsx:453`, "Android/iOS" en `sala.tsx:~388`, tuteo. | 10 |
| 12 | Backend, **solo si van a desplegar esta noche y probar después**: `.catch()` en `motorEventos.service.ts:727` y handlers `process.on` en `index.ts`. | 8 + deploy |

Los puntos 6 a 11 obligan a recompilar e instalar de nuevo. Si no hay tiempo para repetir el ensayo del punto 3 con el build nuevo, conviene quedarse con los puntos 1 a 5.

## 4. No tocar antes de mañana

- **Rotar credenciales** (base, Firebase, Maps): hacerlo esta noche puede dejar al VPS sin conexión. Va después de la defensa.
- **Reescribir el historial de git** para borrar `.env.demo`: rompe los clones de todo el equipo y no elimina lo ya expuesto.
- **`MeshMapView.tsx`** (altitud, `onPanDrag`): son fixes cortos pero afectan a todos los mapas; solo si tenés un iPhone para probar cada pantalla después. La alternativa sin riesgo es usar Android como teléfono principal.
- **Tracking, cola offline y `AuthContext`** (carrera `me`/`sync`, fallback de Android): riesgos a verificar, no fallos confirmados; un cambio a ciegas puede romper lo que hoy anda.
- **Schema de Prisma y migraciones** (`usuario_afectado_id`, columnas PostGIS): no se cambia la base el día anterior.
- **`frontend/app.json`** (slug, paquete, bundle id): cambia la firma e invalida la key de Maps.
- **Renombrar `two.tsx` o borrar rutas huérfanas**: rompe rutas tipadas y navegación.
- **Actualizar o borrar dependencias**: obliga a reinstalar pods y recompilar el nativo.
- **Modo claro** (`_layout.tsx:170`, hex fijos): la demo va en modo oscuro.
- **`npm run demo:seed`**: borra y recrea los datos demo en la base desplegada. El propio script recomienda correrlo el día anterior (las rachas se cortan a la semana), pero corré primero `npm run demo:verificar` y repetí el ensayo después. En esta Mac no se puede correr (`backend/.env` vacío). A verificar cuándo fue la última vez que se corrió.

## 5. Plan B

**Si falla internet en el aula**
- Llevar dos hotspots de operadoras distintas; no depender del wifi de la facultad.
- La app no funciona sin red salvo la cola GPS offline: sin conexión no hay login, ni crear viaje, ni mapa en vivo.
- Dejar las sesiones ya iniciadas en los dos teléfonos (Firebase las persiste); el login en vivo mostrarlo con una sola cuenta.
- Recorrer antes la zona del mapa en ambos teléfonos para que queden los tiles en caché.

**Si falla la API o la base**
- No hay backend local de respaldo en esta Mac. El respaldo real es un **video grabado esta noche** del flujo completo (login → grupo → viaje → iniciar → mapa en vivo con dos teléfonos → finalizar → resumen), guardado en el teléfono y en la notebook.
- En `tesis-brain/` existen `VIDEOS-CASOS-DE-USO.html` y `SIMULACION-FINAL.html`; a verificar que estén actualizados y que abran sin internet.
- Antes de empezar, abrir `https://api.mesh-app.com.ar/api/health` y hacer un login de prueba (el health no consulta la base).

**Qué dejar precargado**
- Un viaje **planificado con la ruta ya configurada** y los participantes con check-in, para iniciar sin depender del cálculo de ruta.
- Un viaje **finalizado** de bici o running con resumen, métricas y ranking, y uno de moto sin ranking: es la evidencia de RN-070.
- Un grupo con miembros ya cargados, por si falla la invitación en vivo.
- El QR del viaje mostrado y escaneado **antes** de iniciar.

**Si falla el GPS bajo techo**
- Dentro del aula la posición puede saltar o no moverse. Con el iPhone conectado a Xcode se puede simular un recorrido (Debug → Simulate Location con un GPX); es una herramienta de desarrollo, no un mock en el código.
- Si no, mostrar el mapa en vivo con los dos puntos quietos y pasar el movimiento en el video.

**Si falla el mapa en iPhone**
- Usar Android (Google Maps) como teléfono del líder y pantalla principal. En iPhone no arrastrar el mapa en vivo y usar el botón de encuadrar.

**Si falla algo puntual en vivo**
- Mapa en vivo vacío: volver atrás y entrar de nuevo.
- Escáner QR trabado: salir de la pantalla y volver a entrar, o unirse por código.
- "Iniciar" da error de otro viaje en curso: finalizar ese viaje desde la tab Viajes.
- Tocar "Iniciar" / "Acepto y arranco" una sola vez.

---

## Anexo A — Preguntas probables del tribunal y qué responder

| Pregunta | Respuesta apoyada en el código |
|---|---|
| ¿Cómo garantizan RN-070? | Compuerta única `esMotorizado()` en `backend/src/lib/actividad.ts` con espejo en `frontend/lib/activityDefaults.ts`; verificada en mapa en vivo, resumen, métricas, ranking, entrenar y reportes de admin. |
| ¿Quién valida los permisos? | El backend: `requireUser` en todas las rutas salvo health y docs, guard de membresía en todos los módulos de viaje, rol de líder para iniciar y finalizar, superadmin leído de la base. |
| ¿Qué pasa sin señal? | Cola GPS en SQLite (`frontend/lib/tracking/gpsQueue.ts`) y sincronización al reconectar; el socket reconecta indefinidamente y vuelve a unirse a la sala. |
| ¿Cómo se prueba? | 70 archivos y 765 tests en el backend, más un test de contrato que falla si hay endpoints sin documentar. Limitación: sin tests de frontend, de sockets ni de carga. |
| ¿Está documentada la API? | OpenAPI con 172 operaciones, servido en `/api/docs`, idéntico al de la rama. |
| ¿Usan PostGIS? | Sí, en las consultas (`backend/src/lib/postgis.ts`); las columnas son `Float` y `Json`, no tipos espaciales. |
| ¿Soporta 200 usuarios? | No hay prueba de carga; el motor guarda estado en memoria y no escala horizontalmente. |
| ¿Por qué Apple Maps en iOS? | No hay key de Google para iOS en el build; `MeshMapView` abstrae el proveedor. |

## Anexo B — Verificado OK

- **Entorno**: API 200 en 0,28 s; handshake de Socket.io correcto; TLS vigente hasta el 17/01/2027; deploy sincronizado con `pre-defensa`; `npm ls` sin faltantes; `expo export` compila para iOS y Android; `expo config` resuelve.
- **Auth y grupos**: sesión persistida, guards con `replace`, doble envío bloqueado, `/me` nunca da 404, contratos front/back coinciden, unirse por QR o código es idempotente, todas las rutas navegadas existen.
- **Viaje**: validaciones al crear (nombre, fecha futura, rangos), "Viaje YA", fechas por `tiempoArg`, configuración de ruta con manejo de errores, sala con polling de 5 s y limpieza, iniciar sin ruta y con un solo miembro, permiso de ubicación denegado no bloquea, finalizar con confirmación, participantes llevados al resumen por socket, eventos y payloads del socket coinciden con el backend, sin logs de posiciones.
- **Backend**: `asyncHandler` y handler global `{error, code}`, Zod en escrituras, SQL parametrizado, sin secretos en el código, fotos validadas (jpeg, 2 MB), `iniciar` con advisory lock, timeouts en servicios externos.
- **UI**: sin "Próximamente", mocks ni botones sin handler; sin `Alert.alert` nativo; sin inglés fuera de las pantallas de plantilla.

No revisado en detalle: `frontend/app/grupo/[grupoId]/miembros.tsx` (flujo completo), `frontend/app/nuevo-viaje.tsx`, `frontend/hooks/useParadas.ts`, `frontend/components/live/LiveBottomPanel.tsx`, `frontend/plugins/withIosSceneLifecycle.js`, y la compilación nativa (prebuild + Xcode/Gradle).

## Anexo C — Herramientas automáticas

| Chequeo | Resultado |
|---|---|
| `tsc --noEmit` frontend | 56 errores, todos de `typedRoutes` por `.expo/types/router.d.ts` viejo. No afecta runtime ni Metro. |
| `tsc --noEmit` backend | 1 error: faltaba `src/docs/openapi.bundled.json` (generado, ignorado por git; lo crea `npm test`). |
| ESLint | No hay configuración en frontend ni backend. |
| Tests backend | 70 archivos, 765 tests, todos pasan (1,98 s). |
| Tests frontend | Sin runner; `components/__tests__/` tiene 1 archivo que no se ejecuta. |
| `docs:lint` | Válido, 3 warnings menores. |
| Greps | Sin `localhost` en runtime salvo el fallback de `Config.ts:115`; 1 TODO; 0 catch vacíos en frontend y 3 en backend. |
