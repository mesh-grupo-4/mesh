<#
.SYNOPSIS
  Espeja dos celulares Android lado a lado sobre el fondo de presentación de Mesh.

.DESCRIPTION
  1. Busca scrcpy y adb (instalados con: winget install Genymobile.scrcpy).
  2. Detecta los celulares conectados por USB (o los pasa a WiFi con -Wifi).
  3. Prepara los teléfonos: No molestar, Mesh abierta, pantalla despierta.
  4. Abre la presentación de la defensa (docs/presentacion-web/index.html) en
     pantalla completa (Edge en modo kiosco). Con -SinDiapositivas abre en su
     lugar el fondo solo (escenario.html).
  5. Abre una ventana de scrcpy por celular, alineada con los nombres del fondo.
     Con la presentación, los celulares se ven solo en las pantallas de demo:
     la página lo avisa con su título ("Mesh · Defensa · Celulares").
  6. Queda un ícono de Mesh en la bandeja de Windows (al lado del reloj) con
     el menú y los atajos. Si un espejo se corta, se reconecta solo.

  Con -Zona (lo usa "Presentar por WiFi.cmd") la notebook prende su zona con
  cobertura inalámbrica móvil y conecta los celulares a esa red: no depende del
  WiFi del lugar. Al finalizar la apaga.

  Atajos (funcionan desde cualquier ventana):
    Ctrl+Alt+M  mostrar los celulares       Ctrl+Alt+R  reconectar
    Ctrl+Alt+I  invertir lados              Ctrl+Alt+C  mostrar/ocultar consola
    Ctrl+Alt+1  quitar / volver a conectar el celular de la izquierda
    Ctrl+Alt+2  quitar / volver a conectar el celular de la derecha
                (el que queda se centra, sin etiquetas ni indicador "en vivo")
    Ctrl+Alt+Q  finalizar: se van los celulares y se forma el logo de Mesh
                (cierre.html; con la presentación, se va a su última pantalla). Queda
                ahí hasta otro Ctrl+Alt+Q: Mesh se va (con la presentación, fundido
                a negro) y se cierra todo. Si la presentación ya estaba en su última
                pantalla, termina enseguida.

.EXAMPLE
  .\espejar-celulares.ps1                 # etiquetas: Líder | Participante, sin nombres
.EXAMPLE
  .\espejar-celulares.ps1 -Izquierda "Sofía" -Derecha "Martín"   # agrega nombres a las etiquetas
.EXAMPLE
  .\espejar-celulares.ps1 -Wifi           # después se pueden desenchufar los cables
.EXAMPLE
  .\espejar-celulares.ps1 -Wifi -Liviano  # por el hotspot de un celular (video a 1024 px y 4 Mbps)
.EXAMPLE
  .\espejar-celulares.ps1 -SinDiapositivas   # solo el fondo con los celulares, sin la presentación
.EXAMPLE
  .\espejar-celulares.ps1 -Cerrar         # cierra una presentación abierta (lo usa "Cerrar presentacion.cmd")
#>
param(
  [string]$Izquierda = '',            # nombres opcionales: sin ellos solo se ve el rol
  [string]$RolIzquierda = 'Líder',
  [string]$Derecha = '',
  [string]$RolDerecha = 'Participante',
  [string[]]$Serials,
  [switch]$Invertir,
  [switch]$Wifi,
  [switch]$Zona,
  [switch]$SinEscenario,
  [switch]$SinDiapositivas,   # fondo solo (escenario.html) en vez de la presentación de la defensa
  [switch]$ConBordes,
  [switch]$SinPreparar,
  [switch]$Cerrar,
  [switch]$Liviano,     # video más liviano: para redes cargadas, como el hotspot de un celular
  [string]$Paquete = 'com.frangiorda1.frontend',
  [int]$Pantalla = -1
)

$ErrorActionPreference = 'Stop'
if ($Zona) { $Wifi = $true }

# --- Layout compartido con escenario.html (fracciones de la pantalla) --------
# Ojo: PowerShell no distingue mayúsculas en variables. Ningún otro nombre de
# variable puede coincidir con estas constantes.
$FRACCION_ARRIBA = 0.13          # borde superior de los celulares
$FRACCION_ALTO = 0.74            # alto de los celulares
$CENTROS_DOS = @(0.30, 0.70)
$CENTROS_UNO = @(0.50)

# --- Cierre con la animación de Mesh (parámetros de cierre.html) --------------
$CIERRE_LENTITUD = 3.5           # cuántas veces más lenta que en la app
$CIERRE_ESPERA = 1.5             # segundos quieta mientras se van los celulares
$CIERRE_TITULO_FIN = 'Hasta pronto'   # título que pone cierre.html cuando Mesh ya se fue

# --- Presentación de la defensa (docs/presentacion-web/index.html) ------------
# La página pone esta palabra en su título en las pantallas de demo: ahí se ven
# los celulares; en el resto quedan detrás de la presentación.
$DIAPOSITIVAS_TITULO_CELULARES = 'Celulares'

function Escribir-Paso([string]$texto) { Write-Host "`n> $texto" -ForegroundColor Cyan }
function Fallar([string]$texto) {
  Write-Host "`n$texto" -ForegroundColor Red
  exit 1
}

# --- Win32: ventanas, foco y atajos globales ---------------------------------
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public struct MeshRect { public int Izq, Arr, Der, Aba; }

public static class MeshVentana {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out MeshRect r);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int cmd);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int index);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern bool SetWindowText(IntPtr hWnd, string texto);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder texto, int max);
  [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);

  // Windows solo deja tomar el foco a quien recibió la última entrada del
  // teclado: una pulsación de Alt simulada habilita SetForegroundWindow.
  public static bool Enfocar(IntPtr hWnd) {
    keybd_event(0x12, 0, 0, UIntPtr.Zero);
    keybd_event(0x12, 0, 2, UIntPtr.Zero);
    return SetForegroundWindow(hWnd);
  }

  // Leer el título directo de la ventana es instantáneo (el vigilante lo hace cada 150 ms).
  public static string Titulo(IntPtr hWnd) {
    var texto = new System.Text.StringBuilder(512);
    GetWindowText(hWnd, texto, texto.Capacity);
    return texto.ToString();
  }
}

// Atajos globales Ctrl+Alt+<tecla>: funcionan aunque el foco esté en otra app.
public class MeshAtajos : NativeWindow, IDisposable {
  [DllImport("user32.dll")] static extern bool RegisterHotKey(IntPtr hWnd, int id, uint mod, uint vk);
  [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr hWnd, int id);
  public event EventHandler Pulsado;
  public int Ultimo;
  public MeshAtajos() { CreateHandle(new CreateParams()); }
  public bool Registrar(int id, Keys tecla) {
    return RegisterHotKey(Handle, id, 0x0001 | 0x0002 | 0x4000, (uint)tecla);   // ALT | CONTROL | NOREPEAT
  }
  protected override void WndProc(ref Message m) {
    if (m.Msg == 0x0312) {   // WM_HOTKEY
      Ultimo = m.WParam.ToInt32();
      if (Pulsado != null) Pulsado(this, EventArgs.Empty);
    }
    base.WndProc(ref m);
  }
  public void Dispose() {
    for (int i = 1; i <= 9; i++) UnregisterHotKey(Handle, i);
    DestroyHandle();
  }
}
'@
[MeshVentana]::SetProcessDPIAware() | Out-Null

# --- Archivos de trabajo -----------------------------------------------------
$logs = Join-Path $env:TEMP 'mesh-presentacion'
New-Item -ItemType Directory -Force $logs | Out-Null
$perfil = Join-Path $logs 'perfil-navegador'
$perfilCierre = Join-Path $logs 'perfil-cierre'    # otra instancia: se abre encima del escenario
$archivoWifi = Join-Path $logs 'wifi.txt'          # direcciones WiFi de la última vez
$archivoDnd = Join-Path $logs 'no-molestar.txt'    # modo No molestar previo de cada celular
$archivoCerrar = Join-Path $logs 'cerrar.pedido'   # lo crea -Cerrar para pedir el cierre
$archivoZona = Join-Path $logs 'zona-iniciada'     # existe si la zona la prendió este script
$archivoEstado = Join-Path $logs 'escenario-estado.js'   # lo leen escenario.html y la presentación: dos celulares o uno solo

