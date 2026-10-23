import React, { useState } from 'react';
import { signInAdmin, signUpAdmin, getStoredSupabaseConfig, User } from '../lib/supabase';
import { Shield, Lock, Mail, KeyRound, AlertCircle, CheckCircle2, RefreshCw, Database, ArrowLeft } from 'lucide-react';

interface AdminLoginPageProps {
  onLoginSuccess: (user: User) => void;
  onNavigateHome: () => void;
  onOpenSupabaseConfig: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onLoginSuccess,
  onNavigateHome,
  onOpenSupabaseConfig,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { isConfigured } = getStoredSupabaseConfig();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedEmail = email.trim();
    const trimmedPass = password.trim();

    if (!trimmedEmail || !trimmedPass) {
      setErrorMsg('Por favor completa todos los campos.');
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await signUpAdmin(trimmedEmail, trimmedPass);
        if (error) {
          throw error;
        }
        if (data.user) {
          if (data.session) {
            onLoginSuccess(data.user);
          } else {
            setSuccessMsg('Usuario creado exitosamente. Si la confirmación por email está activada en Supabase, revisa tu casilla.');
          }
        }
      } else {
        const { data, error } = await signInAdmin(trimmedEmail, trimmedPass);
        if (error) {
          throw error;
        }
        if (data.user) {
          onLoginSuccess(data.user);
        }
      }
    } catch (err: any) {
      console.error('Error de autenticación:', err);
      let message = err.message || 'Error al autenticar con Supabase.';
      if (message.includes('Invalid login credentials')) {
        message = 'Credenciales inválidas. Verifica tu correo y contraseña.';
      } else if (message.includes('Email not confirmed')) {
        message = 'El correo electrónico aún no ha sido confirmado en Supabase.';
      } else if (message.includes('Password should be at least')) {
        message = 'La contraseña debe tener al menos 6 caracteres.';
      }
      setErrorMsg(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto py-8 px-4">
      <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Top return link */}
        <button
          type="button"
          onClick={onNavigateHome}
          className="text-neutral-400 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver al Portal de Socios</span>
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-white text-black flex items-center justify-center font-black text-xl mx-auto">
            <Shield className="w-6 h-6 text-black" />
          </div>
          <h2 className="text-xl font-black tracking-wider text-white uppercase font-mono">
            {isSignUp ? 'Crear Administrador' : 'Panel de Administración'}
          </h2>
          <p className="text-xs text-neutral-400 font-mono">
            Acceso exclusivo del personal vía Supabase Auth
          </p>
        </div>

        {/* Supabase connection warning */}
        {!isConfigured && (
          <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-300 text-xs space-y-2 font-mono">
            <div className="flex items-center gap-2 text-white font-bold">
              <AlertCircle className="w-4 h-4 text-white" />
              <span>Base de datos no configurada</span>
            </div>
            <p className="text-neutral-400 text-[11px]">
              Se requiere conectar Supabase para autenticar al administrador.
            </p>
            <button
              type="button"
              onClick={onOpenSupabaseConfig}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded border border-neutral-700 text-[11px] flex items-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5" />
              Configurar Supabase ahora
            </button>
          </div>
        )}

        {/* Error / Success messages */}
        {errorMsg && (
          <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white text-xs font-mono flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-white shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-700 text-white text-xs font-mono flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-white shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-neutral-300 uppercase font-mono mb-1.5">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ringogym.com"
                className="w-full bg-black border border-neutral-800 rounded-lg pl-9 pr-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-300 uppercase font-mono mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                className="w-full bg-black border border-neutral-800 rounded-lg pl-9 pr-3.5 py-2.5 text-sm sm:text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !isConfigured}
            className="w-full py-3 px-4 bg-white hover:bg-neutral-200 disabled:opacity-50 disabled:hover:bg-white active:scale-95 text-black font-black text-xs sm:text-sm uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4 stroke-[2.5]" />
            )}
            {isSignUp ? 'Registrar Administrador' : 'Ingresar al Panel'}
          </button>
        </form>

        {/* Toggle sign in / sign up */}
        <div className="pt-3 border-t border-neutral-900 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className="text-[11px] text-neutral-400 hover:text-white font-mono underline"
          >
            {isSignUp
              ? '¿Ya tienes cuenta? Iniciar sesión'
              : '¿No tienes cuenta de admin? Registrarse'}
          </button>
        </div>
      </div>
    </div>
  );
};
