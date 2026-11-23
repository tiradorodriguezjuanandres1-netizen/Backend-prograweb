import { Router } from 'express';
import { RetencionesController } from '../controllers/retenciones.controller';

const router = Router();

router.get('/', RetencionesController.getRetenciones);
router.put('/', RetencionesController.updateRetenciones);

export default router;
