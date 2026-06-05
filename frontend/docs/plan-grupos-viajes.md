# Plan de implementación — Grupos sin viajes propios

> **Contexto:** RN-027 establece que los grupos son listas persistentes de contactos, no contenedores de viajes. Al crear un viaje se puede invitar a uno o más grupos en bloque (RN-028). Este plan ajusta el frontend para reflejar esa lógica y alinear la UI con el mock de referencia en `/frontend/mock/mesh/`.
>
> **Mock de referencia:** `screens-trips.jsx` (`CreateTripScreen`) y `screens-main.jsx` (`GroupDetailScreen`).
>
> **Regla:** cero colores hardcodeados — todo vía `useTheme()` o `Colors.dark.*` para config estática de navegadores.

---

## Cambio conceptual

| Antes (incorrecto) | Después (RN-027/028/029) |
|---|---|
| El grupo "contiene" viajes | El grupo es una **lista de contactos** persistente |
| Navegar al grupo para ver sus viajes | Crear un viaje e **invitar grupos en bloque** |
| El grupo es el origen del viaje | El viaje es independiente; el grupo es solo un canal de invitación |

---

## Archivos a modificar (en orden de dependencia)

### TAREA 1 — Extender tipo `ViajePlanificadoApi`

**Archivo:** `frontend/lib/viajesApi.ts`

Agregar dos campos opcionales que el backend ya guarda en la tabla `Viaje`:

```typescript
export type ViajePlanificadoApi = {
  id: string
  creador_id: string
  es_grupal: boolean
  tipo_actividad: TipoActividadApi
  fecha_programada: string
  estado: 'planificado' | 'en_curso' | 'finalizado'
  mi_estado: 'creador' | 'confirmado' | 'pendiente' | 'rechazado' | null
  grupo_id?: string | null        // ← NUEVO
  grupo_nombre?: string | null    // ← NUEVO (join en backend)
}
```

**Por qué:** las tarjetas de viaje necesitan mostrar el grupo asociado, y `grupo/[grupoId]/index.tsx` filtra viajes por `grupo_id` del lado cliente.

---

### TAREA 2 — Reescribir `viaje/crear.tsx` como wizard de 3 pasos

**Archivo:** `frontend/app/viaje/crear.tsx`

**Referencia exacta:** mock `CreateTripScreen` en `screens-trips.jsx`.

#### Estado local necesario

```typescript
const { grupo: grupoParam } = useLocalSearchParams<{ grupo?: string }>()

const [step, setStep] = useState(0)  // 0 | 1 | 2
const [tipoActividad, setTipoActividad] = useState<TipoActividadApi>('moto')
const [salida, setSalida] = useState('')
const [destino, setDestino] = useState('')
const [fecha, setFecha] = useState('')
const [hora, setHora] = useState('09:00')
const [modalidad, setModalidad] = useState<'grupal' | 'individual'>(
  grupoParam ? 'grupal' : 'grupal'
)
const [gruposSeleccionados, setGruposSeleccionados] = useState<Set<string>>(
  new Set(grupoParam ? [grupoParam] : [])
)
const [grupos, setGrupos] = useState<GrupoListItemApi[]>([])
const [cargandoGrupos, setCargandoGrupos] = useState(false)
const [guardando, setGuardando] = useState(false)
```

Cargar grupos con `listarGrupos(userId)` dentro de `useFocusEffect` (igual que actualmente).

#### Paso 0 — Actividad

- Título: `"¿Qué van a hacer?"`
- Subtítulo: `"Elegí la actividad de la salida."`
- 4 tarjetas en grid 2×2 usando `View` con `flexWrap: 'wrap'` y `gap`
- Cada tarjeta: `Pressable` + `ActivityTile` de MeshUI + label texto
- Borde `theme.accentLine` y fondo `theme.accentWeak` cuando seleccionada, `theme.border` y `theme.surface` en reposo

#### Paso 1 — Recorrido

- Título: `"El recorrido"`
- Subtítulo: `"Definí salida y destino."`
- `Field` de MeshUI `label="Punto de salida"` `icon="navigation"` `value={salida}` `onChangeText={setSalida}`
- `Field` de MeshUI `label="Destino"` `icon="flag"` `value={destino}` `onChangeText={setDestino}`
- Fila horizontal (`flexDirection: 'row'`, `gap: 12`):
  - `Field` `label="Fecha"` `icon="calendar"` `value={fecha}` `onChangeText={setFecha}` `style={{ flex: 1 }}`
  - `Field` `label="Hora"` `icon="clock"` `value={hora}` `onChangeText={setHora}` `style={{ flex: 1 }}`

