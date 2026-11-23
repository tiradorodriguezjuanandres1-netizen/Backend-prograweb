import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import {
  calcularHorasHorario,
  denormalizeRol,
  formatDiasLaborales,
  mapEmpleadoFromDb,
} from '../utils/mappers';

export class EmpleadosController {
  // Generar contraseña inicial según RF 1.1.4
  private static generarPasswordInicial(
    numeroEmpleado: string,
    nombre: string,
    apellidoMaterno: string,
  ): string {
    const digitos = numeroEmpleado.replace(/\D/g, '').slice(0, 3).padEnd(3, '0');
    const cleanText = (v: string) =>
      v
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z]/g, '');

    const nom = cleanText(nombre).slice(0, 3);
    const nomFormatted = nom ? nom.charAt(0).toUpperCase() + nom.slice(1).toLowerCase() : 'Emp';

    const apMat = cleanText(apellidoMaterno).slice(0, 2);
    const apMatFormatted = apMat ? apMat.charAt(0).toUpperCase() + apMat.slice(1).toLowerCase() : 'Xx';

    return `${digitos}${nomFormatted}${apMatFormatted}`;
  }

  static async getEmpleados(req: Request, res: Response) {
    try {
      const { data, error } = await supabase
        .from('empleados')
        .select(`
          *,
          departamento:departamentos(nombre),
          puesto:puestos(nombre)
        `)
        .order('id_empleado', { ascending: true });

      if (error) throw error;

      const format = (data || []).map((emp) => {
        const deptoNombre = (emp.departamento as any)?.nombre || '';
        const puestoNombre = (emp.puesto as any)?.nombre || '';
        return mapEmpleadoFromDb(emp, deptoNombre, puestoNombre);
      });

      return res.status(200).json({ ok: true, data: format });
    } catch (error: any) {
      console.error('Error al obtener empleados:', error);
      return res.status(500).json({ ok: false, message: 'Error al obtener empleados.' });
    }
  }

  static async getEmpleadoById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { data, error } = await supabase
        .from('empleados')
        .select(`
          *,
          departamento:departamentos(nombre),
          puesto:puestos(nombre)
        `)
        .eq('id_empleado', id)
        .single();

      if (error || !data) {
        return res.status(404).json({ ok: false, message: 'Empleado no encontrado.' });
      }

      const deptoNombre = (data.departamento as any)?.nombre || '';
      const puestoNombre = (data.puesto as any)?.nombre || '';
      const format = mapEmpleadoFromDb(data, deptoNombre, puestoNombre);

      return res.status(200).json({ ok: true, data: format });
    } catch (error: any) {
      console.error('Error al obtener empleado:', error);
      return res.status(500).json({ ok: false, message: 'Error al obtener empleado.' });
    }
  }

  static async createEmpleado(req: Request, res: Response) {
    try {
      const dto = req.body;

      if (!dto.salarioBase || Number(dto.salarioBase) <= 0) {
        return res.status(400).json({
          ok: false,
          message: 'El salario base debe ser estrictamente mayor a $0.00.',
        });
      }

      const horasPorDia = calcularHorasHorario(
        dto.horaEntradaEstablecida,
        dto.horaSalidaEstablecida,
      );
      if (horasPorDia <= 0) {
        return res.status(400).json({
          ok: false,
          message: 'La hora de salida establecida debe ser posterior a la hora de entrada.',
        });
      }

      if (!dto.diasLaborales || dto.diasLaborales.length === 0) {
        return res.status(400).json({
          ok: false,
          message: 'Debes seleccionar al menos un día laboral en la semana.',
        });
      }

      // Validar duplicados de correo o matrícula
      const { data: existCorreo } = await supabase
        .from('empleados')
        .select('id_empleado')
        .ilike('correo', dto.correoInstitucional.trim())
        .maybeSingle();

      if (existCorreo) {
        return res.status(400).json({
          ok: false,
          message: 'Ya existe un empleado con ese correo institucional.',
        });
      }

      const { data: existMatricula } = await supabase
        .from('empleados')
        .select('id_empleado')
        .eq('matricula', dto.numeroEmpleado.trim())
        .maybeSingle();

      if (existMatricula) {
        return res.status(400).json({
          ok: false,
          message: 'Ya existe un empleado con ese número de matrícula.',
        });
      }

      const passwordInicial = EmpleadosController.generarPasswordInicial(
        dto.numeroEmpleado,
        dto.nombre,
        dto.apellidoMaterno,
      );
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(passwordInicial, salt);

      const nuevoDb = {
        matricula: dto.numeroEmpleado.trim(),
        rol: denormalizeRol(dto.rol || 'EMPLEADO'),
        nombre: dto.nombre.trim(),
        apellido_paterno: dto.apellidoPaterno.trim(),
        apellido_materno: dto.apellidoMaterno.trim(),
        correo: dto.correoInstitucional.trim().toLowerCase(),
        telefono: (dto.telefono || '').trim(),
        id_departamento: Number(dto.departamentoId),
        id_puesto: Number(dto.puestoId),
        salario_base_mensual: Number(dto.salarioBase),
        fecha_ingreso: dto.fechaIngreso,
        hora_entrada: dto.horaEntradaEstablecida,
        hora_salida: dto.horaSalidaEstablecida,
        dias_laborales: formatDiasLaborales(dto.diasLaborales),
        tiene_prestamo_empresa: Boolean(dto.tienePrestamoEmpresa),
        cuota_prestamo_quincenal: dto.tienePrestamoEmpresa
          ? Number(dto.montoPrestamoQuincenal || 0)
          : 0,
        tiene_credito_infonavit: Boolean(dto.tieneCreditoInfonavit),
        cuota_infonavit_quincenal: dto.tieneCreditoInfonavit
          ? Number(dto.descuentoInfonavitQuincenal || 0)
          : 0,
        password_hash: passwordHash,
        estatus: 'Activo',
        primer_ingreso: true,
      };

      const { data, error } = await supabase
        .from('empleados')
        .insert([nuevoDb])
        .select(`
          *,
          departamento:departamentos(nombre),
          puesto:puestos(nombre)
        `)
        .single();

      if (error) throw error;

      const deptoNombre = (data.departamento as any)?.nombre || '';
      const puestoNombre = (data.puesto as any)?.nombre || '';
      const empleado = mapEmpleadoFromDb(data, deptoNombre, puestoNombre);

      return res.status(201).json({
        ok: true,
        message: 'Empleado registrado correctamente.',
        data: { empleado, passwordInicial },
      });
    } catch (error: any) {
      console.error('Error al registrar empleado:', error);
      return res.status(500).json({ ok: false, message: 'Error al registrar empleado.' });
    }
  }

  static async updateEmpleado(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const cambios = req.body;

      if (cambios.salarioBase !== undefined && Number(cambios.salarioBase) <= 0) {
        return res.status(400).json({
          ok: false,
          message: 'El salario base debe ser estrictamente mayor a $0.00.',
        });
      }

      const updateData: any = {};
      if (cambios.nombre) updateData.nombre = cambios.nombre.trim();
      if (cambios.apellidoPaterno) updateData.apellido_paterno = cambios.apellidoPaterno.trim();
      if (cambios.apellidoMaterno) updateData.apellido_materno = cambios.apellidoMaterno.trim();
      if (cambios.telefono !== undefined) updateData.telefono = cambios.telefono.trim();
      if (cambios.departamentoId) updateData.id_departamento = Number(cambios.departamentoId);
      if (cambios.puestoId) updateData.id_puesto = Number(cambios.puestoId);
      if (cambios.salarioBase !== undefined) updateData.salario_base_mensual = Number(cambios.salarioBase);
      if (cambios.horaEntradaEstablecida) updateData.hora_entrada = cambios.horaEntradaEstablecida;
      if (cambios.horaSalidaEstablecida) updateData.hora_salida = cambios.horaSalidaEstablecida;
      if (cambios.diasLaborales) updateData.dias_laborales = formatDiasLaborales(cambios.diasLaborales);
      if (cambios.tienePrestamoEmpresa !== undefined) {
        updateData.tiene_prestamo_empresa = Boolean(cambios.tienePrestamoEmpresa);
        updateData.cuota_prestamo_quincenal = cambios.tienePrestamoEmpresa
          ? Number(cambios.montoPrestamoQuincenal || 0)
          : 0;
      }
      if (cambios.tieneCreditoInfonavit !== undefined) {
        updateData.tiene_credito_infonavit = Boolean(cambios.tieneCreditoInfonavit);
        updateData.cuota_infonavit_quincenal = cambios.tieneCreditoInfonavit
          ? Number(cambios.descuentoInfonavitQuincenal || 0)
          : 0;
      }
      if (cambios.rol) updateData.rol = denormalizeRol(cambios.rol);

      const { data, error } = await supabase
        .from('empleados')
        .update(updateData)
        .eq('id_empleado', id)
        .select(`
          *,
          departamento:departamentos(nombre),
          puesto:puestos(nombre)
        `)
        .single();

      if (error || !data) {
        return res.status(500).json({ ok: false, message: 'Error al actualizar empleado.' });
      }

      const deptoNombre = (data.departamento as any)?.nombre || '';
      const puestoNombre = (data.puesto as any)?.nombre || '';
      const empleado = mapEmpleadoFromDb(data, deptoNombre, puestoNombre);

      return res.status(200).json({
        ok: true,
        message: 'Información del empleado actualizada.',
        data: empleado,
      });
    } catch (error: any) {
      console.error('Error al actualizar empleado:', error);
      return res.status(500).json({ ok: false, message: 'Error al actualizar empleado.' });
    }
  }

  static async cambiarEstatus(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { nuevoEstatus } = req.body;

      if (!['Activo', 'Inactivo'].includes(nuevoEstatus)) {
        return res.status(400).json({ ok: false, message: 'Estatus inválido.' });
      }

      const { error } = await supabase
        .from('empleados')
        .update({ estatus: nuevoEstatus })
        .eq('id_empleado', id);

      if (error) throw error;

      return res.status(200).json({
        ok: true,
        message:
          nuevoEstatus === 'Inactivo'
            ? 'Empleado dado de baja lógica (estatus: Inactivo).'
            : 'Empleado reactivado correctamente.',
      });
    } catch (error: any) {
      console.error('Error al cambiar estatus:', error);
      return res.status(500).json({ ok: false, message: 'Error al cambiar estatus.' });
    }
  }
}
