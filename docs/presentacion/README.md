# Presentación con dos celulares en pantalla

Muestra dos celulares Android en vivo, lado a lado, sobre un fondo con la marca de Mesh
y el nombre de cada integrante. Lo que se proyecta es la pantalla de la notebook.

| Archivo | Qué hace |
|---|---|
| `Presentar por cable.cmd` | Doble clic: arranca todo con los celulares enchufados |
| `Presentar por WiFi.cmd` | Doble clic: arranca todo por WiFi (ver sección 3) |
| `Cerrar presentacion.cmd` | Doble clic: cierra todo, aunque se haya perdido el control |
| `Instalar accesos directos.cmd` | Crea los accesos del menú Inicio para anclar a la barra de tareas |
| `espejar-celulares.ps1` | El script que usan los tres lanzadores |
| `iconos/` | Íconos de los accesos directos (Mesh con insignia de WiFi, cable o cerrar) |
| `escenario.html` | Fondo de presentación (logo, nombres, indicador "en vivo") |

Usa [scrcpy](https://github.com/Genymobile/scrcpy): espeja por USB o WiFi, con muy poca
latencia y sin instalar nada en el teléfono. **Solo Android**: con iPhone no funciona.

---

## 1. Una sola vez

**En la notebook:**

```powershell
winget install Genymobile.scrcpy
```

**Anclar a la barra de tareas** (opcional, recomendado):

1. Doble clic en `Instalar accesos directos.cmd`. Crea en el menú Inicio la carpeta *Mesh* con
   *Presentar Mesh por WiFi*, *Presentar Mesh por cable* y *Cerrar presentación Mesh*, cada uno con su ícono.
2. Inicio › escribir **Presentar Mesh** › clic derecho › **Anclar a la barra de tareas**. Repetir con los que se quieran.

Windows 11 no deja anclar un `.cmd` directamente ni anclar nada por script: ese clic lo tiene que
hacer la persona. Si se mueve la carpeta del repo, volver a correr el instalador (y re-anclar).
Para quitarlos: `.\instalar-accesos.ps1 -Quitar`.

**En cada celular:**

1. Ajustes › Acerca del teléfono › tocar 7 veces *Número de compilación* (habilita Opciones de desarrollador).
2. Opciones de desarrollador › activar **Depuración USB**.
3. En Xiaomi/Redmi/POCO activar también **Depuración USB (ajustes de seguridad)**; si no, los toques desde la PC no funcionan.
4. Conectar por cable y aceptar **Permitir depuración USB** (tildar *Permitir siempre desde esta computadora*).

## 2. Usarlo

Doble clic en **`Presentar por cable.cmd`** (o `Presentar por WiFi.cmd`). En unos 30 segundos:

1. Prepara los teléfonos: activa **No molestar**, cierra la barra de notificaciones y **abre Mesh**.
2. Abre el fondo en pantalla completa y un espejo por celular, cada uno sobre su nombre.
3. La consola se oculta y queda el **ícono de Mesh en la bandeja** de Windows, al lado del reloj.

Windows 11 manda los íconos nuevos a la flechita **^** de la bandeja. Conviene arrastrarlo
de ahí a la barra de tareas una vez, para tenerlo a mano.

**Control durante la presentación** (menú del ícono o atajos, que andan desde cualquier ventana):

| Atajo | Qué hace |
|---|---|
| `Ctrl+Alt+M` | Mostrar los celulares (también: doble clic en el ícono) |
| `Ctrl+Alt+R` | Reconectar los dos espejos |
| `Ctrl+Alt+I` | Invertir lados (si quedaron al revés de los nombres) |
| `Ctrl+Alt+C` | Mostrar u ocultar la consola, con los mensajes del script |
| `Ctrl+Alt+Q` | Finalizar: cierra espejos y fondo, y deja No molestar como estaba en cada teléfono |

Si `Ctrl+Alt+Q` no responde, doble clic en **`Cerrar presentacion.cmd`**: hace lo mismo desde afuera.

**Lo que hace solo**

- **Reconexión:** si un espejo se cierra (cable flojo, corte de WiFi, un Alt+F4 de más), se vuelve a abrir apenas el celular aparece.
- **Orden de ventanas:** con Alt+Tab a otra ventana (diapositivas, backoffice) esa queda adelante. Al volver con `Ctrl+Alt+M`, los celulares reaparecen arriba del fondo y en su lugar, aunque se hayan movido.
- **Pantallas despiertas:** cada 20 segundos despierta los celulares, porque por WiFi Android no respeta "mantener despierto".

**Opciones** (desde una terminal en esta carpeta; los `.cmd` también las aceptan):

```powershell
.\espejar-celulares.ps1                                   # Lucía (líder) | Martín (participante)
.\espejar-celulares.ps1 -Invertir                         # arranca con los celulares intercambiados
.\espejar-celulares.ps1 -Izquierda "Sofía" -RolIzquierda "Participante"
.\espejar-celulares.ps1 -Wifi                             # lo mismo que Presentar por WiFi.cmd
.\espejar-celulares.ps1 -Pantalla 1                       # proyector en modo Extender
.\espejar-celulares.ps1 -SinPreparar                      # no toca No molestar ni abre Mesh
.\espejar-celulares.ps1 -SinEscenario -ConBordes          # solo las ventanas, movibles
.\espejar-celulares.ps1 -Cerrar                           # lo mismo que Cerrar presentacion.cmd
```

## 3. Sin cables (WiFi)

Probado con un Xiaomi 14T Pro y un Samsung S24 en una red de 5 GHz: funciona igual que por cable.
**Bluetooth no sirve**: scrcpy no lo soporta y no tiene ancho de banda para video.

**Cómo funciona `Presentar por WiFi.cmd`**

No usa el WiFi del lugar: la notebook prende su **zona con cobertura inalámbrica móvil** (su propia
red) y el script conecta los celulares a esa red solo, sin tocar nada en los teléfonos. Al finalizar
la apaga y los celulares vuelven solos a su WiFi de siempre. Probado: tarda unos 40 segundos.

Así no importa que la red de la facultad sea pública o aísle a los dispositivos, y nadie más está
en la misma red que los celulares.

1. La notebook conectada a internet por cualquier lado (WiFi de la facultad, cable, o un celular
   compartiendo datos por USB). La zona comparte esa conexión: así Mesh tiene internet.
2. La primera vez en el lugar: los celulares **enchufados** y doble clic en `Presentar por WiFi.cmd`.
3. Cuando dice *ya podés desenchufar los cables*, se desenchufan. El espejo sigue.
4. Si se cierra y se vuelve a abrir, ya no hace falta el cable: los encuentra en la zona.

Hace falta el cable de nuevo si un celular **se reinicia**. Si un celular no logra pasar a la zona,
sigue por cable y el script lo avisa: la presentación no se corta.

**Si la zona no prende** (sin conexión en la notebook, o la placa WiFi no puede compartir), el script
avisa y sigue con la red actual de la notebook. Si esa red aísla dispositivos, ir con
`Presentar por cable.cmd`: es lo más estable y además carga los teléfonos.

**Seguridad:** el modo WiFi deja abierto un puerto de depuración en cada celular hasta que se reinicia.
Si aparece un aviso de *Permitir depuración* que no esperabas, rechazarlo. Después de presentar,
reiniciar los celulares (o apagar la depuración USB).

**Alternativa sin cable nunca: depuración inalámbrica (Android 11 o superior)**

Opciones de desarrollador › *Depuración inalámbrica* › *Vincular dispositivo con código*. En la notebook:

```powershell
# adb viene dentro de la carpeta de scrcpy (winget no lo agrega al PATH)
$adb = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Genymobile.scrcpy*" -Recurse -Filter adb.exe)[0].FullName
& $adb pair 192.168.x.x:PUERTO_DE_VINCULACION     # pide el código de 6 dígitos que muestra el celular
& $adb connect 192.168.x.x:PUERTO_DE_CONEXION     # el que figura arriba en esa misma pantalla
```

Después usar `Presentar por cable.cmd` (sin `-Wifi`): toma las conexiones que ya existen. El celular apaga la
depuración inalámbrica al cambiar de red, así que hay que reactivarla en el aula.

## 4. Ensayar el fondo

Para ensayar el fondo sin celulares, abrir `escenario.html?guia=1` en el navegador
(tecla F para pantalla completa). Con `?enlace=0` se oculta el indicador "en vivo".

## 5. Checklist del día

**Para presentar en la facultad (WiFi)**
- [ ] Llevar los **cables** igual: hacen falta la primera vez en el lugar y son el plan B.
- [ ] Notebook conectada a internet (WiFi de la facultad, aunque pida login, o datos compartidos desde un celular).
- [ ] Doble clic en *Presentar Mesh por WiFi* con los celulares enchufados; desenchufar cuando lo indique.
- [ ] Si algo falla: `Ctrl+Alt+Q`, enchufar y *Presentar Mesh por cable*.

**El día anterior**
- [ ] Volver a correr el seed de demo (`npm run demo:seed` en `backend/`): las fechas, rachas y el ranking mensual son relativos al día. Escribe en producción.
- [ ] Ensayo completo en el aula con el proyector real y los cables que se van a usar.

**Antes de empezar**
- [ ] Celulares con más de 80 % de batería. Por USB cargan mientras se espejan.
- [ ] **No molestar:** el script lo activa solo, pero en Samsung, por defecto, igual muestra las notificaciones en pantalla (se vio con WhatsApp). En los dos: Ajustes › No molestar › *Ocultar notificaciones* (o *Sin elementos visuales*), una sola vez.
- [ ] Rotación automática apagada, brillo al máximo, tamaño de fuente del sistema por defecto.
- [ ] Cerrar el resto de las apps y borrar notificaciones viejas de la barra.
- [ ] Mesh con el **mismo tema** (claro u oscuro) en los dos celulares, para que se vean parejos.
- [ ] Sesión iniciada en Mesh en cada teléfono con la cuenta que dice su etiqueta (`lucia@demo.mesh`, `martin@demo.mesh` o `sofia@demo.mesh`).
- [ ] Ubicación activada y permiso de ubicación de Mesh en *Permitir siempre*.
- [ ] Datos móviles como respaldo del WiFi de la facultad.
- [ ] Notebook: notificaciones de Windows silenciadas (*No molestar*), cargador enchufado, escala de pantalla sin tocar entre el ensayo y la presentación.

**Durante**
- Manejar los celulares en la mano: el script activa *mostrar toques*, así el público ve dónde se toca.
- Un clic sobre una ventana es un toque en ese celular: no mover el mouse por encima.
- Si la pantalla de un celular se apaga, su ventana se ve negra. El script la despierta cada 20 segundos, pero si queda en la pantalla de bloqueo hay que desbloquearla: conviene sacar el bloqueo con PIN o subir el tiempo de pantalla.

## 6. Si algo falla

| Síntoma | Qué hacer |
|---|---|
| "No hay celulares listos" | Cable de datos (no de solo carga), celular desbloqueado, aceptar el aviso de depuración |
| Aparece como *sin autorizar* | El script reinicia adb para que vuelva el aviso y espera un minuto. Si igual no aparece: desenchufar, volver a enchufar y correrlo de nuevo; último recurso, Opciones de desarrollador › *Revocar autorizaciones* |
| Ventana negra | Desbloquear el celular; algunas apps bancarias bloquean la captura, Mesh no |
| Se ve entrecortado por WiFi | Usar la red propia de la notebook (zona con cobertura móvil) o volver al cable |
| "No pude prender la zona" | La notebook no tiene conexión: conectarla a una red. Si sigue, usar *Presentar por cable* |
| Un celular "sigue por cable" | No llegó a la zona: dejarlo enchufado, o conectarlo a mano a la zona (la red que figura en el mensaje) y volver a abrir |
| "Las direcciones WiFi guardadas son de otra red" | Normal al cambiar de lugar: enchufar los celulares esta vez |
| Un espejo quedó del lado equivocado | `Ctrl+Alt+I` |
| Un espejo se congeló o no aparece | `Ctrl+Alt+R`; si no vuelve, `Ctrl+Alt+C` para ver el mensaje |
| Las ventanas no coinciden con los nombres | `Ctrl+Alt+Q` y volver a abrir; si persiste, `-ConBordes` y acomodarlas a mano |
| Se perdió el control (no responde nada) | Doble clic en `Cerrar presentacion.cmd` |
| El script no corre por permisos | Usar los `.cmd`, que lo lanzan con `-ExecutionPolicy Bypass` |

Los logs de scrcpy quedan en `%TEMP%\mesh-presentacion`.
