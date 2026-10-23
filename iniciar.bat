@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title Ringo Carnet - Servidor Local
cd /d "%~dp0"

echo ============================================================
echo           🥊  RINGO CARNET - INICIANDO SISTEMA
echo ============================================================
echo.

:: 1. Verificar si Node.js está instalado
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no está instalado en esta computadora.
    echo Por favor instalá la versión recomendada (LTS) desde:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Instalar dependencias si no existe node_modules
if not exist "node_modules\" (
    echo [1/3] Instalando dependencias (solo la primera vez)...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Falló la instalación de dependencias.
        pause
        exit /b 1
    )
)

:: 3. Compilar la aplicación web si no existe la carpeta dist
if not exist "dist\index.html" (
    echo [2/3] Compilando aplicación web para producción...
    call npm run build:prod
    if %errorlevel% neq 0 (
        echo [ERROR] Falló la compilación de la aplicación.
        pause
        exit /b 1
    )
)

:: 4. Abrir navegador y levantar el servidor seguro
echo [3/3] Abriendo navegador predeterminado en https://localhost:3000 ...
start "" "https://localhost:3000"

echo.
echo Iniciando servidor HTTPS...
call npm run start:local

if %errorlevel% neq 0 (
    echo.
    echo [AVISO] El servidor se detuvo o ocurrió un error.
    pause
)