# --- scrcpy y adb ------------------------------------------------------------
function Buscar-Ejecutable([string]$nombre) {
  $paquetes = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
  if (Test-Path $paquetes) {
    $hallado = Get-ChildItem $paquetes -Directory -Filter 'Genymobile.scrcpy*' -ErrorAction SilentlyContinue |
      ForEach-Object { Get-ChildItem $_.FullName -Recurse -Filter $nombre -ErrorAction SilentlyContinue } |
      Sort-Object FullName -Descending | Select-Object -First 1
    if ($hallado) { return $hallado.FullName }
  }
  $cmd = Get-Command $nombre -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

$scrcpy = Buscar-Ejecutable 'scrcpy.exe'
$adb = Buscar-Ejecutable 'adb.exe'
if (-not $scrcpy -or -not $adb) {
  Fallar "No encontré scrcpy o adb. Instalalo con:`n  winget install Genymobile.scrcpy"
}

# Varios comandos de adb escriben en la salida de error aunque funcionen (por
# ejemplo, abrir una app). Con ErrorActionPreference = Stop, PowerShell 5.1 lo
# toma como error y corta el script: acá se relaja solo para adb.
function Adb {
  $ErrorActionPreference = 'Continue'
  & $adb @args 2>&1 | ForEach-Object { "$_" }
}

# taskkill avisa por la salida de error si el proceso ya terminó: no tiene que
# cortar la limpieza (que después restaura No molestar).
function Matar-Proceso([int]$id, [switch]$Arbol) {
  $ErrorActionPreference = 'Continue'
  if ($Arbol) { & taskkill /PID $id /T /F 2>&1 | Out-Null } else { & taskkill /PID $id /F 2>&1 | Out-Null }
}

# adb sin esperar la respuesta: para lo que corre mientras se presenta.
function Adb-En-Segundo-Plano([string[]]$argumentos) {
  Start-Process -FilePath $adb -ArgumentList $argumentos -WindowStyle Hidden | Out-Null
}

function Listar-Dispositivos {
  Adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\S' -and $_ -notmatch '^\*' } | ForEach-Object {
    $partes = $_ -split '\s+'
    [pscustomobject]@{ Serial = $partes[0]; Estado = $partes[1] }
  }
}

# Edge y Chrome se relanzan a sí mismos: el proceso que devuelve Start-Process
# termina enseguida. El escenario y el cierre se reconocen por su perfil propio.
function Procesos-Navegador([string]$dir) {
  @(Get-CimInstance Win32_Process -Filter "Name='msedge.exe' OR Name='chrome.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine.Contains($dir) -and $_.CommandLine -notmatch '--type=' })
}
function Procesos-Escenario { Procesos-Navegador $perfil }

function Proceso-Con-Ventana([string]$dir) {
  Procesos-Navegador $dir | ForEach-Object { Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue } |
    Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
}

function Ventana-Navegador([string]$dir) {
  $p = Proceso-Con-Ventana $dir
  if ($p) { return $p.MainWindowHandle }
  return [IntPtr]::Zero
}

# El título de la ventana es el de la página.
function Titulo-Navegador([string]$dir) {
  $p = Proceso-Con-Ventana $dir
  if ($p) { return $p.MainWindowTitle }
  return ''
}

function Buscar-Navegador {
  @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
}

# Pantalla completa sin barras, con un perfil propio para poder cerrarlo después.
function Abrir-Kiosco([string]$navegador, [string]$url, [string]$dir) {
  $argsNav = @(
    "--kiosk", "`"$url`"", "--edge-kiosk-type=fullscreen",
    "--user-data-dir=`"$dir`"", "--no-first-run", "--no-default-browser-check",
    "--lang=es-AR", "--disable-features=Translate,msEdgeTranslate",
    "--window-position=$($b.X + 40),$($b.Y + 40)"
  )
  Start-Process -FilePath $navegador -ArgumentList $argsNav | Out-Null
}

# --- No molestar -------------------------------------------------------------
# zen_mode: 0 apagado, 1 prioridad, 2 silencio total, 3 solo alarmas.
$MODOS_DND = @{ '0' = 'off'; '1' = 'priority'; '2' = 'on'; '3' = 'alarms' }

function Restaurar-No-Molestar {
  if (-not (Test-Path $archivoDnd)) { return }
  foreach ($linea in (Get-Content $archivoDnd | Where-Object { $_ -match '=' })) {
    $partes = $linea -split '=', 2
    $modo = $MODOS_DND[$partes[1]]
    if (-not $modo) { $modo = 'off' }
    Adb -s $partes[0] shell cmd notification set_dnd $modo | Out-Null
  }
  Remove-Item $archivoDnd -Force -ErrorAction SilentlyContinue
}

# --- Zona con cobertura inalámbrica móvil ------------------------------------
# Es la red propia de la notebook. Se maneja con la API de Windows (WinRT).
function Cargar-WinRT {
  if ($script:asTask) { return }
  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $null = [Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType = WindowsRuntime]
  $null = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager, Windows.Networking.NetworkOperators, ContentType = WindowsRuntime]
  $script:asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
  } | Select-Object -First 1
}

function Esperar-WinRT($operacion) {
  $tipo = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult]
  $tarea = $script:asTask.MakeGenericMethod($tipo).Invoke($null, @($operacion))
  if (-not $tarea.Wait(30000)) { throw 'Windows no respondió al prender o apagar la zona.' }
  return $tarea.Result
}

# La zona comparte una conexión de la notebook: la que tiene internet o, si no
# hay, cualquier otra conectada (el WiFi de la facultad aunque pida login).
function Administrador-Zona {
  Cargar-WinRT
  $info = [Windows.Networking.Connectivity.NetworkInformation]
  $tm = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager]
  $candidatos = @($info::GetInternetConnectionProfile()) + @($info::GetConnectionProfiles() |
    Where-Object { $_.GetNetworkConnectivityLevel() -ne 'None' })
  foreach ($p in $candidatos) {
    if (-not $p) { continue }
    try {
      if ($tm::GetTetheringCapabilityFromConnectionProfile($p) -ne 'Enabled') { continue }
      return $tm::CreateFromConnectionProfile($p)
    } catch { }
  }
  return $null
}

function Iniciar-Zona {
  try {
    $tm = Administrador-Zona
    if (-not $tm) {
      Write-Host '  No pude prender la zona: la notebook tiene que estar conectada a alguna red (WiFi del lugar, cable, o un celular compartiendo datos por USB).' -ForegroundColor Yellow
      return $null
    }
    if ($tm.TetheringOperationalState -ne 'On') {
      $res = Esperar-WinRT ($tm.StartTetheringAsync())
      if ($res.Status -ne 'Success') {
        Write-Host "  No pude prender la zona ($($res.Status) $($res.AdditionalErrorMessage))." -ForegroundColor Yellow
        return $null
      }
      Set-Content -Path $archivoZona -Value 'iniciada'
      Write-Host '  Zona prendida.'
    } else {
      Write-Host '  La zona ya estaba prendida.'
    }
    $cfg = $tm.GetCurrentAccessPointConfiguration()
    return [pscustomobject]@{ Administrador = $tm; Ssid = $cfg.Ssid; Clave = $cfg.Passphrase }
  } catch {
    Write-Host "  No pude prender la zona: $_" -ForegroundColor Yellow
    return $null
  }
}

# Solo la apaga si la prendió este script.
function Detener-Zona {
  if (-not (Test-Path $archivoZona)) { return }
  try {
    $tm = Administrador-Zona
    if ($tm -and $tm.TetheringOperationalState -eq 'On') { Esperar-WinRT ($tm.StopTetheringAsync()) | Out-Null }
  } catch { }
  Remove-Item $archivoZona -Force -ErrorAction SilentlyContinue
}

