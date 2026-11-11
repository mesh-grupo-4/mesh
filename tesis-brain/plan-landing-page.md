# Plan de implementación — Landing page de Mesh

> **Documento autosuficiente para la IA que va a construir la landing.**
> Proyecto Final 2026 · UTN FRC · Grupo 4 · Curso 5K1
> Relevado del repositorio `mesh-grupo-4/mesh` el 06/11/2026.

---

## 0. Cómo usar este documento

### 0.1 Prompt sugerido

```text
Construí la landing page de Mesh siguiendo plan-landing-page.md al pie de la letra.
Ejecutá las fases de la sección 11 en orden y verificá los criterios de aceptación de cada una
antes de pasar a la siguiente. Usá el copy de la sección 8 tal cual: podés mejorarlo solo si
respetás la sección 2. Si falta un dato marcado [CONFIRMAR], no lo inventes: dejá activo el
comportamiento por defecto que indica la sección 13 y listalo al final en tu reporte.
```

### 0.2 Archivos a adjuntar si la IA no tiene acceso al repo

| Archivo | Para qué sirve |
|---|---|
| `frontend/assets/images/mesh-logo.png` | Logo (único original, no hay SVG) |
| `docs/mesh-screens.html` | Recreación HTML de las pantallas reales: base para los mockups |
| `frontend/constants/Colors.ts` | Colores exactos de la app |
| `tesis-brain/MESH-PROMO.html` | Video promo: inspiración de guion. Pesa 2,5 MB porque tiene imágenes en base64: quitarlas antes de leerlo. Su copy **no** tiene prioridad sobre este plan (ver 2.3) |

### 0.3 Orden de prioridad ante un conflicto

1. Reglas de la sección 2 (seguridad, veracidad, privacidad).
2. Accesibilidad y performance (sección 10).
3. Copy y diseño de este plan.
4. Criterio creativo de quien implementa.

---

## 1. Qué hay que vender

### 1.1 El producto en una frase

**Mesh es la app que le muestra a todo tu grupo en un solo mapa y avisa sola si alguien se desvía, se atrasa o se queda quieto sin avisar.** Sirve para salidas en moto, bici, running y trekking.

### 1.2 El insight

Las apps deportivas miran a la persona y las de mapas miran el camino. **Mesh mira al grupo.**

El dolor es universal para quien sale en grupo: alguien se queda atrás, nadie se entera hasta la próxima parada y el grupo de chat explota. La landing convierte ese caos en un chiste compartido, y a Mesh en la solución obvia.

### 1.3 Público

- Grupos de 18 a 65 años que salen juntos: motoqueros, ciclistas, runners, trekkers, y quienes organizan esas salidas.
- **Lanzamiento en Argentina, foco en Córdoba.** Los ejemplos usan geografía cordobesa: Altas Cumbres, Camino del Cuadrado, Parque Sarmiento, La Cumbrecita.
- **Persona clave: quien organiza.** Es quien descarga primero y luego trae a todo su grupo con un QR.

### 1.4 Objetivo de la página

| Prioridad | Objetivo | Se mide con |
|---|---|---|
| 1 | Descarga | `cta_click` por plataforma y sección |
| 2 | Que se entienda en menos de 10 segundos | Hero con frase, subtítulo y demo visual sobre el pliegue |
| 3 | Que se pruebe el valor sin instalar | `sim_interaction`, `sim_completed` en el simulador |
| 4 | Que se comparta en el grupo | `share_click`, OG image cuidada |

---

## 2. Reglas no negociables

Tienen prioridad sobre cualquier idea creativa. Un incumplimiento bloquea la entrega.

### 2.1 Seguridad vial — RN-070

La modalidad moto está **excluida de todo ranking, tabla, competencia o gamificación de velocidad.** En la landing, eso significa:

- **Nunca** mostrar velocidad, ritmo, velocímetro, `km/h` ni tiempos comparados asociados a moto.
- **Nunca** usar lenguaje de velocidad con moto: "más rápido", "ganale", "récord", "primero en llegar", "a fondo".
- **Nunca** mostrar podios, leaderboards ni fantasma con moto.
- **No publicar el default de 120 km/h de moto.** Para mantener la paridad, el selector de actividades no muestra velocidad en **ninguna** actividad (sección 8.6).
- Toda animación de grupo en moto va a ritmo tranquilo, sin blur de velocidad, llamas ni estética de carrera.
- **Nunca** mostrar a alguien manipulando el teléfono mientras conduce o pedalea. El teléfono va en soporte o lo usa una persona detenida.
- La exclusión se cuenta **con orgullo**, como decisión de marca (sección 8.10).

### 2.2 Veracidad: qué se puede prometer

**Prohibido inventar:** usuarios, descargas, calificaciones, estrellas, testimonios, logos de prensa, premios, marcas aliadas o contadores en vivo. No existen esos datos. La prueba social se reemplaza por demostración: el simulador **es** la prueba.

| Feature | Estado | Se puede decir |
|---|---|---|
| Mapa grupal en vivo, GPS cada 5 s | Implementado | "Todo tu grupo en un solo mapa", "se actualiza cada pocos segundos" |
| Alerta de desvío | Implementado | Avisa al líder cuando alguien se sale de la ruta |
| Alerta de atraso | Implementado | Avisa al líder cuando alguien queda lejos del bloque principal |
| Posible incidente | Implementado | Detecta que alguien **quedó detenido** unos minutos sin marcar parada; le pregunta si está bien y avisa al grupo |
| Paradas voluntarias y pedido de parada | Implementado | Parar con un toque, avisar el motivo, pedirle parada al líder |
| Alertas manuales | Implementado | Parada, combustible, desvío, peligro, información y atraso |
| Offline con sincronización | Implementado | Tu recorrido se guarda en el teléfono y se sincroniza al reconectar |
| Viaje YA | Implementado | Crear y arrancar una salida en pocos toques |
| Unirse con QR | Implementado | Escanean y se suman, sin aprobación manual |
| Ruta con paradas, estimación de tiempos | Implementado | Origen, destino, paradas categorizadas y reordenables |
| Clima sobre la ruta | Implementado | Pronóstico de lluvia y viento antes de salir |
| Checklist de preparativos | Implementado | Personal, sugerido por actividad |
| Gastos compartidos | Implementado | Dividir los gastos de la salida |
| Interfaz adaptativa | Implementado | La pantalla cambia según la actividad |
| Privacidad por viaje | Implementado | Decidís por viaje si compartís, y ves quién accedió |
| Resumen y métricas del viaje | Implementado | Distancia, tiempo; recap al cerrar |
| Ranking de viaje, leaderboard, fantasma | Implementado | **Solo** bici, running y trekking |
| Tabla de posiciones global | Implementado | **Solo** bici, running, trekking y otro |
| Insignias y rachas | Implementado | Por distancia, duración y semanas activas, **nunca por velocidad** |
| Recorridos de la comunidad | Implementado | Publicar, explorar por zona, valorar "Recomiendo / No recomiendo", importar |
| Link de ruta | Implementado | Compartir una ruta planificada |
| **Wrapped mensual o anual** | **No implementado** | **No mencionar** |
| **Itinerario con IA, recomendaciones con IA** | **No implementado** | **No mencionar** |
| **Wearables, relojes** | **No implementado** | **No mencionar** |
| **POIs, hitos geolocalizados** | **No implementado** | **No mencionar** |
| **Cortes, radares, reportes comunitarios** | **No implementado** | **No mencionar** |
| **Navegación giro a giro** | **No se encontró en el código** | **No prometer**. Mesh muestra la ruta y al grupo en el mapa; no dicta indicaciones |
| **Chat o audio entre integrantes** | **No se encontró en el código** | **No sugerir**. Mesh no reemplaza al intercomunicador |
| **Comentarios en recorridos** | **Prohibido por diseño** (RN-083) | **No mencionar** |

### 2.3 Frases que deben evitarse

El video promo tiene alguna frase más fuerte que lo que hace el producto. En la landing rige esta tabla:

