import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { isSupabaseConfigured, supabase } from '../config/supabase';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { mapEmpleadoFromDb } from '../utils/mappers';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_rrhh_2026';

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { correoInstitucional, password } = req.body;

      if (!correoInstitucional || !password) {
        return res.status(400).json({
          ok: false,
          message: 'Debe ingresar correo institucional y contraseña.',
        });
      }

      if (!isSupabaseConfigured()) {
        return res.status(503).json({
          ok: false,
          message: 'Supabase no está configurado. Por favor ingresa tus credenciales en el archivo backend/.env',
        });
      }

      // Consultar empleado con relaciones de departamento y puesto
      const { data: empleadoData, error } = await supabase
        .from('empleados')
        .select(`
          *,
          departamento:departamentos(nombre),
          puesto:puestos(nombre)
        `)
        .ilike('correo', correoInstitucional.trim())
        .single();

      if (error || !empleadoData) {
        return res.status(401).json({
          ok: false,
          message: 'Correo institucional o contraseña incorrectos.',
        });
      }

      // Validar estatus inactivo
      if (empleadoData.estatus === 'Inactivo') {
        return res.status(403).json({
          ok: false,
          message: 'Acceso denegado: Tu cuenta se encuentra en estatus Inactivo. Contacta a Recursos Humanos.',
        });
      }

      // Validar contraseña (bcrypt, coincidencia directa o insensible a mayúsculas)
      let passwordValida = false;
      const stored = (empleadoData.password_hash || '').trim();
      const input = (password || '').trim();

      if (stored) {
        if (stored.startsWith('$2a$') || stored.startsWith('$2b$')) {
          passwordValida = await bcrypt.compare(input, stored);
        } else {
          passwordValida = stored === input || stored.toLowerCase() === input.toLowerCase();
        }
      }

      // Compatibilidad con contraseñas demo estándar
      if (!passwordValida) {
        const correoLower = empleadoData.correo.toLowerCase();
        if (correoLower === 'admin.rh@empresa.mx' && input.toLowerCase() === 'admin123') {
          passwordValida = true;
        } else if (correoLower === 'diego.alvarez@empresa.mx' && (input === 'Emp12345' || input === '202DieMa')) {
          passwordValida = true;
        } else if (correoLower === 'sofia.ramirez@empresa.mx' && input === '202SofLo') {
          passwordValida = true;
        } else if (correoLower === 'mariana.torres@empresa.mx' && (input === 'Inactivo1' || input === '202MarSa')) {
          passwordValida = true;
        }
      }

      if (!passwordValida) {
        return res.status(401).json({
          ok: false,
          message: 'Correo institucional o contraseña incorrectos.',
        });
      }

      const deptoNombre = (empleadoData.departamento as any)?.nombre || '';
      const puestoNombre = (empleadoData.puesto as any)?.nombre || '';
      const empleado = mapEmpleadoFromDb(empleadoData, deptoNombre, puestoNombre);

      const token = jwt.sign(
        {
          id: empleadoData.id_empleado,
          correo: empleadoData.correo,
          rol: empleado.rol,
        },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      return res.status(200).json({
        ok: true,
        message: empleado.primerInicioSesion
          ? 'Por seguridad, debes actualizar tu contraseña inicial.'
          : 'Bienvenido al Portal de Recursos Humanos.',
        requirePasswordChange: empleado.primerInicioSesion,
        data: {
          token,
          empleado,
        },
      });
    } catch (error: any) {
      console.error('Error en login:', error);
      return res.status(500).json({
        ok: false,
        message: 'Error interno del servidor durante el inicio de sesión.',
      });
    }
  }

  static async cambiarPasswordPrimerIngreso(req: AuthenticatedRequest, res: Response) {
    try {
      const { nuevaPassword } = req.body;
      const empleadoId = req.user?.id;

      if (!empleadoId) {
        return res.status(401).json({ ok: false, message: 'Sesión no válida.' });
      }

      const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!nuevaPassword || !regex.test(nuevaPassword)) {
        return res.status(400).json({
          ok: false,
          message: 'La contraseña debe tener mínimo 8 caracteres, incluir mayúsculas, minúsculas y números.',
        });
      }

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(nuevaPassword, salt);

      const { data, error } = await supabase
        .from('empleados')
        .update({
          password_hash: hash,
          primer_ingreso: false,
        })
        .eq('id_empleado', empleadoId)
        .select(`
          *,
          departamento:departamentos(nombre),
          puesto:puestos(nombre)
        `)
        .single();

      if (error || !data) {
        return res.status(500).json({
          ok: false,
          message: 'Error al actualizar la contraseña en Supabase.',
        });
      }

      const deptoNombre = (data.departamento as any)?.nombre || '';
      const puestoNombre = (data.puesto as any)?.nombre || '';
      const empleado = mapEmpleadoFromDb(data, deptoNombre, puestoNombre);

      return res.status(200).json({
        ok: true,
        message: 'Contraseña actualizada correctamente.',
        data: { empleado },
      });
    } catch (error: any) {
      console.error('Error al cambiar contraseña:', error);
      return res.status(500).json({ ok: false, message: 'Error interno del servidor.' });
    }
  }

  static async cambiarPasswordVoluntario(req: AuthenticatedRequest, res: Response) {
    try {
      const { passwordActual, nuevaPassword } = req.body;
      const empleadoId = req.user?.id;

      if (!empleadoId) {
        return res.status(401).json({ ok: false, message: 'Sesión no válida.' });
      }

      const { data: emp, error: errFetch } = await supabase
        .from('empleados')
        .select('password_hash')
        .eq('id_empleado', empleadoId)
        .single();

      if (errFetch || !emp) {
        return res.status(404).json({ ok: false, message: 'Empleado no encontrado.' });
      }

      let actualValida = false;
      if (emp.password_hash) {
        if (emp.password_hash.startsWith('$2a$') || emp.password_hash.startsWith('$2b$')) {
          actualValida = await bcrypt.compare(passwordActual, emp.password_hash);
        } else {
          actualValida = emp.password_hash === passwordActual;
        }
      }

      if (!actualValida) {
        return res.status(400).json({
          ok: false,
          message: 'La contraseña actual ingresada no es correcta.',
        });
      }

      if (passwordActual === nuevaPassword) {
        return res.status(400).json({
          ok: false,
          message: 'La nueva contraseña debe ser diferente a la contraseña actual.',
        });
      }

      const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!regex.test(nuevaPassword)) {
        return res.status(400).json({
          ok: false,
          message: 'La nueva contraseña debe tener mínimo 8 caracteres, incluir mayúsculas, minúsculas y números.',
        });
      }

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(nuevaPassword, salt);

      const { error: errUpdate } = await supabase
        .from('empleados')
        .update({ password_hash: hash })
        .eq('id_empleado', empleadoId);

      if (errUpdate) {
        return res.status(500).json({ ok: false, message: 'Error al actualizar la contraseña.' });
      }

      return res.status(200).json({
        ok: true,
        message: 'Tu contraseña se actualizó correctamente.',
      });
    } catch (error: any) {
      console.error('Error al cambiar contraseña:', error);
      return res.status(500).json({ ok: false, message: 'Error interno del servidor.' });
    }
  }

  static async me(req: AuthenticatedRequest, res: Response) {
    try {
      const empleadoId = req.user?.id;
      if (!empleadoId) {
        return res.status(401).json({ ok: false, message: 'Sesión no válida.' });
      }

      const { data, error } = await supabase
        .from('empleados')
        .select(`
          *,
          departamento:departamentos(nombre),
          puesto:puestos(nombre)
        `)
        .eq('id_empleado', empleadoId)
        .single();

      if (error || !data) {
        return res.status(404).json({ ok: false, message: 'Empleado no encontrado.' });
      }

      const deptoNombre = (data.departamento as any)?.nombre || '';
      const puestoNombre = (data.puesto as any)?.nombre || '';
      const empleado = mapEmpleadoFromDb(data, deptoNombre, puestoNombre);

      return res.status(200).json({ ok: true, data: empleado });
    } catch (error: any) {
      console.error('Error en me:', error);
      return res.status(500).json({ ok: false, message: 'Error interno del servidor.' });
    }
  }
}
