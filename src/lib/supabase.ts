import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

export type { User, Session };

// Local storage keys for customizable Supabase connection in case env vars are provided in UI
const STORAGE_KEY_URL = 'ringo_supabase_url';
const STORAGE_KEY_ANON = 'ringo_supabase_anon';

export function getStoredSupabaseConfig() {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envAnon = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  
  const savedUrl = localStorage.getItem(STORAGE_KEY_URL) || envUrl;
  const savedAnon = localStorage.getItem(STORAGE_KEY_ANON) || envAnon;

  return {
    url: savedUrl.trim(),
    anonKey: savedAnon.trim(),
    isConfigured: Boolean(savedUrl.trim() && savedAnon.trim())
  };
}

export function saveStoredSupabaseConfig(url: string, anonKey: string) {
  localStorage.setItem(STORAGE_KEY_URL, url.trim());
  localStorage.setItem(STORAGE_KEY_ANON, anonKey.trim());
}

export function clearStoredSupabaseConfig() {
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_ANON);
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getStoredSupabaseConfig();
  if (!isConfigured) return null;

  try {
    if (!supabaseInstance) {
      supabaseInstance = createClient(url, anonKey);
    }
    return supabaseInstance;
  } catch (err) {
    console.error('Error initializing Supabase client:', err);
    return null;
  }
}

export function resetSupabaseClient() {
  supabaseInstance = null;
}

export async function testSupabaseConnection(url: string, anonKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const testClient = createClient(url, anonKey);
    // Attempt lightweight query or auth check
    const { error } = await testClient.from('miembros').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      // If table doesn't exist yet, it's connected to Supabase project!
      if (error.message?.includes('relation "public.miembros" does not exist') || error.code === '42P01') {
        return {
          success: true,
          message: 'Conectado a Supabase correctamente. Falta ejecutar el script SQL para crear las tablas.'
        };
      }
      return {
        success: false,
        message: `Error de conexión: ${error.message}`
      };
    }
    return {
      success: true,
      message: '¡Conexión exitosa con la base de datos Supabase!'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'No se pudo conectar a Supabase'
    };
  }
}

export async function signInAdmin(email: string, password: string) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase no está configurado. Conecta la base de datos primero.');
  }
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function signUpAdmin(email: string, password: string) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase no está configurado. Conecta la base de datos primero.');
  }
  return await supabase.auth.signUp({ email, password });
}

export async function signOutAdmin() {
  const supabase = getSupabase();
  if (supabase) {
    await supabase.auth.signOut();
  }
}

export async function getCurrentAdminUser(): Promise<User | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

/**
 * SQL script for Supabase SQL Editor
 */
export const SUPABASE_SQL_SCRIPT = `-- ==========================================
-- SCRIPT DE INICIALIZACIÓN: RINGO CARNET GYM
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase
-- ==========================================

-- 1. Tabla de Miembros
CREATE TABLE IF NOT EXISTS public.miembros (
    id TEXT PRIMARY KEY,
    dni TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    foto_url TEXT,
    disciplina TEXT NOT NULL,
    telefono TEXT NOT NULL,
    fecha_ingreso DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    estado_membresia TEXT NOT NULL DEFAULT 'activo',
    estado_pago TEXT NOT NULL DEFAULT 'pagado',
    monto_mensual NUMERIC DEFAULT 25.00,
    ultimo_pago_fecha DATE,
    notas TEXT,
    codigo_qr TEXT UNIQUE NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla de Registro de Accesos (Control QR)
CREATE TABLE IF NOT EXISTS public.accesos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id TEXT REFERENCES public.miembros(id) ON DELETE CASCADE,
    dni TEXT NOT NULL,
    member_name TEXT NOT NULL,
    disciplina TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    autorizado BOOLEAN NOT NULL DEFAULT true,
    motivo TEXT
);

-- 3. Tabla de Pagos / Renovaciones
CREATE TABLE IF NOT EXISTS public.pagos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id TEXT REFERENCES public.miembros(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    monto NUMERIC NOT NULL,
    metodo TEXT NOT NULL DEFAULT 'Efectivo',
    periodo_inicio DATE NOT NULL,
    periodo_fin DATE NOT NULL,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabla de Disciplinas y Tarifas Oficiales
CREATE TABLE IF NOT EXISTS public.disciplinas (
    id TEXT PRIMARY KEY,
    nombre TEXT UNIQUE NOT NULL,
    precio NUMERIC(10, 2) NOT NULL DEFAULT 28000.00,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Políticas de Seguridad RLS (Lectura y Escritura para la App)
ALTER TABLE public.miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accesos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir todo acceso público a miembros" ON public.miembros FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo acceso público a accesos" ON public.accesos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo acceso público a pagos" ON public.pagos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo acceso público a disciplinas" ON public.disciplinas FOR ALL USING (true) WITH CHECK (true);
`;
