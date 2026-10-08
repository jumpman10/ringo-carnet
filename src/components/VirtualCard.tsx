import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { Member } from '../types';
import { getCalculatedStatus, formatDisplayDate } from '../lib/dateUtils';
import {
  Download,
  Share2,
  Calendar,
  Phone,
  Dumbbell,
  Check,
  AlertCircle,
  QrCode,
  User
} from 'lucide-react';

interface VirtualCardProps {
  member: Member;
  onClose?: () => void;
  showActions?: boolean;
}

export const VirtualCard: React.FC<VirtualCardProps> = ({ member, onClose, showActions = true }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const cardRef = useRef<HTMLDivElement>(null);
  const statusInfo = getCalculatedStatus(member.fecha_vencimiento, member.estado_pago);

  useEffect(() => {
    QRCode.toDataURL(member.codigo_qr, {
      width: 320,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generating QR:', err));
  }, [member.codigo_qr]);

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `Carnet_${member.apellido}_${member.dni}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Carnet Ringo - ${member.nombre} ${member.apellido}`,
          text: `Carnet Ringo Gym | Socio: ${member.nombre} ${member.apellido} | DNI: ${member.dni} | Disciplina: ${member.disciplina}`,
          url: window.location.href,
        });
      } catch (e) {
        console.debug('Share dismissed');
      }
    } else {
      navigator.clipboard.writeText(`Ringo Carnet: ${member.nombre} ${member.apellido} (DNI: ${member.dni})`);
      alert('Información del carnet copiada al portapapeles');
    }
  };

  const daysTotal = 30;
  const daysLeft = Math.max(0, Math.min(statusInfo.daysRemaining, daysTotal));
  const progressPercent = Math.min(100, Math.max(5, (daysLeft / daysTotal) * 100));

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto">
      {/* Physical Virtual Card UI - Black & White Minimalist Design */}
      <div
        ref={cardRef}
        className="w-full bg-[#0a0a0a] rounded-2xl p-4 sm:p-5 border border-white/20 shadow-2xl relative overflow-hidden text-white"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-black text-base">
              R
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-widest text-white uppercase">RINGO GYM</span>
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-700">
                  PASS
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 tracking-wider uppercase">Socio Digital</p>
            </div>
          </div>

          {/* Status Badge - Monochrome */}
          <div className="flex items-center">
            {statusInfo.membershipStatus === 'activo' ? (
              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-white text-black border border-white flex items-center gap-1">
                <Check className="w-3 h-3 stroke-[3]" />
                AL DÍA
              </span>
            ) : statusInfo.membershipStatus === 'por_vencer' ? (
              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-neutral-900 text-white border border-neutral-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                POR VENCER
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-black text-neutral-400 border border-neutral-800 line-through">
                VENCIDO
              </span>
            )}
          </div>
        </div>

        {/* Member Profile Row */}
        <div className="flex items-center gap-3.5 mb-4">
          {member.foto_url ? (
            <img
              src={member.foto_url}
              alt={`${member.nombre} ${member.apellido}`}
              className="w-16 h-16 rounded-xl object-cover border border-neutral-700 bg-neutral-900 shrink-0 transition-all"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl border border-dashed border-neutral-700 bg-neutral-950 flex flex-col items-center justify-center text-neutral-500 shrink-0">
              <User className="w-6 h-6 stroke-[1.5] text-neutral-600 mb-0.5" />
              <span className="text-[8px] font-mono tracking-tighter uppercase text-neutral-400">
                Sin foto
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h4 className="text-base sm:text-lg font-black text-white truncate leading-tight tracking-tight">
              {member.nombre} {member.apellido}
            </h4>
            <p className="text-xs text-neutral-400 font-mono mt-0.5">DNI: {member.dni}</p>

            <div className="mt-1.5 flex items-center">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-neutral-900 text-neutral-200 px-2 py-0.5 rounded border border-neutral-800">
                <Dumbbell className="w-3 h-3 text-white" />
                {member.disciplina}
              </span>
            </div>
          </div>
        </div>

        {/* QR Code Container - Pure High Contrast */}
        <div className="bg-white rounded-xl p-3 flex flex-col items-center justify-center my-3">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Membresía" className="w-44 h-44 object-contain" />
          ) : (
            <div className="w-44 h-44 flex items-center justify-center text-black">
              <QrCode className="w-10 h-10 animate-spin" />
            </div>
          )}
          <div className="text-[10px] font-mono font-bold text-black tracking-wider text-center mt-1">
            {member.codigo_qr}
          </div>
          <div className="text-[9px] text-neutral-600 uppercase tracking-widest text-center mt-0.5">
            Escanear en portería
          </div>
        </div>

        {/* Days Remaining Counter - Clean Monochrome */}
        <div className="bg-neutral-950 rounded-xl p-3 border border-neutral-800 mb-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-neutral-400 font-medium">Días restantes:</span>
            <span
              className={`font-black text-sm font-mono ${statusInfo.daysRemaining <= 2
                ? statusInfo.daysRemaining < 0
                  ? 'text-neutral-500'
                  : 'text-white underline decoration-white decoration-2'
                : 'text-white'
                }`}
            >
              {statusInfo.daysRemaining < 0
                ? `${Math.abs(statusInfo.daysRemaining)} DÍAS VENCIDO`
                : `${statusInfo.daysRemaining} DÍAS`}
            </span>
          </div>

          {/* Progress bar monochrome */}
          <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden border border-neutral-800">
            <div
              className="h-full bg-white transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-neutral-400 mt-2.5 pt-2 border-t border-neutral-900">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-neutral-500" />
              <span>Alta: {formatDisplayDate(member.fecha_ingreso)}</span>
            </div>
            <div className="flex items-center gap-1 font-semibold text-white">
              <span>Vence: {formatDisplayDate(member.fecha_vencimiento)}</span>
            </div>
          </div>
        </div>

        {/* Card Footer Info */}
        <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1 border-t border-neutral-900">
          <span className="flex items-center gap-1 font-mono">
            <Phone className="w-3 h-3" /> {member.telefono}
          </span>
          <span className="font-mono text-[9px] uppercase">ID: {member.id.slice(0, 8)}</span>
        </div>
      </div>

      {/* Action Buttons - Mobile friendly */}
      {showActions && (
        <div className="flex items-center gap-2 mt-3 w-full justify-center no-print">
          <button
            onClick={handleDownload}
            className="flex-1 py-2.5 px-3 bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white text-xs font-bold rounded-xl border border-neutral-700 transition-all flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar
          </button>
        </div>
      )}
    </div>
  );
};
