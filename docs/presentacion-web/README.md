# Presentación web de Mesh

Una página en lugar de PowerPoint. Funciona sin internet: abrir `index.html` con Chrome o Edge y apretar **F** para pantalla completa.

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
| Inicio / Fin | Primera / última pantalla |

El número de pantalla queda en la dirección (`index.html#4`): si se recarga, vuelve a la misma.
El cursor se esconde solo si nadie mueve el mouse.

## Sumar pantallas

Cada pantalla es un `<section class="slide">` dentro de `index.html`. Para sumar una, copiar una parecida y cambiar el texto.

- `data-seccion="..."`: nombre de la parte; se ve abajo a la izquierda.
- `data-quien="..."`: quién la presenta (opcional). Si se completa, aparece al lado de la sección.
- `class="paso"`: ese elemento aparece recién con el próximo clic derecho.
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
