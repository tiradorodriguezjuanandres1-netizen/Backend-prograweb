import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Cargar .env desde la raíz del backend sin importar desde dónde se invoque el proceso
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // fallback

const rawUrl = process.env.SUPABASE_URL || '';
// Eliminar automáticamente /rest/v1 o barras finales si el usuario copió la URL de la API de Supabase
const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabaseKey = (process.env.SUPABASE_KEY || '').trim();

export const isSupabaseConfigured = (): boolean => {
  return (
    !!supabaseUrl &&
    !!supabaseKey &&
    !supabaseUrl.includes('tu-proyecto') &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseKey.includes('tu-supabase') &&
    !supabaseKey.includes('placeholder')
  );
};

// URL y clave segura de respaldo para no romper la inicialización si el usuario no ha editado el .env
const safeUrl = isSupabaseConfigured() ? supabaseUrl : 'https://placeholder-project.supabase.co';
const safeKey = isSupabaseConfigured() ? supabaseKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export const supabase: SupabaseClient = createClient(safeUrl, safeKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
