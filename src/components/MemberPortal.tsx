import React, { useState } from 'react';
import { Member, AccessLog } from '../types';
import { VirtualCard } from './VirtualCard';
import { MemberAvatar } from './MemberAvatar';
import { getCalculatedStatus, formatDisplayDate } from '../lib/dateUtils';
import {
  Key,
  LogIn,
  LogOut,
  MessageCircle,
  History,
  Shield,
  Clock,
  Dumbbell,
  Lock
} from 'lucide-react';

interface MemberPortalProps {
  members: Member[];
  accessLogs: AccessLog[];
  onNavigateToAdmin: () => void;
  currentUserDni: string | null;
  onSetUserDni: (dni: string | null) => void;
}

export const MemberPortal: React.FC<MemberPortalProps> = ({
  members,
  accessLogs,
  onNavigateToAdmin,
  currentUserDni,
  onSetUserDni,
}) => {
  const [dniInput, setDniInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const currentMember = currentUserDni ? members.find((m) => m.dni === currentUserDni) : null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const trimmedDni = dniInput.trim();
    const trimmedPass = passwordInput.trim();

    const member = members.find((m) => m.dni === trimmedDni);
    if (!member) {
      setErrorMsg('No encontramos ningún socio registrado con este DNI.');
      return;
    }

    if (trimmedPass && trimmedPass !== trimmedDni) {
      setErrorMsg('Contraseña incorrecta. Recuerda que tu contraseña es tu número de DNI.');
      return;
    }

    onSetUserDni(member.dni);
  };

  // Login view - Mobile First, Black and White Minimal
  if (!currentMember) {
    return (
      <div className="w-full max-w-sm mx-auto py-4 sm:py-8 px-2 sm:px-4">
        <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-2xl">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-white text-black flex items-center justify-center font-black text-2xl mx-auto mb-2">
              R
            </div>
            <h2 className="text-xl font-black tracking-wider text-white uppercase font-mono">
              RINGO CARNET
            </h2>
            <p className="text-[11px] text-neutral-400 font-mono mt-0.5">Acceso de Socios</p>
          </div>

          {/* DNI as Password Info Box */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 mb-5 text-xs text-neutral-300 flex items-start gap-2">
            <Key className="w-4 h-4 text-white shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white uppercase text-[10px] font-mono">
                Clave de acceso:
              </span>
              <p className="text-neutral-400 text-[11px] mt-0.5">
                Ingresa con tu DNI. Tu contraseña es automáticamente tu mismo número de DNI.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 p-2.5 rounded-lg bg-black border border-neutral-700 text-white text-xs font-mono">
              {errorMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase font-mono mb-1">
                Número de DNI
              </label>
              <input
                type="text"
                required
                value={dniInput}
                onChange={(e) => setDniInput(e.target.value)}
                placeholder="43928104"
                className="w-full bg-black border border-neutral-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase font-mono mb-1 flex items-center justify-between">
                <span>Contraseña</span>
                <span className="text-[9px] text-neutral-500">(Tu DNI)</span>
              </label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Repite tu DNI"
                className="w-full bg-black border border-neutral-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white font-mono"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 px-4 bg-white hover:bg-neutral-200 active:scale-95 text-black font-black text-xs uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 mt-2"
            >
              <LogIn className="w-4 h-4 stroke-[2.5]" />
              Ver Mi Carnet Virtual
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Logged-in member view
  const myAccessLogs = accessLogs.filter((log) => log.dni === currentMember.dni).slice(0, 5);

  return (
    <div className="w-full max-w-md mx-auto py-2 sm:py-6 space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between bg-[#0a0a0a] p-3 rounded-xl border border-neutral-800">
        <div className="flex items-center gap-2.5">
          <MemberAvatar
            src={currentMember.foto_url}
            name={`${currentMember.nombre} ${currentMember.apellido}`}
            className="w-9 h-9 rounded-lg"
          />
          <div>
            <h3 className="text-xs sm:text-sm font-black text-white leading-tight">
              {currentMember.nombre} {currentMember.apellido}
            </h3>
            <p className="text-[10px] text-neutral-400 font-mono">
              {currentMember.disciplina} • DNI: {currentMember.dni}
            </p>
          </div>
        </div>

        <button
          onClick={() => onSetUserDni(null)}
          className="px-2.5 py-1 text-xs text-neutral-300 hover:text-white bg-neutral-900 rounded-lg border border-neutral-800 flex items-center gap-1 font-mono"
        >
          <LogOut className="w-3 h-3" />
          Salir
        </button>
      </div>

      {/* Virtual Card */}
      <VirtualCard member={currentMember} />
      {/* Recent access history */}
      {myAccessLogs.length > 0 && (
        <div className="bg-[#0a0a0a] border border-neutral-800 rounded-xl p-4">
          <h4 className="text-xs font-bold text-white uppercase font-mono mb-2 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" />
            Últimos Ingresos Registrados
          </h4>

          <div className="space-y-1.5">
            {myAccessLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-2 bg-black rounded-lg border border-neutral-900 text-[11px] font-mono"
              >
                <span className="text-neutral-300">
                  {new Date(log.timestamp).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="text-white font-bold">{log.disciplina}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