| No decir | Por qué | Decir |
|---|---|---|
| "Si alguien se cae, el grupo se entera" | Mesh no detecta caídas: detecta una detención prolongada sin parada marcada | "Si alguien se queda quieto sin avisar, Mesh pregunta y avisa al grupo" |
| "Nadie se pierde nunca", "viajá 100 % seguro" | Promesa absoluta de seguridad | "Te enterás a tiempo" |
| "Ves al grupo aunque no haya señal" | Sin conexión no llega la posición en vivo | "Sin señal, tu recorrido se guarda y se sincroniza solo" |
| "Hasta 200 personas" | Objetivo de diseño (RN-033); falta evidencia pública de prueba de carga | "De dos amigos a una caravana entera" |
| "La única app que...", "ninguna app..." | Afirmación absoluta difícil de sostener | "Hecha para mirar al grupo" |
| "Rastreá", "controlá", "vigilá a tu grupo" | Contradice la privacidad del producto | "Coordiná", "mirá dónde está el grupo" |
| "Gratis" | Falta confirmación | Ver [CONFIRMAR] en sección 13 |
| "Descargá en App Store / Google Play" sin link real | No se detectaron links publicados | Ver estados de descarga en sección 8.13 |

**Aviso obligatorio, visible en el simulador (situación de Cami), la FAQ y el footer:**

> Mesh ayuda a coordinar al grupo. No reemplaza a los servicios de emergencia ni garantiza la detección de incidentes: necesita GPS, batería y conexión para que los avisos lleguen. Ante una emergencia, llamá al 911.

### 2.4 Privacidad

- Decirlo claro: la ubicación se lee cada 5 segundos durante el viaje, la ven solo integrantes de ese viaje, y cada persona la puede apagar viaje por viaje.
- Decir también su consecuencia: **con el compartir apagado, Mesh no genera alertas automáticas sobre esa persona.** Es información de seguridad y no se omite.
- La app es **para mayores de 18 años**. No se dirige publicidad, imágenes ni copy a menores, ni se sugiere usarla para seguir a hijos o parejas.
- La propia landing no pide datos personales salvo que se confirme lista de espera (sección 13). Analítica sin cookies ni huella digital.

### 2.5 Datos ficticios

Todo el contenido de simuladores y mockups es de ejemplo. Vive solo en `landing/src/sim/` y `landing/src/content/`, no se conecta al backend, no pide GPS al visitante, y lleva el rótulo visible **"Simulación con datos de ejemplo"**. No usar nombres reales del equipo ni datos de usuarios.

### 2.6 Alcance

- Todo va en una carpeta nueva `landing/`. **No** modificar `frontend/` ni `backend/`.
- **No** crear ni modificar `.env` existentes. Usar solo `landing/.env.example`, sin secretos.
- **No** usar claves de Google Maps en la landing. El mapa es SVG estilizado.
- Rama `feature/landing`, PR con revisión. Nunca push directo a `main`.

---

## 3. Concepto creativo

### 3.1 Gran idea: "La página es un viaje"

Quien entra **sale de viaje con un grupo**. El scroll es la ruta y cada sección es una posta.

- Una **cinta de ruta** naranja, gruesa como el trazo del logo, recorre toda la página y se dibuja con el scroll.
- Seis integrantes viajan por ella. Son **ruedas** del logo: círculos con anillo interior.
- La barra superior es un mini mapa: `Salida → Posta 1 → ... → Llegada`.
- Al final, el grupo llega al destino y aparece el botón de descarga.

### 3.2 El chiste que recorre todo: "¿Y el Gonza?"

Gonza es el amigo que siempre se pierde. Es un personaje ficticio y un hilo narrativo.

| Sección | Qué pasa con Gonza |
|---|---|
| Hero | Una rueda se atrasa y la malla se estira. Título: "¿Y el Gonza?" |
| Problema | Todos lo buscan en el chat. Nadie sabe nada |
| Simulador | Lo podés desviar vos. Te llega la alerta |
| Offline | Se queda sin señal; su recorrido se guarda y reaparece completo |
| Competir | Queda último en bici. Le da igual |
| Llegada | Contador `5/6`... y un rato después `6/6`: **"Llegó el Gonza. Ahora sí."** |

Es importante que el chiste quede del lado cariñoso: Gonza nunca es víctima de un accidente, ni siquiera en broma. En las escenas de posible incidente aparece otra persona (Cami) y el tono baja a serio.

### 3.3 Personalidad y voz

- **Como el amigo que organiza la salida:** canchero, claro y confiable.
- Español rioplatense, con voseo: "armá", "sumá", "bajá".
- Frases cortas. Primero el beneficio, nunca la tecnología. No decir "PostGIS", "WebSocket" ni "motor de eventos" (decir "Mesh se da cuenta solo").
- **Regla de tono:** humor en el problema y la coordinación; serio en seguridad, incidentes y privacidad. No hacer chistes con accidentes.
- Evitar el vocabulario publicitario vacío: "revolucionario", "solución integral", "potenciá".

### 3.4 Eslogan

**Salen juntos. Llegan juntos.**

---

## 4. Sistema visual

### 4.1 Logo

Es una **M hecha con una cinta sinuosa, con dos ruedas** en sus extremos. Hoy existe solo en PNG de 1137 × 1103 px, con mucho margen transparente.

- Trazar a mano un SVG en `landing/src/assets/logo.svg` y verificarlo superpuesto al PNG. **No redibujar ni "mejorar" la forma.** Si no alcanza la fidelidad, marcarlo en el reporte final y usar el PNG recortado.
- Separar en grupos `#cinta`, `#rueda-izq`, `#rueda-der`, para animarlos.
- Color oficial del logo: `#FE3A0F`.

### 4.2 Las dos primitivas gráficas

Todo el lenguaje sale del logo. Esto evita el aspecto genérico de plantilla SaaS.

1. **La cinta:** trazos muy gruesos, extremos redondeados y curvas amplias. Se usa en rutas, divisores y fondos.
2. **La rueda:** dos círculos concéntricos. Se usa como marcador de integrante y como ornamento.

La **malla** es la tercera capa: líneas finas y elásticas entre las ruedas, que se estiran y cambian de color cuando alguien se separa.

### 4.3 Paleta

```css
:root {
  /* Marca */
  --naranja: #FE3A0F;        /* logo, cinta, CTA */
  --naranja-texto: #C92A06;  /* solo para texto naranja sobre fondo crema */
  --coral: #D76655;          /* acento de la UI real, dentro de mockups */

  /* Base clara */
  --crema: #F4F1EE;
  --crema-2: #EFEAE5;
  --blanco: #FFFFFF;
  --tinta: #141210;
  --tinta-suave: #6F675F;
  --linea: #E4DDD6;

  /* Base oscura */
  --noche: #0F0F0F;
  --noche-2: #1C1C1C;
  --hueso: #F4F2F0;
  --hueso-suave: #9A948F;

  /* Modo moto: alto contraste real de la app */
  --moto-fondo: #000000;
  --moto-acento: #FFCC00;

  /* Estados de integrante */
  --ok: #2F9E63;
  --parada: #F59E0B;
  --incidente: #DC2626;

  /* Tipos de alerta */
  --al-desvio: #8B5CF6;
  --al-atraso: #EA580C;
  --al-combustible: #0EA5E9;
  --al-peligro: #DC2626;
  --al-info: #6B7280;
}
```

**Contrastes verificados: seguir esta tabla.**

| Texto | Fondo | Ratio | Uso permitido |
|---|---|---|---|
| `--tinta` | `--naranja` | 5,18 | **Texto de CTA por defecto** |
| Blanco | `--naranja` | 3,60 | Solo texto grande: ≥ 24 px o bold ≥ 19 px |
| `--naranja` | `--crema` | 3,20 | Solo títulos grandes y gráficos |
| `--naranja-texto` | `--crema` | 4,89 | Texto naranja de cuerpo y enlaces |
| `--naranja` | `--noche` | 5,32 | Libre |
| `--tinta` | `--crema` | 16,61 | Libre |
| `--tinta-suave` | `--crema` | 4,94 | Texto secundario |
| `--hueso-suave` | `--noche` | 6,40 | Texto secundario oscuro |
| `--moto-acento` | `--moto-fondo` | 13,89 | Libre |

Reparto de color por sección: 60 % crema o noche, 30 % tinta o hueso y 10 % naranja. Hay **una sola excepción**: el bloque naranja a pantalla completa de la llegada (8.13), para que la explosión de color se guarde para el final. Nada de degradados violeta, glassmorphism ni brillos genéricos.

### 4.4 Tipografía

Autoalojada con Fontsource y `font-display: swap`. Precargar solo la display del hero.

