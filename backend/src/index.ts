import dotenv from 'dotenv';
import app from './app';
import { isSupabaseConfigured } from './config/supabase';

dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Servidor Backend RRHH iniciado en puerto ${PORT}`);
  console.log(`📡 URL API: http://localhost:${PORT}/api`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
  if (isSupabaseConfigured()) {
    console.log(`✅ Supabase configurado correctamente.`);
  } else {
    console.warn(`⚠️  SUPABASE_URL o SUPABASE_KEY no configurados en .env`);
    console.warn(`   Edita backend/.env para conectar con tu proyecto de Supabase.`);
  }
  console.log(`====================================================`);
});
