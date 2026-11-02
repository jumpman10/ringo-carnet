import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const currentFilename = fileURLToPath(import.meta.url);
const currentDirname = path.dirname(currentFilename);

const dataDir = process.env.RINGO_DATA_DIR || path.join(currentDirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const dbPath = path.join(dataDir, 'gimnasio.json');
export const DATA_DIR = dataDir;
export const DB_PATH = dbPath;

const DEFAULT_DISCIPLINES = [
  { id: 'disc-1', nombre: 'Boxeo Recreativo', precio: 30000 },
  { id: 'disc-2', nombre: 'Boxeo Competitivo', precio: 35000 },
  { id: 'disc-3', nombre: 'Funcional', precio: 26000 },
  { id: 'disc-4', nombre: 'Musculación', precio: 28000 },
  { id: 'disc-5', nombre: 'Pase Libre', precio: 45000 },
];

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

  // Specific rule: Jan 29, 30, 31 closes on March 1st
  if (currentMonthIdx === 0 && day >= 29) {
    const nextDate = new Date(y, 2, 1); // March 1st (month index 2)
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

export function getTargetDecemberYear(referenceDate = new Date()) {
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth(); // 0 = Jan, 11 = Dec
  return currentMonth === 11 ? currentYear : currentYear - 1;
}

export function isDateInDecemberOfYear(dateStr, targetYear) {
  if (!dateStr || !targetYear) return false;
  const str = String(dateStr).trim();
  const targetPrefix = `${targetYear}-12`;
  if (str.startsWith(targetPrefix)) {
    return true;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.getFullYear() === Number(targetYear) && d.getMonth() === 11;
  }
  return false;
}

export function shouldKeepMemberInPurge(member, targetYear, payments = []) {
  if (!member) return false;

  // 1. Ingresó en diciembre como nuevo
  if (isDateInDecemberOfYear(member.fecha_ingreso, targetYear)) {
    return true;
  }

  // 2. Registro de socio creado en diciembre
  if (isDateInDecemberOfYear(member.creado_en, targetYear)) {
    return true;
  }

  // 3. Actividad de pago registrada en diciembre (último pago)
  if (isDateInDecemberOfYear(member.ultimo_pago_fecha, targetYear)) {
    return true;
  }

  // 4. Actividad de pago en diciembre registrada en historial de pagos
  if (Array.isArray(payments) && payments.length > 0) {
    const hasPaymentInDec = payments.some(
      (p) =>
        p.member_id === member.id &&
        (isDateInDecemberOfYear(p.fecha, targetYear) || isDateInDecemberOfYear(p.creado_en, targetYear))
    );
    if (hasPaymentInDec) {
      return true;
    }
  }

  return false;
}

function readData() {
  try {
    if (!fs.existsSync(dbPath)) {
      const initialData = {
        members: [],
        disciplines: DEFAULT_DISCIPLINES,
        access_logs: [],
        payments: [],
      };
      writeData(initialData);
      return initialData;
    }

    const raw = fs.readFileSync(dbPath, 'utf8');
    const parsed = JSON.parse(raw);
    let mutated = false;

    if (!Array.isArray(parsed.members)) {
      parsed.members = [];
      mutated = true;
    } else {
      parsed.members.forEach((m) => {
        if (!m.id) {
          m.id = 'mem-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
          mutated = true;
        }
        if (!m.codigo_qr) {
          const cleanDni = m.dni ? String(m.dni).trim() : String(m.id);
          m.codigo_qr = `RINGO-${cleanDni}-${String(m.id).toUpperCase()}`;
          mutated = true;
        }
        if (!m.fecha_ingreso && (m.fecha_inicio || m.start_date)) {
          m.fecha_ingreso = m.fecha_inicio || m.start_date;
          mutated = true;
        }
        if (!m.fecha_vencimiento && (m.end_date || m.fecha_fin)) {
          m.fecha_vencimiento = m.end_date || m.fecha_fin;
          mutated = true;
        }
        if (!m.estado_membresia) {
          m.estado_membresia = m.estado || m.status || 'activo';
          mutated = true;
        }
        if (!m.estado_pago) {
          m.estado_pago = m.estado === 'activo' || m.status === 'active' ? 'pagado' : 'pendiente';
          mutated = true;
        }
        if (m.monto_mensual === undefined && m.precio !== undefined) {
          m.monto_mensual = Number(m.precio) || 0;
          mutated = true;
        }
        if (!m.creado_en) {
          m.creado_en = m.created_at || new Date().toISOString();
          mutated = true;
        }
      });
    }
    if (!Array.isArray(parsed.disciplines) || parsed.disciplines.length === 0) {
      parsed.disciplines = DEFAULT_DISCIPLINES;
      mutated = true;
    }
    if (!Array.isArray(parsed.access_logs)) {
      parsed.access_logs = [];
      mutated = true;
    }
    if (!Array.isArray(parsed.payments)) {
      parsed.payments = [];
      mutated = true;
    }

    if (mutated) {
      writeData(parsed);
    }

    return parsed;
  } catch (error) {
    console.error('Error reading JSON database, resetting defaults:', error);
    const fallback = {
      members: [],
      disciplines: DEFAULT_DISCIPLINES,
      access_logs: [],
      payments: [],
    };
    try {
      writeData(fallback);
    } catch {
      // ignore fallback write error
    }
    return fallback;
  }
}

function writeData(data) {
  const serialized = JSON.stringify(data, null, 2);
  const tempPath = `${dbPath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(tempPath, serialized, 'utf8');
  fs.renameSync(tempPath, dbPath);
}

export function initDatabase() {
  readData();
}

export const dbService = {
  // ----------------------------------------------------
  // Disciplines
  // ----------------------------------------------------
  getDisciplines() {
    const data = readData();
    return [...data.disciplines].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
    );
  },

  createDiscipline({ id, nombre, precio }) {
    if (!nombre || !String(nombre).trim()) {
      throw new Error('Discipline name is required');
    }
    const cleanName = String(nombre).trim();
    const data = readData();

    const duplicate = data.disciplines.find(
      (d) => d.nombre.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate && duplicate.id !== id) {
      throw new Error('UNIQUE constraint failed: disciplines.nombre');
    }

    const disciplineId = id || 'disc-' + Date.now().toString(36);
    const numPrice = Number(precio) || 0;

    const existingIndex = data.disciplines.findIndex((d) => d.id === disciplineId);
    const newDiscipline = {
      id: disciplineId,
      nombre: cleanName,
      precio: numPrice,
    };

    if (existingIndex !== -1) {
      data.disciplines[existingIndex] = newDiscipline;
    } else {
      data.disciplines.push(newDiscipline);
    }

    writeData(data);
    return newDiscipline;
  },

  updateDiscipline(id, { nombre, precio }) {
    const data = readData();
    const index = data.disciplines.findIndex((d) => d.id === id);
    if (index === -1) {
      return null;
    }

    const existing = data.disciplines[index];
    let newName = existing.nombre;
    if (nombre !== undefined) {
      const cleanName = String(nombre).trim();
      const duplicate = data.disciplines.find(
        (d) => d.id !== id && d.nombre.trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (duplicate) {
        throw new Error('UNIQUE constraint failed: disciplines.nombre');
      }
      newName = cleanName;
    }

    const newPrice = precio !== undefined ? Number(precio) : existing.precio;
    const updated = {
      ...existing,
      nombre: newName,
      precio: newPrice,
    };

    data.disciplines[index] = updated;
    writeData(data);
    return updated;
  },

  deleteDiscipline(id) {
    const data = readData();
    const initialLength = data.disciplines.length;
    data.disciplines = data.disciplines.filter((d) => d.id !== id);
    if (data.disciplines.length === initialLength) {
      return false;
    }
    writeData(data);
    return true;
  },

  // ----------------------------------------------------
  // Members
  // ----------------------------------------------------
  getMembers() {
    const data = readData();
    return [...data.members].sort((a, b) => {
      const dateA = a.creado_en || '';
      const dateB = b.creado_en || '';
      return dateB.localeCompare(dateA);
    });
  },

  getMemberById(id) {
    const data = readData();
    return data.members.find((m) => m.id === id) || null;
  },

  getMemberByDni(dni) {
    if (!dni) return null;
    const cleanDni = String(dni).trim();
    const data = readData();
    return data.members.find((m) => String(m.dni).trim() === cleanDni) || null;
  },

  createMember(payload) {
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
      detalles,
      notas = '',
      codigo_qr,
      id,
    } = payload;

    if (!dni || !nombre || !apellido || !disciplina || !fecha_ingreso) {
      throw new Error('Required fields: dni, nombre, apellido, disciplina, fecha_ingreso');
    }

    const cleanDni = String(dni).trim();
    const data = readData();

    if (data.members.some((m) => String(m.dni).trim() === cleanDni)) {
      throw new Error(`UNIQUE constraint failed: members.dni`);
    }

    const memberId = id || 'mem-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const calculatedVencimiento = fecha_vencimiento || calculateNextExpiration(fecha_ingreso);
    const qrCode = codigo_qr || `RINGO-${cleanDni}-${Date.now().toString(36).toUpperCase()}`;
    const nowIso = new Date().toISOString();
    const isPaid = estado_pago === 'pagado';
    const baseMonto = Number(monto_mensual) || 0;
    const finalSaldo = Math.min(Number(saldo_pendiente) || 0, baseMonto > 0 ? baseMonto : Infinity);
    const hasInitialPayment = isPaid || (estado_pago === 'parcial' && (baseMonto - finalSaldo) > 0);
    const lastPaymentDate = hasInitialPayment ? fecha_ingreso : null;

    const newMember = {
      id: memberId,
      dni: cleanDni,
      nombre: String(nombre).trim(),
      apellido: String(apellido).trim(),
      fecha_nacimiento: fecha_nacimiento || null,
      foto_url: foto_url || '',
      disciplina: String(disciplina).trim(),
      telefono: telefono || '',
      fecha_ingreso,
      fecha_vencimiento: calculatedVencimiento,
      estado_membresia,
      estado_pago,
      monto_mensual: baseMonto,
      saldo_pendiente: finalSaldo,
      metodo_pago: metodo_pago || null,
      ultimo_pago_fecha: lastPaymentDate,
      creado_en: nowIso,
      notas: notas || '',
      codigo_qr: qrCode,
    };

    data.members.push(newMember);

    if (isPaid) {
      data.payments.push({
        id: 'pay-' + Date.now().toString(36),
        member_id: memberId,
        fecha: fecha_ingreso,
        monto: Number(monto_mensual) || 0,
        metodo: metodo_pago || 'Efectivo',
        periodo_inicio: fecha_ingreso,
        periodo_fin: calculatedVencimiento,
        detalles: detalles || null,
        notas: notas || 'Alta inicial de miembro',
        creado_en: nowIso,
      });
    } else if (estado_pago === 'parcial') {
      const abonado = Math.max(0, baseMonto - finalSaldo);
      if (abonado > 0) {
        data.payments.push({
          id: 'pay-' + Date.now().toString(36),
          member_id: memberId,
          fecha: fecha_ingreso,
          monto: abonado,
          metodo: metodo_pago || 'Efectivo',
          periodo_inicio: fecha_ingreso,
          periodo_fin: calculatedVencimiento,
          detalles: detalles || null,
          notas: notas || `Pago parcial inicial (Saldo pendiente: $${finalSaldo})`,
          creado_en: nowIso,
        });
      }
    }

    writeData(data);
    return newMember;
  },

  updateMember(id, updates) {
    const data = readData();
    const index = data.members.findIndex((m) => m.id === id);
    if (index === -1) {
      return null;
    }

    const current = data.members[index];

    if (updates.dni !== undefined) {
      const cleanDni = String(updates.dni).trim();
      const duplicate = data.members.find((m) => m.id !== id && String(m.dni).trim() === cleanDni);
      if (duplicate) {
        throw new Error('UNIQUE constraint failed: members.dni');
      }
    }

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

    const baseMonto = updates.monto_mensual !== undefined ? Number(updates.monto_mensual) : (current.monto_mensual || 0);
    let finalSaldo = updates.saldo_pendiente !== undefined ? Number(updates.saldo_pendiente) : (current.saldo_pendiente || 0);
    if (baseMonto > 0 && finalSaldo > baseMonto) {
      finalSaldo = baseMonto;
    }

    const merged = {
      ...current,
      dni: updates.dni !== undefined ? String(updates.dni).trim() : current.dni,
      nombre: updates.nombre !== undefined ? String(updates.nombre).trim() : current.nombre,
      apellido: updates.apellido !== undefined ? String(updates.apellido).trim() : current.apellido,
      fecha_nacimiento: updates.fecha_nacimiento !== undefined ? updates.fecha_nacimiento : current.fecha_nacimiento,
      foto_url: updates.foto_url !== undefined ? updates.foto_url : current.foto_url,
      disciplina: updates.disciplina !== undefined ? String(updates.disciplina).trim() : current.disciplina,
      telefono: updates.telefono !== undefined ? updates.telefono : current.telefono,
      fecha_ingreso: updates.fecha_ingreso !== undefined ? updates.fecha_ingreso : current.fecha_ingreso,
      fecha_vencimiento: fechaVencimiento,
      estado_membresia: updates.estado_membresia !== undefined ? updates.estado_membresia : current.estado_membresia,
      estado_pago: updates.estado_pago !== undefined ? updates.estado_pago : current.estado_pago,
      monto_mensual: baseMonto,
      saldo_pendiente: finalSaldo,
      metodo_pago: updates.metodo_pago !== undefined ? updates.metodo_pago : current.metodo_pago,
      ultimo_pago_fecha: ultimoPagoFecha,
      notas: updates.notas !== undefined ? updates.notas : current.notas,
      codigo_qr: updates.codigo_qr !== undefined ? updates.codigo_qr : current.codigo_qr,
    };

    data.members[index] = merged;

    if (becamePaid && !updates.skipPaymentLog) {
      data.payments.push({
        id: 'pay-' + Date.now().toString(36),
        member_id: id,
        fecha: today,
        monto: Number(merged.monto_mensual) || 28000,
        metodo: merged.metodo_pago || 'Efectivo',
        periodo_inicio: today,
        periodo_fin: merged.fecha_vencimiento,
        detalles: updates.detalles || null,
        notas: 'Actualización de estado a pagado',
        creado_en: new Date().toISOString(),
      });
    }

    writeData(data);
    return merged;
  },

  deleteMember(id) {
    const data = readData();
    const initialLength = data.members.length;
    data.members = data.members.filter((m) => m.id !== id);
    if (data.members.length === initialLength) {
      return false;
    }

    data.access_logs = data.access_logs.filter((a) => a.member_id !== id);
    data.payments = data.payments.filter((p) => p.member_id !== id);

    writeData(data);
    return true;
  },

  previewPurgeMembersExceptDecember(year) {
    const targetYear = Number(year) || getTargetDecemberYear();
    const data = readData();

    const kept = [];
    const deleted = [];

    for (const member of data.members) {
      if (shouldKeepMemberInPurge(member, targetYear, data.payments)) {
        kept.push(member);
      } else {
        deleted.push(member);
      }
    }

    return {
      targetYear,
      totalCount: data.members.length,
      keptCount: kept.length,
      deletedCount: deleted.length,
      deletedMembers: deleted.map((m) => ({
        id: m.id,
        nombre: m.nombre,
        apellido: m.apellido,
        dni: m.dni,
        disciplina: m.disciplina,
        fecha_ingreso: m.fecha_ingreso,
        ultimo_pago_fecha: m.ultimo_pago_fecha,
      })),
    };
  },

  purgeMembersExceptDecember(year) {
    const targetYear = Number(year) || getTargetDecemberYear();
    const data = readData();

    // 1. Respaldo de seguridad automático previo a la depuración masiva
    try {
      const backupDir = path.join(dataDir, 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(
        backupDir,
        `gimnasio_pre_purge_${targetYear}_${timestamp}.json`
      );
      fs.writeFileSync(backupPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (backupErr) {
      console.warn('Advertencia: no se pudo crear el archivo de respaldo previo a la depuración:', backupErr);
    }

    const kept = [];
    const deleted = [];
    const deletedIds = new Set();

    for (const member of data.members) {
      if (shouldKeepMemberInPurge(member, targetYear, data.payments)) {
        kept.push(member);
      } else {
        deleted.push(member);
        deletedIds.add(member.id);
      }
    }

    // Filtrar socios
    data.members = kept;

    // Eliminar accesos y cobros vinculados a los socios eliminados para integridad referencial
    data.access_logs = data.access_logs.filter((a) => !deletedIds.has(a.member_id));
    data.payments = data.payments.filter((p) => !deletedIds.has(p.member_id));

    writeData(data);

    return {
      success: true,
      targetYear,
      keptCount: kept.length,
      deletedCount: deleted.length,
      deletedIds: Array.from(deletedIds),
    };
  },

  renewMember(id, renewalData) {
    const data = readData();
    const index = data.members.findIndex((m) => m.id === id);
    if (index === -1) {
      return null;
    }

    const member = data.members[index];
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
    } = renewalData;

    const today = formatDateISO(new Date());
    const renewalDate = fechaRenovacion || today;
    const nowIso = new Date().toISOString();

    if ((member.saldo_pendiente || 0) > 0 && !esPagoSaldo) {
      throw new Error('El socio tiene una deuda pendiente. Debe registrar el pago de la deuda antes de renovar.');
    }

    if (esPagoSaldo) {
      const deudaActual = member.saldo_pendiente || 0;
      const montoAbonar = Number(monto) || 0;
      if (montoAbonar > deudaActual) {
        throw new Error('El monto a pagar no puede ser mayor a la deuda pendiente.');
      }
      const nuevoSaldo = Math.max(0, deudaActual - montoAbonar);
      const nuevoEstadoPago = nuevoSaldo === 0 ? 'pagado' : 'parcial';

      member.saldo_pendiente = nuevoSaldo;
      member.estado_pago = nuevoEstadoPago;
      member.ultimo_pago_fecha = renewalDate;
      if (metodo) {
        member.metodo_pago = metodo;
      }

      data.payments.push({
        id: 'pay-' + Date.now().toString(36),
        member_id: id,
        fecha: renewalDate,
        monto: Number(monto) || 0,
        metodo,
        periodo_inicio: member.fecha_ingreso,
        periodo_fin: member.fecha_vencimiento,
        detalles: detalles || null,
        notas: notas || `Cancelación de saldo pendiente (Restante: $${nuevoSaldo})`,
        creado_en: nowIso,
      });
    } else {
      const baseDate =
        member.fecha_vencimiento && member.fecha_vencimiento >= renewalDate
          ? member.fecha_vencimiento
          : renewalDate;

      const calculatedExpiration = fechaVencimiento || calculateNextExpiration(baseDate);
      const nuevoSaldo = saldoPendiente !== undefined ? Math.max(0, Number(saldoPendiente)) : 0;
      const nuevoEstadoPago = nuevoSaldo > 0 ? 'parcial' : 'pagado';
      const finalMonto = monto !== undefined ? Number(monto) : (member.monto_mensual || 28000);
      const finalDisciplina = disciplina || member.disciplina;

      member.fecha_vencimiento = calculatedExpiration;
      member.estado_membresia = 'activo';
      member.estado_pago = nuevoEstadoPago;
      member.saldo_pendiente = nuevoSaldo;
      member.ultimo_pago_fecha = renewalDate;
      member.disciplina = finalDisciplina;
      member.monto_mensual = finalMonto;
      member.metodo_pago = metodo;

      data.payments.push({
        id: 'pay-' + Date.now().toString(36),
        member_id: id,
        fecha: renewalDate,
        monto: finalMonto,
        metodo,
        periodo_inicio: baseDate,
        periodo_fin: calculatedExpiration,
        detalles: detalles || null,
        notas:
          notas ||
          (nuevoSaldo > 0
            ? `Pago parcial (Saldo pendiente: $${nuevoSaldo})`
            : 'Renovación de membresía'),
        creado_en: nowIso,
      });
    }

    data.members[index] = member;
    writeData(data);
    return member;
  },

  // ----------------------------------------------------
  // Access Verification & Logs
  // ----------------------------------------------------
  verifyAccess(rawToken) {
    if (!rawToken) {
      throw new Error('Token, code, or DNI is required');
    }
    const token = String(rawToken).trim().toUpperCase();
    const data = readData();

    const member = data.members.find(
      (m) =>
        (m.codigo_qr && m.codigo_qr.trim().toUpperCase() === token) ||
        String(m.dni).trim().toUpperCase() === token ||
        m.id.toUpperCase() === token
    );

    if (!member) {
      return {
        authorized: false,
        autorizado: false,
        error: 'Miembro no encontrado en el sistema',
      };
    }

    const daysRemaining = getDaysRemaining(member.fecha_vencimiento);
    const isMembershipExpired = daysRemaining < 0;
    const isPaymentValid = member.estado_pago === 'pagado' || member.estado_pago === 'parcial';
    const isAuthorized = !isMembershipExpired && isPaymentValid;

    let motivo = '';
    if (isAuthorized) {
      motivo =
        member.estado_pago === 'parcial'
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

    data.access_logs.push({
      ...accessLog,
      autorizado: isAuthorized ? 1 : 0,
    });
    writeData(data);

    return {
      authorized: isAuthorized,
      autorizado: isAuthorized,
      member,
      daysRemaining,
      motivo,
      access_log: accessLog,
    };
  },

  getAccessLogs() {
    const data = readData();
    return [...data.access_logs]
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
      .slice(0, 100)
      .map((r) => ({
        ...r,
        autorizado: Boolean(r.autorizado),
      }));
  },

  createAccessLog({ member_id, dni, member_name, disciplina, autorizado, motivo }) {
    const data = readData();
    const id = 'acc-' + Date.now().toString(36);
    const timestamp = new Date().toISOString();

    const log = {
      id,
      member_id: member_id || null,
      dni: dni || '',
      member_name: member_name || '',
      disciplina: disciplina || '',
      timestamp,
      autorizado: autorizado ? 1 : 0,
      motivo: motivo || '',
    };

    data.access_logs.push(log);
    writeData(data);
    return { ...log, autorizado: Boolean(autorizado) };
  },

  // ----------------------------------------------------
  // Payments
  // ----------------------------------------------------
  getPayments() {
    const data = readData();
    return [...data.payments]
      .sort((a, b) => {
        const dateComp = (b.fecha || '').localeCompare(a.fecha || '');
        if (dateComp !== 0) return dateComp;
        return (b.creado_en || '').localeCompare(a.creado_en || '');
      })
      .slice(0, 100);
  },

  createPayment({ member_id, fecha, monto, metodo, periodo_inicio, periodo_fin, detalles, notas }) {
    const data = readData();
    const id = 'pay-' + Date.now().toString(36);
    const nowIso = new Date().toISOString();

    const payment = {
      id,
      member_id,
      fecha: fecha || formatDateISO(new Date()),
      monto: Number(monto) || 0,
      metodo: metodo || 'Efectivo',
      periodo_inicio: periodo_inicio || null,
      periodo_fin: periodo_fin || null,
      detalles: detalles || null,
      notas: notas || null,
      creado_en: nowIso,
    };

    data.payments.push(payment);
    writeData(data);
    return payment;
  },
};

// Compatibility shim for any legacy caller expecting db object
export const db = {
  pragma() {},
  transaction(fn) {
    return (...args) => fn(...args);
  },
  prepare() {
    return {
      run() { return { changes: 1 }; },
      get() { return null; },
      all() { return []; },
    };
  },
};

export default dbService;