| Rol | Fuente | Por qué |
|---|---|---|
| Display | **Bricolage Grotesque** (variable, 700–800) | Gruesa y con carácter, combina con el logo |
| Texto | **Plus Jakarta Sans** (400–700) | Continuidad con el video promo |
| Datos | **Space Mono** (400, 700) | Ya está en la app; se usa en contadores, telemetría y etiquetas |

```css
--t-hero:  clamp(3.5rem, 13vw, 12rem);    /* line-height .9, tracking -.04em */
--t-h2:    clamp(2.5rem, 7vw, 6rem);      /* line-height .95, tracking -.03em */
--t-h3:    clamp(1.5rem, 3vw, 2.25rem);
--t-lead:  clamp(1.125rem, 1.8vw, 1.5rem);
--t-body:  1.0625rem;
--t-mono:  .875rem;                       /* mayúsculas, tracking .08em */
```

Tamaño mínimo de texto: 15 px (coincide con el mínimo outdoor de la app).

### 4.5 Forma y detalle

- Radios: tarjetas 28 px, botones `999px`, teléfonos 44 px.
- Fondo: curvas de nivel topográficas muy sutiles (SVG, opacidad 6–8 %), en referencia a las sierras.
- Grano sutil en bloques grandes de color (SVG o PNG liviano, < 10 KB).
- Sombras cálidas: `0 20px 60px rgba(60, 45, 35, .16)`.
- Iconos: **Feather** (los mismos que usa la app). Importar SVG por ícono, no toda la librería.
- Sin fotos de stock ni personas generadas por IA. El producto y las ilustraciones SVG son los protagonistas. Si el equipo aporta fotos reales de salidas, cumplir 2.1 y contar con el permiso de las personas.

### 4.6 Mockups de teléfono

1. Recrear las pantallas en HTML/CSS/SVG dentro de un marco genérico, tomando `docs/mesh-screens.html` y `frontend/constants/Colors.ts` como referencia. No usar marcos de iPhone o Pixel reconocibles.
2. El mapa es un SVG estilizado con los colores `mapBg #ECE6DF`, `mapGrid #E0D8CF`, `mapRoute #D3C8BD`. No usar teselas de mapas reales.
3. Pantallas necesarias: mapa en vivo, alerta de desvío, banner "¿Estás bien?", QR, Viaje YA, resumen, modo moto.
4. Si el equipo aporta capturas reales (sección 13), reemplazan a las recreaciones. La recreación nunca debe mostrar una función que la app no tiene.

---

## 5. Stack y arquitectura

### 5.1 Decisiones

| Necesidad | Elección | Por qué |
|---|---|---|
| Framework | **Astro** (última estable) + TypeScript estricto | HTML estático con JS solo donde hace falta, ideal para LCP y SEO |
| Estilos | CSS propio con custom properties, por componente | Control total, sin dependencia extra |
| Animación por scroll | **GSAP + ScrollTrigger** | Timelines precisos y pin confiable |
| Scroll suave | **Lenis**, solo en escritorio | Sensación premium sin secuestrar el touch |
| Interactividad | TypeScript vanilla, sin React | Menos peso; los simuladores son máquinas de estado simples |
| Transición entre páginas | View Transitions de Astro | Liviano |
| Analítica | Plausible o Umami, sin cookies | Coherente con el mensaje de privacidad |
| Hosting | Cloudflare Pages o Vercel | Estático, CDN y previews por PR. Ver sección 13 |

No usar Three.js, WebGL, Lottie ni video pesado: el SVG resuelve todo con mucho menos peso y rinde mejor en teléfonos de gama media. Verificar las versiones actuales en la documentación oficial antes de instalar.

### 5.2 Estructura

```text
landing/
├── package.json
├── astro.config.mjs
├── tsconfig.json
├── .env.example                    # sin secretos
├── public/
│   ├── favicon.svg
│   ├── og-mesh.png                 # 1200 × 630
│   └── robots.txt
├── src/
│   ├── assets/logo.svg
│   ├── config/
│   │   ├── descarga.ts             # estados y links de descarga
│   │   └── actividades.ts          # datos reales por actividad
│   ├── content/copy.ts             # todo el texto
│   ├── styles/{tokens,base,motion}.css
│   ├── layouts/Base.astro
│   ├── components/
│   │   ├── Logo.astro
│   │   ├── Rueda.astro
│   │   ├── Telefono.astro
│   │   ├── BotonDescarga.astro
│   │   ├── NavRuta.astro
│   │   ├── CintaGlobal.astro
│   │   └── pantallas/*.astro       # mockups
│   ├── sections/
│   │   ├── Hero.astro
│   │   ├── Problema.astro
│   │   ├── ComoFunciona.astro
│   │   ├── Simulador.astro
│   │   ├── Actividades.astro
│   │   ├── Offline.astro
│   │   ├── Privacidad.astro
│   │   ├── Bento.astro
│   │   ├── Competir.astro
│   │   ├── Diferencia.astro
│   │   ├── Faq.astro
│   │   ├── Llegada.astro
│   │   └── Footer.astro
│   ├── sim/
│   │   ├── estado.ts               # máquina de estados pura y testeada
│   │   ├── escena.ts               # dibuja el estado en SVG
│   │   └── datos-ejemplo.ts        # integrantes ficticios
│   ├── motion/
│   │   ├── init.ts                 # registra plugins, reduced motion, Lenis
│   │   ├── tokens.ts
│   │   └── {hero,problema,...}.ts  # uno por sección, con import dinámico
│   ├── lib/{analitica,dispositivo}.ts
│   └── pages/
│       ├── index.astro
│       ├── privacidad.astro
│       └── terminos.astro
└── tests/
    ├── sim.test.ts
    ├── reglas-contenido.test.ts    # RN-070 y frases prohibidas
    └── smoke.spec.ts               # Playwright
```

### 5.3 Datos reales de actividades

Valores tomados de `reglas-de-negocio.md` §8 y `motorEventos.config.ts`. **La velocidad se omite a propósito.**

```ts
// src/config/actividades.ts
export const ACTIVIDADES = {
  moto: {
    nombre: 'Moto',
    separacionM: 1000,
    toleranciaMin: 10,
    detencionMin: 3,
    interfaz: 'Pantalla completa, alto contraste y botones extra grandes.',
    feedback: 'Visual prominente',
    competencia: false, // RN-070: nunca cambiar
  },
  bici: {
    nombre: 'Bici',
    separacionM: 300,
    toleranciaMin: 5,
    detencionMin: 3,
    interfaz: 'Pantalla outdoor, botones grandes.',
    feedback: 'Visual + vibración',
    competencia: true,
  },
  running: {
    nombre: 'Running',
    separacionM: 100,
    toleranciaMin: 3,
    detencionMin: 4,
    interfaz: 'Pantalla outdoor, sin distracciones.',
    feedback: 'Vibración primero',
    competencia: true,
  },
  trekking: {
    nombre: 'Trekking',
    separacionM: 50,
    toleranciaMin: 3,
    detencionMin: 5,
    interfaz: 'Pantalla outdoor, sin distracciones.',
    feedback: 'Vibración primero',
    competencia: true,
  },
} as const
```

---

## 6. Sistema de animación

### 6.1 Principios

1. **La animación explica.** Cada una cuenta algo del producto. Si se quita y no se pierde información ni emoción, sobra.
2. **Físico y elástico.** La malla se comporta como bandas elásticas, las ruedas giran y tienen inercia.
3. **Un protagonista por pantalla.** Nada de animar diez cosas a la vez.
4. **El scroll siempre responde.** Nunca bloquear el scroll ni obligar a esperar para leer.
5. **Solo `transform` y `opacity`**, salvo el trazo de la cinta. Máscaras y filtros pesados: no.

### 6.2 Tokens

```ts
// src/motion/tokens.ts
export const DUR = { micro: .18, corta: .35, media: .6, larga: .9, epica: 1.4 }
export const EASE = {
  salida: 'power3.out',       // entradas
  entrada: 'power2.in',       // salidas
  suave: 'power2.inOut',      // cambios de estado
  rebote: 'back.out(1.7)',    // ruedas y chips
  elastico: 'elastic.out(1, .55)', // malla al soltarse
  scroll: 'none',             // siempre lineal si va atado al scroll
}
export const STAGGER = { palabras: .04, tarjetas: .08, ruedas: .06 }
```

### 6.3 Biblioteca de movimientos

