import { Router } from 'express';
import { NominaController } from '../controllers/nomina.controller';

const router = Router();

router.get('/recibos', NominaController.getRecibos);
router.post('/corte', NominaController.generarCorte);
router.put('/recibos/:id', NominaController.updateReciboDetalle);
router.post('/aprobar', NominaController.aprobarCorte);

export default router;
