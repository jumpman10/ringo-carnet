import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BIN_DIR = path.join(ROOT_DIR, 'bin');
const DIST_SERVER_DIR = path.join(ROOT_DIR, 'dist-server');
const WIN_DIR = path.join(BIN_DIR, 'ringo-carnet-windows');

const SQLITE_VERSION = '11.8.1';
const NODE_TARGET = 'node18';
const SQLITE_ABI = 'node-v108'; // Node 18 corresponds to ABI v108

function run(command, cwd = ROOT_DIR) {
  console.log(`\n⚡ Running: ${command}`);
  execSync(command, { cwd, stdio: 'inherit' });
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function fetchPrebuiltSqlite(platformArch, destFile) {
  console.log(`\n📥 Downloading SQLite prebuilt for ${platformArch}...`);
  const filename = `better-sqlite3-v${SQLITE_VERSION}-${SQLITE_ABI}-${platformArch}.tar.gz`;
  const url = `https://github.com/WiseLibs/better-sqlite3/releases/download/v${SQLITE_VERSION}/${filename}`;
  const tmpTar = path.join(BIN_DIR, `tmp-${platformArch}.tar.gz`);
  const tmpExtract = path.join(BIN_DIR, `tmp-extract-${platformArch}`);

  ensureDir(tmpExtract);
  execSync(`curl -sL "${url}" -o "${tmpTar}"`);
  execSync(`tar -xzf "${tmpTar}" -C "${tmpExtract}"`);

  const extractedNode = path.join(tmpExtract, 'build', 'Release', 'better_sqlite3.node');
  if (!fs.existsSync(extractedNode)) {
    throw new Error(`Failed to extract better_sqlite3.node for ${platformArch}`);
  }

  ensureDir(path.dirname(destFile));
  fs.copyFileSync(extractedNode, destFile);

  // Clean temp files
  fs.rmSync(tmpTar, { force: true });
  fs.rmSync(tmpExtract, { recursive: true, force: true });
  console.log(`✅ Saved ${path.basename(destFile)} for ${platformArch}`);
}

async function main() {
  console.log('====================================================');
  console.log('🥊  BUILDING STANDALONE RINGO-CARNET BINARIES');
  console.log('====================================================');

  ensureDir(BIN_DIR);
  ensureDir(DIST_SERVER_DIR);
  ensureDir(WIN_DIR);

  // 1. Build React/Vite Frontend
  console.log('\n📦 Step 1: Compiling React/Vite frontend...');
  run('npm run build');

  // 2. Bundle Node.js server with esbuild into single CommonJS file
  console.log('\n⚙️ Step 2: Bundling Express backend with esbuild...');
  run(
    'npx esbuild server/server.js --bundle --platform=node --target=node18 --format=cjs --outfile=dist-server/server.cjs --external:better-sqlite3'
  );

  // 3. Compile standalone binaries with pkg
  console.log('\n🚀 Step 3: Compiling standalone executables with pkg...');
  // Packaging macOS ARM64
  run(
    `npx @yao-pkg/pkg dist-server/server.cjs --target ${NODE_TARGET}-macos-arm64 --public --assets "dist/**/*" --output "${path.join(BIN_DIR, 'ringo-carnet-macos')}"`
  );

  // Packaging Windows x64
  const winExe = path.join(WIN_DIR, 'ringo-carnet-win.exe');
  run(
    `npx @yao-pkg/pkg dist-server/server.cjs --target ${NODE_TARGET}-win-x64 --public --assets "dist/**/*" --output "${winExe}"`
  );

  // 4. Download and setup native SQLite bindings
  console.log('\n🧩 Step 4: Provisioning native SQLite bindings...');
  // macOS binding (placed next to binary in bin/)
  await fetchPrebuiltSqlite('darwin-arm64', path.join(BIN_DIR, 'better_sqlite3.node'));

  // Windows binding (placed next to exe in bin/ringo-carnet-windows/)
  await fetchPrebuiltSqlite('win32-x64', path.join(WIN_DIR, 'better_sqlite3.node'));

  // Create data directory for Windows distribution
  ensureDir(path.join(WIN_DIR, 'data'));

  // 5. Copy frontend dist/ into distribution folders
  console.log('\n📁 Step 5: Copying compiled frontend dist/ into distribution folders...');
  fs.cpSync(path.join(ROOT_DIR, 'dist'), path.join(WIN_DIR, 'dist'), { recursive: true });
  fs.cpSync(path.join(ROOT_DIR, 'dist'), path.join(BIN_DIR, 'dist'), { recursive: true });

  // 6. Create README for Windows client
  const readmeContent = `=====================================================
RINGO CARNET - SISTEMA DE CONTROL DE ACCESO (WINDOWS)
=====================================================

INSTRUCCIONES DE USO:
1. No se requiere instalar Node.js ni configurar nada.
2. Hacé doble clic en "ringo-carnet-win.exe".
3. Se abrirá la consola y automáticamente se abrirá tu navegador web en https://localhost:3000
4. En celulares conectados al mismo Wi-Fi:
   - Escaneá el código QR que aparece en la consola.
   - Si el navegador dice "La conexión no es privada", tocá en "Configuración avanzada" y luego "Continuar a ... (no seguro)". Esto habilita la cámara para escanear y sacar fotos.

ESTRUCTURA DE ARCHIVOS:
- ringo-carnet-win.exe : Ejecutable principal
- better_sqlite3.node  : Conector de base de datos de alta velocidad
- dist/                : Archivos de la aplicación web (React)
- data/gimnasio.db     : Base de datos SQLite del gimnasio

RESPALDOS:
- Toda la base de datos se guarda en la carpeta "data/gimnasio.db".
- Para hacer una copia de seguridad, simplemente copiá esa carpeta o el archivo gimnasio.db a un pendrive.
=====================================================
`;
  fs.writeFileSync(path.join(WIN_DIR, 'LEEME.txt'), readmeContent, 'utf8');

  console.log('\n====================================================');
  console.log('🎉 COMPILACIÓN COMPLETADA EXITOSAMENTE');
  console.log('====================================================');
  console.log(`🍎 macOS Binary:   ${path.join(BIN_DIR, 'ringo-carnet-macos')}`);
  console.log(`🪟 Windows Folder:  ${WIN_DIR}`);
  console.log('   Contenido listo para comprimir en ZIP:');
  console.log('   ├── ringo-carnet-win.exe');
  console.log('   ├── better_sqlite3.node');
  console.log('   ├── dist/');
  console.log('   ├── data/');
  console.log('   └── LEEME.txt');
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Build failed:', err);
  process.exit(1);
});