| Nombre | Descripción | Dónde |
|---|---|---|
| `revelarTitulo` | Palabras suben desde una máscara, stagger .04 | Todos los H2 |
| `dibujarCinta` | `strokeDashoffset` atado al scroll, con `pathLength="1"` | Cinta global |
| `girarRuedas` | Las ruedas giran según velocidad del scroll, con inercia | Logo, ruedas decorativas |
| `estirarMalla` | La línea se adelgaza y pasa de neutra a naranja y rojo según la distancia | Hero, simulador |
| `pop` | Escala de .6 a 1 con `rebote` | Alertas, chips, badges |
| `contar` | Contador en Space Mono, con cifras tabulares | Stats |
| `pulso` | Anillo que se expande y desaparece, 1.6 s, máximo 2 simultáneos | Posible incidente |
| `magnetico` | CTA se inclina hasta 8 px hacia el puntero, solo con mouse | Botones principales |

### 6.4 Transición entre secciones

- **Crema a noche:** la cinta se ensancha hasta cubrir la pantalla y se convierte en el fondo de la sección siguiente.
- **Hacia moto:** corte directo a negro y amarillo, como cuando la app pasa a alto contraste.
- **Hacia la llegada:** la cinta se abre en un círculo naranja desde el marcador de destino, hasta llenar la pantalla.
- Implementarlas con `clip-path` o escala, y como máximo 3 en toda la página para mantener el impacto.

### 6.5 Reglas técnicas

- `gsap.matchMedia()` con 3 ramas: `(min-width: 900px)`, `(max-width: 899px)` y `(prefers-reduced-motion: reduce)`.
- Inicializar cada sección por `IntersectionObserver` con import dinámico. Revertir sus timelines al salir de vista si son costosos.
- Máximo **2 secciones con pin en escritorio** (Cómo funciona y Offline) y **1 en mobile** (Cómo funciona). Usar `svh`, nunca `vh`, en mobile.
- Lenis: desactivado en dispositivos táctiles y con reduced motion. Conectarlo a `ScrollTrigger.update` y al ticker de GSAP, con `lagSmoothing(0)`.
- `will-change` solo durante la animación, y retirarlo al terminar.
- Pausar loops fuera de pantalla o con `document.hidden`.

### 6.6 Reduced motion y sin JavaScript

- **Sin JS:** todo el texto y los CTA se ven. Los mockups muestran su estado final. Los simuladores muestran una imagen estática con una leyenda.
- **Con `prefers-reduced-motion`:** sin pin, sin parallax, sin Lenis, sin loops ni pulsos. Cinta dibujada de entrada. Los simuladores siguen funcionando con cambios instantáneos o fundidos de 150 ms como máximo.
- Agregar un botón visible **"Pausar animaciones"** en el footer, que persiste en `localStorage` (WCAG 2.2.2).

---

## 7. Mapa de la página

| # | Sección | Rol en el embudo | Fondo |
|---|---|---|---|
| — | Nav con ruta | Orientar y CTA fijo | Transparente |
| 1 | Hero | Entender e intrigar | Crema |
| 2 | Problema | Identificarse y reírse | Crema |
| 3 | Cómo funciona | Entender el flujo | Noche |
| 4 | Simulador | **Vivir el valor** | Noche |
| 5 | Actividades | "Es para mí" | Cambia según actividad |
| 6 | Offline | Quitar objeción | Noche |
| 7 | Privacidad | Dar confianza | Crema |
| 8 | Bento | Mostrar profundidad | Crema |
| 9 | Competir | Manifiesto de marca | Crema, con corte a negro + amarillo |
| 10 | Diferencia | Justificar el cambio | Crema |
| 11 | FAQ | Quitar objeciones finales | Crema |
| 12 | Llegada | **Convertir** | Naranja |
| — | Footer | Legales | Noche |

---

## 8. Especificación sección por sección

Toda la copia está lista para usar y va centralizada en `src/content/copy.ts`.

### 8.0 Navegación

**Layout:** barra fija arriba. Logo a la izquierda, mini ruta en el centro, CTA `Bajá Mesh` a la derecha.

**Mini ruta:** línea horizontal con 5 ruedas pequeñas: `Salida · El problema · Probalo · Tu actividad · Llegada`. Una rueda avanza con el scroll. Cada punto es un enlace ancla con `aria-label`.

**Comportamiento:**
- Baja al hacer scroll hacia arriba y se oculta al hacer scroll hacia abajo.
- Después del hero toma fondo con blur liviano.
- En mobile, sin mini ruta: logo y CTA, más una barra fina de progreso de 3 px.
- **CTA fijo inferior en mobile:** aparece después del hero y se oculta en la sección de llegada. Respeta `safe-area-inset-bottom`.

### 8.1 Hero

**Objetivo:** en 3 segundos se entiende qué es, y dan ganas de seguir.

```text
ETIQUETA:   Para salir en grupo · Moto · Bici · Running · Trekking
H1:         ¿Y el Gonza?
SUB:        Mesh muestra a todo tu grupo en un solo mapa y avisa solo
            si alguien se desvía, se atrasa o se queda quieto sin avisar.
CTA 1:      Bajá Mesh
CTA 2:      Probalo acá, sin instalar nada ↓
PIE:        Salen juntos. Llegan juntos.
```

**Layout de escritorio:** H1 gigante a la izquierda, ocupando dos tercios del ancho. A la derecha, y por detrás del título, escena SVG de la malla: seis ruedas sobre una cinta de ruta sinuosa.

**Layout mobile:** etiqueta, H1, sub y CTA arriba, con la escena debajo y visible sin scroll en la parte inferior. Altura `100svh`.

**Coreografía de entrada (máximo 1,6 s en total; el contenido nunca espera):**

| Tiempo | Qué pasa |
|---|---|
| 0,0 s | El logo se dibuja y sus ruedas caen con `rebote` |
| 0,2 s | H1 sube por palabra con `salida` |
| 0,5 s | La cinta se dibuja de izquierda a derecha |
| 0,7 s | Las seis ruedas entran con `rebote`, stagger .06 |
| 0,9 s | Las líneas de la malla se tienden entre ellas |
| 1,1 s | Sub y CTA aparecen |

**Loop:** las ruedas avanzan suavemente por la cinta. Cada 6 segundos Gonza se va quedando, su línea se estira y se tiñe, aparece una tarjeta de alerta **"Gonza quedó atrás · 450 m"** con `pop`, y luego él recupera con un rebote elástico.

**Interacción:**
- El puntero repele levemente a las ruedas cercanas (máximo 12 px).
- Sobre una rueda, muestra su nombre.
- Hacer scroll hace que la escena se desplace y el grupo avance más rápido por la cinta, y que el H1 se aleje con parallax.

**Aceptación:** H1, sub y CTA se pueden leer sin JS. LCP es el H1, por eso no puede depender del JS para ser visible.

### 8.2 El problema

**Objetivo:** reconocerse y reírse. Es el momento más compartible de la página.

```text
ETIQUETA:  Km 0 · Lo que pasa siempre
H2:        Toda salida grupal tiene este chat.
```

**Escena:** chat genérico, sin marca de WhatsApp ni interfaz que la imite. Los mensajes van entrando al hacer scroll:

```text
Cami      ¿Dónde están?
Nico      Paramos en la estación
Cami      ¿Cuál estación?
Flor      Yo sigo, los espero en el puente
Tomi      ¿Qué puente?
Nico      ¿Alguien vio al Gonza?
Vale      Estaba atrás tuyo
Nico      Atrás mío no hay nadie
Cami      Lo llamo
Cami      No contesta
Flor      Se ve que se quedó sin señal
Gonza     Che, ¿para dónde agarraron?
Gonza     Ya estoy en Mina Clavero
Nico      Gonza, salimos para Carlos Paz
```

**Remate:** el último mensaje queda en pantalla, el chat se encoge a la izquierda y aparece:

```text
Grande:  Una salida. 14 mensajes. Cero idea de dónde está cada uno.
Pie:     Así no se coordina. Así se pierde media mañana.
```

**Animación:** cada burbuja entra con `pop` atada al scroll. Las burbujas previas suben. Indicador "escribiendo..." entre mensajes. En reduced motion se muestra el chat completo.

### 8.3 Cómo funciona

**Objetivo:** pasar del caos a la simpleza en 4 pasos. Sección con pin en escritorio: teléfono al centro, textos a los lados.

