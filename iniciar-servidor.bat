@echo off
title Servidor Auditoria 5S GHI
cd /d "%~dp0"
echo.
echo ========================================
echo   Iniciando Servidor de Auditoria 5S
echo ========================================
echo.

start /b npm start

echo Esperando a que el servidor cargue...
timeout /t 3 /nobreak >nul

echo Abriendo navegador...
start chrome http://localhost:3000

echo.
echo Servidor activo en http://localhost:3000
echo Presiona Ctrl+C para cerrar el servidor
echo.
pause >nul
