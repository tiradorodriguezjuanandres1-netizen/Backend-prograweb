import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateToken } from '../middlewares/auth.middleware';

const router = Router();

router.post('/login', AuthController.login);
router.post('/primer-ingreso', authenticateToken, AuthController.cambiarPasswordPrimerIngreso);
router.post('/cambiar-password', authenticateToken, AuthController.cambiarPasswordVoluntario);
router.get('/me', authenticateToken, AuthController.me);

export default router;
