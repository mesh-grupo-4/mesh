# Presentación de la defensa de Mesh

Toda la defensa en una página, demo incluida (unos 40 minutos). Funciona sin internet: abrir `index.html`
con Chrome o Edge y apretar **F** para pantalla completa. **El día de la defensa no se abre a mano:** la abre
`docs/presentacion/espejar-celulares.ps1` (*Presentar Mesh por cable / WiFi*), que pone los celulares
espejados encima de las pantallas de demo (ver *Demo con los celulares*).

**Qué decir en cada pantalla:** [`GUION.md`](GUION.md), con tiempos, reparto, cada clic y los datos para las preguntas.

**La primera vez:** doble clic en **`Bajar videos.cmd`**. Baja los videos de fondo (unos 58 MB) a `videos/`.
No vienen en el repo porque su licencia no permite redistribuirlos. Sin ellos la página funciona igual, con fondo negro.

## Controles

Pensados para irse pasando el mouse entre presentadores.

| Acción | Qué hace |
|---|---|
| **Clic derecho** | Avanzar. Si la pantalla tiene puntos que aparecen de a uno, muestra el siguiente |
| **Clic izquierdo** | Retroceder |
| → / Espacio / PageDown | Avanzar (sirve con un puntero de presentación) |
| ← / PageUp | Retroceder |
| F | Pantalla completa |
| ? | Ver u ocultar la ayuda de controles |
| T | Mostrar u ocultar el cronómetro (arranca con el primer avance) |
| Inicio / Fin | Primera / última pantalla |
| Ctrl+Alt+Q | Ir al cierre; ya en el cierre, Mesh se va andando y la pantalla se funde a negro |

El número de pantalla queda en la dirección (`index.html#4`): si se recarga, vuelve a la misma.
El cursor se esconde solo si nadie mueve el mouse.

## Recorrido

| Parte | Pantallas | Contenido |
|---|---|---|
| Introducción | 1 a 9 | Las pantallas de `manu-viejo.html` (con "Para quién" unificado y los nombres completos del equipo): el problema, lo que hay hoy, la solución, para quién, el equipo y el pase "Cómo lo construimos" |
| El proyecto | 10 | Alcance por tiers y el cambio de alcance |
| Organización | 11 a 13 | Scrum, los 13 sprints y velocity |
| Arquitectura | 14 a 16 | Pase, piezas y tecnologías, motor de eventos |
| Solución y demo | 17 a 26 | Funcionalidades, el pase y los 8 flujos, cada uno con su guion y un "detrás de escena" |
| Cierre | 27 a 31 | Pase, lo que logramos y los desafíos, lecciones, agradecimientos y el logo para las preguntas |

Las pantallas de pase ("Cómo lo construimos", "Mesh, por dentro", "Lo que nos llevamos") marcan el cambio
de presentador. En cada pantalla se puede completar `data-quien` con el nombre de quien la presenta.
Los datos salen de los documentos del Drive (Estudio Inicial, Plan de Proyecto, Documento de Producto,
Gestión de Sprint) y de la defensa técnica.

## Demo con los celulares

Las pantallas de demo (`data-celulares`) dejan el centro libre para los dos celulares, con las etiquetas
*Líder* / *Participante* y el indicador "en vivo", igual que `docs/presentacion/escenario.html`. A la
izquierda va el guion del flujo (cada clic derecho enciende el paso siguiente) y a la derecha una nota
técnica.

- En esas pantallas el título de la página pasa a *Mesh · Defensa · Celulares*. El script de espejado
  lo lee y muestra los celulares solo ahí; en el resto quedan escondidos detrás de la presentación.
- **En la demo, avanzar con clic en los costados**, no sobre un celular: un clic sobre su ventana es un
  toque en ese teléfono (y el derecho, "atrás" en Android).
- Si queda un solo celular (`Ctrl+Alt+1/2` del script), se centra y se ocultan las etiquetas.
- Sin el script (ensayo), se dibuja dónde van a quedar los celulares; la tecla **S** prueba el modo
  de un solo celular.
- **Plan B del flujo 4 (en movimiento):** si existe `videos/demo-en-movimiento.mp4`, esa pantalla lo
  muestra en lugar de los celulares. Si no existe, se hace en vivo.

## Cierre

La última pantalla carga `docs/presentacion/cierre.html` (la animación de apertura de la app, lenta): se
forma el logo y aparece *¿Preguntas?*. Con `Ctrl+Alt+Q` las letras vuelven a la M, Mesh se va andando y la
pantalla se funde a negro; el script cierra todo en ese momento. Si el script está corriendo, el primer
`Ctrl+Alt+Q` lo atiende él (suelta los celulares y lleva la presentación al cierre) y el segundo, la página.

## Sumar pantallas

Cada pantalla es un `<section class="slide">` dentro de `index.html`. Para sumar una, copiar una parecida y cambiar el texto.

- `data-seccion="..."`: nombre de la parte; se ve abajo a la izquierda.
- `data-quien="..."`: quién la presenta (opcional). Si se completa, aparece al lado de la sección.
- `class="paso"`: ese elemento aparece recién con el próximo clic derecho.
- `data-celulares`: pantalla de demo (ver arriba). Copiar una de las existentes y cambiar guion y nota.
- Video de fondo: `<video class="fondo" src="videos/archivo.mp4" muted loop playsinline preload="auto" data-velocidad="0.7">`
  más un velo (`velo izq`, `velo abajo` o `velo total`) para que se lea el texto. Arranca al entrar a la
  pantalla y se frena al salir. `data-velocidad` es la cámara lenta: `1` es la velocidad normal.

### Gráficos que se encienden con cada clic

Un paso con `data-evento="x"` le suma a la pantalla la clase `ev-x` mientras está visible. Cualquier pieza
del gráfico con `class="ev ev-x"` aparece en ese momento y desaparece si se retrocede. Así funcionan las
pantallas 4 (cada pregunta enciende a su integrante en el sendero) y 6 (cada alerta aparece en el mapa).
Los nombres disponibles están en el CSS (`.slide.ev-desvio .ev-desvio, ...`); para uno nuevo, sumarlo ahí.

Para dejar un punto sobre una ruta sin calcular coordenadas: `data-ruta="idDelPath" data-ruta-t="0.4"`
(0 = principio de la ruta, 1 = final).

## Videos

Están en `videos/`, con sus créditos y licencia en `CREDITOS.md`. La licencia de Mixkit no permite
redistribuirlos sueltos y el repo es público, así que `videos/` está en el `.gitignore` de esta carpeta y
cada uno los baja con `Bajar videos.cmd`. Para sumar un video nuevo de Mixkit, agregar su nombre y su
número (el que aparece al final de la dirección del video en mixkit.co) en `bajar-videos.ps1`.
