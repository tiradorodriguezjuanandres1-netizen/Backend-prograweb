import { Router } from 'express';
import asistenciasRoutes from './asistencias.routes';
import authRoutes from './auth.routes';
import catalogosRoutes from './catalogos.routes';
import empleadosRoutes from './empleados.routes';
import nominaRoutes from './nomina.routes';
import retencionesRoutes from './retenciones.routes';
import solicitudesRoutes from './solicitudes.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/catalogos', catalogosRoutes);
router.use('/empleados', empleadosRoutes);
router.use('/asistencias', asistenciasRoutes);
router.use('/solicitudes', solicitudesRoutes);
router.use('/retenciones', retencionesRoutes);
router.use('/nomina', nominaRoutes);

export default router;
