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

Para ensayar el fondo sin celulares, abrir `escenario.html?guia=1` en el navegador
(tecla F para pantalla completa). Con `?enlace=0` se oculta el indicador "en vivo".

## 3. Checklist del día

**El día anterior**
- [ ] Volver a correr el seed de demo (`npm run demo:seed` en `backend/`): las fechas, rachas y el ranking mensual son relativos al día. Escribe en producción.
- [ ] Ensayo completo en el aula con el proyector real y los cables que se van a usar.

**Antes de empezar**
- [ ] Celulares con más de 80 % de batería. Por USB cargan mientras se espejan.
- [ ] **No molestar** activado en los dos: cualquier notificación se proyecta.
- [ ] Rotación automática apagada, brillo al máximo, tamaño de fuente del sistema por defecto.
- [ ] Cerrar el resto de las apps y borrar notificaciones viejas de la barra.
- [ ] Sesión iniciada en Mesh en cada teléfono con la cuenta que dice su etiqueta (`lucia@demo.mesh`, `martin@demo.mesh` o `sofia@demo.mesh`).
- [ ] Ubicación activada y permiso de ubicación de Mesh en *Permitir siempre*.
- [ ] Datos móviles como respaldo del WiFi de la facultad.
- [ ] Notebook: notificaciones de Windows silenciadas (*No molestar*), cargador enchufado, escala de pantalla sin tocar entre el ensayo y la presentación.

**Durante**
- Manejar los celulares en la mano: el script activa *mostrar toques*, así el público ve dónde se toca.
- Un clic sobre una ventana es un toque en ese celular: no mover el mouse por encima.

## 4. Si algo falla

| Síntoma | Qué hacer |
|---|---|
| "No hay celulares listos" | Cable de datos (no de solo carga), celular desbloqueado, aceptar el aviso de depuración |
| Aparece como *sin autorizar* | El script reinicia adb para que vuelva el aviso y espera un minuto. Si igual no aparece: desenchufar, volver a enchufar y correrlo de nuevo; último recurso, Opciones de desarrollador › *Revocar autorizaciones* |
| Ventana negra | Desbloquear el celular; algunas apps bancarias bloquean la captura, Mesh no |
| Se ve entrecortado por WiFi | Volver al cable: la red de la facultad suele aislar dispositivos o saturarse |
| Las ventanas no coinciden con los nombres | Cerrar con Enter y volver a correr; si persiste, usar `-ConBordes` y acomodarlas a mano |
| El script no corre por permisos | Usar el `.cmd`, que lo lanza con `-ExecutionPolicy Bypass` |

Los logs de scrcpy quedan en `%TEMP%\mesh-presentacion`.