# --- Modo -Cerrar ------------------------------------------------------------
if ($Cerrar) {
  Escribir-Paso 'Cerrando la presentación'
  $otros = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
    Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -match 'espejar-celulares\.ps1' -and $_.CommandLine -notmatch '-Cerrar' })
  if ($otros.Count -gt 0) {
    # Primero se le pide que cierre sola: así restaura todo y saca el ícono.
    Set-Content -Path $archivoCerrar -Value 'cerrar'
    $espera = [Diagnostics.Stopwatch]::StartNew()
    while ($espera.Elapsed.TotalSeconds -lt 10 -and
      @($otros | Where-Object { Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }).Count -gt 0) {
      Start-Sleep -Milliseconds 300
    }
  }
  foreach ($p in $otros) {
    if (Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue) {
      Matar-Proceso $p.ProcessId -Arbol
      # Si colgaba, su consola quedó oculta: se cierra también el .cmd que la abrió.
      $padre = Get-CimInstance Win32_Process -Filter "ProcessId=$($p.ParentProcessId)" -ErrorAction SilentlyContinue
      if ($padre -and $padre.Name -eq 'cmd.exe') { Matar-Proceso $padre.ProcessId }
    }
  }
  Get-Process scrcpy -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  foreach ($p in Procesos-Escenario) { Matar-Proceso $p.ProcessId -Arbol }
  foreach ($p in Procesos-Navegador $perfilCierre) { Matar-Proceso $p.ProcessId -Arbol }
  Restaurar-No-Molestar
  Detener-Zona
  Remove-Item $archivoCerrar -Force -ErrorAction SilentlyContinue
  Write-Host '  Listo: espejos, escenario, No molestar y zona restaurados.' -ForegroundColor Green
  exit 0
}
Remove-Item $archivoCerrar -Force -ErrorAction SilentlyContinue

# --- WiFi --------------------------------------------------------------------
function Redes-Notebook {
  @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } |
    ForEach-Object { [pscustomobject]@{ Ip = $_.IPAddress; Prefijo = [int]$_.PrefixLength } })
}

function Ip-A-Numero([string]$ip) {
  $o = ([Net.IPAddress]::Parse($ip)).GetAddressBytes()
  return [uint64]$o[0] * 16777216 + [uint64]$o[1] * 65536 + [uint64]$o[2] * 256 + [uint64]$o[3]
}

function Misma-Red([string]$ip, $red) {
  $mascara = [uint64]([math]::Pow(2, 32) - [math]::Pow(2, 32 - $red.Prefijo))
  return ((Ip-A-Numero $ip) -band $mascara) -eq ((Ip-A-Numero $red.Ip) -band $mascara)
}

function Nombre-Wifi-Notebook {
  $linea = (netsh wlan show interfaces) | Where-Object { $_ -match '^\s+SSID\s+:' } | Select-Object -First 1
  if ($linea) { return ($linea -split ':', 2)[1].Trim() }
  return $null
}

# IP del celular que está en la misma red que la notebook. Sirve para WiFi
# común y también para hotspot (en el celular que comparte, la interfaz no es wlan0).
function Ip-Celular-En-Red([string]$serial, $redes) {
  if (-not $redes) { $redes = Redes-Notebook }
  $interfaz = ''
  foreach ($l in (Adb -s $serial shell ip -f inet addr)) {
    if ($l -match '^\d+:\s+([^:@\s]+)') { $interfaz = $Matches[1]; continue }
    if ($l -match 'inet (\d+\.\d+\.\d+\.\d+)/' -and $interfaz -notmatch '^(lo|ccmni|rmnet|dummy|tun|clat|v4-)') {
      $ip = $Matches[1]
      foreach ($r in $redes) { if (Misma-Red $ip $r) { return $ip } }
    }
  }
  return $null
}

# adb conserva las conexiones por red que se cayeron ("offline") y no las suelta:
# reconectar a esa misma dirección responde "already connected" y sigue caída.
# Reiniciar el servidor de adb las limpia. Solo se hace antes de abrir los
# espejos (después cortaría la presentación).
function Limpiar-Conexiones-Caidas {
  if (-not @(Listar-Dispositivos | Where-Object { $_.Estado -eq 'offline' -and $_.Serial -match ':\d+$' }).Count) { return }
  Adb kill-server | Out-Null
  Adb start-server | Out-Null
  Start-Sleep -Seconds 2
}

# Red de la zona en la notebook (Windows usa 192.168.137.1/24 por defecto).
function Red-Zona {
  $ip = Get-NetAdapter -ErrorAction SilentlyContinue |
    Where-Object { $_.InterfaceDescription -match 'Wi-Fi Direct Virtual' -and $_.Status -eq 'Up' } |
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($ip) { return [pscustomobject]@{ Ip = $ip.IPAddress; Prefijo = [int]$ip.PrefixLength } }
  return [pscustomobject]@{ Ip = '192.168.137.1'; Prefijo = 24 }
}

function Serial-Equipo([string]$serial) {
  $hw = ((Adb -s $serial shell getprop ro.serialno) | Select-Object -First 1)
  if ($hw) { $hw = $hw.Trim() }
  if (-not $hw -or $hw -match 'error') { return $serial }
  return $hw
}

