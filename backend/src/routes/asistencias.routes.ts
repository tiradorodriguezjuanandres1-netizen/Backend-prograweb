import { Router } from 'express';
import { AsistenciasController } from '../controllers/asistencias.controller';

const router = Router();

router.get('/', AsistenciasController.getAsistencias);
router.get('/hoy/:empleadoId', AsistenciasController.getAsistenciaHoy);
router.post('/entrada', AsistenciasController.registrarEntrada);
router.post('/salida', AsistenciasController.registrarSalida);

export default router;
