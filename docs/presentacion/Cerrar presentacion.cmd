@echo off
rem Cierra una presentacion abierta: espejos, escenario y No molestar.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0espejar-celulares.ps1" -Cerrar
timeout /t 3 >nul
