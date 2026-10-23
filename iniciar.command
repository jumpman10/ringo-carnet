#!/bin/bash
# ============================================================
# 🥊 RINGO CARNET - Lanzador para macOS (Doble Clic)
# ============================================================

# Cambiar al directorio donde reside este script
cd "$(dirname "$0")" || exit 1

# Asegurar rutas estándar de Node/npm en macOS (Homebrew Apple Silicon / Intel / NVM / estándar)
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -n 1)/bin:$PATH"

if [ -f "$HOME/.zshrc" ]; then
  # Cargar entorno de usuario si node no está accesible directamente
  command -v node >/dev/null 2>&1 || source "$HOME/.zshrc" >/dev/null 2>&1
fi

echo "============================================================"
echo "          🥊  RINGO CARNET - INICIANDO SISTEMA (macOS)      "
echo "============================================================"
echo ""

# 1. Verificar si Node.js está disponible
if ! command -v node >/dev/null 2>&1; then
  echo "❌ [ERROR] Node.js no está instalado o no está en el PATH."
  echo "Por favor instalá Node.js (v20 o v22 LTS) desde https://nodejs.org/"
  echo "o vía Homebrew con: brew install node"
  echo ""
  read -p "Presioná Enter para salir..."
  exit 1
fi

# 2. Instalar dependencias si no existe node_modules
if [ ! -d "node_modules" ]; then
  echo "📦 [1/3] Instalando dependencias del sistema (solo primera vez)..."
  npm install
  if [ $? -ne 0 ]; then
    echo "❌ [ERROR] Falló npm install."
    read -p "Presioná Enter para salir..."
    exit 1
  fi
fi

# 3. Compilar aplicación web si no existe dist/
if [ ! -f "dist/index.html" ]; then
  echo "⚡ [2/3] Compilando aplicación web para producción..."
  npm run build:prod
  if [ $? -ne 0 ]; then
    echo "❌ [ERROR] Falló la compilación de la aplicación (vite build)."
    read -p "Presioná Enter para salir..."
    exit 1
  fi
fi

# 4. Abrir navegador en segundo plano y lanzar servidor HTTPS
echo "🚀 [3/3] Abriendo navegador en https://localhost:3000 ..."
(sleep 1.2 && open "https://localhost:3000") &

echo "Iniciando servidor local seguro..."
npm run start:local
