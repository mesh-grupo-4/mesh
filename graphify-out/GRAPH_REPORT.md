# Graph Report - mesh  (2026-10-16)

## Corpus Check
- 418 files · ~365,778 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 4, .mmd 1, .toml 1)

## Summary
- 2880 nodes · 7881 edges · 118 communities (111 shown, 7 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 314 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `855f19f5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- live.tsx
- meshAlert
- ParadasService
- parseJson
- metricas.tsx
- @prisma/client
- two.tsx
- MeshUI.tsx
- HttpError
- motorEventos.service.ts
- RouteBottomSheet.tsx
- LiveMapView.tsx
- viajes.service.ts
- [viajeId]/index.tsx
- expo-router
- useRoutePlanner.ts
- viajes.router.ts
- Plan de implementación — Grupos sin viajes propios
- ChecklistService
- expo
- privacidad.service.ts
- dependencies
- gastos.service.ts
- alertas.tsx
- httpError.ts
- lugares.service.ts
- routing.service.ts
- [viajeId]/privacidad.tsx
- express
- haversineDistanceM
- trackingControl.ts
- AuthContext.tsx
- crear.tsx
- frontend/package.json
- clima.service.ts
- react-native
- backend/package.json
- admin.service.ts
- AdminService
- geocoding.service.ts
- GruposService
- grupos.service.ts
- useParadas.ts
- contrato.test.ts
- AmistadesService
- Themed.tsx
- Proposed Changes
- Tiempo real — Inicio de viaje y monitoreo GPS
- fantasma.service.ts
- configurar-ruta/[viajeId].tsx
- TripRealtimeContext.tsx
- postgis.ts
- checklist.tsx
- gastos.tsx
- compilerOptions
- app/_layout.tsx
- usuarios.service.ts
- MeshDialogContext.tsx
- data.jsx
- devDependencies
- scripts
- usuarios.router.ts
- sockets/index.ts
- ViajeRealtimeBridge.tsx
- Mesh — Frontend Mobile
- CLAUDE.md — Mesh
- Mesh — Backend
- FantasmaPanel.tsx
- tweaks-panel.jsx
- 2. Reglas de Negocio
- meshSocket.ts
- ui.jsx
- Pegar en Jira
- dependencies
- Convenciones de desarrollo
- Guion para armar la presentación de la demo — Mesh
- Reglas de negocio críticas (resumen ejecutivo)
- ClimaViajeCard.tsx
- ADR — Documentación de la API: spec-first con test de contrato
- Documentación de la API
- reportes.tsx
- LiveTripHeader.tsx
- US — Checklist de preparativos pre-ruta
- admin.service.test.ts
- Mesh — Especificación Completa del Sistema
- US — Alertas del líder e historial de viajes
- US — Paradas voluntarias y solicitud de parada
- Pegar en Jira
- Reglas inviolables
- android-frame.jsx
- scripts
- frontend/tsconfig.json
- 3. Flujos del Sistema
- grupos.membership.ts
- Decisiones de arquitectura
- apiClient.ts
- app.jsx
- screens-live.jsx
- adr-documentacion-api.md
- 6. Restricciones Técnicas y No Funcionales
- apiUrl
- Uso de cada tecnología
- Supabase Realtime — `ubicacion_viva`
- reportes.service.ts
- expo
- icons.jsx
- devDependencies
- 5. Estados y Transiciones
- pendientesStore.ts
- privacidad.acceso.ts
- motorEventos.service.test.ts
- backend/README.md
- socket.d.ts
- Estructura del repositorio — Mesh
- mapbox-polyline.d.ts

## God Nodes (most connected - your core abstractions)
1. `useTheme()` - 172 edges
2. `HttpError` - 129 edges
3. `react-native` - 121 edges
4. `meshFetchAuthed()` - 112 edges
5. `apiUrl()` - 112 edges
6. `parseJson()` - 105 edges
7. `react` - 96 edges
8. `Btn()` - 79 edges
9. `useAuth()` - 69 edges
10. `meshAlert()` - 68 edges

## Surprising Connections (you probably didn't know these)
- `5. Contrato de errores uniforme` --references--> `requireUser()`  [INFERRED]
  tesis-brain/adr-documentacion-api.md → backend/src/middleware/requireUser.ts
- `2.3 Reglas de Viajes y Rutas` --references--> `Collapsible()`  [INFERRED]
  tesis-brain/reglas-de-negocio.md → frontend/components/Collapsible.tsx
- `2.14 Reglas de Administración de la Plataforma (Superadmin)` --references--> `usuario()`  [INFERRED]
  tesis-brain/reglas-de-negocio.md → backend/src/modules/viajes/viajes.participantes.test.ts
- `Implementación` --references--> `usuario()`  [INFERRED]
  tesis-brain/reglas-de-negocio.md → backend/src/modules/viajes/viajes.participantes.test.ts
- `Implementación` --references--> `ViajesService`  [INFERRED]
  tesis-brain/reglas-de-negocio.md → backend/src/modules/viajes/viajes.service.ts

## Import Cycles
- 2-file cycle: `backend/src/docs/index.ts -> backend/src/docs/router.ts -> backend/src/docs/index.ts`

## Communities (118 total, 7 thin omitted)

### Community 0 - "live.tsx"
Cohesion: 0.07
Nodes (44): duracionLegible(), mensajeDeError(), styles, ViajeLiveScreen(), DragToDismiss(), AlertasButton(), Props, styles (+36 more)

### Community 1 - "meshAlert"
Cohesion: 0.11
Nodes (62): AdminAuditoriaScreen(), DESCRIPCION_ACCION, objetivo(), AdminGruposScreen(), AdminPanelScreen(), Dato(), styles, AdminReportesScreen() (+54 more)

### Community 2 - "ParadasService"
Cohesion: 0.06
Nodes (34): `viaje:alerta`, `viaje:alerta_actualizada`, ExpoPushMessage, asyncHandler(), crearAlertasController(), alertaIdParamSchema, CambiarEstadoAlertaInput, cambiarEstadoAlertaSchema (+26 more)

### Community 3 - "parseJson"
Cohesion: 0.10
Nodes (33): EditarGrupoScreen(), styles, Props, styles, TransferirLiderazgoModal(), parseJson(), abandonarGrupo(), buscarUsuariosParaInvitar() (+25 more)

### Community 4 - "metricas.tsx"
Cohesion: 0.10
Nodes (48): formatearFecha(), formatearFechaCorta(), TarjetaFinalizado(), EvolucionSesiones(), MetricasScreen(), SplitsList(), styles, VelocidadChart() (+40 more)

### Community 5 - "@prisma/client"
Cohesion: 0.04
Nodes (28): intentos, loginDocsHandler(), loginSchema, registrarIntento(), traducirErrorFirebase(), RelacionAmistad, AbortErrorFalso, emit (+20 more)

### Community 6 - "two.tsx"
Cohesion: 0.09
Nodes (50): AdminGrupoScreen(), getGroupColor(), GruposScreen(), SeccionGruposAmigos, styles, Chip(), filtrar(), FiltroActividad (+42 more)

### Community 7 - "MeshUI.tsx"
Cohesion: 0.06
Nodes (55): ForgotPasswordScreen(), mensajeFirebase(), styles, ACTIVIDADES, mensajeFirebase(), RegisterScreen(), styles, telefonoArgentinoValido() (+47 more)

### Community 8 - "HttpError"
Cohesion: 0.07
Nodes (22): API de tiempo real — Socket.io, Escala, Eventos del cliente al servidor, Eventos del servidor al cliente, `join_viaje`, `leave_viaje`, Paradas voluntarias e incidentes (`paradas.service.ts`, `motorEventos.service.ts`), Reconexión (+14 more)

### Community 9 - "motorEventos.service.ts"
Cohesion: 0.08
Nodes (28): atrasoMetros(), BloquePrincipal, identificarBloquePrincipal(), mediana(), MiembroEnRuta, toleranciaAtrasoMetros(), distanciaMetros(), toRad() (+20 more)

### Community 10 - "RouteBottomSheet.tsx"
Cohesion: 0.07
Nodes (39): Props, CrearAlertaSheet(), run(), crearEstilos(), Props, Tema, UbicacionAlerta, ItemArrastrable() (+31 more)

### Community 11 - "LiveMapView.tsx"
Cohesion: 0.08
Nodes (48): RutaMapaPreview(), AlertaMapPickModal(), Props, styles, GHOST_TRAIL_COLOR, GhostMarker(), styles, GuiaDestino (+40 more)

### Community 12 - "viajes.service.ts"
Cohesion: 0.07
Nodes (32): GeoJsonPoint, QR_EXPIRED_MESSAGE, DEFAULTS, ParametrosActividad, parametrosPorActividad(), RANGO_PARAMETROS, toleranciaAtrasoEfectiva(), asyncHandler() (+24 more)

### Community 13 - "[viajeId]/index.tsx"
Cohesion: 0.14
Nodes (24): badgeParticipante(), RutaMapa, styles, ViajeDetalleScreen(), textoPermisoSistema(), clamp(), ParametrosGrupoCard(), Props (+16 more)

### Community 14 - "expo-router"
Cohesion: 0.06
Nodes (17): RutasScreen(), styles, TabRutas, Props, SegmentTabItem, SegmentTabs(), styles, Theme (+9 more)

### Community 15 - "useRoutePlanner.ts"
Cohesion: 0.07
Nodes (47): REGION_FALLBACK, CameraTarget, crearWaypoint(), formatDistance(), formatDuration(), mensajeErrorRuta(), useRoutePlanner(), cargarRutaExistente() (+39 more)

### Community 16 - "viajes.router.ts"
Cohesion: 0.07
Nodes (33): adapter, pool, prisma, alertasHandlers, c, service, c, checklistHandlers (+25 more)

### Community 17 - "Plan de implementación — Grupos sin viajes propios"
Cohesion: 0.05
Nodes (36): gap(), Advertencias críticas, Agregar imports necesarios, Ampliar `cargar()` para cargar stats en paralelo, Archivos a modificar (en orden de dependencia), Cambio conceptual, Componente `ViajeCard` (inline en el archivo), Estado local necesario (+28 more)

### Community 18 - "ChecklistService"
Cohesion: 0.10
Nodes (22): asyncHandler(), crearChecklistController(), ActualizarItemInput, actualizarItemSchema, AgregarItemInput, agregarItemSchema, ImportarChecklistInput, importarChecklistSchema (+14 more)

### Community 19 - "expo"
Cohesion: 0.05
Nodes (41): backgroundColor, foregroundImage, adaptiveIcon, edgeToEdgeEnabled, package, permissions, predictiveBackGestureEnabled, softwareKeyboardLayoutMode (+33 more)

### Community 20 - "privacidad.service.ts"
Cohesion: 0.13
Nodes (15): obtenerMotorEventos(), asyncHandler(), crearPrivacidadController(), ActualizarPrivacidadUsuarioInput, actualizarPrivacidadUsuarioSchema, ActualizarPrivacidadViajeInput, actualizarPrivacidadViajeSchema, VERSION_CONSENTIMIENTO_UBICACION (+7 more)

### Community 21 - "dependencies"
Cohesion: 0.05
Nodes (42): dependencies, expo, expo-camera, expo-constants, expo-crypto, expo-file-system, expo-font, expo-haptics (+34 more)

### Community 22 - "gastos.service.ts"
Cohesion: 0.11
Nodes (19): asyncHandler(), crearGastosController(), ActualizarGastoInput, actualizarGastoSchema, CrearGastoInput, crearGastoSchema, calcularLiquidacion(), GastoConRelaciones (+11 more)

### Community 23 - "alertas.tsx"
Cohesion: 0.14
Nodes (20): AlertaBanner(), Props, styles, AlertaGrupalBanner(), Props, styles, AlertMarker(), alertMarkerKey() (+12 more)

### Community 24 - "httpError.ts"
Cohesion: 0.13
Nodes (15): asyncHandler(), crearRutasCompartidasController(), lineStringSchema, plantillaIdParamSchema, RutaSnapshot, rutaSnapshotParadaSchema, rutaSnapshotSchema, shareTokenParamSchema (+7 more)

### Community 25 - "lugares.service.ts"
Cohesion: 0.11
Nodes (20): asyncHandler(), crearLugaresController(), c, lugaresRouter, service, BuscarCercanosQuery, buscarCercanosQuerySchema, BuscarEnRutaInput (+12 more)

### Community 26 - "routing.service.ts"
Cohesion: 0.10
Nodes (24): asyncHandler(), crearRoutingController(), CalcularRutaInput, calcularRutaSchema, PerfilRuta, perfilRutaSchema, assertOk(), calcularConGoogle() (+16 more)

### Community 27 - "[viajeId]/privacidad.tsx"
Cohesion: 0.19
Nodes (12): fechaCorta(), PrivacidadScreen(), styles, fechaAccesible(), PrivacidadViajeScreen(), styles, AvisoUbicacion(), PUNTOS_CONSENTIMIENTO_UBICACION (+4 more)

### Community 28 - "express"
Cohesion: 0.11
Nodes (26): requireSuperadmin(), requireUser(), adminRouter, c, service, amistadesRouter, c, service (+18 more)

### Community 29 - "haversineDistanceM"
Cohesion: 0.10
Nodes (29): agregarPunto(), LocationTick, Options, useBreadcrumbTrail(), Destino, Options, useLlegadaDestino(), Options (+21 more)

### Community 30 - "trackingControl.ts"
Cohesion: 0.16
Nodes (21): velocidadImplicitaKmh(), DEFAULT, POR_ACTIVIDAD, TICK_TARGET_MS, TrackingConfig, trackingConfigPorActividad(), aceptarMuestra(), detenerTrackingViaje() (+13 more)

### Community 31 - "AuthContext.tsx"
Cohesion: 0.09
Nodes (14): AuthContext, AuthContextValue, AuthProvider(), displayNombre(), loadProfile(), mergeBackendProfile(), ProfileData, profileKey() (+6 more)

### Community 32 - "crear.tsx"
Cohesion: 0.13
Nodes (27): Fecha y hora — UTC-3 (RN-105), CrearViajeScreen(), fechaPorDefecto(), formatearFechaHora(), styles, Collapsible(), ACTIVIDADES, actividadInicialDesdePerfil() (+19 more)

### Community 33 - "frontend/package.json"
Cohesion: 0.07
Nodes (27): @mapbox/polyline, typescript, main, name, private, version, expo-camera, expo-file-system (+19 more)

### Community 34 - "clima.service.ts"
Cohesion: 0.11
Nodes (15): AlertaClima, ClimaService, ClimaViaje, codigoImplicaLluvia(), descripcionCodigoTiempo(), fechaIso(), OpenMeteoHourly, OpenMeteoRespuesta (+7 more)

### Community 35 - "react-native"
Cohesion: 0.07
Nodes (34): LoginScreen(), mensajeFirebase(), styles, TabBarIcon(), TabLayout(), CenterViajesTabButton(), styles, Props (+26 more)

### Community 36 - "backend/package.json"
Cohesion: 0.07
Nodes (26): author, description, engines, node, @mapbox/polyline, typescript, keywords, license (+18 more)

### Community 37 - "admin.service.ts"
Cohesion: 0.12
Nodes (23): asyncHandler(), param(), uuid, ActualizarUsuarioAdminInput, actualizarUsuarioAdminSchema, busqueda, cambiarRolSistemaSchema, ListarAuditoriaQuery (+15 more)

### Community 38 - "AdminService"
Cohesion: 0.20
Nodes (4): crearAdminController(), AdminService, filtroTexto(), paginar()

### Community 39 - "geocoding.service.ts"
Cohesion: 0.10
Nodes (18): googleMapsApiKey(), asyncHandler(), crearGeocodingController(), c, geocodingRouter, service, BuscarLugaresQuery, buscarLugaresQuerySchema (+10 more)

### Community 41 - "grupos.service.ts"
Cohesion: 0.16
Nodes (19): asyncHandler(), AbandonarGrupoInput, abandonarGrupoSchema, buscarUsuariosQuerySchema, CambiarRolMiembroInput, cambiarRolMiembroSchema, CreateGrupoInput, createGrupoSchema (+11 more)

### Community 42 - "useParadas.ts"
Cohesion: 0.17
Nodes (22): lineaDirecta(), Options, ParadaEntrante, SeguirParadaActiva, SolicitudEntrante, useParadas(), cancelarSolicitudParada(), CategoriaParadaApi (+14 more)

### Community 43 - "contrato.test.ts"
Cohesion: 0.14
Nodes (11): aPlantillaOpenApi(), METODOS_HTTP, Operacion, Parametro, rutasReales(), Spec, openapiSpec, docsRouter (+3 more)

### Community 44 - "AmistadesService"
Cohesion: 0.15
Nodes (11): sendExpoPush(), asyncHandler(), crearAmistadesController(), amigoUsuarioIdParamSchema, buscarUsuariosAmistadQuerySchema, ResponderSolicitudAmistadInput, responderSolicitudAmistadSchema, SolicitarAmistadInput (+3 more)

### Community 45 - "Themed.tsx"
Cohesion: 0.18
Nodes (14): ModalScreen(), styles, NotFoundScreen(), styles, EditScreenInfo(), styles, ExternalLink(), MonoText() (+6 more)

### Community 46 - "Proposed Changes"
Cohesion: 0.09
Nodes (18): 1. Pantalla de Bienvenida y Onboarding, 2. Tablero de Inicio / Dashboard Principal, 3. Pestaña de Historial y Lista de Viajes, 4. Asistente para la Creación de Viajes (Wizard), 5. Tablero de Control y Mapa en Tiempo Real (Live Tracking), Implementación de Nuevas Funcionalidades (Fase 2), Manual Verification, [MODIFY] [crear.tsx](file:///Users/joaquinpenafort/Documents/mesh/frontend/app/viaje/crear.tsx) (+10 more)

### Community 47 - "Tiempo real — Inicio de viaje y monitoreo GPS"
Cohesion: 0.29
Nodes (6): Archivos clave, Cierre del viaje (E04/E06), División de canales, Evento TRIP_STARTED, Fuera de alcance (este ticket), Tiempo real — Inicio de viaje y monitoreo GPS

### Community 48 - "fantasma.service.ts"
Cohesion: 0.15
Nodes (12): PuntoFantasma, asyncHandler(), crearFantasmaController(), CandidatoFantasma, Fantasma, FantasmaService, interpolarRitmoConstante(), nombreDe() (+4 more)

### Community 49 - "configurar-ruta/[viajeId].tsx"
Cohesion: 0.10
Nodes (25): ConfigurarRutaScreen(), styles, AlertasViajeScreen(), styles, TarjetaAlerta(), LlegadaDestinoBanner(), Props, styles (+17 more)

### Community 50 - "TripRealtimeContext.tsx"
Cohesion: 0.20
Nodes (17): sleep(), TripRealtimeContext, TripRealtimeContextValue, TripRealtimeProvider(), vibrateAlert(), joinViajeRoom(), getSupabase(), isSupabaseConfigured() (+9 more)

### Community 51 - "postgis.ts"
Cohesion: 0.17
Nodes (17): assertLineString(), DEFAULTS, FiltrosGps, filtrosGpsPorActividad(), POR_ACTIVIDAD, computeDistanciaPuntoARutaM(), computeLineStringLengthMeters(), computeMetricasGpsPorUsuario() (+9 more)

### Community 52 - "checklist.tsx"
Cohesion: 0.20
Nodes (17): ChecklistViajeScreen(), ImportarSheet(), ItemFila(), metaOrigen(), styles, Theme, ViajeImportable, actualizarItemChecklist() (+9 more)

### Community 53 - "gastos.tsx"
Cohesion: 0.17
Nodes (20): run(), BalanceCard(), formatMonto(), GastoFila(), GastosViajeScreen(), styles, Theme, actualizarGasto() (+12 more)

### Community 54 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, lib, module, outDir (+10 more)

### Community 55 - "app/_layout.tsx"
Cohesion: 0.29
Nodes (9): AppStack(), RootLayout(), RootLayoutNav(), styles, unstable_settings, consumePendingReturn(), setPendingReturn(), expo-font (+1 more)

### Community 56 - "usuarios.service.ts"
Cohesion: 0.13
Nodes (16): Autenticación del handshake, Conexión, CORS, firebaseAuth, esUsuarioFirebaseInexistente(), findOrCreate, verifyIdToken, esConflictoUnico() (+8 more)

### Community 57 - "MeshDialogContext.tsx"
Cohesion: 0.16
Nodes (15): MeshDialog(), MeshDialogButton, MeshDialogVariant, Props, styles, variantColor(), variantIcon(), DialogState (+7 more)

### Community 58 - "data.jsx"
Cohesion: 0.11
Nodes (10): ACTIVIDADES, AV, estadoLabel, GROUPS, INVITES, LIVE_RIDERS, ME, PEOPLE (+2 more)

### Community 59 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, @mermaid-js/mermaid-cli, nodemon, prisma, prisma-erd-generator, @redocly/cli, supertest, ts-node (+9 more)

### Community 60 - "scripts"
Cohesion: 0.12
Nodes (17): scripts, admin:promover, build, db:deploy, db:erd, db:generate, db:migrate, db:studio (+9 more)

### Community 61 - "usuarios.router.ts"
Cohesion: 0.18
Nodes (10): asyncHandler(), crearUsuariosController(), c, service, usuariosRouter, PushTokenInput, pushTokenSchema, SyncUsuarioInput (+2 more)

### Community 62 - "sockets/index.ts"
Cohesion: 0.12
Nodes (15): createApp(), TZ_ARG, app, httpServer, io, PORT, errorHandler(), setIo() (+7 more)

### Community 63 - "ViajeRealtimeBridge.tsx"
Cohesion: 0.28
Nodes (11): confirmarEnvioEnVivo(), emitGpsPingConAck(), LocationTick, ViajeRealtimeBridge(), getMeshSocket(), dequeueGpsSample(), enqueueGpsSample(), flushGpsQueue() (+3 more)

### Community 64 - "Mesh — Frontend Mobile"
Cohesion: 0.18
Nodes (11): Configuración destacada, Convenciones de desarrollo, Desarrollo con celular físico, Estructura del proyecto, Flujo A — Casa / misma WiFi (recomendado), Flujo B — UTN / cafés / AP isolation (túneles), Mapa (Google Maps), Mesh — Frontend Mobile (+3 more)

### Community 65 - "CLAUDE.md — Mesh"
Cohesion: 0.17
Nodes (12): Actores del sistema, Backend — `backend/`, Checklist para el agente de IA, CLAUDE.md — Mesh, Documentación de negocio (Obsidian), Documentación y fuente de verdad, Frontend — `frontend/`, Grafo de conocimiento del codebase (+4 more)

### Community 66 - "Mesh — Backend"
Cohesion: 0.13
Nodes (15): Comandos, Comandos correctos, Convenciones, Estructura del proyecto, Flujo de un evento WebSocket, Flujo de una request REST, Flujo recomendado del equipo, Mesh — Backend (+7 more)

### Community 67 - "FantasmaPanel.tsx"
Cohesion: 0.19
Nodes (13): FantasmaPanel(), gapLegible(), metrosLegibles(), Props, styles, claveStorage(), estadoEn(), EstadoFantasma (+5 more)

### Community 68 - "tweaks-panel.jsx"
Cohesion: 0.21
Nodes (8): TweakColor(), TweakRadio(), TweakRow(), TweakSelect(), TweakSlider(), TweakText(), __TwkCheck(), __twkIsLight()

### Community 69 - "2. Reglas de Negocio"
Cohesion: 0.13
Nodes (15): 2.10 Reglas de Asistencia IA, 2.11 Reglas de Información de Ruta Externa, 2.12 Reglas Transversales de Fecha y Hora, 2.1 Reglas de Usuarios y Autenticación, 2.2 Reglas de Grupos, 2.3 Reglas de Viajes y Rutas, 2.4 Reglas de Ejecución en Tiempo Real, 2.5 Reglas de Alertas (+7 more)

### Community 70 - "meshSocket.ts"
Cohesion: 0.14
Nodes (19): useLeaderboard(), dbRowToMember(), LocationTick, MemberSnapshot, Options, rowToMember(), socketPayloadToMember(), useLiveLocations() (+11 more)

### Community 71 - "ui.jsx"
Cohesion: 0.15
Nodes (3): Avatar(), AvatarStack(), TABS

### Community 72 - "Pegar en Jira"
Cohesion: 0.14
Nodes (14): Alcance, Contexto de producto, Criterios de aceptación, Decisión AC-11 (duplicados), Descripción, DoR checklist, Epic / labels, Flujo (referencia) (+6 more)

### Community 73 - "dependencies"
Cohesion: 0.15
Nodes (13): dependencies, cors, dotenv, express, firebase-admin, helmet, @mapbox/polyline, pg (+5 more)

### Community 74 - "Convenciones de desarrollo"
Cohesion: 0.40
Nodes (5): Comunicación, Convenciones de desarrollo, Estilo de código, Sprints, Testing

### Community 75 - "Guion para armar la presentación de la demo — Mesh"
Cohesion: 0.11
Nodes (19): main(), Git, 0. Tu tarea, 1. Qué es Mesh (para la apertura), 2.1 Sprints ejecutados, 2.2 Estado del backlog por tier (67 historias en Jira), 2.3 Historias por épica (detalle para el slide de producto o el apéndice), 2. Cronograma: dónde estamos (datos de Jira, 16/09/2026) (+11 more)

### Community 76 - "Reglas de negocio críticas (resumen ejecutivo)"
Cohesion: 0.18
Nodes (11): Autenticación, Categorías de parada, Estados de un viaje, Estados de una alerta, Estados del integrante durante el viaje, Grupos e invitaciones, Privacidad y geolocalización — RN-110 a RN-114, Red social de recorridos (+3 more)

### Community 77 - "ClimaViajeCard.tsx"
Cohesion: 0.27
Nodes (9): ClimaViajeCard(), MOTIVO, Props, styles, AlertaClimaApi, ClimaViajeApi, iconoClima(), obtenerClimaViaje() (+1 more)

### Community 78 - "ADR — Documentación de la API: spec-first con test de contrato"
Cohesion: 0.18
Nodes (11): 1. Spec-first modular, no generación desde el código, 2. Un test de contrato como garantía, no la disciplina del equipo, 3. El spec bundleado viaja como JSON dentro de `src/`, 4. Los WebSockets se documentan en Markdown, 5. Contrato de errores uniforme, ADR — Documentación de la API: spec-first con test de contrato, Alternativas descartadas, Consecuencias (+3 more)

### Community 79 - "Documentación de la API"
Cohesion: 0.20
Nodes (10): Autenticación, Comandos, Contrato de errores, Cómo se mantiene sincronizada, Documentación de la API, Dónde vive, GeoJSON (contrato), Probar la API desde Swagger UI (+2 more)

### Community 80 - "reportes.tsx"
Cohesion: 0.08
Nodes (76): ACTIVIDADES, hoyArg(), Preset, PRESETS, rangoDe(), restarDias(), Seccion, SECCIONES (+68 more)

### Community 81 - "LiveTripHeader.tsx"
Cohesion: 0.11
Nodes (27): AVATAR_COLORS, AvatarFallback(), colorFromName(), inicialesDe(), Props, styles, estadoDe(), LiveMember (+19 more)

### Community 82 - "US — Checklist de preparativos pre-ruta"
Cohesion: 0.20
Nodes (10): API, Criterios de aceptación, Decisiones de diseño, Frontend, La US, Los tres orígenes, Modelo de datos, Pendiente (+2 more)

### Community 83 - "admin.service.test.ts"
Cohesion: 0.28
Nodes (6): armar(), armarFirebase(), armarPrisma(), desconectar, usuarioObjetivo, viajesFake

### Community 84 - "Mesh — Especificación Completa del Sistema"
Cohesion: 0.12
Nodes (17): 10. Glosario, 11. Metodología de Desarrollo, 12. Competencia y Diferenciación, 1.1 Público objetivo, 1.2 Actores del sistema, 1. ¿Qué es Mesh?, 4. Modelo de Datos — Entidades Principales, 7. Tiers de Funcionalidad (+9 more)

### Community 85 - "US — Alertas del líder e historial de viajes"
Cohesion: 0.22
Nodes (8): API, Criterios de aceptación, Decisiones de diseño, Interfaz, Las dos US, Modelo de datos, Pendiente relacionado, US — Alertas del líder e historial de viajes

### Community 86 - "US — Paradas voluntarias y solicitud de parada"
Cohesion: 0.22
Nodes (9): API, Criterios de aceptación, Decisiones de diseño, Eventos de Socket.io (room `viaje:{id}`), Interfaz, Las tres US, Modelo de datos, Métricas (+1 more)

### Community 87 - "Pegar en Jira"
Cohesion: 0.22
Nodes (9): Alcance, Contexto de producto, Criterios de aceptación, Descripción, DoR checklist, Epic / labels, Pegar en Jira, Título (+1 more)

### Community 88 - "Reglas inviolables"
Cohesion: 0.25
Nodes (8): 1. Seguridad vial — RN-070 (IRREVOCABLE), 2. Offline-first — RN-038, 3. Autorización en backend — RN-030, 4. Dos roles, sin excepciones — RN-011, 5. Secretos y `.env`, 6. Mocks y datos ficticios, 7. Documentación Swagger/OpenAPI obligatoria (backend), Reglas inviolables

### Community 89 - "android-frame.jsx"
Cohesion: 0.39
Nodes (6): AndroidAppBar(), AndroidDevice(), AndroidKeyboard(), AndroidNavBar(), AndroidStatusBar(), MD_C

### Community 90 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, android, dev, dev:mobile, dev:tunnel, ios, start, web

### Community 91 - "frontend/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, paths, strict, extends, include, firebase/auth, expo/tsconfig.base

### Community 92 - "3. Flujos del Sistema"
Cohesion: 0.25
Nodes (8): 3.1 Flujo de Registro y Autenticación, 3.2 Flujo de Gestión de Grupos, 3.3 Flujo de Creación de Viaje (Pre-viaje), 3.4 Flujo de Ejecución del Viaje (Tiempo Real), 3.5 Flujo de Finalización del Viaje, 3.6 Flujo de Ghost Tracking, 3.7 Flujo de Red Social de Recorridos, 3. Flujos del Sistema

### Community 93 - "grupos.membership.ts"
Cohesion: 0.50
Nodes (3): GrupoMembershipDb, UnirseGrupoResult, unirUsuarioAlGrupo()

### Community 94 - "Decisiones de arquitectura"
Cohesion: 0.29
Nodes (7): API-First, Base de datos geoespacial, Decisiones de arquitectura, Hosting objetivo, Mapas, Motor de eventos, Tiempo real

### Community 95 - "apiClient.ts"
Cohesion: 0.13
Nodes (18): API_BASE_URL, DEV_USER_ID, hostFromApiUrl(), hostFromMetroBundle(), hostFromUri(), isValidLanHost(), resolveApiBaseUrl(), resolveExpoDevHost() (+10 more)

### Community 96 - "app.jsx"
Cohesion: 0.29
Nodes (5): AUTH_KEYS, DENSITY, FONTS, TAB_KEYS, TWEAK_DEFAULTS

### Community 97 - "screens-live.jsx"
Cohesion: 0.48
Nodes (6): LiveMap(), LiveScreen(), RiderList(), ROUTE, statusMeta(), useLive()

### Community 98 - "adr-documentacion-api.md"
Cohesion: 0.29
Nodes (4): ADR — Mapas, rutas y búsqueda con Google Maps Platform, Consecuencias, Contexto, Decisión

### Community 99 - "6. Restricciones Técnicas y No Funcionales"
Cohesion: 0.29
Nodes (7): 6.1 Rendimiento, 6.2 Disponibilidad, 6.3 Disponibilidad Offline, 6.4 Usabilidad, 6.5 Arquitectura, 6.6 Privacidad, 6. Restricciones Técnicas y No Funcionales

### Community 100 - "apiUrl"
Cohesion: 0.07
Nodes (57): cambiarEstadoAlerta(), crearAlerta(), listarAlertas(), buscarUsuariosAmistad(), eliminarAmigo(), EliminarAmigoResponse, listarSolicitudesAmistadPendientes(), responderSolicitudAmistad() (+49 more)

### Community 101 - "Uso de cada tecnología"
Cohesion: 0.33
Nodes (6): Expo (Managed Workflow), Expo Router, React Native Reanimated, React Navigation, TypeScript, Uso de cada tecnología

### Community 102 - "Supabase Realtime — `ubicacion_viva`"
Cohesion: 0.40
Nodes (4): Paso manual obligatorio (Dashboard Supabase), Políticas RLS (incluidas en migración), Supabase Realtime — `ubicacion_viva`, Verificación rápida

### Community 103 - "reportes.service.ts"
Cohesion: 0.10
Nodes (40): asyncHandler(), crearReportesController(), armarMatrizCohortes(), clavesSerie(), completarSerie(), diaArg(), DIAS_MAXIMOS, DIAS_POR_DEFECTO (+32 more)

### Community 104 - "expo"
Cohesion: 0.40
Nodes (3): config, { getDefaultConfig }, expo

### Community 105 - "icons.jsx"
Cohesion: 0.50
Nodes (3): ACTIVITY_ICON, MeshLogo(), MeshMark()

### Community 106 - "devDependencies"
Cohesion: 0.40
Nodes (5): devDependencies, react-test-renderer, @types/mapbox__polyline, @types/react, typescript

### Community 107 - "5. Estados y Transiciones"
Cohesion: 0.40
Nodes (5): 5.1 Estados de un Viaje, 5.2 Estados de un Integrante durante el viaje, 5.3 Estados de una Alerta, 5.4 Estados de Confirmación de Asistencia, 5. Estados y Transiciones

### Community 108 - "pendientesStore.ts"
Cohesion: 0.18
Nodes (15): ensureNotifications(), PushData, registerForPushNotificationsAsync(), usePushNotifications(), emitir(), estado, listeners, Pendientes (+7 more)

### Community 109 - "privacidad.acceso.ts"
Cohesion: 0.19
Nodes (10): comparteUbicacion(), EstadoCompartir, estadoCompartirUbicacion(), filtrarQuienesComparten(), registrarAccesosUbicacion(), CON_CONSENTIMIENTO, VENTANA_ACCESO_MIN, usuario() (+2 more)

### Community 110 - "motorEventos.service.test.ts"
Cohesion: 0.14
Nodes (9): computeDistanciaPuntoARutaM, computeProgresoEnRutaM, emit, linestring, ping(), sendExpoPush, emit, procesarPing (+1 more)

### Community 111 - "backend/README.md"
Cohesion: 0.25
Nodes (3): Backend, Frontend, Mesh

## Knowledge Gaps
- **29 isolated node(s):** `@mapbox/polyline`, `@mermaid-js/mermaid-cli`, `@redocly/cli`, `@types/cors`, `@types/express` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1104 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Monitoreo en vivo (E04)` connect `privacidad.service.ts` to `meshSocket.ts`, `Tiempo real — Inicio de viaje y monitoreo GPS`, `TripRealtimeContext.tsx`, `trackingControl.ts`, `ViajeRealtimeBridge.tsx`?**
  _High betweenness centrality (0.340) - this node is a cross-community bridge._
- **What connects `@mapbox/polyline`, `@mermaid-js/mermaid-cli`, `@redocly/cli` to the rest of the system?**
  _29 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `live.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07337662337662337 - nodes in this community are weakly interconnected._
- **Why does `obtenerMotorEventos()` connect `privacidad.service.ts` to `HttpError`, `motorEventos.service.ts`, `viajes.service.ts`, `motorEventos.service.test.ts`?**
  _High betweenness centrality (0.332) - this node is a cross-community bridge._
- **Should `meshAlert` be split into smaller, more focused modules?**
  _Cohesion score 0.10784708249496981 - nodes in this community are weakly interconnected._
- **Why does `HttpError` connect `HttpError` to `ParadasService`, `clima.service.ts`, `admin.service.ts`, `AdminService`, `@prisma/client`, `geocoding.service.ts`, `grupos.service.ts`, `GruposService`, `AmistadesService`, `viajes.service.ts`, `fantasma.service.ts`, `ChecklistService`, `privacidad.service.ts`, `gastos.service.ts`, `httpError.ts`, `lugares.service.ts`, `routing.service.ts`, `sockets/index.ts`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **Should `ParadasService` be split into smaller, more focused modules?**
  _Cohesion score 0.06456140350877193 - nodes in this community are weakly interconnected._