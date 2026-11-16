@echo off
rem Doble clic para espejar los celulares. Acepta los mismos parametros que el .ps1.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0espejar-celulares.ps1" %*
if errorlevel 1 pause
