import { Member, AccessLog, PaymentLog, Discipline, DisciplineItem, PaymentMethod, RenewMemberOptions } from '../types';
import { calculateNextExpiration, formatDateISO } from './dateUtils';
import { getSupabase } from './supabase';

const STORAGE_KEY_MEMBERS = 'ringo_gym_members';
const STORAGE_KEY_ACCESS = 'ringo_gym_access_logs';
const STORAGE_KEY_PAYMENTS = 'ringo_gym_payments';
const STORAGE_KEY_DISCIPLINES = 'ringo_gym_disciplines';

export const DEFAULT_DISCIPLINES: DisciplineItem[] = [
  { id: 'disc-1', nombre: 'Musculación', precio: 28000 },
  { id: 'disc-2', nombre: 'Crossfit', precio: 32000 },
  { id: 'disc-3', nombre: 'Funcional', precio: 26000 },
  { id: 'disc-4', nombre: 'Boxeo', precio: 30000 },
  { id: 'disc-5', nombre: 'Spinning', precio: 27000 },
  { id: 'disc-6', nombre: 'Pilates', precio: 29000 },
  { id: 'disc-7', nombre: 'Calistenia', precio: 25000 },
  { id: 'disc-8', nombre: 'Pase Libre', precio: 45000 },
];

export async function fetchDisciplines(): Promise<DisciplineItem[]> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('disciplinas').select('*').order('nombre');
      if (!error && data && data.length > 0) {
        localStorage.setItem(STORAGE_KEY_DISCIPLINES, JSON.stringify(data));
        return data as DisciplineItem[];
      }
    } catch (e) {
      console.warn('Could not fetch disciplines from Supabase', e);
    }
  }

  const stored = localStorage.getItem(STORAGE_KEY_DISCIPLINES);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as DisciplineItem[];
      }
    } catch (e) {
      console.error('Error parsing stored disciplines', e);
    }
  }

  localStorage.setItem(STORAGE_KEY_DISCIPLINES, JSON.stringify(DEFAULT_DISCIPLINES));
  return DEFAULT_DISCIPLINES;
}

export async function saveDiscipline(item: Omit<DisciplineItem, 'id'> & { id?: string }): Promise<DisciplineItem> {
  const current = await fetchDisciplines();
  let savedItem: DisciplineItem;

  if (item.id) {
    savedItem = { id: item.id, nombre: item.nombre.trim(), precio: Number(item.precio) };
    const index = current.findIndex(d => d.id === item.id);
    if (index !== -1) {
      current[index] = savedItem;
    } else {
      current.push(savedItem);
    }
  } else {
    savedItem = {
      id: 'disc-' + Date.now().toString(36),
      nombre: item.nombre.trim(),
      precio: Number(item.precio),
    };
    current.push(savedItem);
  }

  localStorage.setItem(STORAGE_KEY_DISCIPLINES, JSON.stringify(current));

  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.from('disciplinas').upsert([savedItem]);
    } catch (e) {
      console.warn('Could not save discipline to Supabase', e);
    }
  }

  return savedItem;
}

export async function deleteDiscipline(id: string): Promise<boolean> {
  const current = await fetchDisciplines();
  const filtered = current.filter(d => d.id !== id);
  localStorage.setItem(STORAGE_KEY_DISCIPLINES, JSON.stringify(filtered));

  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.from('disciplinas').delete().eq('id', id);
    } catch (e) {
      console.warn('Could not delete discipline from Supabase', e);
    }
  }

  return true;
}

// Auto-purge legacy mock items from localStorage on initial load
try {
  const stored = localStorage.getItem(STORAGE_KEY_MEMBERS);
  if (stored) {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      const filtered = parsed.filter((m: any) => !['mem-1', 'mem-2', 'mem-3', 'mem-4', 'mem-5'].includes(m.id));
      if (filtered.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(filtered));
      }
    }
  }
} catch {
  // Ignore
}

export function getLocalMembers(): Member[] {
  const stored = localStorage.getItem(STORAGE_KEY_MEMBERS);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed)
        ? parsed.filter((m: Member) => !['mem-1', 'mem-2', 'mem-3', 'mem-4', 'mem-5'].includes(m.id))
        : [];
    } catch (e) {
      console.error('Error parsing stored members', e);
    }
  }
  return [];
}

export async function fetchMembers(): Promise<Member[]> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('miembros').select('*').order('creado_en', { ascending: false });
      if (!error && data) {
        const localOnly = getLocalMembers().filter(m => !data.some(d => d.id === m.id || d.dni === m.dni));
        const combined = [...data, ...localOnly];
        localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(combined));
        return combined as Member[];
      }
    } catch (err) {
      console.warn('Supabase fetch failed, falling back to local storage', err);
    }
  }

  return getLocalMembers();
}

export function saveLocalMembers(members: Member[]) {
  localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(members));
}

