@echo off
rem Crea en el menu Inicio los accesos directos de la presentacion, listos para anclar.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-accesos.ps1" %*
pause
