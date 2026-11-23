import { Router } from 'express';
import { SolicitudesController } from '../controllers/solicitudes.controller';

const router = Router();

router.get('/', SolicitudesController.getSolicitudes);
router.post('/', SolicitudesController.createSolicitud);
router.put('/:id/resolver', SolicitudesController.resolverSolicitud);

export default router;
