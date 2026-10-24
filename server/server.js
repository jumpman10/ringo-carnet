import express from 'express';
import cors from 'cors';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import selfsigned from 'selfsigned';
import qrcodeTerminal from 'qrcode-terminal';
import { dbService, initDatabase, dbPath, DB_PATH } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base directory: project root in development or execution context
const BASE_DIR = fs.existsSync(path.join(process.cwd(), 'package.json'))
  ? process.cwd()
  : path.resolve(__dirname, '..');

// Static assets resolution (prioritizes physical dist/ next to executable, then fallback)
function resolveDistDir() {
  const candidates = [
    path.join(BASE_DIR, 'dist'),
    path.join(process.cwd(), 'dist'),
    path.join(__dirname, '..', 'dist'),
    path.join(__dirname, 'dist'),
  ];
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fs.existsSync(resolved) && fs.existsSync(path.join(resolved, 'index.html'))) {
      return resolved;
    }
  }
  return path.resolve(BASE_DIR, 'dist');
}

const DIST_DIR = resolveDistDir();
let currentPort = Number(process.env.PORT) || 3000;
export const PORT = currentPort;

// Initialize database schema and initial seeds
initDatabase();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

export const certsDir = process.env.RINGO_DATA_DIR
  ? path.join(process.env.RINGO_DATA_DIR, 'certs')
  : path.join(__dirname, 'certs');
const CERTS_DIR = certsDir;
const CERT_FILE = path.join(certsDir, 'cert.pem');
const KEY_FILE = path.join(certsDir, 'key.pem');

async function getOrCreateCertificates(localIps = []) {
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
  }

  if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
    try {
      const cert = fs.readFileSync(CERT_FILE, 'utf8');
      const key = fs.readFileSync(KEY_FILE, 'utf8');
      return { cert, key, isNew: false, location: certsDir };
    } catch (err) {
      console.warn('⚠️  No se pudieron leer los certificados existentes. Regenerando...', err);
    }
  }

  console.log('🔐 Certificados SSL no encontrados. Generando certificados autofirmados con selfsigned...');

  const altNames = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
    ...localIps.map((ip) => ({ type: 7, ip })),
  ];

  const attrs = [
    { name: 'commonName', value: 'localhost' },
    { name: 'organizationName', value: 'Ringo Carnet' },
  ];

  const pems = await selfsigned.generate(attrs, {
    days: 365,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [{ name: 'subjectAltName', altNames }],
  });

  fs.writeFileSync(CERT_FILE, pems.cert, 'utf8');
  fs.writeFileSync(KEY_FILE, pems.private, 'utf8');

  console.log(`✅ Certificados SSL creados exitosamente en ${certsDir}`);
  return {
    cert: pems.cert,
    key: pems.private,
    isNew: true,
    location: certsDir,
  };
}

function getNetworkIpInfo() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, netList] of Object.entries(interfaces)) {
    for (const net of netList || []) {
      const isIpv4 = net.family === 'IPv4' || net.family === 4;
      if (isIpv4 && !net.internal) {
        if (net.address.startsWith('169.254.')) continue;
        const isWifi = /wi-?fi|wlan|en0|wireless/i.test(name);
        candidates.push({
          interface: name,
          ip: net.address,
          isWifi,
        });
      }
    }
  }

  // Prioritize Wi-Fi interfaces first
  candidates.sort((a, b) => (b.isWifi ? 1 : 0) - (a.isWifi ? 1 : 0));

  const primaryIp = candidates[0]?.ip || '127.0.0.1';
  const allIps = candidates.map((c) => c.ip);

  return { primaryIp, allIps, candidates };
}

export function getLocalIp() {
  const { primaryIp } = getNetworkIpInfo();
  return primaryIp;
}

// ----------------------------------------------------
// Healthcheck & Network Info
// ----------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

app.get('/api/network-info', (req, res) => {
  const ip = getLocalIp();
  const port = currentPort;
  res.json({
    ip: ip,
    port: port,
    url: 'https://' + ip + ':' + port,
  });
});

