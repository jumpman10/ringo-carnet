import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Member, AccessLog } from '../types';
import { getCalculatedStatus, formatDisplayDate } from '../lib/dateUtils';
import { playSuccessChime, playWarningBeep } from '../lib/sound';
import { MemberAvatar } from './MemberAvatar';
import {
  X,
  Camera,
  Check,
  AlertCircle,
  RefreshCw,
  CreditCard,
  Calendar,
  Dumbbell,
  Upload
} from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  onLogAccess: (log: Omit<AccessLog, 'id' | 'timestamp'>) => Promise<void>;
  onRenewMember: (memberId: string) => Promise<void>;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  members,
  onLogAccess,
  onRenewMember,
}) => {
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [matchedMember, setMatchedMember] = useState<Member | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [accessLogged, setAccessLogged] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'ringo-qr-reader';

  const processQrToken = (rawText: string) => {
    setScannedResult(rawText);
    const cleaned = rawText.trim();

    const found = members.find(
      (m) =>
        m.codigo_qr.toUpperCase() === cleaned.toUpperCase() ||
        m.dni === cleaned ||
        cleaned.includes(m.dni) ||
        m.id === cleaned
    );

    if (found) {
      setMatchedMember(found);
      const status = getCalculatedStatus(found.fecha_vencimiento, found.estado_pago);
      const isAuthorized = status.membershipStatus !== 'vencido' && found.estado_pago === 'pagado';

      if (isAuthorized) {
        playSuccessChime();
      } else {
        playWarningBeep();
      }

      onLogAccess({
        member_id: found.id,
        dni: found.dni,
        member_name: `${found.nombre} ${found.apellido}`,
        disciplina: found.disciplina,
        autorizado: isAuthorized,
        motivo: isAuthorized ? 'Acceso Válido - Al Día' : 'Denegado - Membresía vencida o impago',
      });
      setAccessLogged(true);
    } else {
      setMatchedMember(null);
      playWarningBeep();
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (isOpen && !scannedResult) {
      setCameraError(null);
      setAccessLogged(false);

      const startScanner = async () => {
        try {
          const html5QrCode = new Html5Qrcode(containerId);
          scannerRef.current = html5QrCode;

          const config = {
            fps: 10,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1.0,
          };

          await html5QrCode.start(
            { facingMode: 'environment' },
            config,
            (decodedText) => {
              if (isMounted) {
                html5QrCode.stop().then(() => {
                  processQrToken(decodedText);
                }).catch(() => {
                  processQrToken(decodedText);
                });
              }
            },
            () => {}
          );

          if (isMounted) {
            setIsScanning(true);
          }
        } catch (err: any) {
          if (isMounted) {
            setCameraError('Permiso de cámara no disponible o en uso. Puedes ingresar el DNI manualmente.');
            setIsScanning(false);
          }
        }
      };

      const timer = setTimeout(() => {
        startScanner();
      }, 300);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        if (scannerRef.current && scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {});
        }
      };
    }

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [isOpen, scannedResult]);

  const handleResetScan = () => {
    setScannedResult(null);
    setMatchedMember(null);
    setAccessLogged(false);
    setManualCode('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const html5QrCode = new Html5Qrcode('file-scanner-temp');
      const decodedText = await html5QrCode.scanFile(file, true);
      processQrToken(decodedText);
    } catch (err) {
      alert('No se detectó un código QR válido en la imagen.');
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    processQrToken(manualCode.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/90 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative my-4 sm:my-8">
        {/* Header - Monochrome */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-black">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white uppercase tracking-wider">Control de Acceso QR</h3>
              <p className="text-[10px] text-neutral-400 font-mono">Portería Ringo Gym</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().catch(() => {});
              }
              onClose();
            }}
            className="text-neutral-400 hover:text-white p-1 rounded hover:bg-neutral-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-5">
          {/* STATE 1: SCANNING */}
          {!scannedResult && (
            <div className="space-y-3 sm:space-y-4">
              {/* Camera Preview Area - Clean B&W */}
              <div className="relative rounded-xl overflow-hidden bg-black aspect-square max-w-[280px] mx-auto border-2 border-neutral-800 flex items-center justify-center">
                <div id={containerId} className="w-full h-full" />
                <div className="absolute inset-4 pointer-events-none border border-white/40 rounded-lg flex items-center justify-center">
                  <div className="w-8 h-0.5 bg-white" />
                </div>
              </div>

              {cameraError && (
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-400">
                  {cameraError}
                </div>
              )}

              {/* Manual search and Upload */}
              <div className="bg-black p-3 rounded-xl border border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="font-mono text-[11px]">Validación Rápida:</span>
                  <label className="cursor-pointer text-white hover:underline flex items-center gap-1 font-mono text-[11px]">
                    <Upload className="w-3 h-3" />
                    Subir foto
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>

                <form onSubmit={handleManualSearch} className="flex gap-1.5">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="DNI o Código de carnet..."
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white font-mono"
                  />
                  <button
                    type="submit"
                    className="bg-white text-black text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                  >
                    Validar
                  </button>
                </form>

                {/* Quick test member tags */}
                <div className="pt-2 border-t border-neutral-900">
                  <span className="text-[10px] text-neutral-500 uppercase font-mono block mb-1">
                    Prueba rápida con socios:
                  </span>
                  <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                    {members.slice(0, 4).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => processQrToken(m.codigo_qr)}
                        className="text-[10px] px-2 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 font-mono"
                      >
                        {m.nombre} ({m.dni})
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div id="file-scanner-temp" className="hidden" />

          {/* STATE 2: SCAN RESULT INSPECTION */}
          {scannedResult && (
            <div className="space-y-3">
              {matchedMember ? (
                (() => {
                  const status = getCalculatedStatus(matchedMember.fecha_vencimiento, matchedMember.estado_pago);
                  const isAuthorized = status.membershipStatus !== 'vencido' && matchedMember.estado_pago === 'pagado';

                  return (
                    <div className="space-y-3">
                      {/* B&W Authorization Header */}
                      <div
                        className={`rounded-xl p-4 border text-center ${
                          isAuthorized
                            ? 'bg-white text-black border-white'
                            : 'bg-black text-white border-neutral-700'
                        }`}
                      >
                        <div className="text-2xl font-black uppercase tracking-wider font-mono">
                          {isAuthorized ? 'ACCESO AUTORIZADO' : 'ACCESO DENEGADO'}
                        </div>
                        <p className={`text-xs mt-1 font-mono ${isAuthorized ? 'text-neutral-800' : 'text-neutral-400'}`}>
                          {isAuthorized
                            ? 'Membresía al día • Adelante'
                            : matchedMember.estado_pago === 'pendiente'
                            ? 'Cuota pendiente de pago'
                            : 'Membresía mensual vencida'}
                        </p>
                      </div>

                      {/* Member Info Card */}
                      <div className="bg-black border border-neutral-800 rounded-xl p-3.5 space-y-2.5">
                        <div className="flex items-center gap-3">
                          <MemberAvatar
                            src={matchedMember.foto_url}
                            name={`${matchedMember.nombre} ${matchedMember.apellido}`}
                            className="w-12 h-12 rounded-lg"
                          />
                          <div>
                            <h4 className="font-black text-sm text-white">
                              {matchedMember.nombre} {matchedMember.apellido}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-400 font-mono">
                              <span>DNI: {matchedMember.dni}</span>
                              <span>•</span>
                              <span>{matchedMember.disciplina}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-neutral-900">
                          <div>
                            <span className="text-[10px] text-neutral-500 uppercase block">Vencimiento</span>
                            <span className="text-white font-bold">
                              {formatDisplayDate(matchedMember.fecha_vencimiento)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-neutral-500 uppercase block">Días Restantes</span>
                            <span className="text-white font-bold">
                              {status.daysRemaining < 0
                                ? `${Math.abs(status.daysRemaining)}d vencido`
                                : `${status.daysRemaining} días`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="space-y-1.5 pt-1">
                        {!isAuthorized && (
                          <button
                            type="button"
                            onClick={async () => {
                              await onRenewMember(matchedMember.id);
                              handleResetScan();
                            }}
                            className="w-full py-2.5 px-4 bg-white hover:bg-neutral-200 active:scale-95 text-black font-black text-xs uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2"
                          >
                            <CreditCard className="w-4 h-4" />
                            Cobrar y Renovar Mes Ahora
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleResetScan}
                          className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white text-xs font-bold rounded-lg border border-neutral-700 flex items-center justify-center gap-2"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Escanear Siguiente Socio
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* Unmatched */
                <div className="text-center py-6 space-y-3">
                  <div className="text-base font-black text-white font-mono">CÓDIGO NO ENCONTRADO</div>
                  <p className="text-xs text-neutral-400 font-mono break-all px-4">
                    "{scannedResult}"
                  </p>
                  <button
                    type="button"
                    onClick={handleResetScan}
                    className="py-2 px-4 bg-white text-black text-xs font-bold rounded-lg inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reintentar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
