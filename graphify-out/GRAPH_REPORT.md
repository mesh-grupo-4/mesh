# Graph Report - D:\TESIS\mesh  (2026-06-19)

## Corpus Check
- 128 files · ~73,966 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 470 nodes · 587 edges · 96 communities detected
- Extraction: 66% EXTRACTED · 34% INFERRED · 0% AMBIGUOUS · INFERRED: 197 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]

## God Nodes (most connected - your core abstractions)
1. `meshFetch()` - 34 edges
2. `parseJson()` - 34 edges
3. `apiUrl()` - 34 edges
4. `authHeaders()` - 33 edges
5. `GruposService` - 25 edges
6. `ViajesService` - 17 edges
7. `resolveBackendUserId()` - 12 edges
8. `AmistadesService` - 10 edges
9. `solicitarAmistad()` - 7 edges
10. `ejecutarIniciar()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `ejecutarRespuesta()` --calls--> `responderInvitacion()`  [INFERRED]
  D:\TESIS\mesh\frontend\app\(tabs)\grupos.tsx → D:\TESIS\mesh\frontend\lib\gruposApi.ts
- `handleCrear()` --calls--> `crearGrupo()`  [INFERRED]
  D:\TESIS\mesh\frontend\app\(tabs)\grupos.tsx → D:\TESIS\mesh\frontend\lib\gruposApi.ts
- `responder()` --calls--> `responderInvitacionViaje()`  [INFERRED]
  D:\TESIS\mesh\frontend\app\(tabs)\two.tsx → D:\TESIS\mesh\frontend\lib\viajesApi.ts
- `ejecutarSolicitud()` --calls--> `solicitarAmistad()`  [INFERRED]
  D:\TESIS\mesh\frontend\app\amigos\index.tsx → D:\TESIS\mesh\frontend\lib\amistadesApi.ts
- `ejecutarEliminar()` --calls--> `eliminarAmigo()`  [INFERRED]
  D:\TESIS\mesh\frontend\app\amigos\index.tsx → D:\TESIS\mesh\frontend\lib\amistadesApi.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.16
Nodes (41): buscarUsuariosAmistad(), eliminarAmigo(), listarAmigos(), listarSolicitudesAmistadPendientes(), responderSolicitudAmistad(), solicitarAmistad(), apiUrl(), authHeaders() (+33 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (16): resolveBackendUserId(), handleCrear(), ejecutarRespuesta(), handleCrear(), cargar(), confirmarAbandonoParticipante(), confirmarTransferenciaYAbandono(), ejecutarAbandono() (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (12): avColor(), fechaCorta(), fechaLarga(), fullName(), hora(), initials(), GroupDetailScreen(), InicioScreen() (+4 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (1): GruposService

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (13): loadProfile(), profileKey(), saveProfile(), useAuth(), buildRoutePointsPayload(), linestringToLatLng(), toPutRutaBody(), waypointsFromRutaDetalle() (+5 more)

### Community 5 - "Community 5"
Cohesion: 0.1
Nodes (4): assertLineString(), getIo(), computeLineStringLengthMeters(), ViajesService

### Community 6 - "Community 6"
Cohesion: 0.1
Nodes (8): ejecutarIniciar(), onFin(), clearTrackingContext(), setTrackingContext(), connectMeshSocket(), detenerTrackingViaje(), iniciarTrackingViaje(), solicitarPermisosUbicacion()

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (2): App(), useTweaks()

### Community 8 - "Community 8"
Cohesion: 0.16
Nodes (5): useTheme(), Text(), useThemeColor(), View(), useColorScheme()

### Community 9 - "Community 9"
Cohesion: 0.18
Nodes (1): AmistadesService

### Community 10 - "Community 10"
Cohesion: 0.2
Nodes (4): socketRequireUser(), requireUser(), findOrCreateByFirebaseUid(), UsuariosService

### Community 11 - "Community 11"
Cohesion: 0.22
Nodes (0): 

### Community 12 - "Community 12"
Cohesion: 0.28
Nodes (4): actividadInicialDesdePerfil(), actividadValida(), parametrosPorActividad(), textoParametrosActividad()

### Community 13 - "Community 13"
Cohesion: 0.25
Nodes (2): buscarLugares(), run()

### Community 14 - "Community 14"
Cohesion: 0.29
Nodes (0): 

### Community 15 - "Community 15"
Cohesion: 0.33
Nodes (3): byId(), LiveScreen(), useLive()

### Community 16 - "Community 16"
Cohesion: 0.67
Nodes (5): hostFromApiUrl(), hostFromUri(), isTunnelApiUrl(), resolveApiBaseUrl(), resolveExpoDevHost()

### Community 17 - "Community 17"
Cohesion: 0.33
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 0.67
Nodes (2): handleNextStep(), telefonoArgentinoValido()

### Community 19 - "Community 19"
Cohesion: 0.5
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 0.5
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 0.67
Nodes (2): AvatarFallback(), colorFromName()

### Community 22 - "Community 22"
Cohesion: 0.5
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 0.83
Nodes (3): enqueueGpsSample(), flushGpsQueue(), openDb()

### Community 24 - "Community 24"
Cohesion: 0.5
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 0.67
Nodes (1): HttpError

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (2): asyncHandler(), crearAmistadesController()

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (2): asyncHandler(), crearGruposController()

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (2): asyncHandler(), crearUsuariosController()

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (2): asyncHandler(), crearViajesController()

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (2): compartirImagen(), compartirLink()

### Community 31 - "Community 31"
Cohesion: 0.67
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 0.67
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 0.67
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 0.67
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Community 61"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Community 62"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Community 63"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Community 65"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Community 66"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "Community 67"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "Community 68"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "Community 69"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "Community 70"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "Community 71"
Cohesion: 1.0
Nodes (0): 

### Community 72 - "Community 72"
Cohesion: 1.0
Nodes (0): 

### Community 73 - "Community 73"
Cohesion: 1.0
Nodes (0): 

### Community 74 - "Community 74"
Cohesion: 1.0
Nodes (0): 

### Community 75 - "Community 75"
Cohesion: 1.0
Nodes (0): 

### Community 76 - "Community 76"
Cohesion: 1.0
Nodes (0): 

### Community 77 - "Community 77"
Cohesion: 1.0
Nodes (0): 

### Community 78 - "Community 78"
Cohesion: 1.0
Nodes (0): 

### Community 79 - "Community 79"
Cohesion: 1.0
Nodes (0): 

### Community 80 - "Community 80"
Cohesion: 1.0
Nodes (0): 

### Community 81 - "Community 81"
Cohesion: 1.0
Nodes (0): 

### Community 82 - "Community 82"
Cohesion: 1.0
Nodes (0): 

### Community 83 - "Community 83"
Cohesion: 1.0
Nodes (0): 

### Community 84 - "Community 84"
Cohesion: 1.0
Nodes (0): 

### Community 85 - "Community 85"
Cohesion: 1.0
Nodes (0): 

### Community 86 - "Community 86"
Cohesion: 1.0
Nodes (0): 

### Community 87 - "Community 87"
Cohesion: 1.0
Nodes (0): 

### Community 88 - "Community 88"
Cohesion: 1.0
Nodes (0): 

### Community 89 - "Community 89"
Cohesion: 1.0
Nodes (0): 

### Community 90 - "Community 90"
Cohesion: 1.0
Nodes (0): 

### Community 91 - "Community 91"
Cohesion: 1.0
Nodes (0): 

### Community 92 - "Community 92"
Cohesion: 1.0
Nodes (0): 

### Community 93 - "Community 93"
Cohesion: 1.0
Nodes (0): 

### Community 94 - "Community 94"
Cohesion: 1.0
Nodes (0): 

### Community 95 - "Community 95"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 35`** (2 nodes): `errorHandler.ts`, `errorHandler()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (2 nodes): `grupos.membership.ts`, `unirUsuarioAlGrupo()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (2 nodes): `viajes.membership.ts`, `unirUsuarioAlViaje()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (2 nodes): `viajes.unirse-qr.test.ts`, `createMockPrisma()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `index.ts`, `registerSocketHandlers()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (2 nodes): `+html.tsx`, `Root()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (2 nodes): `+not-found.tsx`, `NotFoundScreen()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (2 nodes): `modal.tsx`, `ModalScreen()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (2 nodes): `login.tsx`, `handleLogin()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (2 nodes): `_layout.tsx`, `AuthLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (2 nodes): `index.tsx`, `InicioScreen()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (2 nodes): `_layout.tsx`, `TabBarIcon()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (2 nodes): `_layout.tsx`, `ConfigurarRutaLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (2 nodes): `[viajeId].tsx`, `GrupoViajeQrRedirect()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (2 nodes): `toggle()`, `Collapsible.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (2 nodes): `EditScreenInfo.tsx`, `EditScreenInfo()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (2 nodes): `StyledText.tsx`, `MonoText()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (2 nodes): `Toast.tsx`, `Toast()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (2 nodes): `useClientOnlyValue.ts`, `useClientOnlyValue()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (2 nodes): `useClientOnlyValue.web.ts`, `useClientOnlyValue()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (2 nodes): `MapPickOverlay.tsx`, `MapPickOverlay()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (2 nodes): `mapStyles.ts`, `getMapStyle()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `prisma.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `vitest.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (1 nodes): `firebase.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (1 nodes): `prisma.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (1 nodes): `qrInvite.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (1 nodes): `amistades.router.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (1 nodes): `amistades.schemas.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (1 nodes): `amistades.service.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (1 nodes): `grupos.membership.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (1 nodes): `grupos.router.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (1 nodes): `grupos.schemas.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (1 nodes): `usuarios.router.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (1 nodes): `usuarios.schemas.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (1 nodes): `activityDefaults.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (1 nodes): `viajes.router.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (1 nodes): `viajes.schemas.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (1 nodes): `express.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (1 nodes): `socket.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 77`** (1 nodes): `expo-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 78`** (1 nodes): `metro.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 79`** (1 nodes): `escanear-qr.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 80`** (1 nodes): `unirse.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 81`** (1 nodes): `_layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 82`** (1 nodes): `_layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 83`** (1 nodes): `_layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 84`** (1 nodes): `_layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 85`** (1 nodes): `ExternalLink.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 86`** (1 nodes): `TransferirLiderazgoModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 87`** (1 nodes): `useColorScheme.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 88`** (1 nodes): `MapStylePicker.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 89`** (1 nodes): `RouteTimelineConnector.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 90`** (1 nodes): `StopCategoryPicker.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 91`** (1 nodes): `WaypointNameModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 92`** (1 nodes): `StyledText-test.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 93`** (1 nodes): `Colors.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 94`** (1 nodes): `firebase.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 95`** (1 nodes): `viajesTypes.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `parseJson()` connect `Community 0` to `Community 8`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `ejecutarIniciar()` connect `Community 6` to `Community 0`, `Community 1`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `Text()` connect `Community 8` to `Community 0`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Are the 33 inferred relationships involving `meshFetch()` (e.g. with `listarAmigos()` and `listarSolicitudesAmistadPendientes()`) actually correct?**
  _`meshFetch()` has 33 INFERRED edges - model-reasoned connections that need verification._
- **Are the 33 inferred relationships involving `parseJson()` (e.g. with `listarAmigos()` and `listarSolicitudesAmistadPendientes()`) actually correct?**
  _`parseJson()` has 33 INFERRED edges - model-reasoned connections that need verification._
- **Are the 33 inferred relationships involving `apiUrl()` (e.g. with `listarAmigos()` and `listarSolicitudesAmistadPendientes()`) actually correct?**
  _`apiUrl()` has 33 INFERRED edges - model-reasoned connections that need verification._
- **Are the 31 inferred relationships involving `authHeaders()` (e.g. with `listarAmigos()` and `listarSolicitudesAmistadPendientes()`) actually correct?**
  _`authHeaders()` has 31 INFERRED edges - model-reasoned connections that need verification._