```text
ETIQUETA:  Posta 1 · Cómo funciona
H2:        Del "arrancamos" al "llegamos" en cuatro pasos.
```

| Paso | Título | Texto | Pantalla |
|---|---|---|---|
| 1 | **Armá la salida** | Ruta con paradas, o **Viaje YA** y salís en un par de toques. | Viaje YA → actividad |
| 2 | **Sumá al grupo** | Muestran el QR, escanean y listo. Sin alta de contactos, sin esperar a nadie. | QR con contador `1/6 → 6/6` |
| 3 | **Salgan** | Todos en un solo mapa. Si pasa algo, Mesh avisa solo. | Mapa en vivo con alerta |
| 4 | **Lleguen** | Se cierra el viaje y queda el resumen de la salida, listo. | Resumen animado |

**Animación:**
- Pin de 4 pantallas de scroll en escritorio. El teléfono queda fijo y las pantallas se cruzan con deslizamiento y fundido.
- Los pasos se resaltan a medida que avanza. La cinta global entra al teléfono y se transforma en la ruta del mapa.
- El contador QR sube mientras las ruedas vuelan al teléfono.
- **Mobile:** pin más corto o tarjetas apiladas (`position: sticky`). Priorizar scroll fluido.

**Aceptación:** los 4 pasos son texto real en HTML, en orden y accesibles sin scroll animado.

### 8.4 Simulador: "Sé el líder por un rato"

**Objetivo:** **el momento clave de conversión.** El visitante provoca los problemas y ve cómo responde Mesh. Es la prueba social que no tenemos.

```text
ETIQUETA:  Posta 2 · Probalo acá
H2:        Jugá a ser líder. Armá lío.
SUB:       Tocá una situación y mirá qué haría Mesh.
RÓTULO:    Simulación con datos de ejemplo
```

**Layout de escritorio:** a la izquierda, mapa SVG grande de una ruta por las sierras, con 6 ruedas. A la derecha, teléfono del líder con las notificaciones reales. Abajo, 4 botones grandes.

**Layout mobile:** mapa arriba, notificación tipo toast sobre el mapa, botones en grilla 2 × 2 debajo. Área táctil mínima de 56 px.

**Las 4 situaciones.** Respetan quién recibe cada aviso en la app real (RN-036, RN-040):

| Botón | En el mapa | Aviso | Lo recibe | Salida |
|---|---|---|---|---|
| **Gonza agarra para cualquier lado** | Sale de la cinta, malla en violeta | `Gonza se desvió de la ruta` | Líder | Botón "Que vuelva": regresa y se resuelve |
| **Flor se queda atrás** | Se aleja, la línea se estira en naranja, contador de metros | `Flor quedó lejos del grupo` | Líder | Botón "Esperarla": el grupo se reagrupa |
| **Nico para a cargar nafta** | Anillo ámbar, selector de categoría en su teléfono | `Nico paró · Combustible` | Grupo | Reanuda. Texto: "Avisó, así que nadie se preocupa" |
| **Cami se queda quieta sin avisar** | Cartel `3 min después`, anillo rojo con `pulso` | `Posible incidente · Cami` con ubicación | Todo el grupo | Banner en su teléfono: **Estoy bien** (cancela) o **Estoy mal** (alerta de peligro a todos) |

Regla de tono: en la situación de Cami desaparece el humor. Fondo levemente más oscuro y pulso lento. Si elige **Estoy mal**, mostrar el aviso "Mesh avisa a tu grupo. Ante una emergencia, llamá al 911", y resolver la escena con el grupo yendo hacia ella.

**Progreso y recompensa:** contador `0/4 situaciones`. Al completar cuatro:

```text
Grande:  Esto, pero con tu grupo de verdad.
CTA:     Bajá Mesh
```

También se muestra un CTA secundario desde la primera interacción, sin interrumpir.

**Máquina de estados** (`src/sim/estado.ts`, pura y testeada):

```ts
type EstadoIntegrante = 'en_movimiento' | 'detenido_voluntario' | 'posible_incidente'
type Incidencia = 'ninguna' | 'desvio' | 'atraso'

interface Integrante {
  id: string
  nombre: string
  estado: EstadoIntegrante
  incidencia: Incidencia
  progreso: number // 0..1 sobre la cinta
  offset: number   // separación lateral de la cinta
}

type Evento =
  | { tipo: 'DESVIAR' | 'ATRASAR' | 'INICIAR_PARADA' | 'DETENCION_SIN_AVISO'; id: string }
  | { tipo: 'VOLVER' | 'FIN_PARADA' | 'ESTOY_BIEN' | 'ESTOY_MAL'; id: string }
  | { tipo: 'REINICIAR' }
```

Los nombres de los estados coinciden con los del producto (`en_movimiento`, `detenido_voluntario`, `posible_incidente`). Sin red, sin GPS del visitante, determinista.

**Accesibilidad:**
- Botones reales con `aria-pressed`.
- Región `aria-live="polite"` con cada aviso, para que el simulador funcione sin ver el mapa.
- SVG con `role="img"` y descripción.

**Interacción por arrastre (extra, solo escritorio):** se puede arrastrar a Gonza fuera de la cinta. Pasar el umbral dispara `DESVIAR`. Siempre hay una alternativa con botón.

### 8.5 Transición

Después del simulador, frase grande sola en pantalla, palabra por palabra con el scroll:

> **No es lo mismo salir en moto que salir a correr. Mesh tampoco.**

### 8.6 Actividades

**Objetivo:** que cada visitante vea la suya. **El tema de toda la sección cambia** al elegir una actividad.

```text
ETIQUETA:  Posta 3 · Tu actividad
H2:        ¿En qué salís?
```

**Selector:** 4 botones grandes en `role="radiogroup"`. Teclas de flecha funcionan. Por defecto, la que el hash indique (`#moto`, útil para campañas por actividad) o **bici** como inicial.

| Actividad | Tema | Frase | Muestra de pantalla |
|---|---|---|---|
| **Moto** | Negro + amarillo `#FFCC00`, cambio brusco | **Con guantes, al sol y sin distraerte.** Pantalla completa, alto contraste, botones extra grandes. | Pantalla de alto contraste, botones enormes |
| **Bici** | Noche + naranja | **Un pelotón es un organismo.** Si alguien pincha, te enterás antes de la próxima loma. | Mapa con grupo cercano |
| **Running** | Crema + naranja | **Mirá para adelante. Mesh vibra.** La vibración manda; la pantalla acompaña. | Pantalla mínima; rueda vibrando |
| **Trekking** | Verde musgo `#3E4F3A` + crema (contraste a verificar ≥ 4,5:1) | **Donde se acaba la señal, seguís sumando metros.** | Cerro con curvas de nivel |

**Datos que se muestran** (de `ACTIVIDADES`), con `contar`:

```text
Separación antes de avisar      300 m
Tolerancia de atraso            5 min
Detención antes de preguntar    3 min
Feedback                        Visual + vibración
```

Con pie: *"Valores iniciales. El líder los ajusta en cada viaje."* El tiempo de detención no se presenta como tiempo de respuesta ante emergencias.

**Prohibido:** mostrar velocidad esperada, incluso en otras actividades (sección 2.1). Para moto, además, sin indicador de competencia.

**Animación:**
- Transición de tema con cortina diagonal de 500 ms; en moto el cambio es directo, en 120 ms.
- El teléfono rota y cambia de pantalla.
- Ruedas decorativas cambian su ritmo: moto constante y tranquilo, nunca a más ritmo que las demás.

**Toque especial:** en dispositivos con `navigator.vibrate`, al elegir running o trekking, vibra un patrón corto (`[40, 60, 40]`). Solo tras un gesto del usuario; se ignora sin soporte y en reduced motion.

### 8.7 Offline

**Objetivo:** responder "¿y en la montaña, sin señal?". Es una de las objeciones más fuertes y uno de los grandes diferenciales. Sección con pin en escritorio.

```text
ETIQUETA:  Posta 4 · Sin señal
H2:        Se acabó la señal. Tu recorrido, no.
SUB:       Sin conexión, Mesh guarda tu recorrido en el teléfono
           y lo sincroniza solo al volver.
```

