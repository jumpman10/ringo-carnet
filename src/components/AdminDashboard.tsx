import React, { useState } from 'react';
import { Member, AccessLog, PaymentLog, RenewMemberOptions } from '../types';
import { getCalculatedStatus, getDaysRemaining, formatDisplayDate, buildWhatsAppLink } from '../lib/dateUtils';
import { RenewMemberModal } from './RenewMemberModal';
import { MemberAvatar } from './MemberAvatar';
import {
  Users,
  UserPlus,
  QrCode,
  Clock,
  Search,
  Check,
  AlertCircle,
  CreditCard,
  Edit,
  Trash2,
  MessageCircle,
  Calendar,
  Phone,
  Dumbbell,
  History,
  RefreshCw,
  ArrowUpRight
} from 'lucide-react';

interface AdminDashboardProps {
  members: Member[];
  accessLogs: AccessLog[];
  paymentLogs: PaymentLog[];
  disciplines?: { id: string; nombre: string; precio: number }[];
  onOpenNewMember: () => void;
  onOpenEditMember: (member: Member) => void;
  onDeleteMember: (id: string) => Promise<void>;
  onRenewMember: (id: string, options?: RenewMemberOptions) => Promise<void>;
  onOpenScanner: () => void;
  onOpenExpiringModal: () => void;
  onOpenCardModal: (member: Member) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  members,
  accessLogs,
  paymentLogs,
  disciplines = [],
  onOpenNewMember,
  onOpenEditMember,
  onDeleteMember,
  onRenewMember,
  onOpenScanner,
  onOpenExpiringModal,
  onOpenCardModal,
}) => {
  const [activeTab, setActiveTab] = useState<'members' | 'access_logs' | 'payment_logs'>('members');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'activo' | 'por_vencer' | 'vencido'>('all');
  const [disciplineFilter, setDisciplineFilter] = useState<string>('all');
  const [renewingMember, setRenewingMember] = useState<Member | null>(null);

  // Statistics
  const totalMembers = members.length;
  const activeMembers = members.filter((m) => {
    const s = getCalculatedStatus(m.fecha_vencimiento, m.estado_pago);
    return s.membershipStatus === 'activo';
  }).length;

  const expiringTwoDaysMembers = members.filter((m) => {
    const days = getDaysRemaining(m.fecha_vencimiento);
    return days >= 0 && days <= 2 && m.estado_pago === 'pagado';
  }).length;

  const expiredOrUnpaidMembers = members.filter((m) => {
    const s = getCalculatedStatus(m.fecha_vencimiento, m.estado_pago);
    return s.membershipStatus === 'vencido';
  }).length;

  const estimatedMonthlyRevenue = members.reduce((sum, m) => sum + (m.monto_mensual || 25000), 0);

  // Filter members
  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.apellido.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.dni.includes(searchQuery) ||
      m.telefono.includes(searchQuery);

    if (!matchesSearch) return false;

    if (disciplineFilter !== 'all' && m.disciplina !== disciplineFilter) {
      return false;
    }

    const s = getCalculatedStatus(m.fecha_vencimiento, m.estado_pago);
    if (statusFilter === 'activo') return s.membershipStatus === 'activo';
    if (statusFilter === 'por_vencer') return s.membershipStatus === 'por_vencer';
    if (statusFilter === 'vencido') return s.membershipStatus === 'vencido';

    return true;
  });

  const handleRenewClick = (member: Member) => {
    setRenewingMember(member);
  };

  const handleDeleteClick = async (member: Member) => {
    const confirmDelete = window.confirm(
      `¿Eliminar a ${member.nombre} ${member.apellido} (DNI: ${member.dni})?`
    );
    if (confirmDelete) {
      await onDeleteMember(member.id);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 sm:pb-8">
      {/* Metrics Banner - Mobile First Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Members */}
        <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[10px] sm:text-xs uppercase font-mono tracking-wider">Total Socios</span>
            <Users className="w-3.5 h-3.5 text-neutral-400" />
          </div>
          <div className="text-xl sm:text-3xl font-black text-white mt-1.5 font-mono">{totalMembers}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5 truncate">Registrados en Ringo</div>
        </div>

        {/* Active Members */}
        <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[10px] sm:text-xs uppercase font-mono tracking-wider">Al Día</span>
            <Check className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="text-xl sm:text-3xl font-black text-white mt-1.5 font-mono">{activeMembers}</div>
          <div className="text-[10px] text-neutral-500 mt-0.5 truncate">Membresía activa</div>
        </div>

        {/* Expiring in 2 days */}
        <div
          onClick={onOpenExpiringModal}
          className="bg-[#0a0a0a] hover:bg-[#141414] border border-neutral-700 active:scale-[0.98] rounded-xl p-3.5 sm:p-4 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-white">
            <span className="text-[10px] sm:text-xs uppercase font-mono tracking-wider font-bold">
              Vence ≤ 2 Días
            </span>
            <Clock className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="text-xl sm:text-3xl font-black text-white mt-1.5 font-mono flex items-center justify-between">
            <span>{expiringTwoDaysMembers}</span>
            <ArrowUpRight className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-[10px] text-neutral-300 mt-0.5 flex items-center gap-1">
            <MessageCircle className="w-3 h-3 text-white" />
            <span>Avisar WhatsApp</span>
          </div>
        </div>

        {/* Expired / Unpaid */}
        <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[10px] sm:text-xs uppercase font-mono tracking-wider">Vencidos</span>
            <AlertCircle className="w-3.5 h-3.5 text-neutral-400" />
          </div>
          <div className="text-xl sm:text-3xl font-black text-neutral-400 mt-1.5 font-mono">
            {expiredOrUnpaidMembers}
          </div>
          <div className="text-[10px] text-neutral-500 mt-0.5 truncate">Acceso denegado</div>
        </div>
      </div>

      {/* Main Tabs & Action Header */}
      <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <div className="flex items-center bg-black p-1 rounded-lg border border-neutral-800 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'members'
                ? 'bg-white text-black'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Socios ({totalMembers})
          </button>
          <button
            onClick={() => setActiveTab('access_logs')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'access_logs'
                ? 'bg-white text-black'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Portería ({accessLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('payment_logs')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'payment_logs'
                ? 'bg-white text-black'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Pagos ({paymentLogs.length})
          </button>
        </div>

        {/* Primary Action Buttons - Mobile friendly */}
        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <button
            onClick={onOpenExpiringModal}
            className="py-2 px-3 bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white border border-neutral-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp (≤ 2d)</span>
          </button>

          <button
            onClick={onOpenNewMember}
            className="py-2 px-3 bg-white hover:bg-neutral-200 active:scale-95 text-black font-black text-xs uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Nuevo Socio</span>
          </button>
        </div>
      </div>

      {/* TAB 1: MEMBERS MANAGEMENT */}
      {activeTab === 'members' && (
        <div className="space-y-3 sm:space-y-4">
          {/* Filters Bar - Mobile First */}
          <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3 sm:p-4 space-y-3">
            {/* Search Input */}
            <div className="relative w-full">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre, DNI o teléfono..."
                className="w-full bg-black border border-neutral-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white transition-colors"
              />
            </div>

            {/* Filter Pills - Horizontal scrolling on phone */}
            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto text-xs">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-white text-black'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  Todos ({members.length})
                </button>
                <button
                  onClick={() => setStatusFilter('activo')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors ${
                    statusFilter === 'activo'
                      ? 'bg-white text-black'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  Al Día ({activeMembers})
                </button>
                <button
                  onClick={() => setStatusFilter('por_vencer')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors ${
                    statusFilter === 'por_vencer'
                      ? 'bg-white text-black'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  Por Vencer ({expiringTwoDaysMembers})
                </button>
                <button
                  onClick={() => setStatusFilter('vencido')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors ${
                    statusFilter === 'vencido'
                      ? 'bg-white text-black'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  Vencidos ({expiredOrUnpaidMembers})
                </button>
              </div>

              {/* Discipline Dropdown */}
              <select
                value={disciplineFilter}
                onChange={(e) => setDisciplineFilter(e.target.value)}
                className="w-full sm:w-auto bg-black border border-neutral-800 rounded-lg px-2.5 py-1 text-xs text-neutral-300 focus:outline-none focus:border-white cursor-pointer font-mono"
              >
                <option value="all">Todas las disciplinas</option>
                {(disciplines.length > 0
                  ? disciplines.map((d) => d.nombre)
                  : ['Musculación', 'Crossfit', 'Funcional', 'Boxeo', 'Spinning', 'Pilates', 'Calistenia', 'Pase Libre']
                ).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* MOBILE VIEW: CARDS (Visible on sm and down) */}
          <div className="block lg:hidden space-y-2.5">
            {filteredMembers.length === 0 ? (
              <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-8 text-center text-neutral-400">
                <Users className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-white">No se encontraron socios</p>
                <p className="text-[11px] text-neutral-500 mt-0.5">Prueba cambiando los filtros</p>
              </div>
            ) : (
              filteredMembers.map((member) => {
                const status = getCalculatedStatus(member.fecha_vencimiento, member.estado_pago);
                const daysRemaining = status.daysRemaining;

                return (
                  <div
                    key={member.id}
                    className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3.5 space-y-3"
                  >
                    {/* Header info */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <MemberAvatar
                          src={member.foto_url}
                          name={`${member.nombre} ${member.apellido}`}
                          className="w-12 h-12 rounded-lg"
                        />
                        <div>
                          <h4 className="font-black text-sm text-white leading-tight">
                            {member.nombre} {member.apellido}
                          </h4>
                          <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                            DNI: {member.dni}
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" />
                            {member.telefono}
                          </div>
                        </div>
                      </div>

                      {/* Status badge */}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${status.color}`}>
                        {daysRemaining < 0
                          ? `Vencido`
                          : daysRemaining === 0
                          ? 'Vence hoy'
                          : `${daysRemaining}d`}
                      </span>
                    </div>

                    {/* Meta info chips */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] pt-1 border-t border-neutral-900">
                      <span className="inline-flex items-center gap-1 bg-black px-2 py-0.5 rounded border border-neutral-800 text-neutral-300">
                        <Dumbbell className="w-3 h-3 text-white" />
                        {member.disciplina}
                      </span>
                      <span className="inline-flex items-center gap-1 bg-black px-2 py-0.5 rounded border border-neutral-800 text-neutral-400 font-mono">
                        <Calendar className="w-3 h-3" />
                        Vence: {formatDisplayDate(member.fecha_vencimiento)}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          member.estado_pago === 'pagado'
                            ? 'bg-neutral-900 text-white border border-neutral-700'
                            : 'bg-black text-neutral-500 border border-neutral-900 line-through'
                        }`}
                      >
                        {member.estado_pago === 'pagado' ? 'Pagado' : 'Impago'}
                      </span>
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-neutral-900">
                      <button
                        onClick={() => onOpenCardModal(member)}
                        className="flex-1 py-1.5 px-2 bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white text-xs font-bold rounded-lg border border-neutral-700 flex items-center justify-center gap-1"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        Carnet
                      </button>

                      <a
                        href={buildWhatsAppLink(
                          member.nombre,
                          member.disciplina,
                          member.fecha_vencimiento,
                          member.telefono,
                          daysRemaining
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1.5 px-3 bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white text-xs font-bold rounded-lg border border-neutral-700 flex items-center justify-center gap-1"
                        title="Enviar WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </a>

                      <button
                        onClick={() => handleRenewClick(member)}
                        className="py-1.5 px-3 bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white text-xs font-bold rounded-lg border border-neutral-700 flex items-center justify-center gap-1"
                        title="Renovar membresía"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onOpenEditMember(member)}
                        className="p-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded-lg border border-neutral-800"
                        title="Editar"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteClick(member)}
                        className="p-1.5 bg-black hover:bg-neutral-900 text-neutral-500 hover:text-white rounded-lg border border-neutral-900"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* DESKTOP VIEW: TABLE (Visible on lg and up) */}
          <div className="hidden lg:block bg-[#0a0a0a] border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#111111] text-neutral-400 uppercase tracking-wider text-[10px] border-b border-neutral-800 font-mono">
                  <tr>
                    <th className="py-3 px-4">Socio</th>
                    <th className="py-3 px-3">DNI</th>
                    <th className="py-3 px-3">Disciplina</th>
                    <th className="py-3 px-3">Ingreso</th>
                    <th className="py-3 px-3">Vencimiento</th>
                    <th className="py-3 px-3 text-center">Días Restantes</th>
                    <th className="py-3 px-3">Pago</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-neutral-400">
                        <Users className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                        <p className="font-bold text-white">No se encontraron socios</p>
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((member) => {
                      const status = getCalculatedStatus(member.fecha_vencimiento, member.estado_pago);
                      const daysRemaining = status.daysRemaining;

                      return (
                        <tr key={member.id} className="hover:bg-[#121212] transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <MemberAvatar
                                src={member.foto_url}
                                name={`${member.nombre} ${member.apellido}`}
                                className="w-9 h-9 rounded-lg"
                              />
                              <div>
                                <div className="font-bold text-white">
                                  {member.nombre} {member.apellido}
                                </div>
                                <div className="text-[11px] text-neutral-400 font-mono">
                                  {member.telefono}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3 font-mono text-neutral-200">{member.dni}</td>

                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-900 text-neutral-200 border border-neutral-800 text-[11px]">
                              <Dumbbell className="w-3 h-3 text-white" />
                              {member.disciplina}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-neutral-400 font-mono text-[11px]">
                            {formatDisplayDate(member.fecha_ingreso)}
                          </td>

                          <td className="py-3 px-3 font-medium text-white font-mono">
                            {formatDisplayDate(member.fecha_vencimiento)}
                          </td>

                          <td className="py-3 px-3 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold font-mono ${status.color}`}>
                              {daysRemaining < 0
                                ? `${Math.abs(daysRemaining)}d vencido`
                                : daysRemaining === 0
                                ? 'Vence hoy'
                                : `${daysRemaining} días`}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                                member.estado_pago === 'pagado'
                                  ? 'bg-neutral-900 text-white border border-neutral-700'
                                  : 'bg-black text-neutral-500 border border-neutral-800 line-through'
                              }`}
                            >
                              {member.estado_pago === 'pagado' ? 'Pagado' : 'Pendiente'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => onOpenCardModal(member)}
                                title="Ver Carnet QR"
                                className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 transition-colors"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                              </button>

                              <a
                                href={buildWhatsAppLink(
                                  member.nombre,
                                  member.disciplina,
                                  member.fecha_vencimiento,
                                  member.telefono,
                                  daysRemaining
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Enviar recordatorio WhatsApp"
                                className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 transition-colors"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>

                              <button
                                onClick={() => handleRenewClick(member)}
                                title="Renovar membresía"
                                className="p-1.5 rounded-lg bg-white text-black hover:bg-neutral-200 transition-colors"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => onOpenEditMember(member)}
                                title="Editar Socio"
                                className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 transition-colors"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteClick(member)}
                                title="Eliminar Socio"
                                className="p-1.5 rounded-lg bg-black hover:bg-neutral-900 text-neutral-500 hover:text-white border border-neutral-900 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ACCESS LOGS (PORTERÍA) */}
      {activeTab === 'access_logs' && (
        <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3.5 sm:p-5 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-white" />
                Registro de Ingresos en Portería (Escaneos QR)
              </h3>
              <p className="text-[11px] text-neutral-400">
                Historial de validaciones generadas por escáner
              </p>
            </div>
            <button
              onClick={onOpenScanner}
              className="px-3 py-1.5 bg-white text-black text-xs font-bold rounded-lg"
            >
              Escanear
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#111111] text-neutral-400 uppercase tracking-wider text-[10px] font-mono">
                <tr>
                  <th className="py-2.5 px-3">Fecha y Hora</th>
                  <th className="py-2.5 px-3">Socio</th>
                  <th className="py-2.5 px-3">DNI</th>
                  <th className="py-2.5 px-3">Disciplina</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3">Observación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 font-mono">
                {accessLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-neutral-400 font-sans">
                      No hay registros de accesos todavía.
                    </td>
                  </tr>
                ) : (
                  accessLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#121212]">
                      <td className="py-2.5 px-3 text-neutral-400 text-[11px]">
                        {new Date(log.timestamp).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white font-sans">{log.member_name}</td>
                      <td className="py-2.5 px-3 text-neutral-300">{log.dni}</td>
                      <td className="py-2.5 px-3">
                        <span className="text-[11px] bg-neutral-900 text-neutral-200 px-2 py-0.5 rounded border border-neutral-800">
                          {log.disciplina}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.autorizado
                              ? 'bg-white text-black'
                              : 'bg-black text-neutral-400 border border-neutral-800'
                          }`}
                        >
                          {log.autorizado ? 'AUTORIZADO' : 'DENEGADO'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-neutral-400 text-[11px] font-sans">{log.motivo}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PAYMENT LOGS */}
      {activeTab === 'payment_logs' && (
        <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-3.5 sm:p-5 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-800 pb-3 gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-white" />
                Historial de Cobros y Renovaciones
              </h3>
              <p className="text-[11px] text-neutral-400">
                Registro de pagos de cuotas mensuales
              </p>
            </div>
            <div className="text-xs text-white font-bold bg-neutral-900 border border-neutral-700 px-3 py-1.5 rounded-lg font-mono">
              Recaudación Estimada: ${estimatedMonthlyRevenue.toLocaleString('es-AR')}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#111111] text-neutral-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Socio</th>
                  <th className="py-2.5 px-3">Monto</th>
                  <th className="py-2.5 px-3">Método</th>
                  <th className="py-2.5 px-3">Período Renovado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {paymentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-neutral-400 font-sans">
                      No hay registros de pagos recientes en esta sesión.
                    </td>
                  </tr>
                ) : (
                  paymentLogs.map((pay) => {
                    const member = members.find((m) => m.id === pay.member_id);
                    return (
                      <tr key={pay.id} className="hover:bg-[#121212]">
                        <td className="py-2.5 px-3 text-neutral-300 text-[11px]">
                          {formatDisplayDate(pay.fecha)}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-white font-sans">
                          {member ? `${member.nombre} ${member.apellido}` : 'Socio'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-white">
                          ${pay.monto.toLocaleString('es-AR')}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[11px] bg-neutral-900 text-neutral-300 px-2 py-0.5 rounded border border-neutral-800">
                            {pay.metodo}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-400 text-[11px]">
                          {formatDisplayDate(pay.periodo_inicio)} al {formatDisplayDate(pay.periodo_fin)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating Bottom Action for Mobile Admin (Mobile First) */}
      <div className="fixed bottom-3 inset-x-3 sm:hidden z-30 flex items-center gap-2">
        <button
          onClick={onOpenScanner}
          className="flex-1 py-3 px-4 bg-white text-black font-black uppercase text-xs tracking-wider rounded-xl shadow-2xl flex items-center justify-center gap-2 border border-white active:scale-95 transition-all"
        >
          <QrCode className="w-4 h-4 stroke-[2.5]" />
          Escanear QR Portería
        </button>
      </div>

      {/* Renewal Modal */}
      <RenewMemberModal
        isOpen={Boolean(renewingMember)}
        onClose={() => setRenewingMember(null)}
        member={renewingMember}
        disciplines={disciplines}
        onConfirmRenew={async (id, options) => {
          await onRenewMember(id, options);
          setRenewingMember(null);
        }}
      />
    </div>
  );
};