app.get('/api/backup', (req, res) => {
  try {
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Base de datos no encontrada' });
    }

    res.download(dbPath, 'gimnasio-backup.json', (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Error al descargar el backup de la base de datos' });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// Disciplines API
// ----------------------------------------------------
app.get('/api/disciplines', (req, res) => {
  try {
    const rows = dbService.getDisciplines();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/disciplines', (req, res) => {
  try {
    const { nombre, precio, id } = req.body;
    if (!nombre) {
      return res.status(400).json({ error: 'Discipline name is required' });
    }

    const saved = dbService.createDiscipline({ id, nombre, precio });
    res.status(201).json(saved);
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/disciplines/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updated = dbService.updateDiscipline(id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Discipline not found' });
    }
    res.json(updated);
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/disciplines/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = dbService.deleteDiscipline(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Discipline not found' });
    }
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// Members API
// ----------------------------------------------------
app.get('/api/members', (req, res) => {
  try {
    const rows = dbService.getMembers();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/members/:id', (req, res) => {
  try {
    const member = dbService.getMemberById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/members', (req, res) => {
  try {
    const { dni, nombre, apellido, disciplina, fecha_ingreso } = req.body;
    if (!dni || !nombre || !apellido || !disciplina || !fecha_ingreso) {
      return res.status(400).json({
        error: 'Required fields: dni, nombre, apellido, disciplina, fecha_ingreso',
      });
    }

    const cleanDni = String(dni).trim();
    const existing = dbService.getMemberByDni(cleanDni);
    if (existing) {
      return res.status(409).json({ error: `Member with DNI ${cleanDni} already exists` });
    }

    const created = dbService.createMember(req.body);
    res.status(201).json(created);
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/members/:id', (req, res) => {
  try {
    const { id } = req.params;
    const current = dbService.getMemberById(id);
    if (!current) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const updated = dbService.updateMember(id, req.body);
    res.json(updated);
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/members/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = dbService.deleteMember(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// Renew Membership Endpoint
// ----------------------------------------------------
app.post('/api/members/:id/renew', (req, res) => {
  try {
    const { id } = req.params;
    const member = dbService.getMemberById(id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const updated = dbService.renewMember(id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// QR Access Verification Endpoint
// ----------------------------------------------------
app.post('/api/verify-access', (req, res) => {
  try {
    const rawToken = req.body.qr_token || req.body.code || req.body.dni;
    if (!rawToken) {
      return res.status(400).json({ error: 'Token, code, or DNI is required' });
    }

    const result = dbService.verifyAccess(rawToken);
    if (!result.member) {
      return res.status(404).json({
        authorized: false,
        autorizado: false,
        error: 'Miembro no encontrado en el sistema',
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// Access Logs & Payment Logs Queries
// ----------------------------------------------------
app.get('/api/access-logs', (req, res) => {
  try {
    const rows = dbService.getAccessLogs();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/access-logs', (req, res) => {
  try {
    const created = dbService.createAccessLog(req.body);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/payments', (req, res) => {
  try {
    const rows = dbService.getPayments();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payments', (req, res) => {
  try {
    const created = dbService.createPayment(req.body);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// Static Files Serving (Vite build in dist/)
// ----------------------------------------------------
const indexHtmlPath = path.resolve(DIST_DIR, 'index.html');
if (fs.existsSync(DIST_DIR) && fs.existsSync(indexHtmlPath)) {
  app.use(express.static(DIST_DIR));

  // SPA fallback for HTML5 History API client-side routes (e.g. /admin, /carnet/:dni)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(indexHtmlPath);
  });
} else {
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Ringo Gym Server</title></head>
        <body style="font-family: sans-serif; background: #000; color: #fff; padding: 40px; text-align: center;">
          <h1 style="font-size: 2.5rem; margin-bottom: 8px;">🏋️ Ringo Server</h1>
          <p style="color: #aaa;">Backend API & JSON Database are running.</p>
          <p style="color: #666; font-size: 0.9rem;">dist/ no encontrado. Ejecutá <code>npm run build</code> para compilar el frontend.</p>
        </body>
      </html>
    `);
  });
}

// ----------------------------------------------------
// Browser Auto-open (Cross-platform)
// ----------------------------------------------------
function openBrowser(url) {
  const startCmd = process.platform === 'darwin'
    ? `open "${url}"`
    : process.platform === 'win32'
    ? `start "" "${url}"`
    : `xdg-open "${url}"`;

  exec(startCmd, (err) => {
    if (err) {
      console.warn('⚠️  No se pudo abrir el navegador automáticamente:', err.message);
    }
  });
}

// ----------------------------------------------------
// Server Startup (HTTPS) & Local Network QR
// ----------------------------------------------------
export async function startServer(customPort = 3000) {
  const portToUse = Number(customPort) || Number(process.env.PORT) || 3000;
  currentPort = portToUse;

  const { primaryIp, allIps } = getNetworkIpInfo();
  const ssl = await getOrCreateCertificates(allIps);

  const server = https.createServer({ key: ssl.key, cert: ssl.cert }, app);

  return new Promise((resolve, reject) => {
    server.on('error', (err) => {
      reject(err);
    });

    server.listen(portToUse, '0.0.0.0', () => {
      const localUrl = `https://localhost:${portToUse}`;
      const networkUrl = `https://${primaryIp}:${portToUse}`;

      console.log('\n=============================================================');
      console.log('  🥊  RINGO CARNET - SERVIDOR LOCAL HTTPS EN EJECUCIÓN');
      console.log('=============================================================');
      console.log(`  💻  Acceso en esta PC:       ${localUrl}`);
      console.log(`  📱  Acceso en Red Wi-Fi:     ${networkUrl}`);
      console.log(`  💾  Base de datos JSON:      ${dbPath}`);
      console.log(`  🔒  Certificados SSL:        ${certsDir}`);
      console.log(`  📁  Archivos web:            ${fs.existsSync(indexHtmlPath) ? 'Sirviendo dist/' : 'dist/ no encontrado (ejecutá npm run build)'}`);
      console.log('-------------------------------------------------------------');
      console.log('  📲  Escaneá este código QR desde tu celular (conectado al Wi-Fi):');

      qrcodeTerminal.generate(networkUrl, { small: true }, (qr) => {
        const indented = qr
          .split('\n')
          .map((line) => '      ' + line)
          .join('\n');
        console.log(indented);
      });

      console.log('\n  💡  Tip para celulares (Chrome / Safari):');
      console.log('      Al ser un certificado local, la primera vez el navegador dirá:');
      console.log('      "La conexión no es privada". Tocá "Configuración avanzada"');
      console.log('      y luego "Continuar a ' + primaryIp + ' (no seguro)".');
      console.log('      ¡Esto habilita la cámara para escanear y sacar fotos!');
      console.log('=============================================================\n');

      // Solo ejecuta la apertura automática del navegador si NO estamos dentro de Electron
      if (!process.versions?.electron) {
        setTimeout(() => {
          openBrowser(localUrl);
        }, 600);
      }

      resolve({ server, ip: primaryIp, port: portToUse });
    });
  });
}

// Automatically start when executed directly via Node CLI
const isDirectRun = process.argv[1] && (
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
);

if (isDirectRun) {
  startServer().catch((err) => {
    console.error('❌ Error fatal al iniciar el servidor:', err);
    process.exit(1);
  });
}

export { app };
export default app;