# Conecta a la zona los celulares que ve adb (por cable o por el WiFi anterior)
# y después los busca entre los clientes de la zona. Si un celular ya estaba en
# modo WiFi (no se reinició), no hace falta el cable.
function Llevar-Celulares-A-La-Zona($zonaInfo) {
  Escribir-Paso "Conectando los celulares a la zona '$($zonaInfo.Ssid)'"
  $redZona = Red-Zona
  $equipos = @{}
  foreach ($d in @(Listar-Dispositivos | Where-Object { $_.Estado -eq 'device' })) {
    $hw = Serial-Equipo $d.Serial
    if ($equipos.Contains($hw)) { continue }
    $equipos[$hw] = $false
    if (Ip-Celular-En-Red $d.Serial @($redZona)) { $equipos[$hw] = $true; continue }
    $modelo = ((Adb -s $d.Serial shell getprop ro.product.model) | Select-Object -First 1).Trim()
    Write-Host "  $modelo -> zona"
    # En segundo plano: si el celular está por WiFi, al cambiar de red se corta
    # esta misma conexión.
    $remoto = "cmd wifi connect-network '$($zonaInfo.Ssid)' wpa2 '$($zonaInfo.Clave)'"
    Start-Process -FilePath $adb -ArgumentList "-s $($d.Serial) shell `"$remoto`"" -WindowStyle Hidden | Out-Null
  }

  # Esperar a que aparezcan: por cable con IP de la zona, o como clientes de la
  # zona en modo WiFi. Si no había ninguno a la vista, se espera igual un rato
  # por si se conectan solos (red recordada).
  $limite = 40; if ($equipos.Count -eq 0) { $limite = 20 }
  $faltan = 0
  $limpiado = $false
  $espera = [Diagnostics.Stopwatch]::StartNew()
  do {
    Start-Sleep -Seconds 2
    if (-not $limpiado -and $espera.Elapsed.TotalSeconds -gt 10) {
      Limpiar-Conexiones-Caidas
      $limpiado = $true
    }
    foreach ($c in $zonaInfo.Administrador.GetTetheringClients()) {
      foreach ($h in $c.HostNames) {
        if ([string]$h.Type -ne 'Ipv4') { continue }
        $dir = "$($h.CanonicalName):5555"
        $ya = Listar-Dispositivos | Where-Object { $_.Serial -eq $dir -and $_.Estado -eq 'device' }
        if (-not $ya) { Adb connect $dir | Out-Null }
      }
    }
    foreach ($d in @(Listar-Dispositivos | Where-Object { $_.Estado -eq 'device' })) {
      $enZona = $false
      if ($d.Serial -match '^([\d\.]+):\d+$') { $enZona = Misma-Red $Matches[1] $redZona }
      elseif (Ip-Celular-En-Red $d.Serial @($redZona)) { $enZona = $true }
      if ($enZona) { $equipos[(Serial-Equipo $d.Serial)] = $true }
    }
    $faltan = @($equipos.Keys | Where-Object { -not $equipos[$_] }).Count
  } while (($faltan -gt 0 -or $equipos.Count -eq 0) -and $espera.Elapsed.TotalSeconds -lt $limite)

  $enLaZona = @($equipos.Keys | Where-Object { $equipos[$_] }).Count
  if ($enLaZona -gt 0) { Write-Host "  $enLaZona celular(es) en la zona." -ForegroundColor Green }
  if ($faltan -gt 0) {
    Write-Host "  $faltan celular(es) no llegaron a la zona: si están por cable, siguen por cable." -ForegroundColor Yellow
  }
}

# --- Celulares ---------------------------------------------------------------
Adb start-server | Out-Null
Limpiar-Conexiones-Caidas
$zonaInfo = $null
$redesWifi = $null
if ($Zona) {
  Escribir-Paso 'Prendiendo la zona con cobertura de la notebook'
  $zonaInfo = Iniciar-Zona
  if ($zonaInfo) {
    $redesWifi = @(Red-Zona)
    Llevar-Celulares-A-La-Zona $zonaInfo
    # Las conexiones por la red anterior quedan colgadas: se cortan para que no
    # cuenten como celulares de más.
    foreach ($d in @(Listar-Dispositivos)) {
      if ($d.Serial -match '^([\d\.]+):\d+$' -and -not (Misma-Red $Matches[1] $redesWifi[0])) { Adb disconnect $d.Serial | Out-Null }
    }
  } else {
    Write-Host '  Sigo con la red actual de la notebook.' -ForegroundColor Yellow
  }
}

# Las direcciones guardadas solo sirven en la misma red: en otra, esa IP puede
# ser de otro dispositivo (en una red pública, el teléfono de un desconocido).
$nombreRed = Nombre-Wifi-Notebook
if ($zonaInfo) { $nombreRed = "zona:$($zonaInfo.Ssid)" }

Escribir-Paso 'Buscando celulares'
if ($Wifi -and (Test-Path $archivoWifi)) {
  $guardado = @(Get-Content $archivoWifi | Where-Object { $_ -match '\S' })
  $redGuardada = ($guardado | Where-Object { $_ -match '^red=' } | Select-Object -First 1) -replace '^red=', ''
  if ($redGuardada -and $redGuardada -eq $nombreRed) {
    foreach ($dir in ($guardado | Where-Object { $_ -notmatch '^red=' })) {
      $res = (Adb connect $dir) -join ' '
      if ($res -match 'connected') { Write-Host "  Reconectado por WiFi: $dir" }
    }
  } elseif (-not $zonaInfo) {
    Write-Host '  Las direcciones WiFi guardadas son de otra red: esta vez hace falta el cable.' -ForegroundColor Yellow
  }
}
$todos = @(Listar-Dispositivos)
$noAutorizados = @($todos | Where-Object { $_.Estado -eq 'unauthorized' })
if ($noAutorizados.Count -gt 0) {
  # Muchas veces el aviso no aparece hasta reiniciar adb (pasó con Xiaomi y Samsung).
  Write-Host "  Hay $($noAutorizados.Count) celular(es) sin autorizar: desbloquealos y aceptá 'Permitir depuración USB'. Espero hasta 60 s..." -ForegroundColor Yellow
  Adb kill-server | Out-Null
  Adb start-server | Out-Null
  $espera = [Diagnostics.Stopwatch]::StartNew()
  do {
    Start-Sleep -Seconds 2
    $todos = @(Listar-Dispositivos)
    $noAutorizados = @($todos | Where-Object { $_.Estado -eq 'unauthorized' })
  } while ($noAutorizados.Count -gt 0 -and $espera.Elapsed.TotalSeconds -lt 60)
  if ($noAutorizados.Count -gt 0) {
    Write-Host '  Sigue sin autorizar: desenchufalo, volvé a enchufarlo y corré el script de nuevo. Sigo con los que están listos.' -ForegroundColor Yellow
  }
}
$listos = @($todos | Where-Object { $_.Estado -eq 'device' } | ForEach-Object { $_.Serial })

# Un mismo celular puede figurar varias veces (cable, WiFi anterior, zona). Se
# queda una sola conexión: con -Wifi, la de la zona y después cualquier WiFi;
# sin -Wifi, el cable.
function Puntaje-Conexion([string]$serial) {
  $esRed = $serial -match '^([\d\.]+):\d+$'
  if (-not $Wifi) { if ($esRed) { return 1 } else { return 2 } }
  if (-not $esRed) { return 1 }
  if ($redesWifi -and (Misma-Red $Matches[1] $redesWifi[0])) { return 3 }
  return 2
}
$porEquipo = [ordered]@{}
foreach ($s in $listos) {
  $hw = Serial-Equipo $s
  if ($hw -eq $s -and $s -match ':\d+$') {
    # Por red y sin responder: es una conexión vieja que todavía no se cayó.
    Adb disconnect $s | Out-Null
    continue
  }
  if (-not $porEquipo.Contains($hw) -or (Puntaje-Conexion $s) -gt (Puntaje-Conexion $porEquipo[$hw])) { $porEquipo[$hw] = $s }
}
$listos = @($porEquipo.Values)

if ($Serials) {
  $faltan = @($Serials | Where-Object { $listos -notcontains $_ })
  if ($faltan.Count -gt 0) { Fallar "Estos seriales no están conectados: $($faltan -join ', ')" }
  $listos = $Serials
}

if ($listos.Count -eq 0) {
  Fallar ("No hay celulares listos. Revisá:`n" +
    "  - Cable de datos (no solo de carga) y celular desbloqueado.`n" +
    "  - Opciones de desarrollador > Depuración USB activada.`n" +
    "  - Aceptar el aviso 'Permitir depuración USB' en el teléfono.")
}

# Si un celular no puede pasar a WiFi, sigue por cable: la presentación no se
# corta por eso.
if ($Wifi) {
  Escribir-Paso 'Pasando los celulares a WiFi'
  $finales = @()
  $porCable = 0
  foreach ($s in $listos) {
    if ($s -match ':\d+$') { $finales += $s; continue }
    $modelo = ((Adb -s $s shell getprop ro.product.model) | Select-Object -First 1).Trim()
    $ip = Ip-Celular-En-Red $s $redesWifi
    if (-not $ip) {
      Write-Host "  El $modelo no está en la red de la notebook: sigue por cable." -ForegroundColor Yellow
      $finales += $s; $porCable++; continue
    }
    Adb -s $s tcpip 5555 | Out-Null
    $conectado = $false
    foreach ($intento in 1..5) {
      Start-Sleep -Seconds 2
      if (((Adb connect "${ip}:5555") -join ' ') -match 'connected') { $conectado = $true; break }
    }
    if (-not $conectado) {
      Write-Host "  No pude conectar al $modelo en ${ip}:5555 (la red puede aislar dispositivos): sigue por cable." -ForegroundColor Yellow
      $finales += $s; $porCable++; continue
    }
    Write-Host "  $modelo -> ${ip}:5555"
    $finales += "${ip}:5555"
  }
  $listos = $finales
  $porWifi = @($finales | Where-Object { $_ -match ':\d+$' })
  if ($porWifi.Count -gt 0) {
    Set-Content -Path $archivoWifi -Value (@("red=$nombreRed") + $porWifi) -Encoding UTF8
  }
  if ($porCable -eq 0) {
    Write-Host '  Listo: ya podés desenchufar los cables.' -ForegroundColor Green
  } else {
    Write-Host '  Ojo: los que siguen por cable no se pueden desenchufar.' -ForegroundColor Yellow
  }
}

if ($listos.Count -gt 2) {
  Write-Host "  Hay $($listos.Count) celulares; uso los dos primeros. Elegí otros con -Serials." -ForegroundColor Yellow
  $listos = $listos[0..1]
}
if ($Invertir -and $listos.Count -eq 2) { $listos = @($listos[1], $listos[0]) }