**Escena atada al scroll:**
1. Gonza avanza por la cinta. Barra de señal llena.
2. Entra en una zona gris de sierras. Barra vacía. Cartel `Sin señal`. Para el resto del grupo, su rueda queda atenuada.
3. Sigue avanzando con trazo punteado. Contador en Space Mono: `Guardados en el teléfono: 0 → 72 puntos`, sumando **uno por cada 5 segundos** de la escena.
4. Sale de la zona. Destello de sincronización. Los puntos viajan al mapa, la línea punteada se vuelve sólida y el contador pasa a `Sincronizado ✓`.

**Remate:**

```text
Grande:  Cero metros perdidos.
Pie:     Mientras no hay conexión, el grupo no recibe tu posición en vivo
         ni los avisos que dependen de ella. Apenas volvés, se pone al día.
```

El pie es obligatorio: da credibilidad y evita una promesa falsa.

**Mobile y reduced motion:** tira horizontal de 4 viñetas con el mismo relato.

### 8.8 Privacidad

**Objetivo:** convertir el "¿me van a andar siguiendo?" en confianza. Tono serio, cálido y sin chistes.

```text
ETIQUETA:  Posta 5 · Tu ubicación
H2:        Vos decidís quién te ve.
```

**Interacción central:** interruptor grande **Compartir mi ubicación** en un teléfono, junto a un mapa del grupo:

- **Encendido:** tu rueda aparece en el mapa de los demás.
- **Apagado:** tu rueda se desvanece del mapa grupal, pero el contador `Tu recorrido, guardado solo para vos` sigue subiendo, y aparece: *"Con el compartir apagado, el grupo no te ve y Mesh no genera alertas sobre vos."*

**Cuatro puntos, basados en el texto real de consentimiento de la app (`AvisoUbicacion.tsx`):**

| Ícono | Texto |
|---|---|
| `map-pin` | **Solo durante el viaje.** Tu posición se lee cada 5 segundos mientras el viaje está en curso. Termina, y deja de leerse. |
| `users` | **Solo tu grupo de ese viaje.** Ninguna otra persona. |
| `eye-off` | **Viaje por viaje.** Lo apagás cuando quieras, y nadie puede decidirlo por vos. Ni el líder. |
| `list` | **Sin secretos.** Podés consultar quién accedió a tu posición. |

**Animación sobria:** tarjetas con un fundido simple, nada de rebote. El interruptor es la única estrella.

### 8.9 Todo lo demás (bento)

**Objetivo:** mostrar que Mesh es mucho más que el mapa, sin hacer una lista aburrida.

```text
ETIQUETA:  Posta 6 · Y además
H2:        Todo lo que una salida necesita. Y nada que estorbe.
```

Grilla con tamaños variados; en cada celda, una microanimación al entrar y al pasar el puntero.

| Tamaño | Título | Texto | Microanimación |
|---|---|---|---|
| Grande | **Viaje YA** | ¿Salen ahora? Sin planificar nada. Elegí actividad y arrancá. | Un rayo atraviesa la tarjeta; aparece el botón |
| Mediana | **¿Llueve?** | Pronóstico de lluvia y viento sobre tu ruta, antes de salir. | Gotas caen sobre la cinta |
| Mediana | **Sumá con un QR** | Sin invitar uno por uno. | QR que se compone por módulos |
| Grande | **Paradas que no dispersan** | Combustible, comida, descanso. Un toque y el grupo sabe por qué paraste. | Chips de categoría caen |
| Chica | **Pedí parada** | El líder aprueba o rechaza. Se acabó el "¿paramos?" en el chat. | Burbuja con ✓ |
| Mediana | **Checklist** | Que nadie se olvide nada. Sugerido por actividad. | Tildes se van marcando |
| Mediana | **Gastos** | Dividan la nafta y el asado, sin planilla. | Monedas se reparten |
| Grande | **Recorridos de la comunidad** | Encontrá rutas cerca tuyo, mirá cuánto las recomiendan e importalas. | Mapa con cintas apareciendo |
| Chica | **Insignias y rachas** | Por kilómetros y constancia, nunca por velocidad. | Rueda que gira como medalla |
| Mediana | **El resumen de la salida** | Distancia, tiempo y paradas al cerrar el viaje. | Contadores suben |

**Animación:** entrada con stagger .08 y efecto de inclinación 3D con el mouse, máximo 4°. En mobile, una columna con revelado simple.

### 8.10 Competir: manifiesto

**Objetivo:** convertir una regla de seguridad en un momento de marca memorable. Empieza en crema y termina con un corte brusco a negro y amarillo.

```text
ETIQUETA:   Posta 7 · Competir
H2:         ¿Competir? Sí.
H2 (2):     En moto, nunca.
```

**Primer tiempo, crema-naranja:** "En bici, running o trekking, activá el modo competitivo: tabla en vivo, posiciones, y hasta un fantasma de tu recorrido anterior para correrle a tu mejor versión." Se ve una mini tabla ficticia de bici con ruedas animadas, y Gonza último: *"Gonza, último. Pero contento."*

**Segundo tiempo:** al seguir el scroll, corte a negro. Una rueda con ícono de moto entra lenta. La tabla se apaga.

```text
En moto no hay rankings, ni tablas, ni fantasma.
No es un olvido: es una decisión.
En la ruta, la única meta es volver a casa.
```

**Reglas:** sin velocímetros, sin onomatopeyas de motor. Las motos no aparecen en la mini tabla. La animación de este bloque es deliberadamente **la más lenta de toda la página**.

### 8.11 La diferencia

```text
ETIQUETA:  Posta 8 · Por qué Mesh
H2:        Tu app de siempre mira al que corre. Mesh mira al grupo.
```

Comparación por categoría, sin nombres ni logos de competidores:

| Pregunta | App de rendimiento | App de mapas | App de ubicación | **Mesh** |
|---|---|---|---|---|
| ¿Mide tu actividad? | Sí | No | No | Sí |
| ¿Muestra una ruta planificada? | Parcial | Sí | No | Sí |
| ¿Muestra al grupo en vivo? | En general, no | Parcial | Sí | **Sí** |
| ¿Avisa si alguien se desvía o se atrasa? | No | No | No | **Sí, solo** |
| ¿Distingue parada de posible problema? | No | No | No | **Sí** |
| ¿Se adapta a tu actividad? | Parcial | Parcial | No | **Sí** |

Las primeras columnas son descripción general por categoría. **Revisar con el PO antes de publicar** (sección 13). Si no se valida, reemplazar por la versión de dos columnas: *Sin Mesh / Con Mesh*.

**Animación:** las filas se revelan una a una. Las respuestas de Mesh entran con `pop`. Columna de Mesh en naranja. En mobile se muestra una tarjeta por pregunta para evitar el scroll horizontal.

### 8.12 Preguntas frecuentes

Con `<details>` nativo, animado con CSS. También como JSON-LD `FAQPage`.

| Pregunta | Respuesta |
|---|---|
| ¿Tienen que tener Mesh todos? | Para aparecer en el mapa, sí. Pero entrar es fácil: escanean el QR y se suman. |
| ¿Y si en la ruta no hay señal? | Tu recorrido se guarda en el teléfono y se sincroniza solo cuando vuelve la conexión. Mientras tanto, el grupo no recibe tu posición en vivo ni los avisos que dependen de ella. |
| ¿Quién ve dónde estoy? | Solo las personas confirmadas en ese viaje, y solo mientras está en curso. Podés apagarlo cuando quieras, y consultar quién accedió a tu posición. |
| ¿Si apago el compartir, sigo protegido por las alertas? | No. Con el compartir apagado, Mesh no genera alertas automáticas sobre vos, porque incluirían tu ubicación. |
| ¿Detecta accidentes? | Detecta si alguien queda detenido varios minutos sin marcar una parada: le pregunta si está bien y avisa al grupo. No reemplaza a los servicios de emergencia. Ante una emergencia, llamá al 911. |
| ¿Hay rankings en moto? | No, ni los va a haber. La competencia de velocidad en moto no tiene lugar en Mesh. |
| ¿Gasta mucha batería? | Mesh usa el GPS cada 5 segundos durante el viaje, así que consume más que una app común. Para salidas largas, llevá un cargador. |
| ¿Sirve solo para grupos grandes? | No. De dos amigos a una caravana entera. También podés registrar una salida individual. |
| ¿Cuántas personas pueden entrar? | Depende de [CONFIRMAR]. Por defecto: omitir esta pregunta. |
| ¿Puede usarla un menor de 18? | Por ahora no. Mesh es solo para mayores de 18 años. |
| ¿En qué teléfonos funciona? | Según los estados de descarga (sección 8.13). Texto generado por configuración. |
| ¿Cuánto cuesta? | [CONFIRMAR]. Por defecto: omitir esta pregunta. |

