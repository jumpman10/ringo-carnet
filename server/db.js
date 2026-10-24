import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const isPkg = typeof process.pkg !== 'undefined';
const __filename = typeof __filename !== 'undefined'
  ? __filename
  : fileURLToPath(import.meta.url);
const __dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(__filename);

// Base directory: directory containing the executable when packaged, or project root in development
const BASE_DIR = isPkg
  ? path.dirname(process.execPath)
  : (fs.existsSync(path.join(process.cwd(), 'package.json'))
      ? process.cwd()
      : path.resolve(__dirname, '..'));

// Data directory: prioritize custom data directory (e.g. Electron userData) then default local directory
export const dataDir = process.env.RINGO_DATA_DIR || path.join(__dirname, 'data');
export const DATA_DIR = dataDir;

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const dbPath = path.join(dataDir, 'gimnasio.db');
export const DB_PATH = dbPath;

// Automatic migration from legacy paths if gimnasio.db doesn't exist yet
if (!fs.existsSync(dbPath)) {
  const legacyCandidates = [
    path.join(__dirname, 'data', 'gimnasio.db'),
    path.join(BASE_DIR, 'data', 'gimnasio.db'),
    path.join(BASE_DIR, 'server', 'data', 'gimnasio.db'),
    path.join(BASE_DIR, 'server', 'ringo.db'),
    path.join(BASE_DIR, 'ringo.db'),
  ];
  for (const legacyPath of legacyCandidates) {
    if (fs.existsSync(legacyPath) && path.resolve(legacyPath) !== path.resolve(dbPath)) {
      try {
        fs.copyFileSync(legacyPath, dbPath);
        console.log(`📦 Base de datos previa migrada desde ${legacyPath} a ${dbPath}`);
        break;
      } catch (err) {
        console.error('Error al migrar base de datos anterior:', err);
      }
    }
  }
}

// Locate native binary addon when packaged with pkg
const dbOptions = {};
if (isPkg) {
  const possibleAddonPaths = [
    path.join(BASE_DIR, 'better_sqlite3.node'),
    path.join(BASE_DIR, 'Release', 'better_sqlite3.node'),
    path.join(BASE_DIR, 'build', 'Release', 'better_sqlite3.node'),
  ];
  for (const addonPath of possibleAddonPaths) {
    if (fs.existsSync(addonPath)) {
      dbOptions.nativeBinding = addonPath;
      break;
    }
  }
}

export const db = new Database(dbPath, dbOptions);

// High-performance concurrency settings
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS disciplines (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      precio REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      dni TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      fecha_nacimiento TEXT,
      foto_url TEXT DEFAULT '',
      disciplina TEXT NOT NULL,
      telefono TEXT DEFAULT '',
      fecha_ingreso TEXT NOT NULL,
      fecha_vencimiento TEXT NOT NULL,
      estado_membresia TEXT NOT NULL DEFAULT 'activo',
      estado_pago TEXT NOT NULL DEFAULT 'pendiente',
      monto_mensual REAL NOT NULL DEFAULT 0,
      saldo_pendiente REAL DEFAULT 0,
      metodo_pago TEXT,
      ultimo_pago_fecha TEXT,
      creado_en TEXT NOT NULL,
      notas TEXT,
      codigo_qr TEXT NOT NULL UNIQUE
    );

    CREATE INDEX IF NOT EXISTS idx_members_dni ON members(dni);
    CREATE INDEX IF NOT EXISTS idx_members_codigo_qr ON members(codigo_qr);
    CREATE INDEX IF NOT EXISTS idx_members_creado_en ON members(creado_en DESC);

    CREATE TABLE IF NOT EXISTS access_logs (
      id TEXT PRIMARY KEY,
      member_id TEXT,
      dni TEXT NOT NULL,
      member_name TEXT NOT NULL,
      disciplina TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      autorizado INTEGER NOT NULL,
      motivo TEXT,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_access_logs_member ON access_logs(member_id);

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      fecha TEXT NOT NULL,
      monto REAL NOT NULL,
      metodo TEXT NOT NULL,
      periodo_inicio TEXT,
      periodo_fin TEXT,
      detalles TEXT,
      notas TEXT,
      creado_en TEXT NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_payments_member ON payments(member_id);
    CREATE INDEX IF NOT EXISTS idx_payments_fecha ON payments(fecha DESC);
  `);

  // Seed default disciplines if empty
  const countRow = db.prepare('SELECT COUNT(*) as count FROM disciplines').get();
  if (countRow.count === 0) {
    const insertDiscipline = db.prepare(
      'INSERT INTO disciplines (id, nombre, precio) VALUES (?, ?, ?)'
    );
    const defaults = [
      ['disc-1', 'Musculación', 28000],
      ['disc-2', 'Crossfit', 32000],
      ['disc-3', 'Funcional', 26000],
      ['disc-4', 'Boxeo', 30000],
      ['disc-5', 'Spinning', 27000],
      ['disc-6', 'Pilates', 29000],
      ['disc-7', 'Calistenia', 25000],
      ['disc-8', 'Pase Libre', 45000],
    ];

    const seedTransaction = db.transaction(() => {
      for (const d of defaults) {
        insertDiscipline.run(d[0], d[1], d[2]);
      }
    });
    seedTransaction();
  }
}