function Medir-Celular([string]$serial) {
  $modelo = (Adb -s $serial shell getprop ro.product.model | Select-Object -First 1).Trim()
  $tam = Adb -s $serial shell wm size
  $ancho = 1080; $alto = 2400
  $fisico = $tam | Where-Object { $_ -match 'Physical size: (\d+)x(\d+)' } | Select-Object -First 1
  if ($fisico -match '(\d+)x(\d+)') { $ancho = [int]$Matches[1]; $alto = [int]$Matches[2] }
  $override = $tam | Where-Object { $_ -match 'Override size: (\d+)x(\d+)' } | Select-Object -First 1
  if ($override -match '(\d+)x(\d+)') { $ancho = [int]$Matches[1]; $alto = [int]$Matches[2] }
  if ($ancho -gt $alto) { $t = $ancho; $ancho = $alto; $alto = $t }
  [pscustomobject]@{ Serial = $serial; Modelo = $modelo; Ancho = $ancho; Alto = $alto }
}

$celulares = @($listos | ForEach-Object { Medir-Celular $_ })
$etiquetas = @(
  [pscustomobject]@{ Nombre = $Izquierda; Rol = $RolIzquierda },
  [pscustomobject]@{ Nombre = $Derecha; Rol = $RolDerecha }
)
if ($celulares.Count -eq 2) { $centros = $CENTROS_DOS } else { $centros = $CENTROS_UNO }

# --- Pantalla ----------------------------------------------------------------
$pantallas = [System.Windows.Forms.Screen]::AllScreens
if ($Pantalla -ge 0) {
  if ($Pantalla -ge $pantallas.Count) { Fallar "No existe la pantalla $Pantalla (hay $($pantallas.Count))." }
  $destino = $pantallas[$Pantalla]
} else {
  $destino = [System.Windows.Forms.Screen]::PrimaryScreen
}
$b = $destino.Bounds
Escribir-Paso ("Pantalla {0}x{1} en ({2},{3})" -f $b.Width, $b.Height, $b.X, $b.Y)

# --- Espejos -----------------------------------------------------------------
$espejos = @()
for ($i = 0; $i -lt $celulares.Count; $i++) {
  $c = $celulares[$i]
  $espejos += [pscustomobject]@{
    Indice = $i; Serial = $c.Serial; Modelo = $c.Modelo; Ancho = $c.Ancho; Alto = $c.Alto
    Nombre = $etiquetas[$i].Nombre; Centro = $centros[$i]; CentroBase = $centros[$i]
    X = 0; Y = 0; AnchoVentana = 0; AltoVentana = 0
    Proceso = $null; Hwnd = [IntPtr]::Zero; Log = $null
    ProximoIntento = [datetime]::MinValue; Caido = $false
    Pausado = $false   # quitado con Ctrl+Alt+1/2: no se reconecta solo
    Volviendo = $false # reconectado con Ctrl+Alt+1/2: vuelve al layout de dos cuando aparece
  }
  if (-not $espejos[$i].Nombre) { $espejos[$i].Nombre = $etiquetas[$i].Rol }
  if (-not $espejos[$i].Nombre) { $espejos[$i].Nombre = "celular $($i + 1)" }
  $lado = 'centro'
  if ($celulares.Count -eq 2) { if ($i -eq 0) { $lado = 'izquierda' } else { $lado = 'derecha' } }
  Write-Host ("  {0,-10} {1} ({2}) -> {3}" -f $lado, $c.Modelo, $c.Serial, $espejos[$i].Nombre)
}

function Calcular-Lugar($v) {
  $v.AltoVentana = [int]($b.Height * $FRACCION_ALTO)
  $v.AnchoVentana = [int][math]::Round($v.AltoVentana * $v.Ancho / $v.Alto)
  $v.X = $b.X + [int]($b.Width * $v.Centro - $v.AnchoVentana / 2)
  $v.Y = $b.Y + [int]($b.Height * $FRACCION_ARRIBA)
}
foreach ($v in $espejos) { Calcular-Lugar $v }

