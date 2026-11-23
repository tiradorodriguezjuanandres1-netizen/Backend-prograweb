import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { parseDiasLaborales } from '../utils/mappers';
import { mapSolicitudFromDb } from '../utils/mappers';

export class SolicitudesController {
  private static DIAS_MAP: Record<number, string> = {
    0: 'D',
    1: 'L',
    2: 'M',
    3: 'Mi',
    4: 'J',
    5: 'V',
    6: 'S',
  };

  static async getSolicitudes(req: Request, res: Response) {
    try {
      const empleadoId = req.query.empleadoId ? Number(req.query.empleadoId) : null;

      let query = supabase
        .from('solicitudes')
        .select(`
          *,
          empleado:empleados(
            nombre,
            apellido_paterno,
            apellido_materno,
            matricula,
            departamento:departamentos(nombre)
          )
        `)
        .order('id_solicitud', { ascending: false });

      if (empleadoId) {
        query = query.eq('id_empleado', empleadoId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const format = (data || []).map((s) => {
        const emp = s.empleado as any;
        const empNombre = emp
          ? `${emp.nombre} ${emp.apellido_paterno} ${emp.apellido_materno}`
          : '';
        const matricula = emp?.matricula || '';
        const deptoNombre = emp?.departamento?.nombre || '';
        return mapSolicitudFromDb(s, empNombre, matricula, deptoNombre);
      });

      return res.status(200).json({ ok: true, data: format });
    } catch (error: any) {
      console.error('Error al obtener solicitudes:', error);
      return res.status(500).json({ ok: false, message: 'Error al obtener solicitudes.' });
    }
  }

  static async createSolicitud(req: Request, res: Response) {
    try {
      const {
        empleadoId,
        tipo,
        fechaInicio,
        fechaFin,
        reponerEnDescanso,
        fechaReposicion,
        horasExtrasSolicitadas,
        motivo,
      } = req.body;

      if (!empleadoId || !tipo || !fechaInicio || !fechaFin || !motivo?.trim()) {
        return res.status(400).json({
          ok: false,
          message: 'Todos los campos de la solicitud son obligatorios.',
        });
      }

      const inicio = new Date(fechaInicio + 'T00:00:00');
      const fin = new Date(fechaFin + 'T00:00:00');
      if (fin < inicio) {
        return res.status(400).json({
          ok: false,
          message: 'La fecha de fin no puede ser anterior a la fecha de inicio.',
        });
      }

      // Consultar empleado para validar descanso
      const { data: emp, error: errEmp } = await supabase
        .from('empleados')
        .select(`
          id_empleado,
          nombre,
          apellido_paterno,
          apellido_materno,
          matricula,
          dias_laborales,
          departamento:departamentos(nombre)
        `)
        .eq('id_empleado', Number(empleadoId))
        .single();

      if (errEmp || !emp) {
        return res.status(404).json({ ok: false, message: 'Empleado no encontrado.' });
      }

      // Validar reposición en descanso
      if (reponerEnDescanso) {
        if (!fechaReposicion) {
          return res.status(400).json({
            ok: false,
            message: 'Debes seleccionar el día de descanso en que repondrás el permiso.',
          });
        }

        const dateRepo = new Date(fechaReposicion + 'T12:00:00');
        const dayKey = SolicitudesController.DIAS_MAP[dateRepo.getDay()];
        const diasLaborales = parseDiasLaborales(emp.dias_laborales);

        if (diasLaborales.includes(dayKey as any)) {
          return res.status(400).json({
            ok: false,
            message:
              'El día seleccionado para reponer es un día laboral en tu horario. Solo puedes seleccionar un día de descanso.',
          });
        }
      }

      // Generar folio consecutivo
      const { count } = await supabase
        .from('solicitudes')
        .select('*', { count: 'exact', head: true });

      const nextFolioNum = (count || 0) + 1;
      const folio = `FOL-2026-${String(nextFolioNum).padStart(3, '0')}`;

      const nuevaDb = {
        folio,
        id_empleado: Number(empleadoId),
        tipo,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        repone_descanso: Boolean(reponerEnDescanso),
        fecha_reposicion: reponerEnDescanso ? fechaReposicion : null,
        cantidad_horas_extra: Number(horasExtrasSolicitadas || 0),
        motivo: motivo.trim(),
        estatus: 'Pendiente',
      };

      const { data, error } = await supabase
        .from('solicitudes')
        .insert([nuevaDb])
        .select()
        .single();

      if (error) throw error;

      const empNombre = `${emp.nombre} ${emp.apellido_paterno} ${emp.apellido_materno}`;
      const deptoNombre = (emp.departamento as any)?.nombre || '';
      const mapped = mapSolicitudFromDb(data, empNombre, emp.matricula, deptoNombre);

      return res.status(201).json({
        ok: true,
        message: `Solicitud enviada con folio ${folio} para revisión de RH.`,
        data: mapped,
      });
    } catch (error: any) {
      console.error('Error al crear solicitud:', error);
      return res.status(500).json({ ok: false, message: 'Error al enviar solicitud.' });
    }
  }

  static async resolverSolicitud(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { estatus, comentarioAdmin } = req.body;

      if (!['Aprobada', 'Rechazada'].includes(estatus)) {
        return res.status(400).json({ ok: false, message: 'Estatus de resolución inválido.' });
      }

      const { data, error } = await supabase
        .from('solicitudes')
        .update({
          estatus,
          comentario_rh: (comentarioAdmin || '').trim() || null,
        })
        .eq('id_solicitud', id)
        .select()
        .single();

      if (error || !data) {
        return res.status(500).json({ ok: false, message: 'Error al resolver la solicitud.' });
      }

      return res.status(200).json({
        ok: true,
        message: estatus === 'Aprobada' ? 'Solicitud aprobada correctamente.' : 'Solicitud rechazada.',
        data,
      });
    } catch (error: any) {
      console.error('Error al resolver solicitud:', error);
      return res.status(500).json({ ok: false, message: 'Error al resolver solicitud.' });
    }
  }
}
