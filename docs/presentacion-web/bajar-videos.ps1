# Baja los videos de fondo de la presentación desde Mixkit a la carpeta videos/.
# No van en el repo porque su licencia no permite redistribuirlos (ver CREDITOS.md).
# Uso: doble clic en "Bajar videos.cmd". Si un video ya está, no lo vuelve a bajar.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$destino = Join-Path $PSScriptRoot 'videos'
New-Item -ItemType Directory -Force -Path $destino | Out-Null

$videos = [ordered]@{
  'moto-aerea-ruta'          = 3
  'moto-frente-ruta'         = 39912
  'bici-pareja-camino'       = 44322
  'trekking-grupo-nieve'     = 46066
  'ruta-cerros'              = 4633
  'trekking-fila-nieve'      = 46072
  'moto-sola-desierto'       = 43101
  'trekking-grupo-contraluz' = 46067
  'mar-de-nubes'             = 4695
  'caminante-montanas'       = 36996
}

$fallas = 0
foreach ($nombre in $videos.Keys) {
  $archivo = Join-Path $destino "$nombre.mp4"
  if ((Test-Path $archivo) -and (Get-Item $archivo).Length -gt 100KB) {
    Write-Host "  ya estaba  $nombre"
    continue
  }
  $id = $videos[$nombre]
  try {
    Invoke-WebRequest -Uri "https://assets.mixkit.co/videos/$id/$id-720.mp4" -OutFile $archivo -UserAgent 'Mozilla/5.0'
    Write-Host ("  bajado     {0} ({1:N1} MB)" -f $nombre, ((Get-Item $archivo).Length / 1MB))
  } catch {
    Remove-Item $archivo -ErrorAction SilentlyContinue
    Write-Host "  FALLÓ      $nombre : $($_.Exception.Message)" -ForegroundColor Red
    $fallas++
  }
}

if ($fallas -eq 0) { Write-Host "`nListo. Abrí index.html para presentar." -ForegroundColor Green }
else { Write-Host "`n$fallas video(s) no se pudieron bajar. Revisá la conexión y volvé a correrlo." -ForegroundColor Yellow }
