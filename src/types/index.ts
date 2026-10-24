export type MembershipStatus = 'activo' | 'por_vencer' | 'vencido' | 'inactivo';
export type PaymentStatus = 'pagado' | 'pendiente' | 'vencido' | 'parcial' | 'saldo';

export type PaymentMethod =
  | 'Efectivo'
  | 'Transferencia'
  | 'Tarjeta de débito'
  | 'Tarjeta de crédito'
  | 'Pago con QR'
  | 'Mixto';

export interface PaymentMethodDetail {
  metodo: 'Efectivo' | 'Transferencia' | 'Tarjeta de débito' | 'Tarjeta de crédito' | 'Pago con QR';
  monto: number;
}

export interface DisciplineItem {
  id: string;
  nombre: string;
  precio: number;
}

export type Discipline = string;

export interface Member {
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  fecha_nacimiento?: string; // YYYY-MM-DD
  foto_url: string;
  disciplina: Discipline;
  telefono: string;
  fecha_ingreso: string; // YYYY-MM-DD
  fecha_vencimiento: string; // YYYY-MM-DD
  estado_membresia: MembershipStatus;
  estado_pago: PaymentStatus;
  monto_mensual: number;
  saldo_pendiente?: number;
  metodo_pago?: PaymentMethod;
  ultimo_pago_fecha?: string;
  creado_en: string;
  notas?: string;
  codigo_qr: string; // token for verification
}

export interface AccessLog {
  id: string;
  member_id: string;
  dni: string;
  member_name: string;
  disciplina: Discipline;
  timestamp: string;
  autorizado: boolean;
  motivo?: string;
}

export interface PaymentLog {
  id: string;
  member_id: string;
  fecha: string;
  monto: number;
  metodo: PaymentMethod | 'Tarjeta' | string;
  periodo_inicio: string;
  periodo_fin: string;
  detalles?: PaymentMethodDetail[];
  notas?: string;
}

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  email?: string;
  role?: UserRole;
}

export interface CurrentUser {
  role: UserRole;
  member?: Member;
  email?: string;
}

export interface RenewMemberOptions {
  monto?: number;
  metodo?: PaymentMethod | string;
  detalles?: PaymentMethodDetail[];
  disciplina?: string;
  fechaRenovacion?: string;
  fechaVencimiento?: string;
  saldoPendiente?: number;
  esPagoSaldo?: boolean;
  notas?: string;
}
