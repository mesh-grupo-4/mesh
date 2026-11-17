@echo off
rem Presentar con los celulares enchufados por cable.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0espejar-celulares.ps1" %*
if errorlevel 1 pause
