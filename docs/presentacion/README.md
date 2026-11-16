# Presentación con dos celulares en pantalla

Muestra dos celulares Android en vivo, lado a lado, sobre un fondo con la marca de Mesh
y el nombre de cada integrante. Lo que se proyecta es la pantalla de la notebook.

| Archivo | Qué hace |
|---|---|
| `espejar-celulares.cmd` | Doble clic: arranca todo |
| `espejar-celulares.ps1` | Detecta los celulares, abre el fondo y acomoda las ventanas |
| `escenario.html` | Fondo de presentación (logo, nombres, indicador "en vivo") |

Usa [scrcpy](https://github.com/Genymobile/scrcpy): espeja por USB o WiFi, con muy poca
latencia y sin instalar nada en el teléfono. **Solo Android**: con iPhone no funciona.

---

## 1. Una sola vez

**En la notebook:**

```powershell
winget install Genymobile.scrcpy
```

**En cada celular:**

1. Ajustes › Acerca del teléfono › tocar 7 veces *Número de compilación* (habilita Opciones de desarrollador).
2. Opciones de desarrollador › activar **Depuración USB**.
3. En Xiaomi/Redmi/POCO activar también **Depuración USB (ajustes de seguridad)**; si no, los toques desde la PC no funcionan.
4. Conectar por cable y aceptar **Permitir depuración USB** (tildar *Permitir siempre desde esta computadora*).

## 2. Usarlo

Conectar los dos celulares por cable y hacer doble clic en `espejar-celulares.cmd`.
Para cerrar todo: volver a la consola (Alt+Tab) y apretar Enter.

**Alternar con otras ventanas** (diapositivas, backoffice, el navegador): pasar a esa ventana
con Alt+Tab y queda adelante de todo. Para volver a los celulares, Alt+Tab a *Mesh · Presentación*:
reaparecen arriba del fondo y en su lugar, aunque se hayan movido.

Desde PowerShell se pueden pasar opciones:

```powershell
cd docs\presentacion
.\espejar-celulares.ps1                                   # Lucía (líder) | Martín (participante)
.\espejar-celulares.ps1 -Invertir                         # intercambia los celulares de lado
.\espejar-celulares.ps1 -Izquierda "Sofía" -RolIzquierda "Participante"
.\espejar-celulares.ps1 -Wifi                             # después se desenchufan los cables
.\espejar-celulares.ps1 -Pantalla 1                       # proyector en modo Extender
.\espejar-celulares.ps1 -SinEscenario -ConBordes          # solo las ventanas, movibles
```

El script imprime qué modelo quedó de cada lado. Si quedaron al revés, `-Invertir`.

## 3. Sin cables (WiFi)

Probado con un Xiaomi 14T Pro y un Samsung S24 en una red de 5 GHz: funciona igual que por cable.
**Bluetooth no sirve**: scrcpy no lo soporta y no tiene ancho de banda para video.

**Cómo se usa**

1. La notebook y los dos celulares en la **misma red**.
2. Enchufar los celulares por cable **una vez** y correr con `-Wifi` (desde el `.cmd` también: `espejar-celulares.cmd -Wifi`).
3. Cuando dice *ya podés desenchufar los cables*, se desenchufan. El espejo sigue.
4. Para volver a abrirlo sin cable, correr de nuevo con `-Wifi`: reconecta solo a las direcciones de la última vez.

Hace falta volver a enchufar si un celular **se reinicia**, si **cambia de red** o si el router le da otra IP.

**Qué red usar en la facultad**

Las redes de facultad suelen aislar a los dispositivos entre sí, y ahí el WiFi no conecta.
Lo más seguro es llevar la red propia: **Zona con cobertura inalámbrica móvil de Windows**
(Configuración › Red e Internet). La notebook arma la red y los dos celulares se conectan a ella.
No depende del WiFi del aula y el script detecta esa red solo.
Ensayarlo antes: Mesh necesita internet, así que la notebook tiene que tener conexión para compartir,
o los celulares tienen que seguir usando datos móviles.

Si no hay forma de armar una red propia, ir con cable: es lo más estable y además carga los teléfonos.

**Alternativa sin cable nunca: depuración inalámbrica (Android 11 o superior)**

Opciones de desarrollador › *Depuración inalámbrica* › *Vincular dispositivo con código*. En la notebook:

```powershell
# adb viene dentro de la carpeta de scrcpy (winget no lo agrega al PATH)
$adb = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Genymobile.scrcpy*" -Recurse -Filter adb.exe)[0].FullName
& $adb pair 192.168.x.x:PUERTO_DE_VINCULACION     # pide el código de 6 dígitos que muestra el celular
& $adb connect 192.168.x.x:PUERTO_DE_CONEXION     # el que figura arriba en esa misma pantalla
```

Después correr el script **sin** `-Wifi`: toma las conexiones que ya existen. El celular apaga la
depuración inalámbrica al cambiar de red, así que hay que reactivarla en el aula.

## 4. Ensayar el fondo

Para ensayar el fondo sin celulares, abrir `escenario.html?guia=1` en el navegador
(tecla F para pantalla completa). Con `?enlace=0` se oculta el indicador "en vivo".

## 5. Checklist del día

**El día anterior**
- [ ] Volver a correr el seed de demo (`npm run demo:seed` en `backend/`): las fechas, rachas y el ranking mensual son relativos al día. Escribe en producción.
- [ ] Ensayo completo en el aula con el proyector real y los cables que se van a usar.

**Antes de empezar**
- [ ] Celulares con más de 80 % de batería. Por USB cargan mientras se espejan.
- [ ] **No molestar** activado en los dos: cualquier notificación se proyecta.
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
- Si la pantalla de un celular se apaga, su ventana se ve negra: tocar el botón de encendido. Por cable se mantienen despiertos solos; por WiFi esa opción no aplica, así que conviene apagar el bloqueo automático o subir el tiempo de pantalla.

## 6. Si algo falla

| Síntoma | Qué hacer |
|---|---|
| "No hay celulares listos" | Cable de datos (no de solo carga), celular desbloqueado, aceptar el aviso de depuración |
| Aparece como *sin autorizar* | El script reinicia adb para que vuelva el aviso y espera un minuto. Si igual no aparece: desenchufar, volver a enchufar y correrlo de nuevo; último recurso, Opciones de desarrollador › *Revocar autorizaciones* |
| Ventana negra | Desbloquear el celular; algunas apps bancarias bloquean la captura, Mesh no |
| Se ve entrecortado por WiFi | Usar la red propia de la notebook (zona con cobertura móvil) o volver al cable |
| "No pude conectar" con `-Wifi` | La red aísla dispositivos: cambiar a la red propia de la notebook o a un hotspot |
| "No está en la misma red que la notebook" | El celular está con datos móviles u otra red: conectarlo a la red de la notebook |
| Las ventanas no coinciden con los nombres | Cerrar con Enter y volver a correr; si persiste, usar `-ConBordes` y acomodarlas a mano |
| El script no corre por permisos | Usar el `.cmd`, que lo lanza con `-ExecutionPolicy Bypass` |

Los logs de scrcpy quedan en `%TEMP%\mesh-presentacion`.