> **Importante:** salida/destino/fecha/hora no se envían al backend en `crearViaje()` — la API actual no acepta esos campos. Se guardan en state local por UX. La configuración real de ruta se hace después en `/configurar-ruta/[viajeId]`. No inventar campos en la llamada a la API.

#### Paso 2 — ¿Quiénes van?

- Título: `"¿Quiénes van?"`
- Subtítulo: `"Invitá grupos en bloque o sumá gente después por QR."`
- Dos tarjetas toggle `Grupal` / `Individual`:
  - `Grupal` sub: `"Invitar por grupos"` → muestra lista de grupos
  - `Individual` sub: `"Sin invitados"` → oculta la lista, llama `setGruposSeleccionados(new Set())`
- Si `modalidad === 'grupal'`: lista de grupos con checkbox visual
  - Cada fila: ícono de grupo (con color generado), nombre, cantidad de miembros, checkbox
  - Checkbox: borde `theme.accent` + fondo `theme.accent` + checkmark cuando seleccionado
- Si 0 grupos seleccionados siendo grupal: se puede crear igual (no es error, el QR suma gente después)
- Si `cargandoGrupos`: mostrar `ActivityIndicator`
- Si lista vacía: `"No tenés grupos. Creá uno en la pestaña Grupos."`

#### Layout general (todos los pasos)

```
<Stack.Screen options={{ headerShown: false }} />
<TopBar
  title="Nuevo viaje"
  onBack={step === 0 ? () => router.back() : () => setStep(s => s - 1)}
  bordered={false}
/>

{/* Barra de progreso */}
<View style={[styles.track, { backgroundColor: theme.surface2 }]}>
  <View style={[styles.trackFill, {
    width: `${((step + 1) / 3) * 100}%`,
    backgroundColor: theme.accent
  }]} />
</View>

<ScrollView key={step}>
  {/* contenido del step actual */}
</ScrollView>

{/* Botón sticky inferior */}
<View style={[styles.footer, { borderTopColor: theme.border }]}>
  <Btn
    variant="primary"
    size="lg"
    block
    iconRight={step === 2 ? 'check-square' : 'arrow-right'}
    onPress={handleNext}
    disabled={guardando}
  >
    {step === 2 ? 'Crear y generar QR' : 'Continuar'}
  </Btn>
</View>
```

Styles mínimos nuevos:
```typescript
track: { height: 3, marginHorizontal: 20, borderRadius: 2, marginBottom: 4 }
trackFill: { height: '100%', borderRadius: 2, transition: 'width 0.3s' }
footer: { padding: 20, borderTopWidth: 1 }
```

#### `handleNext`

```typescript
const handleNext = () => {
  if (step < 2) {
    setStep(s => s + 1)
    return
  }
  void handleCrear()
}

const handleCrear = async () => {
  setGuardando(true)
  try {
    const userId = resolveBackendUserId(backendUserId)
    const fecha = new Date()
    fecha.setDate(fecha.getDate() + 7)
    fecha.setHours(9, 0, 0, 0)

    const viaje = await crearViaje({
      esGrupal: modalidad === 'grupal',
      grupoIds: modalidad === 'grupal' ? [...gruposSeleccionados] : [],
      tipoActividad,
      fechaProgramada: fecha,
    }, userId)

    // Va al QR (no al detalle) — igual que el mock
    router.replace({ pathname: '/viaje/[viajeId]/qr', params: { viajeId: viaje.id } })
  } catch (e: unknown) {
    Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo crear el viaje.')
  } finally {
    setGuardando(false)
  }
}
```

---

### TAREA 3 — Refactor UI de `(tabs)/two.tsx`

**Archivo:** `frontend/app/(tabs)/two.tsx`

**Referencia:** mock `ViajesScreen` en `screens-trips.jsx`.

#### Agregar imports necesarios

```typescript
import { useTheme, ActivityTile, Badge } from '@/components/MeshUI'
import { Feather } from '@expo/vector-icons'
```

#### Nuevo estado

