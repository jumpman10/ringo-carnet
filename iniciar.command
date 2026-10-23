#!/bin/zsh
# ============================================================
# 🥊 RINGO CARNET - Lanzador para macOS (Doble Clic)
# ============================================================

# 1. Cargar entorno de Node.js (priorizando NVM si está presente)
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  source "$NVM_DIR/nvm.sh"
elif [ -f "$HOME/.zshrc" ]; then
  source "$HOME/.zshrc" >/dev/null 2>&1
fi

# Fallback para rutas de Homebrew / estándar
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

# 2. Posicionarse en la carpeta del proyecto de forma absoluta
PROJECT_DIR="${0:A:h}"
cd "$PROJECT_DIR" 2>/dev/null
if [ $? -ne 0 ]; then
  echo "❌ [ERROR DE PERMISOS DE macOS]"
  echo "Terminal no tiene permiso para acceder a la carpeta Escritorio (Desktop)."
  echo ""
  echo "👉 Para solucionarlo:"
  echo "1. Andá a: Ajustes del Sistema -> Privacidad y seguridad -> Archivos y carpetas"
  echo "2. Buscá 'Terminal' y activá el permiso de 'Carpeta Escritorio'."
  echo ""
  read -p "Presioná Enter para salir..."
  exit 1
fi

echo "============================================================"
echo "          🥊  RINGO CARNET - INICIANDO SISTEMA (macOS)      "
echo "============================================================"
echo ""

# 3. Verificar disponibilidad de Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "❌ [ERROR] Node.js no está disponible."
  echo "Instalá Node.js (LTS recomendado) desde https://nodejs.org/"
  echo ""
  read -p "Presioná Enter para salir..."
  exit 1
fi

# 4. Instalar dependencias si falta node_modules
if [ ! -d "node_modules" ]; then
  echo "📦 [1/3] Instalando dependencias del sistema (solo primera vez)..."
  npm install
  if [ $? -ne 0 ]; then
    echo "❌ [ERROR] Falló npm install."
    read -p "Presioná Enter para salir..."
    exit 1
  fi
fi

# 5. Compilar si no existe dist/
if [ ! -f "dist/index.html" ]; then
  echo "⚡ [2/3] Compilando aplicación web para producción..."
  npm run build:prod
  if [ $? -ne 0 ]; then
    echo "❌ [ERROR] Falló la compilación de la aplicación."
    read -p "Presioná Enter para salir..."
    exit 1
  fi
fi

# 6. Abrir navegador en segundo plano y lanzar servidor HTTPS
echo "🚀 [3/3] Abriendo navegador en https://localhost:3000 ..."
(sleep 1.2 && open "https://localhost:3000") &

echo "Iniciando servidor local seguro..."
NODE_ENV=production node server/server.js
