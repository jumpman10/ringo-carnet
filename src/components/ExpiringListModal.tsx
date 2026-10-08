import React, { useState } from 'react';
import { Member } from '../types';
import { getDaysRemaining, formatDisplayDate, buildWhatsAppLink } from '../lib/dateUtils';
import { MemberAvatar } from './MemberAvatar';
import {
  X,
  MessageCircle,
  Clock,
  Send,
  Copy,
  Check,
  Calendar,
  Phone,
  Dumbbell
} from 'lucide-react';

interface ExpiringListModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
}

export const ExpiringListModal: React.FC<ExpiringListModalProps> = ({ isOpen, onClose, members }) => {
  const [filterType, setFilterType] = useState<'all_critical' | 'two_days' | 'today_tomorrow' | 'expired'>('all_critical');
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});
  const [copiedBatch, setCopiedBatch] = useState(false);

  if (!isOpen) return null;

  const criticalMembers = members.filter((m) => {
    const days = getDaysRemaining(m.fecha_vencimiento);
    if (filterType === 'two_days') return days === 2;
    if (filterType === 'today_tomorrow') return days >= 0 && days <= 1;
    if (filterType === 'expired') return days < 0;
    return days <= 2;
  }).sort((a, b) => getDaysRemaining(a.fecha_vencimiento) - getDaysRemaining(b.fecha_vencimiento));

  const handleSendIndividual = (member: Member) => {
    const days = getDaysRemaining(member.fecha_vencimiento);
    const link = buildWhatsAppLink(
      member.nombre,
      member.disciplina,
      member.fecha_vencimiento,
      member.telefono,
      days
    );
    window.open(link, '_blank');
    setSentMap((prev) => ({ ...prev, [member.id]: true }));
  };

  const handleBulkSequential = () => {
    if (criticalMembers.length === 0) return;
    const confirmSend = window.confirm(
      `Se abrirán los chats de WhatsApp para los ${criticalMembers.length} socios. ¿Comenzar?`
    );
    if (!confirmSend) return;

    criticalMembers.forEach((member, index) => {
      setTimeout(() => {
        const days = getDaysRemaining(member.fecha_vencimiento);
        const link = buildWhatsAppLink(
          member.nombre,
          member.disciplina,
          member.fecha_vencimiento,
          member.telefono,
          days
        );
        window.open(link, '_blank');
        setSentMap((prev) => ({ ...prev, [member.id]: true }));
      }, index * 1200);
    });
  };

  const handleCopySummary = () => {
    const lines = criticalMembers.map((m) => {
      const days = getDaysRemaining(m.fecha_vencimiento);
      return `${m.nombre} ${m.apellido} (${m.disciplina}) - Tel: ${m.telefono} - Vence: ${m.fecha_vencimiento} (${days} días)`;
    });
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedBatch(true);
    setTimeout(() => setCopiedBatch(false), 2500);
  };

  const pendingCount = criticalMembers.filter((m) => !sentMap[m.id]).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/90 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative my-4 sm:my-8 flex flex-col max-h-[90vh]">
        {/* Header - B&W */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-800 bg-black shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-white uppercase tracking-wider">
                  Vencimientos (≤ 2 Días)
                </h3>
                <span className="bg-neutral-900 text-white border border-neutral-700 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
                  {criticalMembers.length}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Avisos personalizados de WhatsApp (individual o masivo)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded hover:bg-neutral-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters and Actions Bar - Mobile First */}
        <div className="p-3 bg-black border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs">
            <button
              onClick={() => setFilterType('all_critical')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors ${
                filterType === 'all_critical'
                  ? 'bg-white text-black'
                  : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              Todos (≤ 2d)
            </button>
            <button
              onClick={() => setFilterType('two_days')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors ${
                filterType === 'two_days'
                  ? 'bg-white text-black'
                  : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              Exacto 2 días
            </button>
            <button
              onClick={() => setFilterType('today_tomorrow')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors ${
                filterType === 'today_tomorrow'
                  ? 'bg-white text-black'
                  : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              Hoy y Mañana
            </button>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={handleCopySummary}
              className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs rounded-md border border-neutral-800 flex items-center gap-1 font-mono"
            >
              {copiedBatch ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
              {copiedBatch ? 'Copiado' : 'Copiar'}
            </button>

            <button
              onClick={handleBulkSequential}
              disabled={criticalMembers.length === 0}
              className="px-3 py-1 bg-white hover:bg-neutral-200 text-black text-xs font-black uppercase tracking-wider rounded-md flex items-center gap-1 disabled:opacity-40 active:scale-95 transition-all"
            >
              <Send className="w-3 h-3" />
              <span>Enviar a Todos ({pendingCount})</span>
            </button>
          </div>
        </div>

        {/* List of members - Mobile card friendly */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-2">
          {criticalMembers.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 font-mono text-xs">
              No hay socios pendientes de aviso en este filtro.
            </div>
          ) : (
            criticalMembers.map((member) => {
              const daysRemaining = getDaysRemaining(member.fecha_vencimiento);
              const isSent = Boolean(sentMap[member.id]);

              return (
                <div
                  key={member.id}
                  className="bg-black border border-neutral-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-3">
                    <MemberAvatar
                      src={member.foto_url}
                      name={`${member.nombre} ${member.apellido}`}
                      className="w-10 h-10 rounded-lg"
                    />

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-xs sm:text-sm text-white">
                          {member.nombre} {member.apellido}
                        </h4>
                        <span className="text-[10px] bg-neutral-900 text-neutral-300 px-1.5 py-0.2 rounded border border-neutral-800 font-mono">
                          {member.disciplina}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono mt-0.5">
                        <span>Tel: {member.telefono}</span>
                        <span>•</span>
                        <span>Vence: {formatDisplayDate(member.fecha_vencimiento)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-neutral-900">
                    <span className="font-mono text-[10px] uppercase font-bold text-neutral-300 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
                      {daysRemaining < 0
                        ? `${Math.abs(daysRemaining)}d vencido`
                        : daysRemaining === 0
                        ? 'Vence hoy'
                        : `${daysRemaining} días restantes`}
                    </span>

                    <button
                      onClick={() => handleSendIndividual(member)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono flex items-center gap-1.5 transition-all ${
                        isSent
                          ? 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                          : 'bg-white text-black active:scale-95'
                      }`}
                    >
                      {isSent ? (
                        <>
                          <Check className="w-3 h-3 stroke-[3]" />
                          Enviado
                        </>
                      ) : (
                        <>
                          <MessageCircle className="w-3 h-3" />
                          WhatsApp
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
