import { MembershipStatus, PaymentStatus } from '../types';

/**
 * Format a Date object to YYYY-MM-DD
 */
export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate the next monthly expiration date based on gym rules:
 * - If joining on the 15th of the month, expires on the 15th of next month.
 * - Special user requirement: Jan 29, 30, and 31 expire on March 1st (February does not have 30/31, and even on leap years 29 expires on March 1st).
 * - For other months where the day does not exist in next month (e.g. 31 to 30), it rolls to 1st of the next month.
 */
export function calculateNextExpiration(fromDateStr: string): string {
  if (!fromDateStr) return '';
  const [y, m, d] = fromDateStr.split('-').map(Number);
  if (!y || !m || !d) return fromDateStr;

  const currentMonthIdx = m - 1; // 0-indexed (0 = Jan, 1 = Feb, ...)
  const day = d;

  // Specific rule: Jan 29, 30, 31 closes on March 1st
  if (currentMonthIdx === 0 && day >= 29) {
    const nextDate = new Date(y, 2, 1); // March 1st (month index 2)
    return formatDateISO(nextDate);
  }

  // Next target month
  let targetYear = y;
  let targetMonthIdx = currentMonthIdx + 1;
  if (targetMonthIdx > 11) {
    targetMonthIdx = 0;
    targetYear += 1;
  }

  // Days in target month
  const daysInTargetMonth = new Date(targetYear, targetMonthIdx + 1, 0).getDate();

  let targetDay = day;
  if (day > daysInTargetMonth) {
    // If target month does not have that day, align to 1st of following month as requested
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

/**
 * Calculate the days remaining until expiration.
 * Positive = days left
 * 0 = expires today
 * Negative = expired X days ago
 */
export function getDaysRemaining(expirationDateStr: string): number {
  if (!expirationDateStr || typeof expirationDateStr !== 'string') return 0;
  const cleanStr = expirationDateStr.includes('T') ? expirationDateStr.split('T')[0] : expirationDateStr;
  const [y, m, d] = cleanStr.split('-').map(Number);
  if (!y || !m || !d) return 0;
  const expiration = new Date(y, m - 1, d);
  expiration.setHours(23, 59, 59, 999);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const diffMs = expiration.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return isNaN(diffDays) ? 0 : diffDays;
}

/**
 * Determine dynamic status based on expiration date and payment state
 */
export function getCalculatedStatus(
  expirationDateStr: string,
  paymentStatus: PaymentStatus
): { membershipStatus: MembershipStatus; daysRemaining: number; label: string; color: string } {
  const daysRemaining = getDaysRemaining(expirationDateStr);

  if (paymentStatus === 'pendiente' || paymentStatus === 'saldo' || paymentStatus === 'vencido' || daysRemaining < 0) {
    return {
      membershipStatus: 'vencido',
      daysRemaining,
      label: daysRemaining < 0 ? `Vencido hace ${Math.abs(daysRemaining)} días` : 'Vencido / Saldo pendiente',
      color: 'bg-black text-neutral-400 border border-neutral-800',
    };
  }

  if (paymentStatus === 'parcial') {
    return {
      membershipStatus: 'activo',
      daysRemaining,
      label: daysRemaining === 0 ? 'Vence hoy (Pago Parcial)' : `${daysRemaining} días (Pago Parcial)`,
      color: 'bg-neutral-900 text-amber-300 border border-amber-500/40 font-bold',
    };
  }

  if (daysRemaining <= 2) {
    return {
      membershipStatus: 'por_vencer',
      daysRemaining,
      label: daysRemaining === 0 ? '¡Vence hoy!' : daysRemaining === 1 ? 'Vence en 1 día' : 'Vence en 2 días',
      color: 'bg-neutral-900 text-white border border-neutral-400',
    };
  }

  return {
    membershipStatus: 'activo',
    daysRemaining,
    label: `${daysRemaining} días restantes`,
    color: 'bg-white text-black border border-white font-bold',
  };
}

/**
 * Format date for friendly human display (e.g. "15 de Febrero, 2026")
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const cleanStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const [y, m, d] = cleanStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Clean phone number for WhatsApp link.
 * Handles standard Argentine mobile numbers (+54 9, 54, or local 10 digits).
 */
export function cleanPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  // Argentine mobile: 10 digits (e.g. 3814123456) -> add country code 549
  if (cleaned.length === 10) {
    return `549${cleaned}`;
  }
  // Argentine mobile: 12 digits starting with 54 (e.g. 543814123456) -> add 9 mobile prefix
  if (cleaned.startsWith('54') && cleaned.length === 12 && !cleaned.startsWith('549')) {
    return `549${cleaned.slice(2)}`;
  }
  return cleaned;
}

/**
 * Build WhatsApp link for membership expiration reminder
 */
export function buildWhatsAppLink(
  nombre: string,
  disciplina: string,
  fechaVencimiento: string,
  telefono: string,
  daysRemaining: number
): string {
  const cleanPhone = cleanPhoneNumber(telefono);
  const readableDate = formatDisplayDate(fechaVencimiento);
  
  let timeText = `el ${readableDate}`;
  if (daysRemaining === 0) {
    timeText = `¡hoy! (${readableDate})`;
  } else if (daysRemaining === 1) {
    timeText = `mañana (${readableDate})`;
  } else if (daysRemaining > 1) {
    timeText = `en ${daysRemaining} días (${readableDate})`;
  }

  const message = `¡Hola ${nombre}! Te saludamos desde Ringo Gym 🥊\n\nTe recordamos que tu carnet de *${disciplina}* vence ${timeText}.\n\nPara seguir disfrutando de tus entrenamientos sin interrupciones, puedes acercarte a recepción a renovar tu mensualidad o solicitar los datos de transferencia.\n\n¡Te esperamos con la mejor energía! 💪`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
