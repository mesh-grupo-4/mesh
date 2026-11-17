@echo off
rem Presentar sin cables usando el hotspot de un celular: ese celular comparte datos,
rem y la notebook y el otro celular estan conectados a su red WiFi.
rem No prende la zona de la notebook. La primera vez (o si un celular se reinicio) tienen que estar enchufados.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0espejar-celulares.ps1" -Wifi -Liviano %*
if errorlevel 1 pause
