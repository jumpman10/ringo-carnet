import express from 'express';
import cors from 'cors';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import selfsigned from 'selfsigned';
import qrcodeTerminal from 'qrcode-terminal';
import { db, initDatabase, dbPath, DB_PATH } from './db.js';

const isPkg = typeof process.pkg !== 'undefined';
const __filename = typeof __filename !== 'undefined'
  ? __filename
  : fileURLToPath(import.meta.url);
const __dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(__filename);

// Base directory: directory of the binary if packaged, or project root in development
const BASE_DIR = isPkg
  ? path.dirname(process.execPath)
  : (fs.existsSync(path.join(process.cwd(), 'package.json'))
      ? process.cwd()
      : path.resolve(__dirname, '..'));

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

// ----------------------------------------------------
// Utility Functions
// ----------------------------------------------------
function formatDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateNextExpiration(fromDateStr) {
  if (!fromDateStr) return '';
  const [y, m, d] = fromDateStr.split('-').map(Number);
  if (!y || !m || !d) return fromDateStr;

  const currentMonthIdx = m - 1;
  const day = d;

  // Specific rule: Jan 29, 30, 31 renews on Feb 1st
  if (currentMonthIdx === 0 && day >= 29) {
    const nextDate = new Date(y, 1, 1);
    return formatDateISO(nextDate);
  }

  let targetYear = y;
  let targetMonthIdx = currentMonthIdx + 1;
  if (targetMonthIdx > 11) {
    targetMonthIdx = 0;
    targetYear += 1;
  }

  const daysInTargetMonth = new Date(targetYear, targetMonthIdx + 1, 0).getDate();
  let targetDay = day;
  if (day > daysInTargetMonth) {
    targetDay = 1;
    targetMonthIdx += 1;
    if (targetMonthIdx > 11) {
      targetMonthIdx = 0;
      targetYear += 1;
    }
  }

  const result = new Date(targetYear, targetMonthIdx, targetDay);
  return formatDateISO(result);
}