```typescript
const [filtro, setFiltro] = useState<'todos' | 'en_curso' | 'planificado' | 'finalizado'>('todos')
```

#### Lista filtrada y ordenada

```typescript
const ordenEstado: Record<string, number> = { en_curso: 0, planificado: 1, finalizado: 2 }

const listaFiltrada = viajes
  .filter(v => filtro === 'todos' || v.estado === filtro)
  .sort((a, b) => (ordenEstado[a.estado] ?? 3) - (ordenEstado[b.estado] ?? 3))
```

#### Estructura del componente

```tsx
<View style={[styles.container, { backgroundColor: theme.background }]}>
  <Stack.Screen options={{ headerShown: false }} />
  <TopBar title="Viajes" bordered={false} />

  {/* Filter chips — fuera del ScrollView */}
  <View style={styles.chipsRow}>
    {([
      ['todos', 'Todos'],
      ['en_curso', 'En curso'],
      ['planificado', 'Próximos'],
      ['finalizado', 'Pasados'],
    ] as const).map(([k, l]) => (
      <Pressable
        key={k}
        style={[styles.chip,
          filtro === k
            ? { backgroundColor: theme.accent, borderColor: theme.accent }
            : { backgroundColor: theme.surface, borderColor: theme.border }
        ]}
        onPress={() => setFiltro(k)}
      >
        <Text style={[styles.chipText, { color: filtro === k ? theme.onAccent : theme.textDim }]}>
          {l}
        </Text>
      </Pressable>
    ))}
  </View>

  <ScrollView refreshControl={...}>
    {/* Invitaciones pendientes (rediseñadas con Btn de MeshUI) */}
    {invitaciones.length > 0 && (
      <View style={styles.section}>
        {/* ... preservar lógica de responder(), rediseñar con Btn variant="primary"/"secondary" size="sm" */}
      </View>
    )}

    {/* Lista de viajes */}
    {cargando ? (
      <ActivityIndicator color={theme.accent} size="large" style={{ marginTop: 48 }} />
    ) : listaFiltrada.length === 0 ? (
      <Text style={[styles.vacio, { color: theme.textDim }]}>
        {filtro === 'todos' ? 'No tenés viajes todavía.' : 'No hay viajes en esta categoría.'}
      </Text>
    ) : (
      listaFiltrada.map(v => <ViajeCard key={v.id} viaje={v} onPress={...} />)
    )}
  </ScrollView>

  {/* FAB */}
  <Pressable
    style={[styles.fab, { backgroundColor: theme.accent }]}
    onPress={() => router.push('/viaje/crear')}
  >
    <Feather name="plus" size={20} color={theme.onAccent} />
    <Text style={[styles.fabText, { color: theme.onAccent }]}>Nuevo viaje</Text>
  </Pressable>
</View>
```

#### Componente `ViajeCard` (inline en el archivo)

```tsx
function ViajeCard({ viaje, onPress }: { viaje: ViajePlanificadoApi; onPress: () => void }) {
  const theme = useTheme()
  const toneBadge = viaje.estado === 'en_curso' ? 'live'
    : viaje.estado === 'planificado' ? 'accent' : 'mute'
  const estadoLabel = { en_curso: 'En curso', planificado: 'Planificado', finalizado: 'Finalizado' }
  const miEstadoLabel = {
    creador: 'Creador', confirmado: 'Confirmado',
    pendiente: 'Pendiente', rechazado: 'Rechazado'
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.card, {
        backgroundColor: pressed ? theme.surface2 : theme.surface,
        borderColor: theme.border,
      }]}
      onPress={onPress}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <ActivityTile activity={viaje.tipo_actividad} />
          <View style={{ marginLeft: 12 }}>
            <Text style={[styles.cardTitulo, { color: theme.text }]}>
              {etiquetaActividad(viaje.tipo_actividad)}
            </Text>
            {viaje.grupo_nombre && (
              <Text style={[styles.cardSub, { color: theme.textDim }]}>
                {viaje.grupo_nombre}
              </Text>
            )}
          </View>
        </View>
        <Badge tone={toneBadge} pulse={viaje.estado === 'en_curso'}>
          {estadoLabel[viaje.estado]}
        </Badge>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <View style={styles.cardBottom}>
        <View style={styles.cardMeta}>
          <Feather name="calendar" size={13} color={theme.textMute} />
          <Text style={[styles.cardMetaText, { color: theme.textDim }]}>
            {formatearFecha(viaje.fecha_programada)}
          </Text>
        </View>
        {viaje.mi_estado && (
          <Text style={[styles.miEstado, { color: theme.textDim }]}>
            {miEstadoLabel[viaje.mi_estado] ?? viaje.mi_estado}
          </Text>
        )}
      </View>
    </Pressable>
  )
}
```