function Lanzar-Espejo($v) {
  $argsScrcpy = @(
    "--serial=$($v.Serial)",
    # Un rango de puertos por espejo: si comparten el rango y arrancan juntos
    # (por ejemplo, al reconectar), uno falla con "Server connection failed".
    "--port=$(27183 + 8 * $v.Indice):$(27190 + 8 * $v.Indice)",
    "--window-title=`"Mesh - $($v.Nombre)`"",
    '--stay-awake', '--show-touches', '--no-audio',
    '--disable-screensaver', '--screen-off-timeout=1800',
    '--max-fps=60'
  )
  # En pantalla cada celular ocupa ~0,74 del alto (unos 890 px en 1200): con 1024
  # no se pierde nada visible y se manda la mitad. Por el hotspot de un celular el
  # video del otro cruza el aire dos veces, así que conviene.
  if ($Liviano) { $argsScrcpy += '--max-size=1024', '--video-bit-rate=4M' }
  else { $argsScrcpy += '--max-size=1920', '--video-bit-rate=8M' }
  if (-not $ConBordes) { $argsScrcpy += '--window-borderless' }
  # Un log por lanzamiento: el de un espejo recién cerrado puede seguir tomado.
  $v.Log = Join-Path $logs ("scrcpy-{0}-{1:HHmmss}.log" -f $v.Indice, (Get-Date))
  $v.Proceso = Start-Process -FilePath $scrcpy -ArgumentList $argsScrcpy -PassThru -NoNewWindow `
    -RedirectStandardOutput $v.Log -RedirectStandardError "$($v.Log).err"
  $v.Hwnd = [IntPtr]::Zero
}

function Buscar-Ventana($v) {
  $v.Proceso.Refresh()
  if ($v.Proceso.MainWindowHandle -eq [IntPtr]::Zero) { return }
  $v.Hwnd = $v.Proceso.MainWindowHandle
  if ($v.Caido) {
    Write-Host "  Reconectado: $($v.Nombre) ($($v.Modelo))." -ForegroundColor Green
    $v.Caido = $false
  }
  $v.Volviendo = $false
}

function Espejo-Vivo($v) {
  return $v.Proceso -and -not $v.Proceso.HasExited -and $v.Hwnd -ne [IntPtr]::Zero
}

# Si un espejo se cierra (cable flojo, corte de WiFi, Alt+F4 de más) se vuelve
# a abrir apenas el celular aparece de nuevo.
function Reintentar($v) {
  if ((Get-Date) -lt $v.ProximoIntento) { return }
  $v.ProximoIntento = (Get-Date).AddSeconds(4)
  if (-not $v.Caido) {
    Write-Host "  Se cortó el espejo de $($v.Nombre) ($($v.Modelo)). Reintentando..." -ForegroundColor Yellow
    $v.Caido = $true
  }
  $estado = (Listar-Dispositivos | Where-Object { $_.Serial -eq $v.Serial } | Select-Object -First 1).Estado
  if ($estado -ne 'device') {
    if ($v.Serial -match ':\d+$') { Adb-En-Segundo-Plano @('connect', $v.Serial) }
    return
  }
  Lanzar-Espejo $v
}

# --- Preparar los teléfonos --------------------------------------------------
function Preparar-Celulares {
  Escribir-Paso 'Preparando los teléfonos'
  # El modo original se guarda ANTES de tocarlo, para poder restaurarlo aunque
  # el script se corte. Si un celular ya figura (corrida que no cerró bien),
  # ese valor es el original: no se pisa con el No molestar que quedó encendido.
  $yaGuardados = @()
  if (Test-Path $archivoDnd) { $yaGuardados = @(Get-Content $archivoDnd | ForEach-Object { ($_ -split '=', 2)[0] }) }
  foreach ($v in $espejos) {
    if ($yaGuardados -notcontains $v.Serial) {
      $zen = ((Adb -s $v.Serial shell settings get global zen_mode) | Select-Object -First 1).Trim()
      if ($zen -notmatch '^\d$') { $zen = '0' }
      Add-Content -Path $archivoDnd -Value "$($v.Serial)=$zen" -Encoding ASCII
    }
    Adb -s $v.Serial shell cmd notification set_dnd on | Out-Null
    Adb -s $v.Serial shell cmd statusbar collapse | Out-Null
    Adb -s $v.Serial shell input keyevent KEYCODE_WAKEUP | Out-Null
    $instalada = (Adb -s $v.Serial shell pm list packages $Paquete) -join ' '
    if ($instalada -match [regex]::Escape("package:$Paquete")) {
      Adb -s $v.Serial shell monkey -p $Paquete -c android.intent.category.LAUNCHER 1 | Out-Null
      Write-Host "  $($v.Modelo): No molestar activado, Mesh abierta."
    } else {
      Write-Host "  $($v.Modelo): No molestar activado. Mesh no está instalada." -ForegroundColor Yellow
    }
  }
}

# --- Orden de ventanas -------------------------------------------------------
# Los celulares van pegados al escenario:
# - Con el escenario (o un celular) en foco quedan "siempre visibles" y en su
#   lugar; si un Alt+Tab o un clic de más los movió, vuelven.
# - Con otra ventana en foco (diapositivas, backoffice) pasan justo debajo del
#   escenario, y esa ventana queda adelante.
# Windows no deja subir ventanas ajenas desde un proceso en segundo plano, pero
# sí marcarlas como siempre visibles; y con una ventana normal encima de la
# pantalla completa vuelve a mostrar la barra de tareas. Por eso se usa
# "siempre visible" solo mientras la escena está en foco.
$HWND_TOPMOST = [IntPtr](-1)
$HWND_BOTTOM = [IntPtr]1
$SOLO_ORDEN = 0x0013          # SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE
$UBICAR = 0x0050              # SWP_SHOWWINDOW | SWP_NOACTIVATE
$hwndEscenario = [IntPtr]::Zero

function Es-Siempre-Visible($h) { return ([MeshVentana]::GetWindowLong($h, -20) -band 0x8) -ne 0 }   # WS_EX_TOPMOST

function Traer-Al-Frente($v) {
  $r = New-Object MeshRect
  [MeshVentana]::GetWindowRect($v.Hwnd, [ref]$r) | Out-Null
  $enLugar = $r.Izq -eq $v.X -and $r.Arr -eq $v.Y -and ($r.Der - $r.Izq) -eq $v.AnchoVentana -and ($r.Aba - $r.Arr) -eq $v.AltoVentana
  if (-not $enLugar) {
    if ([MeshVentana]::IsIconic($v.Hwnd)) { [MeshVentana]::ShowWindow($v.Hwnd, 4) | Out-Null }   # SW_SHOWNOACTIVATE
    [MeshVentana]::SetWindowPos($v.Hwnd, $HWND_TOPMOST, $v.X, $v.Y, $v.AnchoVentana, $v.AltoVentana, $UBICAR) | Out-Null
  } elseif (-not (Es-Siempre-Visible $v.Hwnd)) {
    [MeshVentana]::SetWindowPos($v.Hwnd, $HWND_TOPMOST, 0, 0, 0, 0, $SOLO_ORDEN) | Out-Null
  }
}

function Mandar-Atras($v) {
  if (-not (Es-Siempre-Visible $v.Hwnd)) { return }
  # Ubicarla después de una ventana normal le quita el "siempre visible".
  $despues = $HWND_BOTTOM
  if ($hwndEscenario -ne [IntPtr]::Zero) { $despues = $hwndEscenario }
  [MeshVentana]::SetWindowPos($v.Hwnd, $despues, 0, 0, 0, 0, $SOLO_ORDEN) | Out-Null
}

function Buscar-Escenario { $script:hwndEscenario = Ventana-Navegador $perfil }

# Con la presentación, los celulares van adelante solo si la pantalla actual es de demo.
function Pantalla-Pide-Celulares {
  if ($SinDiapositivas -or $hwndEscenario -eq [IntPtr]::Zero) { return $true }
  return ([MeshVentana]::Titulo($hwndEscenario)) -match [regex]::Escape($DIAPOSITIVAS_TITULO_CELULARES)
}

function Escena-En-Foco {
  $foco = [MeshVentana]::GetForegroundWindow()
  if ($foco -eq [IntPtr]::Zero) { return $false }
  if ($foco -eq $hwndEscenario) { return $true }
  foreach ($v in $espejos) { if ($v.Hwnd -eq $foco) { return $true } }
  return $false
}

# --- Acciones del menú y los atajos ------------------------------------------
$consola = [MeshVentana]::GetConsoleWindow()

function Mostrar-Celulares {
  $destino = $hwndEscenario
  if ($destino -eq [IntPtr]::Zero) {
    $vivo = $espejos | Where-Object { Espejo-Vivo $_ } | Select-Object -First 1
    if ($vivo) { $destino = $vivo.Hwnd }
  }
  if ($destino -ne [IntPtr]::Zero) { [MeshVentana]::Enfocar($destino) | Out-Null }
}

function Reconectar-Todo {
  Write-Host '  Reconectando los espejos...' -ForegroundColor Cyan
  foreach ($v in $espejos) {
    if ($v.Proceso -and -not $v.Proceso.HasExited) { Stop-Process -Id $v.Proceso.Id -Force -ErrorAction SilentlyContinue }
    $v.ProximoIntento = [datetime]::MinValue
  }
}

function Invertir-Lados {
  if ($espejos.Count -ne 2) { return }
  $centro = $espejos[0].CentroBase; $espejos[0].CentroBase = $espejos[1].CentroBase; $espejos[1].CentroBase = $centro
  $nombre = $espejos[0].Nombre; $espejos[0].Nombre = $espejos[1].Nombre; $espejos[1].Nombre = $nombre
  foreach ($v in $espejos) {
    if (Espejo-Vivo $v) { [MeshVentana]::SetWindowText($v.Hwnd, "Mesh - $($v.Nombre)") | Out-Null }
  }
  Actualizar-Disposicion -Forzar
  Mostrar-Celulares
}

# Con dos celulares en la presentación van en sus lados; si con Ctrl+Alt+1/2 queda
# uno solo, va al centro y el escenario saca las etiquetas y el "en vivo". El que
# se está reconectando cuenta recién cuando aparece su ventana, para que el otro
# no se corra antes de tiempo. Un corte de conexión (Caido) no cambia el layout.
$disposicionSolo = $false
function Actualizar-Disposicion([switch]$Forzar) {
  if ($espejos.Count -ne 2) { return }
  $enEscena = @($espejos | Where-Object { -not $_.Pausado -and -not $_.Volviendo })
  $solo = $enEscena.Count -lt 2
  if ($solo -eq $script:disposicionSolo -and -not $Forzar) { return }
  $script:disposicionSolo = $solo
  foreach ($v in $espejos) {
    $v.Centro = $v.CentroBase
    if ($solo -and $enEscena.Count -eq 1 -and $enEscena[0].Indice -eq $v.Indice) { $v.Centro = 0.5 }
    Calcular-Lugar $v
  }
  Escribir-Estado-Escenario
}

# Con Ctrl+Alt+Q se suma un pedido de cierre numerado: la presentación lo atiende
# una sola vez (va a su última pantalla o, si ya estaba ahí, despide a Mesh).
$pedidoCierre = ''
function Escribir-Estado-Escenario {
  $modo = 'dos'
  if ($script:disposicionSolo) { $modo = 'solo' }
  $texto = "meshEstado('$modo');"
  if ($script:pedidoCierre) { $texto += " if (window.meshCerrar) meshCerrar('$($script:pedidoCierre)');" }
  try { Set-Content -Path $archivoEstado -Value $texto -Encoding ASCII } catch { }
}

function Alternar-Consola {
  if ($consola -eq [IntPtr]::Zero) { return }
  if ([MeshVentana]::IsWindowVisible($consola)) {
    [MeshVentana]::ShowWindow($consola, 0) | Out-Null          # SW_HIDE
  } else {
    [MeshVentana]::ShowWindow($consola, 5) | Out-Null          # SW_SHOW
    [MeshVentana]::Enfocar($consola) | Out-Null
  }
}

# Saca un celular de la presentación (para seguir con uno solo) o, si ya estaba
# afuera, lo vuelve a conectar. $lado: 0 izquierda, 1 derecha, según dónde está
# ahora (Invertir lados los cambia). Con un solo celular, el 0 es el del centro.
function Alternar-Celular([int]$lado) {
  $ordenados = @($espejos | Sort-Object CentroBase)
  if ($lado -ge $ordenados.Count) { return }
  $v = $ordenados[$lado]
  if ($v.Pausado) {
    $v.Pausado = $false
    $v.Volviendo = $true                      # el otro sigue al centro hasta que aparezca
    $v.Caido = $true                          # así avisa "Reconectado" cuando vuelve
    $v.ProximoIntento = [datetime]::MinValue  # el vigilante lo reintenta ya
    Write-Host "  Volviendo a conectar a $($v.Nombre) ($($v.Modelo))..." -ForegroundColor Cyan
  } else {
    $v.Pausado = $true
    if ($v.Proceso -and -not $v.Proceso.HasExited) { Stop-Process -Id $v.Proceso.Id -Force -ErrorAction SilentlyContinue }
    $v.Hwnd = [IntPtr]::Zero
    $v.Volviendo = $false
    $atajo = $lado + 1
    Write-Host "  Quité a $($v.Nombre) ($($v.Modelo)). Ctrl+Alt+$atajo para volver a conectarlo." -ForegroundColor Cyan
  }
}

# Ctrl+Alt+Q y el menú cierran con la animación de Mesh; "Cerrar presentacion.cmd"
# cierra directo.
$conCierre = $false
function Finalizar([switch]$ConAnimacion) {
  if ($ConAnimacion) { $script:conCierre = $true }
  $script:contexto.ExitThread()
}

# Abre cierre.html encima de todo y espera a que aparezca. Devuelve $false si
# no hay navegador.
function Abrir-Cierre {
  $navegador = Buscar-Navegador
  if (-not $navegador) { return $false }
  $inv = [Globalization.CultureInfo]::InvariantCulture
  $query = 'lento={0}&espera={1}' -f $CIERRE_LENTITUD.ToString($inv), $CIERRE_ESPERA.ToString($inv)
  $url = ([uri](Join-Path $PSScriptRoot 'cierre.html')).AbsoluteUri + '?' + $query
  Abrir-Kiosco $navegador $url $perfilCierre
  $cronometro = [Diagnostics.Stopwatch]::StartNew()
  $hwnd = [IntPtr]::Zero
  while ($hwnd -eq [IntPtr]::Zero -and $cronometro.Elapsed.TotalSeconds -lt 8) {
    Start-Sleep -Milliseconds 200
    $hwnd = Ventana-Navegador $perfilCierre
  }
  if ($hwnd -ne [IntPtr]::Zero) { [MeshVentana]::Enfocar($hwnd) | Out-Null }
  return $true
}

# El logo queda formado sin límite de tiempo. El segundo Ctrl+Alt+Q lo recibe la
# página (los atajos globales ya se soltaron): Mesh se va andando, la pantalla
# se funde a negro y la página cambia el título, que es la señal para cerrarla.
# También termina si cierran la ventana (Alt+F4) o corren "Cerrar presentacion.cmd".
# Con la presentación es lo mismo, pero en su última pantalla: se espera su ventana.
function Esperar-Cierre([string]$dir = $perfilCierre) {
  Write-Host '  Logo de Mesh en pantalla. Ctrl+Alt+Q para que se vaya (o Alt+F4).'
  while ($true) {
    if (Test-Path $archivoCerrar) { break }
    if (@(Procesos-Navegador $dir).Count -eq 0) { break }
    if ((Titulo-Navegador $dir) -match [regex]::Escape($CIERRE_TITULO_FIN)) { break }
    Start-Sleep -Milliseconds 500
  }
  foreach ($p in Procesos-Navegador $dir) { Matar-Proceso $p.ProcessId -Arbol }
}

# Ctrl+Alt+Q con la presentación: no se abre otra ventana. Se le pide a la página
# que vaya a su última pantalla y se le da el foco, para que reciba el segundo
# Ctrl+Alt+Q cuando ya se soltaron los atajos.
function Pedir-Cierre-A-Diapositivas {
  if ($hwndEscenario -eq [IntPtr]::Zero) { Buscar-Escenario }
  if ($hwndEscenario -eq [IntPtr]::Zero) { return $false }
  $script:pedidoCierre = [string](Get-Date).Ticks
  Escribir-Estado-Escenario
  [MeshVentana]::Enfocar($hwndEscenario) | Out-Null
  return $true
}

function Cargar-Icono {
  $png = Join-Path $PSScriptRoot '..\..\frontend\assets\images\favicon.png'
  try {
    $original = New-Object System.Drawing.Bitmap $png
    $chico = New-Object System.Drawing.Bitmap $original, 32, 32
    return [System.Drawing.Icon]::FromHandle($chico.GetHicon())
  } catch {
    return [System.Drawing.SystemIcons]::Application
  }
}

# --- Vigilante: corre cada 150 ms mientras se presenta ------------------------
$proximoDespertar = (Get-Date).AddSeconds(20)
$proximoEscenario = Get-Date

function Vigilar {
  if (Test-Path $archivoCerrar) { Finalizar; return }

  foreach ($v in $espejos) {
    if ($v.Pausado) { continue }
    if (-not $v.Proceso -or $v.Proceso.HasExited) { $v.Hwnd = [IntPtr]::Zero; Reintentar $v; continue }
    if ($v.Hwnd -eq [IntPtr]::Zero) { Buscar-Ventana $v }
  }
  Actualizar-Disposicion

  if (-not $SinEscenario -and $hwndEscenario -eq [IntPtr]::Zero -and (Get-Date) -ge $script:proximoEscenario) {
    Buscar-Escenario
    $script:proximoEscenario = (Get-Date).AddSeconds(2)
  }

  $vivos = @($espejos | Where-Object { Espejo-Vivo $_ })
  if ((Escena-En-Foco) -and (Pantalla-Pide-Celulares)) {
    foreach ($v in $vivos) { Traer-Al-Frente $v }
  } else {
    foreach ($v in $vivos) { Mandar-Atras $v }
  }

  # Por WiFi Android no respeta "mantener despierto": se lo despierta seguido.
  if ((Get-Date) -ge $script:proximoDespertar) {
    foreach ($v in $vivos) { Adb-En-Segundo-Plano @('-s', $v.Serial, 'shell', 'input', 'keyevent', 'KEYCODE_WAKEUP') }
    $script:proximoDespertar = (Get-Date).AddSeconds(20)
  }
}

# --- Presentación ------------------------------------------------------------
$fallo = $false
$icono = $null
$atajos = $null
$reloj = $null

try {
  if (-not $SinPreparar) { Preparar-Celulares }

  if (-not $SinEscenario) {
    if ($SinDiapositivas) { Escribir-Paso 'Abriendo el escenario' } else { Escribir-Paso 'Abriendo la presentación' }
    $navegador = Buscar-Navegador
    if (-not $navegador) {
      Write-Host '  No encontré Edge ni Chrome: sigo sin escenario.' -ForegroundColor Yellow
      $SinEscenario = $true
    } else {
      $q = @{
        izq = $etiquetas[0].Nombre; rolIzq = $etiquetas[0].Rol
        der = $etiquetas[1].Nombre; rolDer = $etiquetas[1].Rol
        arriba = $FRACCION_ARRIBA; alto = $FRACCION_ALTO; celulares = $celulares.Count
        estado = ([uri]$archivoEstado).AbsoluteUri
      }
      Escribir-Estado-Escenario
      $query = ($q.GetEnumerator() | ForEach-Object {
        '{0}={1}' -f $_.Key, [uri]::EscapeDataString(([string]$_.Value).Replace(',', '.'))
      }) -join '&'
      $pagina = Join-Path $PSScriptRoot 'escenario.html'
      $deck = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\presentacion-web\index.html'))
      if (-not $SinDiapositivas -and -not (Test-Path $deck)) {
        Write-Host "  No encontré la presentación ($deck): abro solo el fondo." -ForegroundColor Yellow
        $SinDiapositivas = $true
      }
      if (-not $SinDiapositivas) { $pagina = $deck }
      $url = ([uri]$pagina).AbsoluteUri + '?' + $query
      Abrir-Kiosco $navegador $url $perfil
      $espera = [Diagnostics.Stopwatch]::StartNew()
      while ($hwndEscenario -eq [IntPtr]::Zero -and $espera.Elapsed.TotalSeconds -lt 10) {
        Start-Sleep -Milliseconds 300
        Buscar-Escenario
      }
    }
  }

  # De a uno y con reintentos: la conexión inicial con el celular a veces falla
  # la primera vez (sobre todo por WiFi).
  foreach ($v in $espejos) {
    Escribir-Paso "Espejando $($v.Modelo) ($($v.Nombre))"
    foreach ($intento in 1..3) {
      Lanzar-Espejo $v
      $espera = [Diagnostics.Stopwatch]::StartNew()
      while ($v.Hwnd -eq [IntPtr]::Zero -and -not $v.Proceso.HasExited -and $espera.Elapsed.TotalSeconds -lt 30) {
        Start-Sleep -Milliseconds 300
        Buscar-Ventana $v
      }
      if ($v.Hwnd -ne [IntPtr]::Zero) { break }
      if (-not $v.Proceso.HasExited) { Stop-Process -Id $v.Proceso.Id -Force -ErrorAction SilentlyContinue }
      if ($intento -lt 3) {
        Write-Host "  No abrió; reintento ($($intento + 1) de 3)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
      }
    }
    if ($v.Hwnd -eq [IntPtr]::Zero) {
      $detalle = ''
      if (Test-Path "$($v.Log).err") { $detalle = (Get-Content "$($v.Log).err" -Tail 8) -join "`n" }
      throw "scrcpy no abrió la ventana de $($v.Modelo).`n$detalle"
    }
  }

  # Se repite porque scrcpy puede ajustar su tamaño al recibir el primer cuadro.
  foreach ($vuelta in 1..3) {
    foreach ($v in $espejos) { Traer-Al-Frente $v }
    Start-Sleep -Milliseconds 800
  }

  # Bandeja de Windows: ícono, menú y atajos.
  $contexto = New-Object System.Windows.Forms.ApplicationContext
  $menu = New-Object System.Windows.Forms.ContextMenuStrip
  $titulo = $menu.Items.Add('Mesh · Presentación')
  $titulo.Enabled = $false
  [void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
  $opciones = @(
    @{ Texto = 'Mostrar celulares';             Atajo = 'Ctrl+Alt+M'; Id = 2; Tecla = 'M'; Accion = { Mostrar-Celulares } },
    @{ Texto = 'Reconectar celulares';          Atajo = 'Ctrl+Alt+R'; Id = 3; Tecla = 'R'; Accion = { Reconectar-Todo } },
    @{ Texto = 'Invertir lados';                Atajo = 'Ctrl+Alt+I'; Id = 4; Tecla = 'I'; Accion = { Invertir-Lados } },
    @{ Texto = 'Mostrar u ocultar la consola';  Atajo = 'Ctrl+Alt+C'; Id = 5; Tecla = 'C'; Accion = { Alternar-Consola } },
    $null,
    @{ Texto = 'Quitar o reconectar el celular izquierdo'; Atajo = 'Ctrl+Alt+1'; Id = 6; Tecla = 'D1'; Accion = { Alternar-Celular 0 } },
    @{ Texto = 'Quitar o reconectar el celular derecho';   Atajo = 'Ctrl+Alt+2'; Id = 7; Tecla = 'D2'; Accion = { Alternar-Celular 1 } },
    $null,
    @{ Texto = 'Finalizar presentación';        Atajo = 'Ctrl+Alt+Q'; Id = 1; Tecla = 'Q'; Accion = { Finalizar -ConAnimacion } }
  )
  $accionesPorId = @{}
  $atajos = New-Object MeshAtajos
  $sinAtajo = @()
  foreach ($o in $opciones) {
    if (-not $o) { [void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)); continue }
    $item = New-Object System.Windows.Forms.ToolStripMenuItem $o.Texto
    $item.ShortcutKeyDisplayString = $o.Atajo
    $item.add_Click($o.Accion)
    [void]$menu.Items.Add($item)
    $accionesPorId[$o.Id] = $o.Accion
    if (-not $atajos.Registrar($o.Id, [System.Windows.Forms.Keys]$o.Tecla)) { $sinAtajo += $o.Atajo }
  }
  $atajos.add_Pulsado({
    $accion = $accionesPorId[$atajos.Ultimo]
    if ($accion) { try { & $accion } catch { Write-Host "  Error: $_" -ForegroundColor Red } }
  })

  $icono = New-Object System.Windows.Forms.NotifyIcon
  $icono.Icon = Cargar-Icono
  $icono.Text = 'Mesh · Ctrl+Alt+M mostrar · Ctrl+Alt+Q finalizar'
  $icono.ContextMenuStrip = $menu
  $icono.add_DoubleClick({ Mostrar-Celulares })
  $icono.Visible = $true

  $reloj = New-Object System.Windows.Forms.Timer
  $reloj.Interval = 150
  $reloj.add_Tick({ try { Vigilar } catch { Write-Host "  Error del vigilante: $_" -ForegroundColor Red } })

  Write-Host "`nTodo listo." -ForegroundColor Green
  Write-Host '  El control queda en el ícono de Mesh de la bandeja (al lado del reloj).'
  Write-Host '  Ctrl+Alt+M mostrar celulares   Ctrl+Alt+R reconectar   Ctrl+Alt+I invertir'
  Write-Host '  Ctrl+Alt+C consola             Ctrl+Alt+1 / 2 quitar o reconectar el celular izquierdo / derecho'
  Write-Host '  Ctrl+Alt+Q finalizar (con la animación de Mesh)'
  if ($sinAtajo.Count -gt 0) {
    Write-Host "  Otro programa ya usa: $($sinAtajo -join ', '). Usá el menú del ícono." -ForegroundColor Yellow
  }
  Write-Host "  Logs de scrcpy en $logs"

  # La consola se oculta: con ella en foco, Windows muestra la barra de tareas
  # encima de la pantalla completa. Vuelve con Ctrl+Alt+C.
  if ($consola -ne [IntPtr]::Zero) { [MeshVentana]::ShowWindow($consola, 0) | Out-Null }
  Mostrar-Celulares
  $reloj.Start()
  [System.Windows.Forms.Application]::Run($contexto)
}
catch {
  $fallo = $true
  if ($consola -ne [IntPtr]::Zero) { [MeshVentana]::ShowWindow($consola, 5) | Out-Null }
  Write-Host "`n$_" -ForegroundColor Red
}
finally {
  if ($reloj) { $reloj.Stop(); $reloj.Dispose() }
  if ($icono) { $icono.Visible = $false; $icono.Dispose() }
  if ($atajos) { $atajos.Dispose() }
  # Con Ctrl+Alt+Q la animación se abre primero, encima del escenario: así al
  # irse los celulares no se ve el escritorio. No molestar y la zona se
  # restauran mientras el logo está en pantalla.
  $hayCierre = $false
  $cierreEnDiapositivas = $false
  if ($conCierre -and -not $fallo -and -not $SinEscenario) {
    Escribir-Paso 'Cerrando con la animación de Mesh'
    if (-not $SinDiapositivas) {
      try { $cierreEnDiapositivas = Pedir-Cierre-A-Diapositivas } catch { Write-Host "  No pude avisarle a la presentación: $_" -ForegroundColor Yellow }
    }
    if (-not $cierreEnDiapositivas) {
      try { $hayCierre = Abrir-Cierre } catch { Write-Host "  No pude abrir la animación: $_" -ForegroundColor Yellow }
    }
  }
  foreach ($v in $espejos) {
    if ($v.Proceso -and -not $v.Proceso.HasExited) { Matar-Proceso $v.Proceso.Id -Arbol }
  }
  # Con el cierre en la presentación, la ventana sigue hasta que Mesh se va.
  if (-not $cierreEnDiapositivas) {
    foreach ($p in Procesos-Escenario) { Matar-Proceso $p.ProcessId -Arbol }
  }
  Restaurar-No-Molestar
  Detener-Zona
  if ($cierreEnDiapositivas) { Esperar-Cierre $perfil }
  elseif ($hayCierre) { Esperar-Cierre }
  Remove-Item $archivoCerrar -Force -ErrorAction SilentlyContinue
}
if ($fallo) { exit 1 }