function getDaysRemaining(expirationDateStr) {
  if (!expirationDateStr) return 0;
  const [y, m, d] = expirationDateStr.split('-').map(Number);
  const expiration = new Date(y, m - 1, d);
  expiration.setHours(23, 59, 59, 999);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const diffMs = expiration.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

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

    // Flush WAL journal to main database file before download
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // Proceed even if WAL checkpoint warning occurs
    }

    res.download(dbPath, 'gimnasio-backup.db', (err) => {
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
    const rows = db.prepare('SELECT * FROM disciplines ORDER BY nombre ASC').all();
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

    const disciplineId = id || 'disc-' + Date.now().toString(36);
    const numPrice = Number(precio) || 0;

    const stmt = db.prepare(`
      INSERT INTO disciplines (id, nombre, precio)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        nombre = excluded.nombre,
        precio = excluded.precio
    `);
    stmt.run(disciplineId, nombre.trim(), numPrice);

    const saved = db.prepare('SELECT * FROM disciplines WHERE id = ?').get(disciplineId);
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/disciplines/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, precio } = req.body;

    const existing = db.prepare('SELECT * FROM disciplines WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Discipline not found' });
    }

    const newName = nombre !== undefined ? nombre.trim() : existing.nombre;
    const newPrice = precio !== undefined ? Number(precio) : existing.precio;

    db.prepare('UPDATE disciplines SET nombre = ?, precio = ? WHERE id = ?').run(newName, newPrice, id);
    const updated = db.prepare('SELECT * FROM disciplines WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/disciplines/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = db.prepare('DELETE FROM disciplines WHERE id = ?').run(id);
    if (result.changes === 0) {
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
    const rows = db.prepare('SELECT * FROM members ORDER BY creado_en DESC').all();
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/members/:id', (req, res) => {
  try {
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
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
    const {
      dni,
      nombre,
      apellido,
      fecha_nacimiento,
      foto_url = '',
      disciplina,
      telefono = '',
      fecha_ingreso,
      fecha_vencimiento,
      estado_membresia = 'activo',
      estado_pago = 'pendiente',
      monto_mensual = 0,
      saldo_pendiente = 0,
      metodo_pago,
      notas = '',
      codigo_qr,
      id,
    } = req.body;

    if (!dni || !nombre || !apellido || !disciplina || !fecha_ingreso) {
      return res.status(400).json({
        error: 'Required fields: dni, nombre, apellido, disciplina, fecha_ingreso',
      });
    }

    const cleanDni = String(dni).trim();
    const existingDni = db.prepare('SELECT id FROM members WHERE dni = ?').get(cleanDni);
    if (existingDni) {
      return res.status(409).json({ error: `Member with DNI ${cleanDni} already exists` });
    }

    const memberId = id || 'mem-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const calculatedVencimiento = fecha_vencimiento || calculateNextExpiration(fecha_ingreso);
    const qrCode = codigo_qr || `RINGO-${cleanDni}-${Date.now().toString(36).toUpperCase()}`;
    const nowIso = new Date().toISOString();
    const isPaid = estado_pago === 'pagado';
    const lastPaymentDate = isPaid ? fecha_ingreso : null;

    const createMemberTx = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO members (
          id, dni, nombre, apellido, fecha_nacimiento, foto_url, disciplina,
          telefono, fecha_ingreso, fecha_vencimiento, estado_membresia, estado_pago,
          monto_mensual, saldo_pendiente, metodo_pago, ultimo_pago_fecha, creado_en,
          notas, codigo_qr
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?
        )
      `);

      stmt.run(
        memberId,
        cleanDni,
        nombre.trim(),
        apellido.trim(),
        fecha_nacimiento || null,
        foto_url || '',
        disciplina.trim(),
        telefono || '',
        fecha_ingreso,
        calculatedVencimiento,
        estado_membresia,
        estado_pago,
        Number(monto_mensual) || 0,
        Number(saldo_pendiente) || 0,
        metodo_pago || null,
        lastPaymentDate,
        nowIso,
        notas || '',
        qrCode
      );

      // Record initial payment log if marked paid upon registration
      if (isPaid) {
        const payStmt = db.prepare(`
          INSERT INTO payments (
            id, member_id, fecha, monto, metodo, periodo_inicio, periodo_fin, detalles, notas, creado_en
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        payStmt.run(
          'pay-' + Date.now().toString(36),
          memberId,
          fecha_ingreso,
          Number(monto_mensual) || 0,
          metodo_pago || 'Efectivo',
          fecha_ingreso,
          calculatedVencimiento,
          null,
          'Alta inicial de miembro',
          nowIso
        );
      }
    });

    createMemberTx();

    const created = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/members/:id', (req, res) => {
  try {
    const { id } = req.params;
    const current = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
    if (!current) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const updates = req.body;
    let fechaVencimiento = updates.fecha_vencimiento || current.fecha_vencimiento;
    if (updates.fecha_ingreso && !updates.fecha_vencimiento) {
      fechaVencimiento = calculateNextExpiration(updates.fecha_ingreso);
    }

    const becamePaid = updates.estado_pago === 'pagado' && current.estado_pago !== 'pagado';
    const today = formatDateISO(new Date());
    const ultimoPagoFecha = updates.ultimo_pago_fecha !== undefined
      ? updates.ultimo_pago_fecha
      : becamePaid
        ? today
        : current.ultimo_pago_fecha;

    const merged = {
      dni: updates.dni !== undefined ? String(updates.dni).trim() : current.dni,
      nombre: updates.nombre !== undefined ? updates.nombre.trim() : current.nombre,
      apellido: updates.apellido !== undefined ? updates.apellido.trim() : current.apellido,
      fecha_nacimiento: updates.fecha_nacimiento !== undefined ? updates.fecha_nacimiento : current.fecha_nacimiento,
      foto_url: updates.foto_url !== undefined ? updates.foto_url : current.foto_url,
      disciplina: updates.disciplina !== undefined ? updates.disciplina : current.disciplina,
      telefono: updates.telefono !== undefined ? updates.telefono : current.telefono,
      fecha_ingreso: updates.fecha_ingreso !== undefined ? updates.fecha_ingreso : current.fecha_ingreso,
      fecha_vencimiento: fechaVencimiento,
      estado_membresia: updates.estado_membresia !== undefined ? updates.estado_membresia : current.estado_membresia,
      estado_pago: updates.estado_pago !== undefined ? updates.estado_pago : current.estado_pago,
      monto_mensual: updates.monto_mensual !== undefined ? Number(updates.monto_mensual) : current.monto_mensual,
      saldo_pendiente: updates.saldo_pendiente !== undefined ? Number(updates.saldo_pendiente) : current.saldo_pendiente,
      metodo_pago: updates.metodo_pago !== undefined ? updates.metodo_pago : current.metodo_pago,
      ultimo_pago_fecha: ultimoPagoFecha,
      notas: updates.notas !== undefined ? updates.notas : current.notas,
      codigo_qr: updates.codigo_qr !== undefined ? updates.codigo_qr : current.codigo_qr,
    };

    const updateTx = db.transaction(() => {
      db.prepare(`
        UPDATE members SET
          dni = ?, nombre = ?, apellido = ?, fecha_nacimiento = ?, foto_url = ?,
          disciplina = ?, telefono = ?, fecha_ingreso = ?, fecha_vencimiento = ?,
          estado_membresia = ?, estado_pago = ?, monto_mensual = ?, saldo_pendiente = ?,
          metodo_pago = ?, ultimo_pago_fecha = ?, notas = ?, codigo_qr = ?
        WHERE id = ?
      `).run(
        merged.dni,
        merged.nombre,
        merged.apellido,
        merged.fecha_nacimiento,
        merged.foto_url,
        merged.disciplina,
        merged.telefono,
        merged.fecha_ingreso,
        merged.fecha_vencimiento,
        merged.estado_membresia,
        merged.estado_pago,
        merged.monto_mensual,
        merged.saldo_pendiente,
        merged.metodo_pago,
        merged.ultimo_pago_fecha,
        merged.notas,
        merged.codigo_qr,
        id
      );

      if (becamePaid && !updates.skipPaymentLog) {
        db.prepare(`
          INSERT INTO payments (
            id, member_id, fecha, monto, metodo, periodo_inicio, periodo_fin, detalles, notas, creado_en
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'pay-' + Date.now().toString(36),
          id,
          today,
          Number(merged.monto_mensual) || 28000,
          merged.metodo_pago || 'Efectivo',
          today,
          merged.fecha_vencimiento,
          null,
          'Actualización de estado a pagado',
          new Date().toISOString()
        );
      }
    });

    updateTx();

    const updated = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/members/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleteTx = db.transaction(() => {
      db.prepare('DELETE FROM access_logs WHERE member_id = ?').run(id);
      db.prepare('DELETE FROM payments WHERE member_id = ?').run(id);
      return db.prepare('DELETE FROM members WHERE id = ?').run(id);
    });

    const result = deleteTx();
    if (result.changes === 0) {
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
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const {
      monto,
      metodo = 'Efectivo',
      detalles,
      disciplina,
      fechaRenovacion,
      fechaVencimiento,
      saldoPendiente,
      esPagoSaldo,
      notas,
    } = req.body;

    const today = formatDateISO(new Date());
    const renewalDate = fechaRenovacion || today;
    const nowIso = new Date().toISOString();

    const renewTx = db.transaction(() => {
      // Case A: Paying off pending balance only
      if (esPagoSaldo) {
        const nuevoSaldo = Math.max(0, (member.saldo_pendiente || 0) - (Number(monto) || 0));
        const nuevoEstadoPago = nuevoSaldo === 0 ? 'pagado' : 'parcial';

        db.prepare(`
          UPDATE members SET
            saldo_pendiente = ?,
            estado_pago = ?,
            ultimo_pago_fecha = ?,
            metodo_pago = COALESCE(?, metodo_pago)
          WHERE id = ?
        `).run(nuevoSaldo, nuevoEstadoPago, renewalDate, metodo || null, id);

        db.prepare(`
          INSERT INTO payments (
            id, member_id, fecha, monto, metodo, periodo_inicio, periodo_fin, detalles, notas, creado_en
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'pay-' + Date.now().toString(36),
          id,
          renewalDate,
          Number(monto) || 0,
          metodo,
          member.fecha_ingreso,
          member.fecha_vencimiento,
          detalles ? JSON.stringify(detalles) : null,
          notas || `Cancelación de saldo pendiente (Restante: $${nuevoSaldo})`,
          nowIso
        );
      } else {
        // Case B: Membership extension / renewal
        const baseDate = member.fecha_vencimiento && member.fecha_vencimiento >= renewalDate
          ? member.fecha_vencimiento
          : renewalDate;

        const calculatedExpiration = fechaVencimiento || calculateNextExpiration(baseDate);
        const nuevoSaldo = saldoPendiente !== undefined ? Math.max(0, Number(saldoPendiente)) : 0;
        const nuevoEstadoPago = nuevoSaldo > 0 ? 'parcial' : 'pagado';
        const finalMonto = monto !== undefined ? Number(monto) : (member.monto_mensual || 28000);
        const finalDisciplina = disciplina || member.disciplina;

        db.prepare(`
          UPDATE members SET
            fecha_vencimiento = ?,
            estado_membresia = 'activo',
            estado_pago = ?,
            saldo_pendiente = ?,
            ultimo_pago_fecha = ?,
            disciplina = ?,
            monto_mensual = ?,
            metodo_pago = ?
          WHERE id = ?
        `).run(
          calculatedExpiration,
          nuevoEstadoPago,
          nuevoSaldo,
          renewalDate,
          finalDisciplina,
          finalMonto,
          metodo,
          id
        );

        db.prepare(`
          INSERT INTO payments (
            id, member_id, fecha, monto, metodo, periodo_inicio, periodo_fin, detalles, notas, creado_en
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          'pay-' + Date.now().toString(36),
          id,
          renewalDate,
          finalMonto,
          metodo,
          baseDate,
          calculatedExpiration,
          detalles ? JSON.stringify(detalles) : null,
          notas || (nuevoSaldo > 0 ? `Pago parcial (Saldo pendiente: $${nuevoSaldo})` : 'Renovación de membresía'),
          nowIso
        );
      }
    });

    renewTx();

    const updated = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
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

    const token = String(rawToken).trim();

    // Match by QR code, DNI, or ID
    const member = db.prepare(`
      SELECT * FROM members
      WHERE UPPER(codigo_qr) = UPPER(?)
         OR dni = ?
         OR id = ?
      LIMIT 1
    `).get(token, token, token);

    if (!member) {
      return res.status(404).json({
        authorized: false,
        autorizado: false,
        error: 'Miembro no encontrado en el sistema',
      });
    }

    const daysRemaining = getDaysRemaining(member.fecha_vencimiento);
    const isMembershipExpired = daysRemaining < 0;
    const isPaymentValid = member.estado_pago === 'pagado' || member.estado_pago === 'parcial';
    const isAuthorized = !isMembershipExpired && isPaymentValid;

    let motivo = '';
    if (isAuthorized) {
      motivo = member.estado_pago === 'parcial'
        ? `Acceso Válido (Saldo pendiente: $${(member.saldo_pendiente || 0).toLocaleString('es-AR')})`
        : 'Acceso Válido - Al Día';
    } else {
      if (isMembershipExpired) {
        motivo = `Denegado - Membresía vencida hace ${Math.abs(daysRemaining)} días`;
      } else {
        motivo = 'Denegado - Estado de pago irregular o impago';
      }
    }

    const nowIso = new Date().toISOString();
    const logId = 'acc-' + Date.now().toString(36);

    db.prepare(`
      INSERT INTO access_logs (
        id, member_id, dni, member_name, disciplina, timestamp, autorizado, motivo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId,
      member.id,
      member.dni,
      `${member.nombre} ${member.apellido}`,
      member.disciplina,
      nowIso,
      isAuthorized ? 1 : 0,
      motivo
    );

    const accessLog = {
      id: logId,
      member_id: member.id,
      dni: member.dni,
      member_name: `${member.nombre} ${member.apellido}`,
      disciplina: member.disciplina,
      timestamp: nowIso,
      autorizado: isAuthorized,
      motivo,
    };

    res.json({
      authorized: isAuthorized,
      autorizado: isAuthorized,
      member,
      daysRemaining,
      motivo,
      access_log: accessLog,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// Access Logs & Payment Logs Queries
// ----------------------------------------------------
app.get('/api/access-logs', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM access_logs ORDER BY timestamp DESC LIMIT 100').all();
    const formatted = rows.map((r) => ({
      ...r,
      autorizado: Boolean(r.autorizado),
    }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/access-logs', (req, res) => {
  try {
    const { member_id, dni, member_name, disciplina, autorizado, motivo } = req.body;
    const id = 'acc-' + Date.now().toString(36);
    const timestamp = new Date().toISOString();

    db.prepare(`
      INSERT INTO access_logs (id, member_id, dni, member_name, disciplina, timestamp, autorizado, motivo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      member_id || null,
      dni,
      member_name,
      disciplina,
      timestamp,
      autorizado ? 1 : 0,
      motivo || ''
    );

    res.status(201).json({ id, member_id, dni, member_name, disciplina, timestamp, autorizado: Boolean(autorizado), motivo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/payments', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM payments ORDER BY fecha DESC, creado_en DESC LIMIT 100').all();
    const formatted = rows.map((r) => {
      let detalles = undefined;
      if (r.detalles) {
        try {
          detalles = JSON.parse(r.detalles);
        } catch {
          detalles = undefined;
        }
      }
      return { ...r, detalles };
    });
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payments', (req, res) => {
  try {
    const { member_id, fecha, monto, metodo, periodo_inicio, periodo_fin, detalles, notas } = req.body;
    const id = 'pay-' + Date.now().toString(36);
    const nowIso = new Date().toISOString();

    db.prepare(`
      INSERT INTO payments (id, member_id, fecha, monto, metodo, periodo_inicio, periodo_fin, detalles, notas, creado_en)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      member_id,
      fecha || formatDateISO(new Date()),
      Number(monto) || 0,
      metodo || 'Efectivo',
      periodo_inicio || null,
      periodo_fin || null,
      detalles ? JSON.stringify(detalles) : null,
      notas || null,
      nowIso
    );

    res.status(201).json({ id, member_id, fecha, monto, metodo, periodo_inicio, periodo_fin, detalles, notas, creado_en: nowIso });
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
          <p style="color: #aaa;">Backend API & SQLite are running.</p>
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
      console.log(`  💾  Base de datos SQLite:    ${dbPath}`);
      console.log(`  🔒  Certificados SSL:        ${certsDir}`);
      console.log(`  📁  Archivos web:            ${fs.existsSync(indexHtmlPath) ? `Sirviendo dist/` : 'dist/ no encontrado (ejecutá npm run build)'}`);
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

// Automatically start when executed directly via Node CLI or packaged binary
const isDirectRun = process.argv[1] && (
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
  (isPkg && !process.versions?.electron)
);

if (isDirectRun) {
  startServer().catch((err) => {
    console.error('❌ Error fatal al iniciar el servidor:', err);
    process.exit(1);
  });
}

export { app };
export default app;