Styles adicionales necesarios:
```typescript
chipsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 12 }
chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 }
chipText: { fontSize: 13, fontWeight: '600' }
section: { paddingHorizontal: 20, marginBottom: 8 }
vacio: { fontSize: 14, textAlign: 'center', marginTop: 48, paddingHorizontal: 32 }
card: { borderRadius: 14, borderWidth: 1.2, padding: 16, marginHorizontal: 20, marginBottom: 12 }
cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }
cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 }
cardTitulo: { fontSize: 15, fontWeight: '700' }
cardSub: { fontSize: 13, marginTop: 2 }
divider: { height: 1, marginVertical: 12 }
cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }
cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 }
cardMetaText: { fontSize: 13 }
miEstado: { fontSize: 12, fontWeight: '600' }
fab: { position: 'absolute', bottom: 24, right: 20, flexDirection: 'row', alignItems: 'center',
       gap: 8, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 28,
       shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 }
fabText: { fontSize: 15, fontWeight: '700' }
```

---

### TAREA 4 — Añadir stats reales + sección "Viajes del grupo" en `grupo/[grupoId]/index.tsx`

**Archivo:** `frontend/app/grupo/[grupoId]/index.tsx`

#### Nuevos imports

```typescript
import { listarMiembrosGrupo } from '@/lib/gruposApi'
import {
  listarViajesPlanificados,
  type ViajePlanificadoApi,
} from '@/lib/viajesApi'
import { ActivityTile, Badge } from '@/components/MeshUI'
```

#### Nuevo estado

```typescript
const [miembrosCount, setMiembrosCount] = useState<number | null>(null)
const [viajesGrupo, setViajesGrupo] = useState<ViajePlanificadoApi[]>([])
```

#### Ampliar `cargar()` para cargar stats en paralelo

Reemplazar el `try` de `cargar` para incluir las dos llamadas adicionales:

```typescript
const [detalle, miembros, todosViajes] = await Promise.all([
  obtenerGrupo(grupoId, userId),
  listarMiembrosGrupo(grupoId, userId),
  listarViajesPlanificados(userId),
])
setGrupo(detalle)
setMiembrosCount(miembros.length)
setViajesGrupo(todosViajes.filter(v => v.grupo_id === grupoId))
```

> Si el backend todavía no retorna `grupo_id` en `listarViajesPlanificados`, el filtro devuelve array vacío y la sección muestra el estado vacío. No es un bug — es el comportamiento correcto hasta que el backend lo soporte.

#### Stats card — reemplazar `"--"` con datos reales

```tsx
// Antes:
<Text style={[styles.statValue, { color: theme.text }]}>--</Text>  // Miembros
<Text style={[styles.statValue, { color: theme.text }]}>--</Text>  // Viajes

// Después:
<Text style={[styles.statValue, { color: theme.text }]}>
  {miembrosCount ?? '--'}
</Text>
<Text style={[styles.statValue, { color: theme.text }]}>
  {viajesGrupo.length > 0 ? viajesGrupo.length : '--'}
</Text>
```

#### Sección nueva "Viajes del grupo"

Insertar entre `linksContainer` y `zonaPeligro` (dentro del `<>` del render principal):