export async function createMember(memberData: Omit<Member, 'id' | 'codigo_qr' | 'creado_en' | 'fecha_vencimiento'> & { fecha_vencimiento?: string }): Promise<Member> {
  const id = 'mem-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const now = new Date();
  
  // Calculate expiration date automatically if not explicitly given
  const calculatedVencimiento = memberData.fecha_vencimiento || calculateNextExpiration(memberData.fecha_ingreso);
  const qrCode = `RINGO-${memberData.dni.trim()}-${Date.now().toString(36).toUpperCase()}`;
  const isPagado = memberData.estado_pago === 'pagado';

  const newMember: Member = {
    ...memberData,
    id,
    fecha_vencimiento: calculatedVencimiento,
    codigo_qr: qrCode,
    creado_en: now.toISOString(),
    ultimo_pago_fecha: isPagado ? memberData.fecha_ingreso : undefined,
  };

  // 1. Save to Supabase
  // CRITICAL: Strip 'metodo_pago' because it belongs to the 'pagos' table, not 'miembros' table
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { metodo_pago, ...dbMember } = newMember;
      const { error } = await supabase.from('miembros').insert([dbMember]);
      if (error) {
        console.error('Error saving member to Supabase:', error);
      }
    } catch (err) {
      console.warn('Error saving member to Supabase:', err);
    }
  }

  // 2. Save local
  const current = getLocalMembers();
  const updated = [newMember, ...current.filter(m => m.id !== id)];
  saveLocalMembers(updated);

  // 3. If paid upon registration, register initial payment log automatically
  if (isPagado) {
    await logPayment({
      member_id: id,
      fecha: newMember.fecha_ingreso,
      monto: Number(newMember.monto_mensual),
      metodo: (memberData.metodo_pago as PaymentMethod) || 'Efectivo',
      periodo_inicio: newMember.fecha_ingreso,
      periodo_fin: calculatedVencimiento,
    });
  }

  return newMember;
}

export async function updateMember(
  id: string, 
  updates: Partial<Member>,
  options?: { skipPaymentLog?: boolean }
): Promise<Member | null> {
  const current = await fetchMembers();
  const index = current.findIndex(m => m.id === id);
  if (index === -1) return null;

  const previousMember = current[index];

  // Recalculate expiration if join date changed
  let updatedData = { ...current[index], ...updates };
  if (updates.fecha_ingreso && !updates.fecha_vencimiento) {
    updatedData.fecha_vencimiento = calculateNextExpiration(updates.fecha_ingreso);
  }

  const becamePagado = updates.estado_pago === 'pagado' && previousMember.estado_pago !== 'pagado';
  if (becamePagado && !updates.ultimo_pago_fecha) {
    updatedData.ultimo_pago_fecha = formatDateISO(new Date());
  }

  current[index] = updatedData;
  saveLocalMembers(current);

  const supabase = getSupabase();
  if (supabase) {
    try {
      // Strip 'metodo_pago' from updates sent to 'miembros' table
      const { metodo_pago, ...dbUpdates } = updates;
      if (Object.keys(dbUpdates).length > 0) {
        const { error } = await supabase.from('miembros').update(dbUpdates).eq('id', id);
        if (error) {
          console.error('Error updating member in Supabase:', error);
        }
      }
    } catch (err) {
      console.warn('Error updating member in Supabase:', err);
    }
  }

  // If status changed to 'pagado' and not explicitly skipped (e.g. during renewMemberMembership)
  if (becamePagado && !options?.skipPaymentLog) {
    const today = formatDateISO(new Date());
    await logPayment({
      member_id: id,
      fecha: today,
      monto: Number(updatedData.monto_mensual) || 28000,
      metodo: (updates.metodo_pago as PaymentMethod) || 'Efectivo',
      periodo_inicio: today,
      periodo_fin: updatedData.fecha_vencimiento,
    });
  }

  return updatedData;
}

export async function deleteMember(id: string): Promise<boolean> {
  const current = await fetchMembers();
  const filtered = current.filter(m => m.id !== id);
  saveLocalMembers(filtered);

  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.from('miembros').delete().eq('id', id);
    } catch (err) {
      console.warn('Error deleting member in Supabase:', err);
    }
  }

  return true;
}

