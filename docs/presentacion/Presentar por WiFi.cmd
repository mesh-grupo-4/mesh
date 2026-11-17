@echo off
rem Presentar sin cables: prende la zona con cobertura de la notebook y conecta los celulares a esa red.
rem La primera vez en un lugar (o si un celular se reinicio) tienen que estar enchufados.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0espejar-celulares.ps1" -Zona %*
if errorlevel 1 pause
