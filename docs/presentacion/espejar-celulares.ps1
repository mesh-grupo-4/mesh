<#
.SYNOPSIS
  Espeja dos celulares Android lado a lado sobre el fondo de presentación de Mesh.

.DESCRIPTION
  1. Busca scrcpy y adb (instalados con: winget install Genymobile.scrcpy).
  2. Detecta los celulares conectados por USB (o los pasa a WiFi con -Wifi).
  3. Abre escenario.html en pantalla completa (Edge en modo kiosco).
  4. Abre una ventana de scrcpy por celular y la acomoda sobre el escenario,
     alineada con los nombres que muestra el fondo.
  Con Enter (o Ctrl+C) en esta consola se cierra todo lo que abrió el script.

.EXAMPLE
  .\espejar-celulares.ps1
.EXAMPLE
  .\espejar-celulares.ps1 -Izquierda "Sofía" -RolIzquierda "Líder" -Derecha "Martín" -RolDerecha "Participante"
.EXAMPLE
  .\espejar-celulares.ps1 -Invertir       # intercambia qué celular va a cada lado
.EXAMPLE
  .\espejar-celulares.ps1 -Wifi           # después se pueden desenchufar los cables
.EXAMPLE
  .\espejar-celulares.ps1 -Pantalla 1     # usa el segundo monitor (proyector en modo Extender)
#>
param(
  [string]$Izquierda = 'Lucía',
  [string]$RolIzquierda = 'Líder',
  [string]$Derecha = 'Martín',
  [string]$RolDerecha = 'Participante',
  [string[]]$Serials,
  [switch]$Invertir,
  [switch]$Wifi,
  [switch]$SinEscenario,
  [switch]$ConBordes,
  [int]$Pantalla = -1
)

$ErrorActionPreference = 'Stop'

# --- Layout compartido con escenario.html (fracciones de la pantalla) --------
$FRACCION_ARRIBA = 0.13          # borde superior de los celulares
$FRACCION_ALTO = 0.74            # alto de los celulares
$CENTROS_DOS = @(0.30, 0.70)
$CENTROS_UNO = @(0.50)

function Escribir-Paso([string]$texto) { Write-Host "`n> $texto" -ForegroundColor Cyan }
function Fallar([string]$texto) {
  Write-Host "`n$texto" -ForegroundColor Red
  exit 1
}

# --- Ventanas: coordenadas físicas, sin importar la escala de Windows --------
Add-Type @'
using System;
using System.Runtime.InteropServices;
public struct MeshRect { public int Izq, Arr, Der, Aba; }
public static class MeshVentana {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out MeshRect r);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int cmd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
}
'@
[MeshVentana]::SetProcessDPIAware() | Out-Null
Add-Type -AssemblyName System.Windows.Forms

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

function Adb { & $adb @args 2>&1 | ForEach-Object { "$_" } }

# --- Celulares ---------------------------------------------------------------
function Listar-Dispositivos {
  Adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\S' -and $_ -notmatch '^\*' } | ForEach-Object {
    $partes = $_ -split '\s+'
    [pscustomobject]@{ Serial = $partes[0]; Estado = $partes[1] }
  }
}

Escribir-Paso 'Buscando celulares'
Adb start-server | Out-Null
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