### 8.13 La llegada: CTA final

**Objetivo:** el punto más alto de la página. Es el clímax del viaje.

**Secuencia:**
1. La cinta llega al marcador de destino y se abre en un círculo naranja que llena la pantalla.
2. Fondo `--naranja`, texto en `--tinta`. Las ruedas llegan una a una.
3. Contador grande en Space Mono: `5/6`.
4. Texto: **"Falta uno."**
5. Pausa de 1,2 s. Gonza entra corriendo por el costado con un rebote y frena de golpe.
6. El contador pasa a `6/6`. Explosión de anillos concéntricos, como la rueda del logo.

```text
Grande:     Llegó el Gonza. Ahora sí.
H2:         Tu próxima salida, con todos.
SUB:        Bajá Mesh, armá el viaje y mandales el QR.
CTA:        [Botones de descarga]
PIE:        Salen juntos. Llegan juntos.
```

**Reglas:** el botón se muestra **desde el primer momento**; la secuencia nunca retiene el CTA. En reduced motion, se muestra directamente `6/6` y el texto final.

**Botones de descarga:** un solo componente, `BotonDescarga.astro`, gobernado por configuración.

```ts
// src/config/descarga.ts
type EstadoPlataforma =
  | { estado: 'tienda'; url: string }
  | { estado: 'apk'; url: string }       // APK directo para Android
  | { estado: 'proximamente' }

export const DESCARGA: { android: EstadoPlataforma; ios: EstadoPlataforma; listaEspera?: string } = {
  android: import.meta.env.PUBLIC_ANDROID_URL
    ? { estado: 'tienda', url: import.meta.env.PUBLIC_ANDROID_URL }
    : import.meta.env.PUBLIC_APK_URL
      ? { estado: 'apk', url: import.meta.env.PUBLIC_APK_URL }
      : { estado: 'proximamente' },
  ios: import.meta.env.PUBLIC_IOS_URL
    ? { estado: 'tienda', url: import.meta.env.PUBLIC_IOS_URL }
    : { estado: 'proximamente' },
  listaEspera: import.meta.env.PUBLIC_LISTA_ESPERA_URL || undefined,
}
```

| Estado | Qué se muestra |
|---|---|
| `tienda` | Insignia oficial de Google Play o App Store, respetando sus guías de marca |
| `apk` | Botón "Descargar para Android (APK)" con una nota breve sobre cómo instalar |
| `proximamente` | Botón deshabilitado "Próximamente en iPhone"; si hay `listaEspera`, enlace "Avisame cuando esté" |
| Sin ninguna plataforma disponible | El CTA principal pasa a "Avisame cuando esté" o, sin lista, se reemplaza por "Mirá cómo funciona" |

**Comportamiento por dispositivo:**
- Android o iOS: el botón de su plataforma va primero.
- Escritorio: botones + **QR grande** hacia el destino de descarga, generado en tiempo de build con el texto "Apuntá con la cámara". Sin destino configurado, no hay QR.
- Botón secundario **"Pasáselo al grupo"**: usa `navigator.share`; sin soporte, copia el link con confirmación visual.

### 8.14 Footer

- Logo, eslogan y aviso de seguridad (2.3).
- Enlaces: Privacidad, Términos, Contacto ([CONFIRMAR]).
- Línea: `Mesh · Proyecto Final 2026 · UTN FRC · Grupo 4 · Curso 5K1`.
- `Disponible para mayores de 18 años.`
- Botón "Pausar animaciones".
- Atribución si corresponde a tipografías o iconos.

### 8.15 Páginas legales

- `/privacidad`: resumen de lo que hace la **landing** (analítica sin cookies) y de lo que hace la **app** (basado en RN-110 a RN-114). Usar el mismo tono llano.
- `/terminos`: mínimo, con el aviso de seguridad.
- Ambos con banner: **"Borrador. Pendiente de revisión legal"**, mostrado hasta que el equipo lo retire (sección 13). No generar texto legal presentándolo como definitivo. Tener en cuenta la Ley 25.326 de Protección de Datos Personales de Argentina.

---

## 9. SEO, compartir y analítica

### 9.1 SEO

```html
<html lang="es-AR">
<title>Mesh · La app para salir en grupo y llegar todos juntos</title>
<meta name="description" content="Todo tu grupo en un solo mapa, con avisos automáticos si alguien se desvía, se atrasa o se queda quieto. Para moto, bici, running y trekking.">
```

- Open Graph y Twitter Card con `og-mesh.png` (logo, cinta, "¿Y el Gonza?").
- JSON-LD: `MobileApplication` (sin `aggregateRating` ni `offers` hasta confirmar) y `FAQPage`.
- Búsquedas objetivo: `app para salir en grupo en moto`, `app para coordinar salida en bici`, `ver ubicación del grupo en ruta`, `app grupo trekking sin señal`, `app para grupos de running`.
- Un solo H1. Jerarquía correcta. `sitemap.xml`, `robots.txt`, URL canónica.
- Vista previa de calidad para WhatsApp: la OG image es decisiva, porque por ahí se va a compartir.

### 9.2 Analítica

Sin cookies y sin identificadores persistentes. Vía `src/lib/analitica.ts`, no operativa si no hay variable de entorno.

| Evento | Propiedades |
|---|---|
| `cta_click` | `seccion`, `plataforma`, `estado` |
| `sim_interaction` | `situacion` |
| `sim_completed` | — |
| `actividad_elegida` | `actividad` |
| `share_click` | `metodo` |
| `scroll_hito` | `seccion` |
| `faq_open` | `pregunta` |

---

## 10. Calidad

### 10.1 Presupuesto de performance

Medido en Lighthouse móvil, 4G simulada.

| Métrica | Objetivo |
|---|---|
| LCP | ≤ 2,0 s |
| CLS | ≤ 0,05 |
| INP | ≤ 200 ms |
| Performance Lighthouse | ≥ 90 |
| Accesibilidad / SEO / Buenas prácticas | ≥ 95 / 100 / ≥ 95 |
| JS inicial (gzip) | ≤ 70 KB |
| Total primera carga (gzip) | ≤ 500 KB |

- El H1 usa fuente precargada, sin esperar animación.
- Solo la primera vista carga inmediatamente; el resto, por import dinámico.
- Animar en 60 fps en un Android de gama media. Si no se alcanza, reducir: menos ruedas, sin malla en las zonas más exigentes.

### 10.2 Accesibilidad (WCAG 2.2 AA)

- Navegación completa por teclado, foco visible y "Saltar al contenido".
- Contrastes de la tabla 4.3 y `lang` correcto.
- SVG decorativos con `aria-hidden`, y los informativos con su descripción.
- Área táctil ≥ 44 px, ≥ 56 px en el simulador.
- La información no depende solo del color: cada estado lleva ícono y texto.
- Nada parpadea más de 3 veces por segundo.

### 10.3 Dispositivos de prueba

Android gama media con Chrome, iPhone con Safari, Chrome, Firefox y Safari en escritorio. Anchos: 360, 390, 768, 1024, 1440 y 1920 px. Sin scroll horizontal. Verificar notch, barra inferior de iOS y modo landscape en teléfono.

### 10.4 Tests automáticos

**`tests/reglas-contenido.test.ts` (obligatorio, falla el build):**

```ts
import { ACTIVIDADES } from '../src/config/actividades'
// 1. ACTIVIDADES.moto.competencia === false
// 2. Ninguna actividad expone campos de velocidad.
// 3. Sobre el HTML generado, falla si aparece alguna de estas expresiones:
//    /km\/h/i, /velocímetro/i, /wrapped/i, /inteligencia artificial/i, /\bIA\b/,
//    /wearable/i, /radares?/i, /se cae/i, /100\s*%\s*segur/i, /rastre[aá]/i,
//    /aggregateRating/, /testimonios?/i
// 4. El bloque #moto y la sección Competir no contienen /ranking activo|podio|más rápido|récord/i,
//    salvo la frase de exclusión aprobada.
// 5. Existe el aviso de seguridad con "911" en el footer.
// 6. Con URL no configurada, no aparecen insignias de tiendas.
```

