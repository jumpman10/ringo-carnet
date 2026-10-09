import React, { useState, useEffect } from 'react';
import { Member, DisciplineItem, PaymentMethod, RenewMemberOptions } from '../types';
import { calculateNextExpiration, formatDateISO, formatDisplayDate, getDaysRemaining } from '../lib/dateUtils';
import {
  X,
  Calendar,
  CreditCard,
  Dumbbell,
  Check,
  RefreshCw,
  Clock,
  ArrowRight,
  DollarSign,
  Lock
} from 'lucide-react';

interface RenewMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  disciplines: DisciplineItem[];
  onConfirmRenew: (memberId: string, options: RenewMemberOptions) => Promise<void>;
}

const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'Efectivo', label: 'Efectivo' },
  { id: 'Transferencia', label: 'Transferencia' },
  { id: 'Tarjeta de crédito', label: 'Tarjeta' },
];

export const RenewMemberModal: React.FC<RenewMemberModalProps> = ({
  isOpen,
  onClose,
  member,
  disciplines,
  onConfirmRenew,
}) => {
  const [fechaRenovacion, setFechaRenovacion] = useState(formatDateISO(new Date()));
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [disciplina, setDisciplina] = useState('');
  const [monto, setMonto] = useState<number>(28000);
  const [metodo, setMetodo] = useState<PaymentMethod>('Efectivo');
  const [loading, setLoading] = useState(false);

  // Initialize modal state when opened with a member
  useEffect(() => {
    if (member && isOpen) {
      const today = formatDateISO(new Date());
      setFechaRenovacion(today);

      // Determine initial discipline & amount
      const currentDisc = member.disciplina || (disciplines[0]?.nombre ?? 'Musculación');
      setDisciplina(currentDisc);

      const matchedDisc = disciplines.find((d) => d.nombre === currentDisc);
      const defaultAmount = matchedDisc?.precio || member.monto_mensual || 28000;
      setMonto(defaultAmount);

      setMetodo(member.metodo_pago || 'Efectivo');

      // Calculate initial expiration
      const baseDate = member.fecha_vencimiento && member.fecha_vencimiento >= today
        ? member.fecha_vencimiento
        : today;
      setFechaVencimiento(calculateNextExpiration(baseDate));
    }
  }, [member, isOpen, disciplines]);

  if (!isOpen || !member) return null;

  // Handle change in renewal date (always calculates next expiration automatically)
  const handleRenovacionChange = (newRenovacionDate: string) => {
    setFechaRenovacion(newRenovacionDate);
    const baseDate = member.fecha_vencimiento && member.fecha_vencimiento >= newRenovacionDate
      ? member.fecha_vencimiento
      : newRenovacionDate;
    setFechaVencimiento(calculateNextExpiration(baseDate));
  };

  // Handle discipline selection
  const handleDisciplineChange = (selectedName: string) => {
    setDisciplina(selectedName);
    const found = disciplines.find((d) => d.nombre === selectedName);
    if (found) {
      setMonto(found.precio);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disciplina.trim()) {
      alert('Por favor selecciona una disciplina');
      return;
    }
    if (!fechaRenovacion || !fechaVencimiento) {
      alert('Por favor ingresa la fecha de renovación y el nuevo vencimiento');
      return;
    }

    setLoading(true);
    try {
      await onConfirmRenew(member.id, {
        fechaRenovacion,
        fechaVencimiento,
        disciplina,
        monto: Number(monto) || 0,
        metodo,
      });
      onClose();
    } catch (err) {
      console.error('Error al renovar membresía:', err);
      alert('Ocurrió un error al registrar la renovación');
    } finally {
      setLoading(false);
    }
  };

  const daysRemaining = getDaysRemaining(member.fecha_vencimiento);
  const isExpired = daysRemaining < 0;
  const isPaidThroughFuture = member.fecha_vencimiento && member.fecha_vencimiento >= fechaRenovacion;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-sm">
      <div className="min-h-full flex items-center justify-center p-2.5 sm:p-4">
        <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative my-auto flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-800 bg-black shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white text-black flex items-center justify-center font-bold shadow-sm">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-base text-white tracking-wide uppercase">
                Renovar Membresía
              </h3>
              <p className="text-xs text-neutral-400">
                {member.nombre} {member.apellido} • DNI <span className="font-mono text-neutral-300">{member.dni}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Current Status Box */}
          <div className="bg-neutral-950 border border-neutral-800/80 rounded-xl p-3 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-neutral-400 shrink-0" />
              <div>
                <span className="text-neutral-400 block text-[11px]">Vencimiento actual</span>
                <span className="font-bold text-white">
                  {member.fecha_vencimiento ? formatDisplayDate(member.fecha_vencimiento) : 'Sin registro'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  isExpired
                    ? 'bg-neutral-900 text-neutral-300 border border-neutral-700'
                    : daysRemaining <= 2
                    ? 'bg-neutral-800 text-white border border-neutral-600'
                    : 'bg-white text-black'
                }`}
              >
                {isExpired
                  ? `Vencido hace ${Math.abs(daysRemaining)}d`
                  : daysRemaining === 0
                  ? 'Vence hoy'
                  : `${daysRemaining} días restantes`}
              </span>
            </div>
          </div>

          {/* Dates Row: Renovación & Nuevo Vencimiento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Fecha de Renovación */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-white" />
                Fecha Renovación
              </label>
              <input
                type="date"
                required
                value={fechaRenovacion}
                onChange={(e) => handleRenovacionChange(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-white focus:outline-none transition-colors"
              />
              <span className="text-[10px] text-neutral-500 mt-1 block">
                Fecha del pago / inicio
              </span>
            </div>

            {/* Nuevo Vencimiento (Automático) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-white" />
                  Nuevo Vencimiento
                </label>
                <span className="text-[10px] text-neutral-500 font-mono">
                  (Automático)
                </span>
              </div>
              <div className="relative">
                <input
                  type="date"
                  readOnly
                  tabIndex={-1}
                  value={fechaVencimiento}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-300 font-mono cursor-not-allowed select-none focus:outline-none"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-neutral-500">
                  <Lock className="w-3.5 h-3.5" />
                </div>
              </div>
              <span className="text-[10px] text-neutral-400 mt-1 block truncate">
                {isPaidThroughFuture
                  ? 'Acumulado al vencimiento actual (+1 mes)'
                  : '1 mes desde fecha de renovación'}
              </span>
            </div>
          </div>

          {/* Disciplina Selector */}
          <div>
            <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Dumbbell className="w-3.5 h-3.5 text-white" />
              Disciplina
            </label>
            <div className="relative">
              <select
                value={disciplina}
                onChange={(e) => handleDisciplineChange(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-white focus:border-white focus:outline-none appearance-none transition-colors cursor-pointer"
              >
                {/* Include current discipline if not in list */}
                {disciplina && !disciplines.some((d) => d.nombre === disciplina) && (
                  <option value={disciplina}>{disciplina}</option>
                )}
                {disciplines.map((d) => (
                  <option key={d.id} value={d.nombre}>
                    {d.nombre} — ${d.precio.toLocaleString('es-AR')}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-neutral-400">
                ▼
              </div>
            </div>
          </div>

          {/* Monto & Método de Pago Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Monto */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-white" />
                Monto a Cobrar ($)
              </label>
              <input
                type="number"
                min="0"
                step="500"
                required
                value={monto}
                onChange={(e) => setMonto(Number(e.target.value))}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-white focus:outline-none transition-colors"
                placeholder="28000"
              />
              <span className="text-[10px] text-neutral-400 mt-1 block font-mono">
                $ {Number(monto || 0).toLocaleString('es-AR')}
              </span>
            </div>

            {/* Método de Pago */}
            <div>
              <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-white" />
                Método de Pago
              </label>
              <div className="grid grid-cols-3 gap-1">
                {PAYMENT_METHODS.map((pm) => {
                  const isSelected = metodo === pm.id;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setMetodo(pm.id)}
                      className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-all border text-center ${
                        isSelected
                          ? 'bg-white text-black border-white shadow-sm'
                          : 'bg-neutral-900 text-neutral-400 hover:text-white border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      {pm.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Summary Box */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs space-y-1 text-neutral-400">
            <div className="flex justify-between">
              <span>Período renovado:</span>
              <span className="text-white font-mono font-medium">
                {formatDisplayDate(fechaRenovacion)} al {formatDisplayDate(fechaVencimiento)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total registrado:</span>
              <span className="text-white font-bold font-mono">
                ${Number(monto || 0).toLocaleString('es-AR')} ({metodo})
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-lg border border-neutral-800 text-xs font-bold text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-lg bg-white hover:bg-neutral-200 active:scale-95 text-black text-xs font-black tracking-wider uppercase flex items-center gap-2 transition-all shadow-md"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirmar Renovación</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
  );
};
