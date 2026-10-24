import {
  Member,
  AccessLog,
  PaymentLog,
  DisciplineItem,
  RenewMemberOptions,
  PaymentMethod,
} from '../types';
import { calculateNextExpiration, formatDateISO } from './dateUtils';

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

/**
 * Standard API fetch wrapper with user-friendly error translations
 */
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `/api${endpoint}`;

  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!res.ok) {
      let errorMessage = `Error del servidor (${res.status})`;
      try {
        const body = await res.json();
        if (body?.error) {
          errorMessage = body.error;
        }
      } catch {
        errorMessage = res.statusText || errorMessage;
      }

      // Friendly translations for common errors
      if (res.status === 409) {
        errorMessage = 'Ya existe un socio registrado con este DNI.';
      } else if (res.status === 404) {
        errorMessage = 'El registro solicitado no fue encontrado.';
      }

      throw new Error(errorMessage);
    }

    return (await res.json()) as T;
  } catch (err: any) {
    if (err.name === 'TypeError' && err.message?.toLowerCase().includes('fetch')) {
      throw new Error(
        'No se pudo conectar con el servidor local (/api). Verifica que esté corriendo con "npm run server".'
      );
    }
    throw err;
  }
}

// ---------------------------------------------------------------------
// Disciplines
// ---------------------------------------------------------------------
export async function fetchDisciplines(): Promise<DisciplineItem[]> {
  try {
    const data = await apiRequest<DisciplineItem[]>('/disciplines');
    if (Array.isArray(data) && data.length > 0) {
      localStorage.setItem(STORAGE_KEY_DISCIPLINES, JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.warn('API fetchDisciplines failed, falling back to local cache:', err);
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

export async function saveDiscipline(
  item: Omit<DisciplineItem, 'id'> & { id?: string }
): Promise<DisciplineItem> {
  const current = await fetchDisciplines();
  let savedItem: DisciplineItem;

  try {
    if (item.id) {
      savedItem = await apiRequest<DisciplineItem>(`/disciplines/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify(item),
      });
    } else {
      savedItem = await apiRequest<DisciplineItem>('/disciplines', {
        method: 'POST',
        body: JSON.stringify(item),
      });
    }
  } catch (err) {
    console.warn('Could not save discipline to local API, saving locally:', err);
    savedItem = {
      id: item.id || 'disc-' + Date.now().toString(36),
      nombre: item.nombre.trim(),
      precio: Number(item.precio),
    };
  }

  const index = current.findIndex((d) => d.id === savedItem.id);
  if (index !== -1) {
    current[index] = savedItem;
  } else {
    current.push(savedItem);
  }
  localStorage.setItem(STORAGE_KEY_DISCIPLINES, JSON.stringify(current));

  return savedItem;
}

export async function deleteDiscipline(id: string): Promise<boolean> {
  try {
    await apiRequest(`/disciplines/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('Could not delete discipline from local API:', err);
  }

  const current = await fetchDisciplines();
  const filtered = current.filter((d) => d.id !== id);
  localStorage.setItem(STORAGE_KEY_DISCIPLINES, JSON.stringify(filtered));
  return true;
}

// ---------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------
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

export function saveLocalMembers(members: Member[]) {
  localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(members));
}

export async function fetchMembers(): Promise<Member[]> {
  try {
    const data = await apiRequest<Member[]>('/members');
    if (Array.isArray(data)) {
      saveLocalMembers(data);
      return data;
    }
  } catch (err) {
    console.warn('API fetchMembers failed, falling back to local cache:', err);
  }

  return getLocalMembers();
}

export async function createMember(
  memberData: Omit<Member, 'id' | 'codigo_qr' | 'creado_en' | 'fecha_vencimiento'> & {
    fecha_vencimiento?: string;
  }
): Promise<Member> {
  let createdMember: Member;

  try {
    createdMember = await apiRequest<Member>('/members', {
      method: 'POST',
      body: JSON.stringify(memberData),
    });
  } catch (err) {
    // If backend rejects (e.g. duplicate DNI or connection error), propagate readable error
    throw err;
  }

  const current = getLocalMembers();
  const updated = [createdMember, ...current.filter((m) => m.id !== createdMember.id)];
  saveLocalMembers(updated);

  return createdMember;
}

export async function updateMember(
  id: string,
  updates: Partial<Member>,
  options?: { skipPaymentLog?: boolean }
): Promise<Member | null> {
  let updatedMember: Member;

  try {
    updatedMember = await apiRequest<Member>(`/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...updates, skipPaymentLog: options?.skipPaymentLog }),
    });
  } catch (err) {
    console.error('Error updating member on API:', err);
    throw err;
  }

  const current = getLocalMembers();
  const index = current.findIndex((m) => m.id === id);
  if (index !== -1) {
    current[index] = updatedMember;
    saveLocalMembers(current);
  }

  return updatedMember;
}

export async function deleteMember(id: string): Promise<boolean> {
  try {
    await apiRequest(`/members/${id}`, { method: 'DELETE' });
  } catch (err) {
    console.error('Error deleting member on API:', err);
    throw err;
  }

  const current = getLocalMembers();
  const filtered = current.filter((m) => m.id !== id);
  saveLocalMembers(filtered);
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
  let payload: RenewMemberOptions = {};

  if (typeof optionsOrMonto === 'number') {
    payload = {
      monto: optionsOrMonto,
      metodo: legacyMetodo,
    };
  } else if (typeof optionsOrMonto === 'object' && optionsOrMonto !== null) {
    payload = optionsOrMonto;
  }

  try {
    const updated = await apiRequest<Member>(`/members/${memberId}/renew`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const current = getLocalMembers();
    const index = current.findIndex((m) => m.id === memberId);
    if (index !== -1) {
      current[index] = updated;
      saveLocalMembers(current);
    }

    return updated;
  } catch (err) {
    console.error('Error renewing member membership on API:', err);
    throw err;
  }
}

// ---------------------------------------------------------------------
// Access Verification (QR Scanner) & Access Logs
// ---------------------------------------------------------------------
export async function verifyAccess(tokenOrDni: string): Promise<{
  authorized: boolean;
  autorizado: boolean;
  member?: Member;
  motivo?: string;
  daysRemaining?: number;
  access_log?: AccessLog;
}> {
  return await apiRequest('/verify-access', {
    method: 'POST',
    body: JSON.stringify({ qr_token: tokenOrDni }),
  });
}

export async function logAccess(
  log: Omit<AccessLog, 'id' | 'timestamp'>
): Promise<AccessLog> {
  const newLog: AccessLog = {
    ...log,
    id: 'acc-' + Date.now().toString(36),
    timestamp: new Date().toISOString(),
  };

  try {
    const apiLog = await apiRequest<AccessLog>('/access-logs', {
      method: 'POST',
      body: JSON.stringify(newLog),
    });
    if (apiLog) {
      const current = getAccessLogs();
      localStorage.setItem(STORAGE_KEY_ACCESS, JSON.stringify([apiLog, ...current.slice(0, 99)]));
      return apiLog;
    }
  } catch (err) {
    console.warn('Could not post access log to local API, logging locally:', err);
  }

  const current = getAccessLogs();
  const updated = [newLog, ...current.slice(0, 99)];
  localStorage.setItem(STORAGE_KEY_ACCESS, JSON.stringify(updated));
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
  try {
    const logs = await apiRequest<AccessLog[]>('/access-logs');
    if (Array.isArray(logs)) {
      localStorage.setItem(STORAGE_KEY_ACCESS, JSON.stringify(logs));
      return logs;
    }
  } catch (err) {
    console.warn('API fetchAccessLogs failed, falling back to local cache:', err);
  }

  return getAccessLogs();
}

// ---------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------
export async function logPayment(payment: Omit<PaymentLog, 'id'>): Promise<PaymentLog> {
  let createdPayment: PaymentLog;

  try {
    createdPayment = await apiRequest<PaymentLog>('/payments', {
      method: 'POST',
      body: JSON.stringify(payment),
    });
  } catch (err) {
    console.warn('Could not post payment to local API, saving locally:', err);
    createdPayment = {
      ...payment,
      id: 'pay-' + Date.now().toString(36),
    };
  }

  const stored = getPaymentLogs();
  const updated = [createdPayment, ...stored.filter((p) => p.id !== createdPayment.id)];
  localStorage.setItem(STORAGE_KEY_PAYMENTS, JSON.stringify(updated));

  return createdPayment;
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
  try {
    const logs = await apiRequest<PaymentLog[]>('/payments');
    if (Array.isArray(logs)) {
      localStorage.setItem(STORAGE_KEY_PAYMENTS, JSON.stringify(logs));
      return logs;
    }
  } catch (err) {
    console.warn('API fetchPaymentLogs failed, falling back to local cache:', err);
  }

  return getPaymentLogs();
}
