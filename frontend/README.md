# Mesh — Frontend Mobile

Aplicación mobile de la plataforma **Mesh**, desarrollada como parte de una tesis universitaria. Construida con React Native y Expo, se comunica con el backend Express + Socket.io para funcionalidad en tiempo real.

---

## Stack tecnológico

| Tecnología | Versión | Rol |
|---|---|---|
| [React Native](https://reactnative.dev/) | 0.81.5 | Framework base para apps móviles nativas |
| [Expo](https://expo.dev/) | SDK 54 | Plataforma de desarrollo y toolchain para React Native |
| [Expo Router](https://expo.github.io/router/) | v6 | Navegación basada en sistema de archivos (file-based routing) |
| [TypeScript](https://www.typescriptlang.org/) | 5.9.2 | Tipado estático sobre JavaScript |
| [React](https://react.dev/) | 19.1.0 | Librería de UI declarativa |
| [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/) | v4 | Animaciones fluidas ejecutadas en el hilo nativo |
| [@expo/vector-icons](https://icons.expo.fyi/) | v15 | Biblioteca de íconos (FontAwesome, MaterialIcons, etc.) |
| [React Navigation](https://reactnavigation.org/) | v7 | Motor de navegación subyacente usado por Expo Router |

---

## Uso de cada tecnología

### Expo (Managed Workflow)
Elimina la necesidad de mantener proyectos nativos de Xcode o Android Studio. Provee el toolchain completo: bundler Metro, Expo Go para desarrollo, y EAS Build para distribución. La configuración de la app se centraliza en `app.json`.

### Expo Router
Implementa un sistema de rutas basado en la estructura de archivos dentro de `app/`, similar a Next.js. Cada archivo `.tsx` dentro de `app/` se convierte automáticamente en una ruta navegable. Los grupos de rutas (carpetas entre paréntesis como `(tabs)`) agrupan pantallas sin afectar la URL.

### TypeScript
Modo estricto habilitado (`"strict": true`). Alias de importación configurado: `@/*` resuelve a la raíz del proyecto, permitiendo imports absolutos como `import Colors from '@/constants/Colors'`.

### React Native Reanimated
Permite animaciones y gestos con rendimiento nativo. Se inicializa en el root layout para garantizar disponibilidad global en la app.

### React Navigation
Actúa como motor de navegación que Expo Router utiliza internamente. Provee `ThemeProvider` para el soporte de modo oscuro/claro automático según la preferencia del sistema.

---

## Estructura del proyecto

```
frontend/
├── app/                        # Rutas de la aplicación (Expo Router)
│   ├── _layout.tsx             # Root layout: fuentes, tema, splash screen
│   ├── +html.tsx               # Wrapper HTML para build web
│   ├── +not-found.tsx          # Pantalla 404 para rutas inexistentes
│   ├── modal.tsx               # Pantalla modal global
│   └── (tabs)/                 # Grupo de navegación por tabs
│       ├── _layout.tsx         # Configuración del Tab Navigator
│       ├── index.tsx           # Pantalla principal (Tab 1)
│       └── two.tsx             # Segunda pantalla (Tab 2)
│
├── components/                 # Componentes reutilizables
│   ├── Themed.tsx              # View y Text con soporte de tema (dark/light)
│   ├── StyledText.tsx          # Componente de texto con fuente personalizada
│   ├── ExternalLink.tsx        # Link que abre el navegador del sistema
│   ├── EditScreenInfo.tsx      # Componente informativo de pantallas placeholder
│   ├── useColorScheme.ts       # Hook para detectar tema del sistema
│   └── useClientOnlyValue.ts   # Hook para valores exclusivos del cliente (web)
│
├── constants/
│   └── Colors.ts               # Paleta de colores para modo claro y oscuro
│
├── assets/
│   ├── fonts/
│   │   └── SpaceMono-Regular.ttf
│   └── images/
│       ├── icon.png            # Ícono de la app
│       ├── splash-icon.png     # Imagen de splash screen
│       ├── adaptive-icon.png   # Ícono adaptativo Android
│       └── favicon.png         # Favicon para build web
│
├── app.json                    # Configuración de Expo (nombre, íconos, plugins)
├── package.json
└── tsconfig.json               # TypeScript con strict mode y alias @/*
```

---

## Configuración destacada

- **Nueva arquitectura de React Native** (`newArchEnabled: true`) — mejor rendimiento con el nuevo renderer y bridge.
- **Rutas tipadas** (`typedRoutes: true`) — Expo Router genera tipos TypeScript para todas las rutas, con autocompletado en `router.push()` y `<Link href>`.
- **Tema automático** (`userInterfaceStyle: "automatic"`) — dark/light mode según la preferencia del sistema operativo.

---

## Scripts disponibles

```bash
npm start           # Inicia el dev server (escanear QR con Expo Go)
npm run dev         # Alias de npm start
npm run dev:tunnel  # Expo con túnel (redes con AP isolation: UTN, cafés)
npm run android     # Abre en emulador/dispositivo Android
npm run ios         # Abre en simulador iOS (requiere macOS)
npm run web         # Abre en el navegador
```

---

## Desarrollo con celular físico

La URL del backend se resuelve en `constants/Config.ts`. Por defecto **no hace falta** definir `EXPO_PUBLIC_API_URL` en `.env`: Expo Go expone la IP de la PC donde corre Metro y la app arma `http://<IP>:3000` automáticamente.

### Flujo A — Casa / misma WiFi (recomendado)

1. Copiá `.env.example` a `.env` y **no** definas `EXPO_PUBLIC_API_URL`.
2. Terminal 1: `cd backend && npm run dev`
3. Terminal 2: `cd frontend && npm start`
4. Escaneá el QR con Expo Go en la **misma WiFi** que la PC.

**Verificación:**

- En Metro debe aparecer: `[Mesh] API_BASE_URL = http://<IP-de-tu-PC>:3000`
- Desde el navegador del celular: `http://<IP>:3000/api/health` debe responder OK.

### Flujo B — UTN / cafés / AP isolation (túneles)

En redes institucionales o públicas el router suele bloquear que el celular hable con la PC aunque compartan WiFi. Hacen falta **dos túneles**:

| Componente | Comando | Qué resuelve |
|---|---|---|
| Metro (bundler JS) | `npm run dev:tunnel` | Celular descarga la app por internet |
| API + Socket.io | `ngrok http 3000` | REST y WebSockets por internet |

Pasos:

1. `cd backend && npm run dev`
2. En otra terminal: `ngrok http 3000` → copiá la URL HTTPS (ej. `https://a1b2c3d4.ngrok-free.app`).
3. En `frontend/.env`: `EXPO_PUBLIC_API_URL=https://a1b2c3d4.ngrok-free.app` (sin `/api` al final).
4. `cd frontend && npm run dev:tunnel` → escaneá el QR.

La URL de ngrok cambia al reiniciar ngrok (plan free). Actualizá `.env` cuando eso pase.

### Síntomas frecuentes

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| Timeout al login / sync | IP fija vieja en `.env` | Comentá `EXPO_PUBLIC_API_URL` y reiniciá Metro |
| App carga pero API no responde | AP isolation (UTN, café) | Flujo B con túneles |
| Backend OK en PC, app no conecta | Celular en otra red o datos móviles | Misma WiFi (A) o túnel (B) |
| `10.0.2.2` en celular físico | Variable pensada para emulador | Quitá esa URL del `.env` |

---

## Convenciones de desarrollo

- Nuevas **pantallas** → crear archivo `.tsx` dentro de `app/`
- Nuevas **tabs** → agregar archivo dentro de `app/(tabs)/` y registrar en `app/(tabs)/_layout.tsx`
- **Pantallas modales** → agregar en `app/` con `presentation: 'modal'` en el layout raíz
- **Componentes reutilizables** → `components/`
- **Imports** → usar alias `@/` en lugar de rutas relativas (ej: `@/components/Themed`)
