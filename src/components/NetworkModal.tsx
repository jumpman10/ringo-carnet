import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import {
  X,
  Smartphone,
  Wifi,
  Download,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  ShieldAlert,
  Database,
  ExternalLink,
} from 'lucide-react';

interface NetworkInfo {
  ip: string;
  port: number;
  url: string;
}

interface NetworkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NetworkModal: React.FC<NetworkModalProps> = ({ isOpen, onClose }) => {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchNetworkInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/network-info');
      if (!res.ok) {
        throw new Error(`Error HTTP ${res.status}: no se pudo obtener los datos de red.`);
      }
      const data: NetworkInfo = await res.json();
      setNetworkInfo(data);
    } catch (err: any) {
      console.error('Error fetching network info:', err);
      setError(err.message || 'No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNetworkInfo();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!networkInfo?.url) return;
    try {
      await navigator.clipboard.writeText(networkInfo.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error copying URL to clipboard:', err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="min-h-full flex items-center justify-center p-2.5 sm:p-4">
        <div
          className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative my-auto flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-800 bg-black shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-black text-white uppercase tracking-wider">
                  Conexión Celular y Backup
                </h2>
                <p className="text-[11px] text-neutral-400 font-mono">
                  Escaneo por Wi-Fi y respaldo de base de datos
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-900 transition-colors"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-neutral-400" />
                <p className="text-xs font-mono text-neutral-400">Detectando IP de red local...</p>
              </div>
            ) : error ? (
              <div className="p-4 bg-red-950/40 border border-red-800/80 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-red-400">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p className="text-xs font-medium">{error}</p>
                </div>
                <button
                  onClick={fetchNetworkInfo}
                  className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg border border-neutral-700 text-xs font-mono flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reintentar</span>
                </button>
              </div>
            ) : networkInfo ? (
              <>
                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-xl flex items-center justify-center border-4 border-neutral-800">
                    <QRCodeCanvas
                      value={networkInfo.url}
                      size={210}
                      level="M"
                      marginSize={1}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    IP Detectada: <strong className="text-white">{networkInfo.ip}</strong>
                  </span>
                </div>

                {/* URL Display with Copy button */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                    URL de acceso móvil
                  </label>
                  <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-xl p-2 sm:p-2.5">
                    <span className="flex-1 font-mono text-xs sm:text-sm text-emerald-400 truncate px-2 select-all">
                      {networkInfo.url}
                    </span>
                    <button
                      onClick={handleCopy}
                      className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-white rounded-lg text-xs font-mono flex items-center gap-1.5 shrink-0 transition-all border border-neutral-700"
                      title="Copiar URL al portapapeles"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 3 Pasos para conectar */}
                <div className="space-y-2.5 bg-neutral-900/60 border border-neutral-800/80 rounded-xl p-3.5 sm:p-4">
                  <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                    <span>Pasos para conectar el celular por Wi-Fi</span>
                  </h3>
                  <ol className="space-y-2 text-xs text-neutral-300">
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-200 flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5 border border-neutral-700">
                        1
                      </span>
                      <div>
                        <strong className="text-white">Mismo Wi-Fi:</strong> Asegurate de que el celular esté conectado a la misma red Wi-Fi que esta computadora.
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-200 flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5 border border-neutral-700">
                        2
                      </span>
                      <div>
                        <strong className="text-white">Escanear QR:</strong> Abrí la cámara del celular y apuntá al código QR superior (o escribí la URL en el navegador móvil).
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-200 flex items-center justify-center font-mono font-bold text-[11px] shrink-0 mt-0.5 border border-neutral-700">
                        3
                      </span>
                      <div>
                        <strong className="text-white">Alerta de seguridad:</strong> En la alerta de seguridad del navegador móvil tocar <span className="text-amber-300 font-semibold">'Configuración avanzada'</span> -&gt; <span className="text-amber-300 font-semibold">'Continuar al sitio'</span> para habilitar el uso seguro de la cámara.
                      </div>
                    </li>
                  </ol>
                </div>
              </>
            ) : null}

            {/* Backup Section */}
            <div className="pt-2 border-t border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Copia de Seguridad de la Base de Datos</span>
                  </h3>
                  <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                    Descargá el archivo completo con socios, cuotas y asistencias
                  </p>
                </div>
              </div>

              <a
                href="/api/backup"
                download="gimnasio-backup.db"
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-xl flex items-center justify-center gap-2 text-xs font-mono transition-all shadow-md"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Descargar Copia de Seguridad (.db)</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
