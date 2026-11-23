import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_rrhh_2026';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    correo: string;
    rol: 'ADMIN' | 'EMPLEADO';
  };
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ ok: false, message: 'Acceso no autorizado: Token requerido.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ ok: false, message: 'Token inválido o expirado.' });
    }
    req.user = decoded as AuthenticatedRequest['user'];
    next();
  });
};

export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user || req.user.rol !== 'ADMIN') {
    return res.status(403).json({
      ok: false,
      message: 'Acceso denegado: Se requieren permisos de Administrador de RH.',
    });
  }
  next();
};
