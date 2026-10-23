import React, { useState, useEffect, useMemo } from 'react';
import { Member, DisciplineItem, PaymentMethod, PaymentMethodDetail, RenewMemberOptions } from '../types';
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
  Lock,
  Split,
  AlertCircle,
  FileText,
  BadgeAlert
} from 'lucide-react';

interface RenewMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  disciplines: DisciplineItem[];
  onConfirmRenew: (memberId: string, options: RenewMemberOptions) => Promise<void>;
}

type SinglePaymentMethod =
  | 'Efectivo'
  | 'Transferencia'
  | 'Tarjeta de débito'
  | 'Tarjeta de crédito'
  | 'Pago con QR';

const PAYMENT_METHODS: { id: SinglePaymentMethod; label: string }[] = [
  { id: 'Efectivo', label: 'Efectivo' },
  { id: 'Transferencia', label: 'Transferencia' },
  { id: 'Tarjeta de débito', label: 'Débito' },
  { id: 'Tarjeta de crédito', label: 'Crédito' },
  { id: 'Pago con QR', label: 'Pago QR' },
];

export const RenewMemberModal: React.FC<RenewMemberModalProps> = ({
  isOpen,
  onClose,
  member,
  disciplines,
  onConfirmRenew,
}) => {
  const [modoCobro, setModoCobro] = useState<'renovacion' | 'saldar_deuda'>('renovacion');
  const [fechaRenovacion, setFechaRenovacion] = useState(formatDateISO(new Date()));
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [disciplina, setDisciplina] = useState('');
  const [precioDisciplina, setPrecioDisciplina] = useState<number>(28000);
  
  // Amount being paid today
  const [montoAbonado, setMontoAbonado] = useState<number>(28000);
  
  // Payment split mode
  const [esMixto, setEsMixto] = useState<boolean>(false);
  const [metodoSimple, setMetodoSimple] = useState<SinglePaymentMethod>('Efectivo');
  
  // Mixed breakdown
  const [montoEfectivo, setMontoEfectivo] = useState<number>(0);
  const [montoTransferencia, setMontoTransferencia] = useState<number>(0);
  const [montoDebito, setMontoDebito] = useState<number>(0);
  const [montoCredito, setMontoCredito] = useState<number>(0);
  const [montoQr, setMontoQr] = useState<number>(0);
  
  const [notas, setNotas] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Initialize modal state when opened
  useEffect(() => {
    if (member && isOpen) {
      const today = formatDateISO(new Date());
      setFechaRenovacion(today);

      const hasDebt = (member.saldo_pendiente || 0) > 0;
      setModoCobro('renovacion');

      const currentDisc = member.disciplina || (disciplines[0]?.nombre ?? 'Musculación');
      setDisciplina(currentDisc);

      const matchedDisc = disciplines.find((d) => d.nombre === currentDisc);
      const feeAmount = matchedDisc?.precio || member.monto_mensual || 28000;
      setPrecioDisciplina(feeAmount);
      setMontoAbonado(feeAmount);

      // Reset payment mode
      setEsMixto(false);
      setMetodoSimple(
        member.metodo_pago && member.metodo_pago !== 'Mixto'
          ? (member.metodo_pago as SinglePaymentMethod)
          : 'Efectivo'
      );
      setMontoEfectivo(feeAmount);
      setMontoTransferencia(0);
      setMontoDebito(0);
      setMontoCredito(0);
      setMontoQr(0);
      setNotas('');

      // Calculate expiration
      const baseDate = member.fecha_vencimiento && member.fecha_vencimiento >= today
        ? member.fecha_vencimiento
        : today;
      setFechaVencimiento(calculateNextExpiration(baseDate));
    }
  }, [member, isOpen, disciplines]);

  // When switching modes (Renovación vs Saldar Deuda)
  const handleModoCobroChange = (nuevoModo: 'renovacion' | 'saldar_deuda') => {
    setModoCobro(nuevoModo);
    if (nuevoModo === 'saldar_deuda') {
      const deuda = member?.saldo_pendiente || 0;
      setMontoAbonado(deuda);
      setMontoEfectivo(deuda);
      setMontoTransferencia(0);
      setMontoDebito(0);
      setMontoCredito(0);
      setMontoQr(0);
    } else {
      setMontoAbonado(precioDisciplina);
      setMontoEfectivo(precioDisciplina);
      setMontoTransferencia(0);
      setMontoDebito(0);
      setMontoCredito(0);
      setMontoQr(0);
    }
  };

  // Recalculate expiration when renewal date changes
  const handleRenovacionChange = (newRenovacionDate: string) => {
    setFechaRenovacion(newRenovacionDate);
    if (!member) return;
    const baseDate = member.fecha_vencimiento && member.fecha_vencimiento >= newRenovacionDate
      ? member.fecha_vencimiento
      : newRenovacionDate;
    setFechaVencimiento(calculateNextExpiration(baseDate));
  };

  // Handle discipline change
  const handleDisciplineChange = (selectedName: string) => {
    setDisciplina(selectedName);
    const found = disciplines.find((d) => d.nombre === selectedName);
    if (found) {
      setPrecioDisciplina(found.precio);
      if (modoCobro === 'renovacion') {
        setMontoAbonado(found.precio);
        setMontoEfectivo(found.precio);
        setMontoTransferencia(0);
        setMontoDebito(0);
        setMontoCredito(0);
        setMontoQr(0);
      }
    }
  };

  // Switch to/from mixed payment
  const handleToggleMixto = (activarMixto: boolean) => {
    setEsMixto(activarMixto);
    if (activarMixto) {
      // Split in half or allocate to cash first
      const mitad = Math.floor(montoAbonado / 2);
      setMontoEfectivo(mitad);
      setMontoTransferencia(montoAbonado - mitad);
      setMontoDebito(0);
      setMontoCredito(0);
      setMontoQr(0);
    }
  };

  // Mixed totals and validation
  const sumaDesglose = useMemo(() => {
    return (
      Number(montoEfectivo || 0) +
      Number(montoTransferencia || 0) +
      Number(montoDebito || 0) +
      Number(montoCredito || 0) +
      Number(montoQr || 0)
    );
  }, [montoEfectivo, montoTransferencia, montoDebito, montoCredito, montoQr]);

  const diferenciaDesglose = montoAbonado - sumaDesglose;
  const desgloseValido = !esMixto || diferenciaDesglose === 0;

  // Partial payment debt calculation
  const saldoPendienteCalculado = useMemo(() => {
    if (modoCobro === 'saldar_deuda') {
      const deudaActual = member?.saldo_pendiente || 0;
      return Math.max(0, deudaActual - montoAbonado);
    }
    // Para renovación: si el socio abona menos de la tarifa
    return Math.max(0, precioDisciplina - montoAbonado);
  }, [modoCobro, member?.saldo_pendiente, precioDisciplina, montoAbonado]);

  const esPagoParcial = modoCobro === 'renovacion' && montoAbonado < precioDisciplina;

  // Auto-fill remainder button for mixed methods
  const autoCompletarResto = (
    metodoDestino: 'Efectivo' | 'Transferencia' | 'Tarjeta de débito' | 'Tarjeta de crédito' | 'Pago con QR'
  ) => {
    const restante = montoAbonado - sumaDesglose;
    if (metodoDestino === 'Efectivo') {
      setMontoEfectivo(Math.max(0, montoEfectivo + restante));
    } else if (metodoDestino === 'Transferencia') {
      setMontoTransferencia(Math.max(0, montoTransferencia + restante));
    } else if (metodoDestino === 'Tarjeta de débito') {
      setMontoDebito(Math.max(0, montoDebito + restante));
    } else if (metodoDestino === 'Tarjeta de crédito') {
      setMontoCredito(Math.max(0, montoCredito + restante));
    } else if (metodoDestino === 'Pago con QR') {
      setMontoQr(Math.max(0, montoQr + restante));
    }
  };

  if (!isOpen || !member) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (montoAbonado < 0) {
      alert('El monto a abonar no puede ser negativo');
      return;
    }
    if (esMixto && !desgloseValido) {
      alert(`La suma del desglose ($${sumaDesglose.toLocaleString('es-AR')}) no coincide con el total a cobrar ($${montoAbonado.toLocaleString('es-AR')}).`);
      return;
    }

    setLoading(true);
    try {
      const detallesList: PaymentMethodDetail[] = [];
      let metodoFinal: PaymentMethod | string = metodoSimple;

      if (esMixto) {
        if (montoEfectivo > 0) detallesList.push({ metodo: 'Efectivo', monto: montoEfectivo });
        if (montoTransferencia > 0) detallesList.push({ metodo: 'Transferencia', monto: montoTransferencia });
        if (montoDebito > 0) detallesList.push({ metodo: 'Tarjeta de débito', monto: montoDebito });
        if (montoCredito > 0) detallesList.push({ metodo: 'Tarjeta de crédito', monto: montoCredito });
        if (montoQr > 0) detallesList.push({ metodo: 'Pago con QR', monto: montoQr });

        const nombresMetodos = detallesList.map(d => d.metodo).join(' + ');
        metodoFinal = detallesList.length > 1 ? `Mixto (${nombresMetodos})` : (detallesList[0]?.metodo || 'Mixto');
      } else {
        detallesList.push({ metodo: metodoSimple, monto: montoAbonado });
      }

      await onConfirmRenew(member.id, {
        monto: montoAbonado,
        metodo: metodoFinal,
        detalles: detallesList,
        disciplina: modoCobro === 'renovacion' ? disciplina : member.disciplina,
        fechaRenovacion,
        fechaVencimiento: modoCobro === 'renovacion' ? fechaVencimiento : member.fecha_vencimiento,
        saldoPendiente: saldoPendienteCalculado,
        esPagoSaldo: modoCobro === 'saldar_deuda',
        notas: notas.trim() || undefined,
      });

      onClose();
    } catch (err) {
      console.error('Error al registrar pago/renovación:', err);
      alert('Ocurrió un error al registrar el pago');
    } finally {
      setLoading(false);
    }
  };

  const daysRemaining = getDaysRemaining(member.fecha_vencimiento);
  const isExpired = daysRemaining < 0;
  const isPaidThroughFuture = member.fecha_vencimiento && member.fecha_vencimiento >= fechaRenovacion;
  const tieneDeudaPrevia = (member.saldo_pendiente || 0) > 0;

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
                  {modoCobro === 'saldar_deuda' ? 'Cobro de Saldo Deudor' : 'Cobro & Renovación'}
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
            
            {/* Si el socio tiene deuda previa, selector de operación */}
            {tieneDeudaPrevia && (
              <div className="bg-amber-950/40 border border-amber-600/40 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-amber-300 font-bold">
                    <BadgeAlert className="w-4 h-4 shrink-0" />
                    <span>Socio con saldo deudor pendiente</span>
                  </div>
                  <span className="font-mono font-black text-amber-200 text-sm">
                    ${(member.saldo_pendiente || 0).toLocaleString('es-AR')}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleModoCobroChange('renovacion')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border text-center ${
                      modoCobro === 'renovacion'
                        ? 'bg-white text-black border-white shadow-sm'
                        : 'bg-black/60 text-neutral-400 border-neutral-800 hover:text-white'
                    }`}
                  >
                    Renovar nuevo mes
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModoCobroChange('saldar_deuda')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border text-center ${
                      modoCobro === 'saldar_deuda'
                        ? 'bg-amber-400 text-black border-amber-300 font-black shadow-sm'
                        : 'bg-black/60 text-amber-300/80 border-amber-900/50 hover:text-amber-200'
                    }`}
                  >
                    Saldar deuda ($ {member.saldo_pendiente?.toLocaleString('es-AR')})
                  </button>
                </div>
              </div>
            )}

            {/* Current Status Box (Solo si no está saldando deuda directa) */}
            {modoCobro === 'renovacion' && (
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
            )}

            {/* Modo Renovación: Fechas & Disciplina */}
            {modoCobro === 'renovacion' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-white" />
                      Fecha de Cobro
                    </label>
                    <input
                      type="date"
                      required
                      value={fechaRenovacion}
                      onChange={(e) => handleRenovacionChange(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-white focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 text-white" />
                        Nuevo Vencimiento
                      </label>
                      <span className="text-[10px] text-neutral-500 font-mono">(Automático)</span>
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
                        : '1 mes desde fecha de cobro'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Dumbbell className="w-3.5 h-3.5 text-white" />
                    Disciplina & Arancel Oficial
                  </label>
                  <div className="relative">
                    <select
                      value={disciplina}
                      onChange={(e) => handleDisciplineChange(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:border-white focus:outline-none appearance-none transition-colors cursor-pointer"
                    >
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
              </>
            )}

            {/* MONTO A COBRAR / ABONAR HOY */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-4 h-4 text-white" />
                    Monto a Cobrar Hoy ($)
                  </label>
                  <span className="text-[11px] text-neutral-500 block">
                    {modoCobro === 'renovacion'
                      ? `Arancel de lista: $${precioDisciplina.toLocaleString('es-AR')}`
                      : `Deuda pendiente: $${(member.saldo_pendiente || 0).toLocaleString('es-AR')}`}
                  </span>
                </div>
                <div className="w-40">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    required
                    value={montoAbonado}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setMontoAbonado(val);
                      if (!esMixto) {
                        setMontoEfectivo(val);
                      }
                    }}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-base text-right text-white font-mono font-bold focus:border-white focus:outline-none"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Alerta de pago parcial / saldo pendiente */}
              {esPagoParcial && (
                <div className="bg-amber-950/50 border border-amber-600/50 rounded-lg p-2.5 flex items-start gap-2 text-xs text-amber-200">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Cobro Parcial Detectado</span>
                    <span>
                      El socio abona menos que el arancel total. Se registrará una{' '}
                      <strong>deuda pendiente de ${saldoPendienteCalculado.toLocaleString('es-AR')}</strong>.
                    </span>
                  </div>
                </div>
              )}

              {modoCobro === 'saldar_deuda' && montoAbonado < (member.saldo_pendiente || 0) && (
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-300 flex items-center justify-between">
                  <span>Pago a cuenta de deuda:</span>
                  <span className="font-mono text-amber-300 font-bold">
                    Quedarán debiendo ${saldoPendienteCalculado.toLocaleString('es-AR')}
                  </span>
                </div>
              )}
            </div>

            {/* SELECTOR DE MODALIDAD: ÚNICO VS MIXTO */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-white" />
                  Método de Pago
                </label>
                
                {/* Switch Único / Mixto */}
                <div className="flex items-center bg-neutral-900 p-0.5 rounded-lg border border-neutral-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleToggleMixto(false)}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                      !esMixto
                        ? 'bg-white text-black shadow-sm'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Método Único
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleMixto(true)}
                    className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition-all ${
                      esMixto
                        ? 'bg-white text-black shadow-sm'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Split className="w-3 h-3" />
                    Combinado / Mixto
                  </button>
                </div>
              </div>

              {/* OPCIÓN A: MÉTODO ÚNICO */}
              {!esMixto && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {PAYMENT_METHODS.map((pm) => {
                    const isSelected = metodoSimple === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setMetodoSimple(pm.id)}
                        className={`py-2 px-1 rounded-lg text-xs font-bold transition-all border text-center ${
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
              )}

              {/* OPCIÓN B: MÉTODO COMBINADO / MIXTO (DESGLOSE MULTI-MÉTODO) */}
              {esMixto && (
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3.5 space-y-3">
                  <div className="text-[11px] text-neutral-400 flex items-center justify-between pb-1 border-b border-neutral-850">
                    <span>Indica cuánto abona con cada método:</span>
                    <span className="font-mono text-neutral-300">
                      Objetivo: <strong>${montoAbonado.toLocaleString('es-AR')}</strong>
                    </span>
                  </div>

                  {/* Efectivo */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-neutral-200 w-28">💵 Efectivo</span>
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={montoEfectivo || ''}
                        onChange={(e) => setMontoEfectivo(Number(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-white focus:outline-none text-right"
                      />
                      {diferenciaDesglose !== 0 && (
                        <button
                          type="button"
                          onClick={() => autoCompletarResto('Efectivo')}
                          title="Asignar el saldo restante a Efectivo"
                          className="px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px] font-mono whitespace-nowrap"
                        >
                          Resto
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Transferencia */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-neutral-200 w-28">📱 Transferencia</span>
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={montoTransferencia || ''}
                        onChange={(e) => setMontoTransferencia(Number(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-white focus:outline-none text-right"
                      />
                      {diferenciaDesglose !== 0 && (
                        <button
                          type="button"
                          onClick={() => autoCompletarResto('Transferencia')}
                          title="Asignar el saldo restante a Transferencia"
                          className="px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px] font-mono whitespace-nowrap"
                        >
                          Resto
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tarjeta de Débito */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-neutral-200 w-28">💳 T. Débito</span>
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={montoDebito || ''}
                        onChange={(e) => setMontoDebito(Number(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-white focus:outline-none text-right"
                      />
                      {diferenciaDesglose !== 0 && (
                        <button
                          type="button"
                          onClick={() => autoCompletarResto('Tarjeta de débito')}
                          title="Asignar el saldo restante a Débito"
                          className="px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px] font-mono whitespace-nowrap"
                        >
                          Resto
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tarjeta de Crédito */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-neutral-200 w-28">💳 T. Crédito</span>
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={montoCredito || ''}
                        onChange={(e) => setMontoCredito(Number(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-white focus:outline-none text-right"
                      />
                      {diferenciaDesglose !== 0 && (
                        <button
                          type="button"
                          onClick={() => autoCompletarResto('Tarjeta de crédito')}
                          title="Asignar el saldo restante a Crédito"
                          className="px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px] font-mono whitespace-nowrap"
                        >
                          Resto
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Pago con QR */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-neutral-200 w-28">📲 Pago QR</span>
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={montoQr || ''}
                        onChange={(e) => setMontoQr(Number(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-white focus:outline-none text-right"
                      />
                      {diferenciaDesglose !== 0 && (
                        <button
                          type="button"
                          onClick={() => autoCompletarResto('Pago con QR')}
                          title="Asignar el saldo restante a Pago QR"
                          className="px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[10px] font-mono whitespace-nowrap"
                        >
                          Resto
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Balance / Cuadratura de métodos */}
                  <div className={`pt-2 border-t border-neutral-850 flex items-center justify-between text-xs ${
                    desgloseValido ? 'text-green-400' : 'text-amber-400 font-bold'
                  }`}>
                    <span>
                      {desgloseValido ? '✓ Desglose balanceado:' : '⚠️ Diferencia en desglose:'}
                    </span>
                    <span className="font-mono">
                      Suma: ${sumaDesglose.toLocaleString('es-AR')}{' '}
                      {diferenciaDesglose !== 0 && (
                        <span className="text-amber-300">
                          ({diferenciaDesglose > 0 ? `faltan $${diferenciaDesglose.toLocaleString('es-AR')}` : `sobran $${Math.abs(diferenciaDesglose).toLocaleString('es-AR')}`})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Notas / Observaciones Opcionales */}
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-neutral-400" />
                Notas del Pago (Opcional)
              </label>
              <input
                type="text"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej. Seña entregada en caja, compromiso de saldo"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-white focus:outline-none"
              />
            </div>

            {/* Resumen Final de Transacción */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs space-y-1 text-neutral-400">
              <div className="flex justify-between">
                <span>Total a registrar en caja:</span>
                <span className="text-white font-bold font-mono">
                  ${montoAbonado.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Modalidad:</span>
                <span className="text-neutral-200 font-medium">
                  {esMixto ? 'Combinado / Mixto' : metodoSimple}
                </span>
              </div>
              {modoCobro === 'renovacion' && (
                <div className="flex justify-between">
                  <span>Próximo vencimiento:</span>
                  <span className="text-white font-mono">
                    {formatDisplayDate(fechaVencimiento)}
                  </span>
                </div>
              )}
              {saldoPendienteCalculado > 0 && (
                <div className="flex justify-between text-amber-300 font-bold pt-1 border-t border-neutral-900">
                  <span>Saldo deudor que quedará:</span>
                  <span className="font-mono">
                    ${saldoPendienteCalculado.toLocaleString('es-AR')}
                  </span>
                </div>
              )}
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
                disabled={loading || (esMixto && !desgloseValido)}
                className="px-5 py-2.5 rounded-lg bg-white hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-black text-xs font-black tracking-wider uppercase flex items-center gap-2 transition-all shadow-md"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      {modoCobro === 'saldar_deuda' ? 'Registrar Cobro de Deuda' : 'Confirmar Cobro'}
                    </span>
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
