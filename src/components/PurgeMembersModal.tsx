import React, { useState, useMemo } from 'react';
import { Member, PaymentLog } from '../types';
import {
  getTargetDecemberYear,
  shouldKeepMemberInPurge,
  PurgeResult,
} from '../lib/storage';
import {
  UserX,
  X,
  RefreshCw,
  ShieldAlert,
  Calendar,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface PurgeMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  paymentLogs: PaymentLog[];
  onConfirmPurge: (targetYear: number) => Promise<PurgeResult | void>;
}

export const PurgeMembersModal: React.FC<PurgeMembersModalProps> = ({
  isOpen,
  onClose,
  members,
  paymentLogs,
  onConfirmPurge,
}) => {
  const defaultYear = useMemo(() => getTargetDecemberYear(), []);
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [showDeletedList, setShowDeletedList] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [purgeSuccess, setPurgeSuccess] = useState<PurgeResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Años disponibles basados en el diciembre válido más reciente y ejercicios previos
  const availableYears = useMemo(() => {
    return [defaultYear, defaultYear - 1, defaultYear - 2, defaultYear - 3];
  }, [defaultYear]);

  // Compute preview of members to keep and members to delete
  const { keptMembers, deletedMembers } = useMemo(() => {
    const kept: Member[] = [];
    const deleted: Member[] = [];

    for (const member of members) {
      if (shouldKeepMemberInPurge(member, selectedYear, paymentLogs)) {
        kept.push(member);
      } else {
        deleted.push(member);
      }
    }

    return { keptMembers: kept, deletedMembers: deleted };
  }, [members, selectedYear, paymentLogs]);

  if (!isOpen) return null;

  const handleExecutePurge = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const res = await onConfirmPurge(selectedYear);
      if (res) {
        setPurgeSuccess(res);
      } else {
        setPurgeSuccess({
          success: true,
          targetYear: selectedYear,
          keptCount: keptMembers.length,
          deletedCount: deletedMembers.length,
          deletedIds: deletedMembers.map((m) => m.id),
        });
      }
    } catch (err: any) {
      console.error('Error al depurar usuarios:', err);
      setErrorMessage(err.message || 'Error al ejecutar la depuración.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    setPurgeSuccess(null);
    setErrorMessage(null);
    setShowDeletedList(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0e0e0e] border border-neutral-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/80 bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-950/60 border border-red-800/60 flex items-center justify-center text-red-400">
              <UserX className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Pasar Usuarios / Depuración de Diciembre
              </h3>
              <p className="text-[11px] font-mono text-neutral-400">
                Conservar socios con alta o pagos en Diciembre
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            className="text-neutral-500 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {purgeSuccess ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-950/50 border border-emerald-700/60 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">¡Depuración completada!</h4>
                <p className="text-xs text-neutral-400 mt-1">
                  Se eliminaron correctamente {purgeSuccess.deletedCount} socios. Se conservaron{' '}
                  {purgeSuccess.keptCount} socios correspondientes a Diciembre {purgeSuccess.targetYear}.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2 bg-white text-black font-bold text-xs font-mono rounded-lg hover:bg-neutral-200 transition-colors"
                >
                  Entendido y Cerrar
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Year Selector & Period Notice */}
              <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-neutral-200">Período de Diciembre evaluado:</span>
                    <p className="text-[11px] text-neutral-400 font-mono">
                      Diciembre más reciente ({selectedYear})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="year-select" className="text-xs font-mono text-neutral-400">
                    Año:
                  </label>
                  <select
                    id="year-select"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="bg-black border border-neutral-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-red-500 cursor-pointer"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        Diciembre {yr} {yr === defaultYear ? '(Sugerido)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Main question */}
              <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-red-200">
                      ¿Estás seguro de pasar los usuarios?
                    </h4>
                    <p className="text-xs text-red-300/80 leading-relaxed">
                      Esta operación es permanente. Solo se conservarán los socios que:{' '}
                      <strong className="text-white">ingresaron como nuevos en Diciembre {selectedYear}</strong> o que{' '}
                      <strong className="text-white">tuvieron actividad de pago registrada en Diciembre {selectedYear}</strong>.
                      Todos los demás socios serán eliminados.
                    </p>
                  </div>
                </div>
              </div>

              {/* Metrics preview */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono text-emerald-400">
                    <span>A conservar</span>
                    <span className="font-bold text-sm text-emerald-300">{keptMembers.length}</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-tight">
                    Ingresaron o abonaron en Dic {selectedYear}
                  </p>
                </div>

                <div className="bg-red-950/20 border border-red-800/40 rounded-xl p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono text-red-400">
                    <span>A eliminar</span>
                    <span className="font-bold text-sm text-red-300">{deletedMembers.length}</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-tight">
                    Sin actividad de pago ni alta en Dic {selectedYear}
                  </p>
                </div>
              </div>

              {/* Expandable list of members to delete */}
              {deletedMembers.length > 0 && (
                <div className="border border-neutral-800/90 rounded-xl overflow-hidden bg-black/40">
                  <button
                    type="button"
                    onClick={() => setShowDeletedList(!showDeletedList)}
                    className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-neutral-300 hover:text-white hover:bg-neutral-900/50 transition-colors font-mono"
                  >
                    <span>Ver lista de socios a eliminar ({deletedMembers.length})</span>
                    {showDeletedList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showDeletedList && (
                    <div className="max-h-48 overflow-y-auto divide-y divide-neutral-900 border-t border-neutral-800 px-4 py-2 font-mono text-xs">
                      {deletedMembers.map((m) => (
                        <div key={m.id} className="py-1.5 flex items-center justify-between text-[11px]">
                          <span className="text-neutral-200">
                            {m.apellido}, {m.nombre}
                          </span>
                          <span className="text-neutral-500">
                            DNI: {m.dni} • Ingreso: {m.fecha_ingreso || '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Safety notice */}
              <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-mono bg-neutral-900/40 border border-neutral-800 px-3 py-2 rounded-lg">
                <ShieldAlert className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span>
                  El sistema generará una copia de seguridad automática antes de ejecutar la depuración.
                </span>
              </div>

              {errorMessage && (
                <div className="text-xs text-red-400 bg-red-950/40 border border-red-800 px-3 py-2 rounded-lg">
                  {errorMessage}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        {!purgeSuccess && (
          <div className="px-6 py-3.5 border-t border-neutral-800/80 bg-neutral-950/60 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-mono font-semibold text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg border border-neutral-700/80 transition-colors disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExecutePurge}
              disabled={isProcessing || deletedMembers.length === 0}
              className="px-4 py-2 text-xs font-mono font-bold text-white bg-red-600 hover:bg-red-500 active:scale-95 rounded-lg border border-red-500/80 transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <UserX className="w-3.5 h-3.5" />
                  <span>Sí, pasar usuarios</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

