import React, { useState, useEffect } from 'react';
import { X, Server, CheckCircle2, AlertCircle, RefreshCw, Smartphone, Database, Shield } from 'lucide-react';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [testing, setTesting] = useState(false);
  const [serverStatus, setServerStatus] = useState<{
    connected: boolean;
    serverTime?: string;
    protocol?: string;
    error?: string;
  } | null>(null);

  const checkServerStatus = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setServerStatus({
          connected: true,
          serverTime: data.serverTime,
          protocol: window.location.protocol.replace(':', ''),
        });
      } else {
        setServerStatus({
          connected: false,
          error: `Respuesta del servidor: HTTP ${res.status}`,
        });
      }
    } catch (err: any) {
      setServerStatus({
        connected: false,
        error: 'No se pudo conectar a /api/health. Asegúrate de iniciar "npm run server".',
      });
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkServerStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-sm">
      <div className="min-h-full flex items-center justify-center p-3 sm:p-4">
        <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative my-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-800 bg-black">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-sm sm:text-base text-white uppercase tracking-wider">
                  Servidor Local SQLite
                </h3>
                <p className="text-[11px] text-neutral-400 font-mono">
                  Base de datos local independiente (Node.js + Express)
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

          {/* Body */}
          <div className="p-4 sm:p-5 space-y-4">
            {/* Status card */}
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-neutral-400">Estado de Conexión:</span>
                {testing ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono text-neutral-400">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verificando...
                  </span>
                ) : serverStatus?.connected ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Conectado a /api
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono text-amber-400 font-bold">
                    <AlertCircle className="w-3.5 h-3.5" /> Desconectado
                  </span>
                )}
              </div>

              {serverStatus?.error && (
                <p className="text-[11px] text-amber-300 font-mono bg-amber-950/30 p-2 rounded border border-amber-800/40">
                  {serverStatus.error}
                </p>
              )}

              {serverStatus?.connected && (
                <div className="pt-2 border-t border-neutral-900 grid grid-cols-2 gap-2 text-[11px] font-mono text-neutral-400">
                  <div>
                    <span className="text-neutral-500">Motor:</span> SQLite WAL
                  </div>
                  <div>
                    <span className="text-neutral-500">Protocolo:</span> {serverStatus.protocol?.toUpperCase()}
                  </div>
                </div>
              )}
            </div>

            {/* Local Server Details */}
            <div className="space-y-2 text-xs font-mono text-neutral-300">
              <div className="flex items-start gap-2 p-3 bg-neutral-900/60 rounded-lg border border-neutral-800">
                <Database className="w-4 h-4 text-white shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Almacenamiento Local (server/ringo.db)</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Todos los socios, pagos, disciplinas y accesos se guardan en tu base de datos SQLite local de forma permanente.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-neutral-900/60 rounded-lg border border-neutral-800">
                <Smartphone className="w-4 h-4 text-white shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Acceso Móvil por Wi-Fi</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Al ejecutar <code>npm run server</code> se muestra la IP local de tu máquina para abrir el sistema desde el celular.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-neutral-900/60 rounded-lg border border-neutral-800">
                <Shield className="w-4 h-4 text-white shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Cámara y Escáner QR (HTTPS)</p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Para usar la cámara del celular en red local, colocá tus certificados <code>cert.pem</code> y <code>key.pem</code> en la raíz del proyecto.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={checkServerStatus}
                disabled={testing}
                className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg border border-neutral-700 text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                <span>Reintentar Conexión</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white hover:bg-neutral-200 text-black rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition-all cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
