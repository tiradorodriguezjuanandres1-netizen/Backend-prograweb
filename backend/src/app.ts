import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { isSupabaseConfigured } from './config/supabase';
import apiRoutes from './routes';

const app = express();

const corsOrigin = process.env.FRONTEND_URL || 'http://localhost:4200';
app.use(
  cors({
    origin: [corsOrigin, 'http://localhost:4200', 'http://127.0.0.1:4200'],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Estado de salud y diagnóstico
app.get('/api/health', (req: Request, res: Response) => {
  const supabaseOk = isSupabaseConfigured();
  res.status(200).json({
    status: 'online',
    timestamp: new Date().toISOString(),
    supabaseConfigured: supabaseOk,
    message: supabaseOk
      ? 'Backend conectado y listo con Supabase.'
      : 'Atención: Variables SUPABASE_URL o SUPABASE_KEY pendientes de configurar en .env',
  });
});

app.get('/', (req: Request, res: Response) => {
  res.send({
    message: 'Servidor Backend de Recursos Humanos (RRHH) en ejecución.',
    version: '1.0.0',
    endpoints: '/api',
  });
});

// Rutas API
app.use('/api', apiRoutes);

// Manejador 404
app.use((req: Request, res: Response) => {
  res.status(404).json({ ok: false, message: `Ruta no encontrada: ${req.method} ${req.url}` });
});

// Manejador global de errores
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error no capturado:', err);
  res.status(err.status || 500).json({
    ok: false,
    message: err.message || 'Error interno del servidor.',
  });
});

export default app;
