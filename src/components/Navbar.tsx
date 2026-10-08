import React from 'react';
import { User } from '../lib/supabase';
import {
  LogOut,
  Shield,
  Settings
} from 'lucide-react';

interface NavbarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  adminUser: User | null;
  onLogoutAdmin: () => void;
  onOpenConfigModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPath,
  onNavigate,
  adminUser,
  onLogoutAdmin,
  onOpenConfigModal,
}) => {
  const isAdminRoute = currentPath === '/admin' || currentPath.startsWith('/admin/');

  return (
    <header className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-neutral-800 px-3 sm:px-6 py-2.5 sm:py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand */}
        <button
          onClick={() => onNavigate('/')}
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
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-700 leading-none">
                {isAdminRoute ? 'ADMIN' : 'CARNET'}
              </span>
            </div>
            <p className="text-[10px] text-neutral-400 truncate mt-0.5 hidden xs:block">
              {isAdminRoute ? 'Gestión Administrativa' : 'Portal de Socios'}
            </p>
          </div>
        </button>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {isAdminRoute ? (
            <>
              {/* Tools if admin is authenticated */}
              {adminUser && (
                <>
                  {/* Botón Configurar */}
                  <button
                    onClick={onOpenConfigModal}
                    className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white rounded-lg border border-neutral-700 flex items-center gap-1.5 text-xs font-mono transition-all shadow-sm"
                    title="Configurar disciplinas y cuotas"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Configurar</span>
                  </button>

                  {/* Admin info & Logout */}
                  <div className="flex items-center gap-2 pl-1 sm:pl-2 border-l border-neutral-800">
                    <div className="hidden md:flex flex-col text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Shield className="w-3 h-3 text-white" />
                        <span className="text-[10px] font-mono font-bold text-white uppercase leading-none">
                          Admin
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-neutral-400 truncate max-w-[120px]">
                        {adminUser.email}
                      </span>
                    </div>
                    <button
                      onClick={onLogoutAdmin}
                      title="Cerrar sesión de administrador"
                      className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-neutral-300 hover:text-white rounded-lg border border-neutral-800 flex items-center gap-1.5 text-xs font-mono transition-all"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span className="hidden xs:inline">Salir</span>
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            /* Common user view on / */
            <>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