if ($Wifi) {
  Escribir-Paso 'Pasando los celulares a WiFi'
  $porWifi = @()
  foreach ($s in $listos) {
    if ($s -match ':\d+$') { $porWifi += $s; continue }
    $ip = $null
    $red = Adb -s $s shell ip -f inet addr show wlan0
    if (($red -join "`n") -match 'inet (\d+\.\d+\.\d+\.\d+)') { $ip = $Matches[1] }
    if (-not $ip) { Fallar "El celular $s no tiene IP en wlan0: conectalo a la misma red WiFi que la notebook." }
    Adb -s $s tcpip 5555 | Out-Null
    Start-Sleep -Seconds 2
    $res = Adb connect "${ip}:5555"
    if (($res -join ' ') -notmatch 'connected') { Fallar "No pude conectar a ${ip}:5555 ($res). ¿Están en la misma red y la red no aísla clientes?" }
    Write-Host "  $s -> ${ip}:5555"
    $porWifi += "${ip}:5555"
  }
  $listos = $porWifi
  Write-Host '  Listo: ya podés desenchufar los cables.' -ForegroundColor Green
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
for ($i = 0; $i -lt $celulares.Count; $i++) {
  $lado = 'derecha'
  if ($i -eq 0 -and $celulares.Count -eq 2) { $lado = 'izquierda' }
  if ($celulares.Count -eq 1) { $lado = 'centro' }
  Write-Host ("  {0,-10} {1} ({2}) -> {3}" -f $lado, $celulares[$i].Modelo, $celulares[$i].Serial, $etiquetas[$i].Nombre)
}

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

if ($celulares.Count -eq 2) { $centros = $CENTROS_DOS } else { $centros = $CENTROS_UNO }

$abiertos = New-Object System.Collections.ArrayList
$logs = Join-Path $env:TEMP 'mesh-presentacion'
New-Item -ItemType Directory -Force $logs | Out-Null

$perfil = Join-Path $logs 'perfil-navegador'

# Edge y Chrome se relanzan a sí mismos: el proceso que devuelve Start-Process
# termina enseguida. El escenario se reconoce por su perfil propio.
function Procesos-Escenario {
  @(Get-CimInstance Win32_Process -Filter "Name='msedge.exe' OR Name='chrome.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine.Contains($perfil) -and $_.CommandLine -notmatch '--type=' })
}

function Cerrar-Todo {
  foreach ($p in $abiertos) {
    try { if (-not $p.HasExited) { & taskkill /PID $p.Id /T /F 2>&1 | Out-Null } } catch {}
  }
  $abiertos.Clear()
  foreach ($p in Procesos-Escenario) { & taskkill /PID $p.ProcessId /T /F 2>&1 | Out-Null }
}

try {
  # --- Escenario -------------------------------------------------------------
  if (-not $SinEscenario) {
    Escribir-Paso 'Abriendo el escenario'
    $navegador = @(
      "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
      "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
      "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
      "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $navegador) {
      Write-Host '  No encontré Edge ni Chrome: sigo sin escenario.' -ForegroundColor Yellow
    } else {
      $q = @{
        izq = $etiquetas[0].Nombre; rolIzq = $etiquetas[0].Rol
        der = $etiquetas[1].Nombre; rolDer = $etiquetas[1].Rol
        arriba = $FRACCION_ARRIBA; alto = $FRACCION_ALTO; celulares = $celulares.Count
      }
      $query = ($q.GetEnumerator() | ForEach-Object {
        '{0}={1}' -f $_.Key, [uri]::EscapeDataString(([string]$_.Value).Replace(',', '.'))
      }) -join '&'
      $html = Join-Path $PSScriptRoot 'escenario.html'
      $url = ([uri]$html).AbsoluteUri + '?' + $query
      $argsNav = @(
        "--kiosk", "`"$url`"", "--edge-kiosk-type=fullscreen",
        "--user-data-dir=`"$perfil`"", "--no-first-run", "--no-default-browser-check",
        "--lang=es-AR", "--disable-features=Translate,msEdgeTranslate",
        "--window-position=$($b.X + 40),$($b.Y + 40)"
      )
      Start-Process -FilePath $navegador -ArgumentList $argsNav | Out-Null
      Start-Sleep -Seconds 3
    }
  }

  # --- Espejos ---------------------------------------------------------------
  $ventanas = @()
  for ($i = 0; $i -lt $celulares.Count; $i++) {
    $c = $celulares[$i]
    $nombre = $etiquetas[$i].Nombre
    Escribir-Paso "Espejando $($c.Modelo) ($nombre)"

    # Ojo: PowerShell no distingue mayúsculas en variables; estos nombres no
    # pueden coincidir con las constantes del layout.
    $altoVentana = [int]($b.Height * $FRACCION_ALTO)
    $anchoVentana = [int][math]::Round($altoVentana * $c.Ancho / $c.Alto)
    $xVentana = $b.X + [int]($b.Width * $centros[$i] - $anchoVentana / 2)
    $yVentana = $b.Y + [int]($b.Height * $FRACCION_ARRIBA)

    $argsScrcpy = @(
      "--serial=$($c.Serial)",
      "--window-title=`"Mesh - $nombre`"",
      '--always-on-top', '--stay-awake', '--show-touches', '--no-audio',
      '--disable-screensaver', '--screen-off-timeout=1800',
      '--max-size=1920', '--video-bit-rate=8M', '--max-fps=60'
    )
    if (-not $ConBordes) { $argsScrcpy += '--window-borderless' }

    $log = Join-Path $logs "scrcpy-$i.log"
    $p = Start-Process -FilePath $scrcpy -ArgumentList $argsScrcpy -PassThru -NoNewWindow `
      -RedirectStandardOutput $log -RedirectStandardError "$log.err"
    [void]$abiertos.Add($p)

    $reloj = [Diagnostics.Stopwatch]::StartNew()
    while ($reloj.Elapsed.TotalSeconds -lt 30) {
      $p.Refresh()
      if ($p.HasExited -or $p.MainWindowHandle -ne [IntPtr]::Zero) { break }
      Start-Sleep -Milliseconds 300
    }
    if ($p.HasExited -or $p.MainWindowHandle -eq [IntPtr]::Zero) {
      $detalle = ''
      if (Test-Path "$log.err") { $detalle = (Get-Content "$log.err" -Tail 8) -join "`n" }
      throw "scrcpy no abrió la ventana de $($c.Modelo).`n$detalle"
    }
    $ventanas += [pscustomobject]@{
      Proceso = $p; Nombre = $nombre; Hwnd = $p.MainWindowHandle
      X = $xVentana; Y = $yVentana; Ancho = $anchoVentana; Alto = $altoVentana; Avisado = $false
    }
  }

  # Devuelve una ventana a su lugar si se movió, se minimizó o cambió de tamaño
  # (un Alt+Tab o un clic de más durante la presentación).
  function Reacomodar($v) {
    if ($v.Proceso.HasExited) {
      if (-not $v.Avisado) {
        Write-Host "`n  Se cerró el espejo de $($v.Nombre) (¿se desconectó el cable?). Volvé a correr el script." -ForegroundColor Yellow
        $v.Avisado = $true
      }
      return
    }
    $r = New-Object MeshRect
    [MeshVentana]::GetWindowRect($v.Hwnd, [ref]$r) | Out-Null
    if ($r.Izq -eq $v.X -and $r.Arr -eq $v.Y -and ($r.Der - $r.Izq) -eq $v.Ancho -and ($r.Aba - $r.Arr) -eq $v.Alto) { return }
    [MeshVentana]::ShowWindow($v.Hwnd, 9) | Out-Null   # SW_RESTORE
    # HWND_TOPMOST = -1; SWP_SHOWWINDOW | SWP_NOACTIVATE
    [MeshVentana]::SetWindowPos($v.Hwnd, [IntPtr](-1), $v.X, $v.Y, $v.Ancho, $v.Alto, 0x0050) | Out-Null
  }

  # Se repite porque scrcpy puede ajustar su tamaño al recibir el primer cuadro.
  foreach ($vuelta in 1..3) {
    foreach ($v in $ventanas) { Reacomodar $v }
    Start-Sleep -Milliseconds 800
  }

  Write-Host "`nTodo listo." -ForegroundColor Green
  Write-Host '  - Clic sobre una ventana = toque en ese celular. Para mostrar, usá los teléfonos en la mano.'
  Write-Host '  - Si una ventana se corre, volvé a correr el script.'
  Write-Host "  - Logs de scrcpy en $logs"

  # La consola se minimiza para que el escenario quede adelante: con la consola
  # en foco, Windows muestra la barra de tareas encima de la pantalla completa.
  $ventanaEscenario = Procesos-Escenario | ForEach-Object { Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue } |
    Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
  if ($ventanaEscenario) {
    Write-Host '  - Esta consola queda minimizada: para cerrar todo, volvé acá con Alt+Tab.'
    [MeshVentana]::ShowWindow([MeshVentana]::GetConsoleWindow(), 6) | Out-Null   # SW_MINIMIZE
    [MeshVentana]::SetForegroundWindow($ventanaEscenario.MainWindowHandle) | Out-Null
  }
  Write-Host "`nPresioná Enter acá para cerrar los espejos y el escenario."
  $conTeclado = $true
  try { [void][Console]::KeyAvailable } catch { $conTeclado = $false }
  if (-not $conTeclado) {
    Read-Host | Out-Null
  } else {
    $salir = $false
    while (-not $salir) {
      while ([Console]::KeyAvailable) {
        if ([Console]::ReadKey($true).Key -eq [ConsoleKey]::Enter) { $salir = $true }
      }
      if (-not $salir) {
        foreach ($v in $ventanas) { Reacomodar $v }
        Start-Sleep -Milliseconds 700
      }
    }
  }
}
finally {
  Cerrar-Todo
}
