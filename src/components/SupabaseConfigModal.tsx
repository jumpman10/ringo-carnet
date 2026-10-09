import React, { useState, useEffect } from 'react';
import {
  getStoredSupabaseConfig,
  saveStoredSupabaseConfig,
  clearStoredSupabaseConfig,
  testSupabaseConnection,
  resetSupabaseClient,
  SUPABASE_SQL_SCRIPT
} from '../lib/supabase';
import { X, Database, Check, Copy, RefreshCw, Shield } from 'lucide-react';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSql, setShowSql] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const config = getStoredSupabaseConfig();
      setUrl(config.url);
      setAnonKey(config.anonKey);
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      alert('Ingresa la URL y la Anon Key de tu proyecto Supabase.');
      return;
    }

    setTesting(true);
    setTestResult(null);

    const result = await testSupabaseConnection(url.trim(), anonKey.trim());
    setTestResult(result);
    setTesting(false);

    if (result.success) {
      saveStoredSupabaseConfig(url.trim(), anonKey.trim());
      resetSupabaseClient();
      onConfigSaved();
    }
  };

  const handleDisconnect = () => {
    clearStoredSupabaseConfig();
    resetSupabaseClient();
    setUrl('');
    setAnonKey('');
    setTestResult(null);
    onConfigSaved();
  };

  const copySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const config = getStoredSupabaseConfig();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-sm">
      <div className="min-h-full flex items-center justify-center p-2.5 sm:p-4">
        <div className="bg-[#0a0a0a] border border-neutral-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl relative my-auto flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh]">
          {/* Header - B&W */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-neutral-800 bg-black shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center font-bold">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-sm sm:text-base text-white uppercase tracking-wider">
                    Configurar Supabase
                  </h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-neutral-900 text-white border border-neutral-700">
                    {config.isConfigured ? 'Conectado' : 'Local'}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 font-mono">
                  PostgreSQL & Autenticación de Socios
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
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0 text-xs">
          <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 text-neutral-300 space-y-1 font-mono text-[11px]">
            <p>1. Ingresa la URL y anon public key de tu proyecto Supabase.</p>
            <p>2. Ejecuta el script SQL en el editor de Supabase para crear las tablas.</p>
          </div>

          <form onSubmit={handleTestAndSave} className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase font-mono mb-1">
                Project URL
              </label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xyz.supabase.co"
                className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-neutral-400 uppercase font-mono mb-1">
                Anon Public Key
              </label>
              <textarea
                rows={2}
                required
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGci..."
                className="w-full bg-black border border-neutral-800 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-white font-mono"
              />
            </div>

            {testResult && (
              <div className="p-2.5 rounded-lg border border-neutral-800 bg-neutral-950 text-white font-mono text-[11px]">
                {testResult.message}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              {config.isConfigured && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="text-neutral-500 hover:text-white underline font-mono text-[11px]"
                >
                  Desconectar
                </button>
              )}
              <button
                type="submit"
                disabled={testing}
                className="ml-auto px-4 py-2 bg-white text-black font-black uppercase text-xs rounded-lg active:scale-95 transition-all flex items-center gap-1.5"
              >
                {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                Probar y Conectar
              </button>
            </div>
          </form>

          {/* SQL Section */}
          <div className="pt-3 border-t border-neutral-900">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-white uppercase font-mono">
                Script SQL de Tablas
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowSql(!showSql)}
                  className="text-neutral-400 hover:text-white font-mono text-[11px]"
                >
                  {showSql ? 'Ocultar' : 'Ver'}
                </button>
                <button
                  type="button"
                  onClick={copySql}
                  className="px-2 py-0.5 bg-neutral-900 text-white text-[11px] rounded border border-neutral-800 flex items-center gap-1 font-mono"
                >
                  {copiedSql ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                  {copiedSql ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            {showSql && (
              <pre className="bg-black border border-neutral-900 rounded-lg p-2.5 text-[10px] font-mono text-neutral-400 max-h-40 overflow-auto">
                {SUPABASE_SQL_SCRIPT}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};
