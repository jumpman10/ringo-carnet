import * as XLSX from 'xlsx';
import { Member, AccessLog, PaymentLog, DisciplineItem } from '../types';
import { getCalculatedStatus, getDaysRemaining, formatDisplayDate } from './dateUtils';

/**
 * Generic helper to build and trigger download of an .xlsx spreadsheet in the browser.
 */
export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  sheetName: string,
  fileName: string,
  columnWidths?: { wch: number }[]
) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  if (columnWidths) {
    worksheet['!cols'] = columnWidths;
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/**
 * Export members table to .xlsx
 */
export function exportMembersToExcel(members: Member[], suffix = '') {
  const data = members.map((m) => {
    const status = getCalculatedStatus(m.fecha_vencimiento, m.estado_pago);
    const days = getDaysRemaining(m.fecha_vencimiento);

    return {
      Apellido: m.apellido,
      Nombre: m.nombre,
      DNI: m.dni,
      Teléfono: m.telefono,
      Disciplina: m.disciplina,
      'Monto Mensual ($)': m.monto_mensual || 25000,
      'Fecha Ingreso': formatDisplayDate(m.fecha_ingreso),
      'Fecha Vencimiento': formatDisplayDate(m.fecha_vencimiento),
      'Días Restantes': days,
      'Estado Membresía': status.membershipStatus.toUpperCase(),
      'Estado Pago': m.estado_pago ? m.estado_pago.toUpperCase() : 'PENDIENTE',
      'Método de Pago': m.metodo_pago || 'Efectivo',
    };
  });

  const nowStr = new Date().toISOString().slice(0, 10);
  const fileName = `socios_ringo_${nowStr}${suffix ? '_' + suffix : ''}`;
  const columnWidths = [
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 15 },
    { wch: 18 },
    { wch: 15 },
    { wch: 18 },
    { wch: 15 },
    { wch: 16 },
  ];

  exportToExcel(data, 'Socios', fileName, columnWidths);
}

/**
 * Export access logs table to .xlsx
 */
export function exportAccessLogsToExcel(logs: AccessLog[]) {
  const data = logs.map((log) => ({
    'Fecha y Hora': new Date(log.timestamp).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    Socio: log.member_name,
    DNI: log.dni,
    Disciplina: log.disciplina,
    Estado: log.autorizado ? 'AUTORIZADO' : 'DENEGADO',
    'Motivo / Observación': log.motivo,
  }));

  const nowStr = new Date().toISOString().slice(0, 10);
  const fileName = `accesos_porteria_ringo_${nowStr}`;
  const columnWidths = [
    { wch: 22 },
    { wch: 26 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 32 },
  ];

  exportToExcel(data, 'Accesos', fileName, columnWidths);
}

/**
 * Export payment logs table to .xlsx
 */
export function exportPaymentLogsToExcel(payments: PaymentLog[], members: Member[]) {
  const data = payments.map((pay) => {
    const member = members.find((m) => m.id === pay.member_id);
    return {
      'Fecha Cobro': formatDisplayDate(pay.fecha),
      Socio: member ? `${member.nombre} ${member.apellido}` : 'Socio desconocido',
      DNI: member ? member.dni : '-',
      Disciplina: member ? member.disciplina : '-',
      'Monto ($)': pay.monto,
      'Método de Pago': pay.metodo,
      'Período Desde': formatDisplayDate(pay.periodo_inicio),
      'Período Hasta': formatDisplayDate(pay.periodo_fin),
    };
  });

  const nowStr = new Date().toISOString().slice(0, 10);
  const fileName = `historial_cobros_ringo_${nowStr}`;
  const columnWidths = [
    { wch: 15 },
    { wch: 26 },
    { wch: 14 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
  ];

  exportToExcel(data, 'Cobros', fileName, columnWidths);
}

/**
 * Export critical expiring members to .xlsx
 */
export function exportCriticalMembersToExcel(members: Member[], filterLabel = 'todos') {
  const data = members.map((m) => {
    const days = getDaysRemaining(m.fecha_vencimiento);
    return {
      Socio: `${m.nombre} ${m.apellido}`,
      DNI: m.dni,
      Teléfono: m.telefono,
      Disciplina: m.disciplina,
      Vencimiento: formatDisplayDate(m.fecha_vencimiento),
      'Días Restantes':
        days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Vence hoy' : `${days} días`,
      'Estado Pago': m.estado_pago ? m.estado_pago.toUpperCase() : 'PENDIENTE',
      'Monto Cuota ($)': m.monto_mensual || 25000,
    };
  });

  const nowStr = new Date().toISOString().slice(0, 10);
  const fileName = `vencimientos_criticos_${filterLabel}_${nowStr}`;
  const columnWidths = [
    { wch: 26 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
  ];

  exportToExcel(data, 'Vencimientos', fileName, columnWidths);
}

/**
 * Export disciplines configuration to .xlsx
 */
export function exportDisciplinesToExcel(disciplines: DisciplineItem[]) {
  const data = disciplines.map((d) => ({
    'Nombre Disciplina': d.nombre,
    'Precio Mensual ($)': d.precio,
    ID: d.id,
  }));

  const nowStr = new Date().toISOString().slice(0, 10);
  const fileName = `disciplinas_ringo_${nowStr}`;
  const columnWidths = [
    { wch: 24 },
    { wch: 18 },
    { wch: 20 },
  ];

  exportToExcel(data, 'Disciplinas', fileName, columnWidths);
}