export async function renewMemberMembership(
  memberId: string,
  options?: RenewMemberOptions
): Promise<Member | null>;
export async function renewMemberMembership(
  memberId: string,
  monto?: number,
  legacyMetodo?: PaymentMethod
): Promise<Member | null>;
export async function renewMemberMembership(
  memberId: string, 
  optionsOrMonto?: RenewMemberOptions | number, 
  legacyMetodo: PaymentMethod = 'Efectivo'
): Promise<Member | null> {
  let monto: number | undefined;
  let metodo: PaymentMethod = legacyMetodo;
  let disciplina: string | undefined;
  let fechaRenovacion: string | undefined;
  let fechaVencimiento: string | undefined;

  if (typeof optionsOrMonto === 'number') {
    monto = optionsOrMonto;
    metodo = legacyMetodo;
  } else if (typeof optionsOrMonto === 'object' && optionsOrMonto !== null) {
    monto = optionsOrMonto.monto;
    metodo = optionsOrMonto.metodo || 'Efectivo';
    disciplina = optionsOrMonto.disciplina;
    fechaRenovacion = optionsOrMonto.fechaRenovacion;
    fechaVencimiento = optionsOrMonto.fechaVencimiento;
  }

  const current = await fetchMembers();
  const member = current.find(m => m.id === memberId);
  if (!member) return null;

  const today = formatDateISO(new Date());
  const renewalDate = fechaRenovacion || today;

  // New expiration date based on current expiration (or renewal date if expired)
  const baseDate = member.fecha_vencimiento && member.fecha_vencimiento >= renewalDate
    ? member.fecha_vencimiento
    : renewalDate;

  const newExpiration = fechaVencimiento || calculateNextExpiration(baseDate);

  const updates: Partial<Member> = {
    fecha_vencimiento: newExpiration,
    estado_membresia: 'activo',
    estado_pago: 'pagado',
    ultimo_pago_fecha: renewalDate,
  };

  if (disciplina) {
    updates.disciplina = disciplina;
  }
  if (monto !== undefined) {
    updates.monto_mensual = monto;
  }
  if (metodo) {
    updates.metodo_pago = metodo;
  }

  const updated = await updateMember(
    memberId,
    updates,
    { skipPaymentLog: true }
  );

  // Log payment
  await logPayment({
    member_id: memberId,
    fecha: renewalDate,
    monto: monto !== undefined ? monto : (member.monto_mensual || 28000),
    metodo,
    periodo_inicio: baseDate,
    periodo_fin: newExpiration,
  });

  return updated;
}


// Access Logs
export async function logAccess(log: Omit<AccessLog, 'id' | 'timestamp'>): Promise<AccessLog> {
  const newLog: AccessLog = {
    ...log,
    id: 'acc-' + Date.now().toString(36),
    timestamp: new Date().toISOString()
  };

  const currentLogs = getAccessLogs();
  const updatedLogs = [newLog, ...currentLogs.slice(0, 100)];
  localStorage.setItem(STORAGE_KEY_ACCESS, JSON.stringify(updatedLogs));

  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.from('accesos').insert([{
        member_id: newLog.member_id,
        dni: newLog.dni,
        member_name: newLog.member_name,
        disciplina: newLog.disciplina,
        autorizado: newLog.autorizado,
        motivo: newLog.motivo || ''
      }]);
    } catch (e) {
      console.warn('Could not save access log to Supabase', e);
    }
  }

  return newLog;
}

export function getAccessLogs(): AccessLog[] {
  const raw = localStorage.getItem(STORAGE_KEY_ACCESS);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function fetchAccessLogs(): Promise<AccessLog[]> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('accesos')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);
      if (!error && data) {
        localStorage.setItem(STORAGE_KEY_ACCESS, JSON.stringify(data));
        return data as AccessLog[];
      }
    } catch (e) {
      console.warn('Could not fetch access logs from Supabase', e);
    }
  }
  return getAccessLogs();
}

// Payments
export async function logPayment(payment: Omit<PaymentLog, 'id'>): Promise<PaymentLog> {
  let newPayment: PaymentLog = {
    ...payment,
    id: 'pay-' + Date.now().toString(36)
  };

  const stored = getPaymentLogs();
  const updated = [newPayment, ...stored.filter(p => p.id !== newPayment.id)];
  localStorage.setItem(STORAGE_KEY_PAYMENTS, JSON.stringify(updated));

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('pagos').insert([{
        member_id: newPayment.member_id,
        fecha: newPayment.fecha,
        monto: Number(newPayment.monto),
        metodo: newPayment.metodo,
        periodo_inicio: newPayment.periodo_inicio,
        periodo_fin: newPayment.periodo_fin
      }]).select().single();

      if (error) {
        console.error('Could not save payment to Supabase:', error);
      } else if (data) {
        newPayment = data as PaymentLog;
        const currentStored = getPaymentLogs();
        const replaced = currentStored.map(p =>
          (p.id.startsWith('pay-') && p.member_id === data.member_id && p.fecha === data.fecha)
            ? (data as PaymentLog)
            : p
        );
        localStorage.setItem(STORAGE_KEY_PAYMENTS, JSON.stringify(replaced));
      }
    } catch (e) {
      console.warn('Could not save payment to Supabase', e);
    }
  }

  return newPayment;
}

export function getPaymentLogs(): PaymentLog[] {
  const raw = localStorage.getItem(STORAGE_KEY_PAYMENTS);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function fetchPaymentLogs(): Promise<PaymentLog[]> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('pagos')
        .select('*')
        .order('creado_en', { ascending: false })
        .limit(100);
      if (!error && data) {
        const localOnly = getPaymentLogs().filter(
          p => p.id.startsWith('pay-') && !data.some(d => d.member_id === p.member_id && d.fecha === p.fecha)
        );
        const combined = [...data, ...localOnly];
        localStorage.setItem(STORAGE_KEY_PAYMENTS, JSON.stringify(combined));
        return combined as PaymentLog[];
      }
    } catch (e) {
      console.warn('Could not fetch payment logs from Supabase', e);
    }
  }
  return getPaymentLogs();
}
