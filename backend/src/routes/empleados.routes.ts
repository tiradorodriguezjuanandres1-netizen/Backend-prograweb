import { Router } from 'express';
import { EmpleadosController } from '../controllers/empleados.controller';

const router = Router();

router.get('/', EmpleadosController.getEmpleados);
router.get('/:id', EmpleadosController.getEmpleadoById);
router.post('/', EmpleadosController.createEmpleado);
router.put('/:id', EmpleadosController.updateEmpleado);
router.patch('/:id/estatus', EmpleadosController.cambiarEstatus);

export default router;