```tsx
{/* Viajes del grupo */}
<View>
  <Text style={[styles.sectionEyebrow, { color: theme.textMute }]}>
    VIAJES DEL GRUPO
  </Text>

  {viajesGrupo.length === 0 ? (
    <Text style={[styles.viajesVacio, { color: theme.textDim }]}>
      Todavía no hay viajes en este grupo.
    </Text>
  ) : (
    <View style={styles.viajesStack}>
      {viajesGrupo.map(v => {
        const tone = v.estado === 'en_curso' ? 'live'
          : v.estado === 'planificado' ? 'accent' : 'mute'
        const estadoLabel = {
          en_curso: 'En curso', planificado: 'Planificado', finalizado: 'Finalizado',
        }
        return (
          <Pressable
            key={v.id}
            style={({ pressed }) => [
              styles.viajeRow,
              {
                backgroundColor: pressed ? theme.surface2 : theme.surface,
                borderColor: theme.border,
              },
            ]}
            onPress={() =>
              router.push({ pathname: '/viaje/[viajeId]', params: { viajeId: v.id } })
            }
          >
            <ActivityTile activity={v.tipo_actividad as TipoActividadApi} />
            <View style={styles.viajeInfo}>
              <Text style={[styles.viajeTipo, { color: theme.text }]}>
                {etiquetaActividad(v.tipo_actividad)}
              </Text>
              <Text style={[styles.viajeFecha, { color: theme.textDim }]}>
                {formatearFecha(v.fecha_programada)}
              </Text>
            </View>
            <Badge tone={tone} pulse={v.estado === 'en_curso'}>
              {estadoLabel[v.estado]}
            </Badge>
          </Pressable>
        )
      })}
    </View>
  )}
</View>
```

Agregar helpers locales al archivo (copiar de `two.tsx`):

```typescript
function etiquetaActividad(tipo: string): string {
  const map: Record<string, string> = {
    moto: 'Moto', bici: 'Bici', running: 'Running', trekking: 'Trekking',
  }
  return map[tipo] ?? tipo
}
```

Styles nuevos:
```typescript
sectionEyebrow: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8,
                  textTransform: 'uppercase', fontFamily: 'SpaceMono', marginBottom: 10 }
viajesVacio: { fontSize: 13.5, fontStyle: 'italic' }
viajesStack: { gap: 10 }
viajeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
            borderRadius: 13, borderWidth: 1.2 }
viajeInfo: { flex: 1 }
viajeTipo: { fontSize: 14.5, fontWeight: '700' }
viajeFecha: { fontSize: 12.5, marginTop: 2 }
```

---

## Navegación resultante

```
Grupos (tab)
  └─ Grupo detalle
       ├─ [btn] Nuevo viaje     →  /viaje/crear?grupo=X
       │                              └─ step 2 pre-selecciona grupo X
       ├─ [li]  Miembros        →  /grupo/[id]/miembros
       ├─ [li]  Invitar personas →  /grupo/[id]/invitar-desde-grupos
       └─ [nueva sección] Viajes del grupo  →  /viaje/[id]

Viajes (tab)
  ├─ Chips: Todos | En curso | Próximos | Pasados
  ├─ Invitaciones pendientes (lógica existente, UI con MeshUI)
  ├─ Lista filtrada de viajes (ViajeCard)
  └─ FAB → /viaje/crear

/viaje/crear  (wizard nuevo)
  step 0: actividad (grid 2×2 con ActivityTile)
  step 1: recorrido (salida / destino / fecha / hora)
  step 2: ¿quiénes van? (individual / grupal + grupos)
       └─ crear  →  /viaje/[id]/qr   ← cambia: antes iba al detalle
```

---

## Lo que NO cambia

- `frontend/app/grupo/[grupoId]/miembros.tsx`
- `frontend/app/grupo/[grupoId]/invitar-desde-grupos.tsx`
- `frontend/app/viaje/[viajeId]/index.tsx`
- `frontend/app/viaje/[viajeId]/qr.tsx`
- `frontend/app/viaje/[viajeId]/live.tsx`
- `frontend/components/MeshUI.tsx`
- Todo el backend

---

## Advertencias críticas

1. **Step 1 del wizard no persiste salida/destino en el backend.** `crearViaje()` no acepta esos campos. Se guardan en state local por UX. No agregar campos inventados a la llamada a la API.

2. **`grupo_id` en `ViajePlanificadoApi` puede no llegar del backend todavía.** Si es `undefined`, el filtro `v.grupo_id === grupoId` devuelve vacío — eso es correcto. No hacer workarounds.

3. **`ActivityTile` de MeshUI acepta exactamente** `'moto' | 'bici' | 'running' | 'trekking'`. No usar strings distintos.

4. **La navegación post-creación cambia:** de `/viaje/[id]` (detalle) a `/viaje/[id]/qr`. Verificar que `qr.tsx` funcione correctamente como destino de `router.replace`.

5. **`listarMiembrosGrupo` se llama ahora en `cargar()` en lugar de solo en `iniciarAbandono()`**. Asegurarse de que no haya conflicto de estado entre ambas llamadas.
