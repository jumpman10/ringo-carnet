import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { toJpeg } from 'html-to-image';
import { Member } from '../types';
import { getCalculatedStatus, formatDisplayDate, cleanPhoneNumber } from '../lib/dateUtils';
import logoImg from '../assets/logo.jpg';
import {
  Download,
  Calendar,
  Phone,
  MapPin,
  Dumbbell,
  Check,
  AlertCircle,
  QrCode,
  User,
  Loader2,
  MessageCircle,
} from 'lucide-react';

interface VirtualCardProps {
  member: Member;
  onClose?: () => void;
  showActions?: boolean;
}

export const VirtualCard: React.FC<VirtualCardProps> = ({ member, onClose, showActions = true }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loadingAction, setLoadingAction] = useState<'download' | 'whatsapp' | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const statusInfo = getCalculatedStatus(member.fecha_vencimiento, member.estado_pago);

  const qrCodeText =
    member.codigo_qr ||
    (member.dni ? `RINGO-${String(member.dni).trim()}` : String(member.id || 'SOCIO'));

  useEffect(() => {
    if (!qrCodeText) return;
    QRCode.toDataURL(qrCodeText, {
      width: 480,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generating QR:', err));
  }, [qrCodeText]);

  const getCarnetFileName = (): string => {
    const rawName = `${member.nombre || ''} ${member.apellido || ''}`.trim();
    const slug = rawName
      ? rawName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      : 'socio';
    return `carnet-${slug || 'socio'}.jpg`;
  };

  const generateJpg = async (): Promise<{ dataUrl: string; blob: Blob; fileName: string } | null> => {
    if (!cardRef.current) return null;

    const exportOptions = {
      quality: 0.95,
      pixelRatio: 3,
      backgroundColor: '#0a0a0a',
      cacheBust: true,
      filter: (node: Node) => {
        if (node instanceof Element && node.getAttribute('data-export-hide') === 'true') {
          return false;
        }
        return true;
      },
    };

    let dataUrl: string;
    try {
      dataUrl = await toJpeg(cardRef.current, exportOptions);
    } catch (err) {
      console.warn('Reintentando captura con skipFonts:', err);
      dataUrl = await toJpeg(cardRef.current, {
        ...exportOptions,
        skipFonts: true,
      });
    }

    const fileName = getCarnetFileName();
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    return { dataUrl, blob, fileName };
  };

  const triggerDownload = (dataUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownload = async () => {
    if (!cardRef.current || loadingAction) return;

    setLoadingAction('download');
    try {
      const result = await generateJpg();
      if (!result) return;
      triggerDownload(result.dataUrl, result.fileName);
    } catch (error) {
      console.error('Error al generar el carnet en JPG:', error);
      alert('Hubo un inconveniente al generar la imagen del carnet. Por favor intentá nuevamente.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleWhatsAppShare = async () => {
    if (!cardRef.current || loadingAction) return;

    setLoadingAction('whatsapp');
    setFeedbackMessage(null);
    try {
      const result = await generateJpg();
      if (!result) return;

      const file = new File([result.blob], result.fileName, { type: 'image/jpeg' });
      const memberFullName = `${member.nombre || ''} ${member.apellido || ''}`.trim() || 'Socio';
      const shareMessage = `¡Hola ${member.nombre || 'socio'}! Te compartimos tu carnet digital de Ringo Gym 🥊`;

      const canShareFiles =
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] });

      if (canShareFiles) {
        try {
          await navigator.share({
            files: [file],
            title: `Carnet Ringo - ${memberFullName}`,
            text: shareMessage,
          });
          return;
        } catch (shareErr: unknown) {
          if (shareErr instanceof Error && shareErr.name === 'AbortError') {
            return;
          }
          console.warn('Fallo navigator.share, ejecutando fallback:', shareErr);
        }
      }

      // Fallback para navegadores de escritorio o sin soporte de Web Share con archivos:
      // 1. Descarga automática del archivo JPG
      triggerDownload(result.dataUrl, result.fileName);

      // 2. Intentar copiar imagen al portapapeles para pegar directo en WhatsApp Web
      let copiedToClipboard = false;
      try {
        if (typeof window !== 'undefined' && navigator.clipboard && window.ClipboardItem) {
          const pngBlob = await new Promise<Blob | null>((resolve) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth || img.width;
              canvas.height = img.naturalHeight || img.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((blob) => resolve(blob), 'image/png');
              } else {
                resolve(null);
              }
            };
            img.onerror = () => resolve(null);
            img.src = result.dataUrl;
          });

          if (pngBlob) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': pngBlob }),
            ]);
            copiedToClipboard = true;
          }
        }
      } catch (clipErr) {
        console.debug('No se pudo copiar al portapapeles (opcional):', clipErr);
      }

      // 3. Abrir chat de WhatsApp
      const cleanPhone = cleanPhoneNumber(member.telefono || '');
      const whatsappUrl = cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(shareMessage)}`
        : `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;

      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

      // 4. Mensaje de retroalimentación
      if (copiedToClipboard) {
        setFeedbackMessage('¡Carnet descargado y copiado! En WhatsApp Web pegalo con Ctrl+V (o Cmd+V).');
      } else {
        setFeedbackMessage('Carnet JPG descargado. Se abrió WhatsApp para que lo adjuntes.');
      }
      setTimeout(() => setFeedbackMessage(null), 6000);
    } catch (error) {
      console.error('Error al compartir el carnet por WhatsApp:', error);
      alert('Hubo un inconveniente al generar el carnet. Por favor intentá nuevamente.');
    } finally {
      setLoadingAction(null);
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
        <div className="relative border-b border-neutral-800 pb-3 mb-4">
          {/* Status Badge - Export Hidden */}
          <div data-export-hide="true" className="absolute top-0 right-0 z-10">
            {statusInfo.membershipStatus === 'activo' ? (
              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-white text-black border border-white flex items-center gap-1 shadow-sm">
                <Check className="w-3 h-3 stroke-[3]" />
                AL DÍA
              </span>
            ) : statusInfo.membershipStatus === 'por_vencer' ? (
              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-neutral-900 text-white border border-neutral-400 flex items-center gap-1 shadow-sm">
                <AlertCircle className="w-3 h-3" />
                POR VENCER
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-black text-neutral-400 border border-neutral-800 line-through shadow-sm">
                VENCIDO
              </span>
            )}
          </div>

          {/* Centered Brand Header */}
          <div className="flex flex-col items-center justify-center text-center">
            <div className="bg-[#f7f7f7] rounded-xl px-3 py-1.5 shadow-sm inline-flex items-center justify-center">
              <img
                src={logoImg}
                alt="Ringo Gym Logo"
                className="h-12 sm:h-14 w-auto object-contain"
              />
            </div>
            <div className="mt-2.5 flex flex-col items-center gap-0.5 text-center">
              <span className="flex items-center gap-1.5 text-xs text-neutral-300 font-mono tracking-wide">
                <Phone className="w-3 h-3 text-neutral-400" />
                +543813424213
              </span>
              <span className="flex items-center gap-1.5 text-xs text-neutral-400 font-medium tracking-wide">
                <MapPin className="w-3 h-3 text-neutral-400" />
                Marcos Paz 419
              </span>
            </div>
          </div>
        </div>

        {/* Member Profile Row */}
        <div className="flex items-center gap-3.5 mb-4">
          {member.foto_url ? (
            <img
              src={member.foto_url}
              alt={`${member.nombre} ${member.apellido}`}
              className="w-16 h-16 rounded-xl object-cover border border-neutral-700 bg-neutral-900 shrink-0 transition-all"
              crossOrigin="anonymous"
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
            {qrCodeText}
          </div>
          <div className="text-[9px] text-neutral-600 uppercase tracking-widest text-center mt-0.5">
            Escanear en portería
          </div>
        </div>

        {/* Days Remaining Counter - Clean Monochrome */}
        <div data-export-hide="true" className="bg-neutral-950 rounded-xl p-3 border border-neutral-800 mb-3">
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
              <span>Alta: {formatDisplayDate(member.fecha_ingreso || (member as any).fecha_inicio || (member as any).start_date || '')}</span>
            </div>
            <div className="flex items-center gap-1 font-semibold text-white">
              <span>Vence: {formatDisplayDate(member.fecha_vencimiento || (member as any).end_date || '')}</span>
            </div>
          </div>
        </div>

        {/* Card Footer Info */}
        <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1 border-t border-neutral-900">
          <span className="flex items-center gap-1 font-mono">
            <Phone className="w-3 h-3" /> {member.telefono || '-'}
          </span>
          {member.fecha_nacimiento && (
            <span className="font-mono text-[9px] text-neutral-500">
              Nac: {formatDisplayDate(member.fecha_nacimiento)}
            </span>
          )}
          <span className="font-mono text-[9px] uppercase">ID: {member.id ? String(member.id).slice(0, 8) : 'SOCIO'}</span>
        </div>
      </div>

      {/* Action Buttons - Mobile friendly */}
      {showActions && (
        <div className="flex flex-col gap-2 mt-3 w-full no-print">
          <div className="flex items-center gap-2 w-full justify-center">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!qrDataUrl || !!loadingAction}
              className="flex-1 py-2.5 px-3 bg-neutral-900 hover:bg-neutral-800 active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold rounded-xl border border-neutral-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              title="Descargar carnet como imagen JPG"
            >
              {loadingAction === 'download' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generando JPG...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar JPG</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleWhatsAppShare}
              disabled={!qrDataUrl || !!loadingAction}
              className="flex-1 py-2.5 px-3 bg-white hover:bg-neutral-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none text-black text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              title="Compartir carnet JPG por WhatsApp"
            >
              {loadingAction === 'whatsapp' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Preparando...</span>
                </>
              ) : (
                <>
                  <MessageCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>WhatsApp</span>
                </>
              )}
            </button>
          </div>

          {feedbackMessage && (
            <div className="w-full bg-neutral-900 border border-neutral-800 text-neutral-300 rounded-xl p-2.5 text-center text-[11px] font-mono flex items-center justify-center gap-2">
              <Check className="w-3.5 h-3.5 text-white shrink-0 stroke-[2.5]" />
              <span>{feedbackMessage}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
