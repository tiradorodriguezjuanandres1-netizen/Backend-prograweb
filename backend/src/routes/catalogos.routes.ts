import { Router } from 'express';
import { CatalogosController } from '../controllers/catalogos.controller';

const router = Router();

// Departamentos
router.get('/departamentos', CatalogosController.getDepartamentos);
router.post('/departamentos', CatalogosController.createDepartamento);
router.put('/departamentos/:id', CatalogosController.updateDepartamento);
router.delete('/departamentos/:id', CatalogosController.deleteDepartamento);

// Puestos
router.get('/puestos', CatalogosController.getPuestos);
router.post('/puestos', CatalogosController.createPuesto);
router.put('/puestos/:id', CatalogosController.updatePuesto);
router.delete('/puestos/:id', CatalogosController.deletePuesto);

export default router;