**`tests/sim.test.ts`:** las transiciones de la máquina de estados: desvío y atraso avisan solo al líder; posible incidente avisa a todo el grupo; `ESTOY_BIEN` cancela; `ESTOY_MAL` genera alerta de peligro; `REINICIAR` deja todo como al principio.

**`tests/smoke.spec.ts` (Playwright):** la página carga sin errores de consola, cada CTA existe, teclado, simulador completo, cambio de actividad, sin JS muestra H1 y CTA, reduced motion sin pin.

---

## 11. Plan de ejecución

Cada fase termina con sus criterios cumplidos, antes de pasar a la siguiente. **El contenido llega antes que la animación.**

### Fase 0 — Base

- [ ] Rama `feature/landing`, carpeta `landing/` con Astro y TypeScript estricto.
- [ ] Scripts: `dev`, `build`, `preview`, `test`, `test:e2e`, `lint`.
- [ ] `.env.example` sin secretos y `landing/` con sus propias dependencias.
- [ ] Verificar que `deploy-backend.yml` (filtrado por `backend/**`) no se dispare con esta rama.

**Listo si:** `npm run build` genera una página vacía sin errores y sin cambios fuera de `landing/`.

### Fase 1 — Sistema de diseño

- [ ] Tokens de color, tipografía y motion.
- [ ] Logo SVG separado y validado contra el PNG.
- [ ] Componentes `Logo`, `Rueda`, `BotonDescarga`, `Telefono`.
- [ ] Página `/estilos` para revisión, disponible solo en desarrollo (`import.meta.env.DEV`) y excluida del build de producción.

**Listo si:** los contrastes son los de la tabla 4.3 y el logo coincide con el PNG al superponerlos.

### Fase 2 — Contenido estático completo

- [ ] Las 14 secciones en HTML semántico, responsive y con el copy final.
- [ ] Mockups de pantalla en su estado final.
- [ ] Configuración `descarga.ts` y `actividades.ts`.
- [ ] Test de reglas de contenido funcionando.

**Listo si:** toda la historia se entiende **sin JS**, y `reglas-contenido.test.ts` pasa.

### Fase 3 — Motion base

- [ ] `init.ts`, Lenis, `gsap.matchMedia`, reduced motion y botón de pausa.
- [ ] Cinta global, ruedas que giran, mini ruta de navegación.
- [ ] `revelarTitulo` y entradas por sección, hero completo.

**Listo si:** el scroll corre fluido en un Android de gama media y reduced motion desactiva todo.

### Fase 4 — Piezas de autor

Una por vez, en este orden de impacto:

- [ ] **Simulador** (8.4) con su máquina de estados y tests.
- [ ] **Llegada** con `5/6 → 6/6` (8.13).
- [ ] **Chat del problema** (8.2).
- [ ] **Cómo funciona** con pin (8.3).
- [ ] **Actividades** con cambio de tema (8.6).
- [ ] **Offline** atado al scroll (8.7).
- [ ] **Privacidad** con interruptor (8.8).
- [ ] **Bento** con microanimaciones (8.9) y **Competir** (8.10).

**Listo si:** cada pieza funciona con mouse, touch, teclado y reduced motion. Si el tiempo se acaba, cortar desde el final de la lista: el simulador y la llegada nunca se recortan.

### Fase 5 — Pulido responsive, accesibilidad y performance

- [ ] Recorrer matriz de dispositivos y anchos.
- [ ] Auditar teclado y lector de pantalla.
- [ ] Alcanzar los presupuestos de 10.1. Reducir efectos antes de bajar los objetivos.

**Listo si:** los puntajes de Lighthouse se cumplen en mobile, y no hay scroll horizontal.

### Fase 6 — SEO, legales y analítica

- [ ] Metadatos, JSON-LD, OG, sitemap y robots.
- [ ] Páginas legales con banner de borrador.
- [ ] Eventos de analítica, inactivos sin configuración.
- [ ] Probar la vista previa pegando el link en WhatsApp.

**Listo si:** los validadores de datos estructurados y OG no reportan errores.

### Fase 7 — Publicación

- [ ] Abrir PR con capturas, video corto y reporte de Lighthouse.
- [ ] Revisión por pares y validación del PO, en especial 2.2, 8.11 y 8.15.
- [ ] Desplegar en un entorno de preview, y resolver los [CONFIRMAR].
- [ ] Publicar en el dominio final **solo con aprobación del equipo**.

---

## 12. Definición de terminado

- [ ] Todos los tests pasan.
- [ ] Ningún elemento de la sección 2 fue violado.
- [ ] Ninguna feature mencionada queda fuera de "Implementado" en la tabla 2.2.
- [ ] Ninguna cifra, testimonio ni reseña inventada.
- [ ] Moto: sin velocidad, sin ranking, sin lenguaje competitivo.
- [ ] Aviso de seguridad presente en el simulador, la FAQ y el footer.
- [ ] Links de descarga reales, o estado "próximamente" honesto.
- [ ] Sin JS y con reduced motion, todo se entiende y se puede usar.
- [ ] Presupuestos de performance cumplidos en mobile.
- [ ] Sin cambios fuera de `landing/`, salvo este documento o las notas que pida el equipo.
- [ ] Reporte final con los [CONFIRMAR] pendientes y cualquier desvío del plan.

---

## 13. Pendientes del equipo: [CONFIRMAR]

Ninguno bloquea el desarrollo. Cada uno tiene un comportamiento por defecto.

| # | Decisión | Por defecto si no se responde | Responsable sugerido |
|---|---|---|---|
| 1 | Links de Google Play, App Store o APK público | Estado `proximamente` | Equipo |
| 2 | ¿Hay versión para iPhone en esta etapa? | "Próximamente en iPhone" | Equipo |
| 3 | ¿Mesh es gratis? ¿Sigue vigente la idea freemium? | No se menciona precio y se omite la FAQ | PO |
| 4 | Lista de espera | Sin formulario, sin recolectar emails | PO |
| 5 | Dominio final | URL de preview, sin indexar | Equipo |
| 6 | Hosting: Cloudflare Pages o Vercel, o el VPS del proyecto | Cloudflare Pages | Equipo |
| 7 | Mail de contacto | Sin enlace de contacto | Equipo |
| 8 | Tabla comparativa por categorías (8.11) | Versión *Sin Mesh / Con Mesh* | PO |
| 9 | Prueba de carga para publicar capacidad de integrantes | No se publica la cifra | Equipo |
| 10 | Capturas reales y fotos de salidas con permiso | Mockups recreados en HTML | Equipo |
| 11 | Revisión legal de privacidad y términos | Banner de borrador visible | Equipo o asesor legal |
| 12 | ¿Mantener el chiste de Gonza? | Sí | PO |

**Antes de publicar en tiendas (fuera de esta landing):** el identificador actual es `com.frangiorda1.frontend`, en `frontend/app.json`. Una vez publicada una app, ese identificador no se puede cambiar, así que conviene revisarlo antes.

---

## 14. Fuentes

Datos verificados en el repositorio el 06/11/2026:

- `tesis-brain/reglas-de-negocio.md`: RN-021, RN-030 a RN-038, RN-040 a RN-044, RN-063 a RN-065, RN-070 a RN-076, RN-080 a RN-088, RN-105 a RN-114, §8, §12.
- `tesis-brain/us-viaje-ya.md`: flujo de Viaje YA.
- `frontend/constants/Colors.ts`, `frontend/constants/Typography.ts`: color y tamaño mínimo.
- `frontend/components/AvisoUbicacion.tsx`: puntos del consentimiento.
- `backend/src/modules/motor-eventos/motorEventos.config.ts`: tiempos de detección por actividad.
- `backend/prisma/migrations/20261023120000_insignias/migration.sql`: insignias sin criterio de velocidad.
- `docs/mesh-screens.html`: color de marca `#FE3A0F`, colores de alerta y referencia de pantallas.
- `tesis-brain/MESH-PROMO.html`: guion del video promocional.
- Búsqueda en el repo sin resultados para: `wrapped` y navegación giro a giro en el código de la app, y links publicados de Google Play o App Store.

"Implementado" en la tabla 2.2 significa que el módulo o la pantalla existen en el código y están especificados. No equivale a una prueba funcional de cada feature en producción: el PO la valida en la Fase 7.
