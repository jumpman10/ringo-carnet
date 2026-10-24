import React from 'react';
import {
  Settings,
  QrCode,
  Wifi
} from 'lucide-react';

interface NavbarProps {
  onOpenConfigModal: () => void;
  onOpenScanner?: () => void;
  onOpenNetworkModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenConfigModal,
  onOpenScanner,
  onOpenNetworkModal,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-neutral-800 px-3 sm:px-6 py-2.5 sm:py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2.5 text-left group"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white text-black flex items-center justify-center font-black text-lg shrink-0 group-hover:scale-105 transition-transform">
            R
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-base sm:text-lg tracking-wider text-white uppercase leading-none">
                RINGO
              </span>
              <span className="text-[11px] sm:text-xs font-mono uppercase px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-700 leading-none">
                ADMIN
              </span>
            </div>
            <p className="text-xs text-neutral-400 truncate mt-0.5 hidden xs:block">
              Gestión Administrativa
            </p>
          </div>
        </button>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Botón Conectar Celular / Backup */}
          {onOpenNetworkModal && (
            <button
              onClick={onOpenNetworkModal}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white rounded-lg border border-neutral-700 flex items-center gap-1.5 text-xs font-mono transition-all shadow-sm"
              title="Conectar celular por Wi-Fi y descargar backup"
            >
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>Conectar Celular / Backup</span>
            </button>
          )}

          {/* Botón Escanear QR */}
          {onOpenScanner && (
            <button
              onClick={onOpenScanner}
              className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-white hover:bg-neutral-200 active:scale-95 text-black rounded-lg border border-white flex items-center gap-1.5 text-xs font-mono font-bold transition-all shadow-sm"
              title="Escanear código QR de socio"
            >
              <QrCode className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Escanear QR</span>
            </button>
          )}

          {/* Botón Configurar */}
          <button
            onClick={onOpenConfigModal}
            className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white rounded-lg border border-neutral-700 flex items-center gap-1.5 text-xs font-mono transition-all shadow-sm"
            title="Configurar disciplinas y cuotas"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configurar</span>
          </button>
        </div>
      </div>
    </header>
  );
};
