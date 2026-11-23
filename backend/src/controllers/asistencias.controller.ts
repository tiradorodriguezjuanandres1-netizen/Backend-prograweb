import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { mapAsistenciaFromDb } from '../utils/mappers';

export class AsistenciasController {
  private static timeToMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  private static getTodayISO(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private static getCurrentTime(): string {
    const now = new Date();
    return now.toTimeString().slice(0, 8);
  }

  static async getAsistencias(req: Request, res: Response) {
    try {
      const empleadoId = req.query.empleadoId ? Number(req.query.empleadoId) : null;

      let query = supabase.from('asistencias').select('*').order('fecha', { ascending: false });

      if (empleadoId) {
        query = query.eq('id_empleado', empleadoId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const format = (data || []).map(mapAsistenciaFromDb);
      return res.status(200).json({ ok: true, data: format });
    } catch (error: any) {
      console.error('Error al obtener asistencias:', error);
      return res.status(500).json({ ok: false, message: 'Error al obtener asistencias.' });
    }
  }

  static async getAsistenciaHoy(req: Request, res: Response) {
    try {
      const empleadoId = Number(req.params.empleadoId);
      const hoy = AsistenciasController.getTodayISO();

      const { data, error } = await supabase
        .from('asistencias')
        .select('*')
        .eq('id_empleado', empleadoId)
        .eq('fecha', hoy)
        .maybeSingle();

      if (error) throw error;

      return res.status(200).json({
        ok: true,
        data: data ? mapAsistenciaFromDb(data) : null,
      });
    } catch (error: any) {
      console.error('Error al obtener asistencia de hoy:', error);
      return res.status(500).json({ ok: false, message: 'Error al consultar asistencia de hoy.' });
    }
  }

  static async registrarEntrada(req: Request, res: Response) {
    try {
      const { empleadoId, folioIncidencia, horaSimulada } = req.body;
      const empId = Number(empleadoId);
      const hoy = AsistenciasController.getTodayISO();
      const hora = horaSimulada || AsistenciasController.getCurrentTime();

      // Verificar si ya existe registro de entrada hoy
      const { data: existente } = await supabase
        .from('asistencias')
        .select('*')
        .eq('id_empleado', empId)
        .eq('fecha', hoy)
        .maybeSingle();

      if (existente) {
        return res.status(400).json({
          ok: false,
          message: 'Ya existe un registro de entrada para el día de hoy.',
        });
      }

      // Consultar horario del empleado
      const { data: emp, error: errEmp } = await supabase
        .from('empleados')
        .select('hora_entrada')
        .eq('id_empleado', empId)
        .single();

      if (errEmp || !emp) {
        return res.status(404).json({ ok: false, message: 'Empleado no encontrado.' });
      }

      // Validar tolerancia de 10 minutos
      const actualMin = AsistenciasController.timeToMinutes(hora.slice(0, 5));
      const establecidaMin = AsistenciasController.timeToMinutes(emp.hora_entrada.slice(0, 5));
      const conRetardo = actualMin > establecidaMin + 10;

      if (conRetardo) {
        const cleanFolio = (folioIncidencia || '').trim().toUpperCase();
        if (!cleanFolio) {
          return res.status(400).json({
            ok: false,
            requiereFolio: true,
            message:
              'Has superado los 10 minutos de tolerancia. Ingresa el folio de tu solicitud de llegada tarde.',
          });
        }

        // Validar folio en solicitudes
        const { data: solicitudValida } = await supabase
          .from('solicitudes')
          .select('*')
          .eq('id_empleado', empId)
          .eq('tipo', 'Llegada tarde')
          .ilike('folio', cleanFolio)
          .neq('estatus', 'Rechazada')
          .maybeSingle();

        if (!solicitudValida) {
          return res.status(400).json({
            ok: false,
            requiereFolio: true,
            message:
              'El folio ingresado no corresponde a una solicitud válida de llegada tarde para tu usuario.',
          });
        }
      }

      const nuevoRegistro = {
        id_empleado: empId,
        fecha: hoy,
        hora_entrada: hora,
        hora_salida: null,
        incidencia: conRetardo
          ? `Retardo justificado (${folioIncidencia.trim().toUpperCase()})`
          : 'Sin incidencias',
        detalle_salida: null,
        estatus: 'En jornada',
      };

      const { data, error } = await supabase
        .from('asistencias')
        .insert([nuevoRegistro])
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({
        ok: true,
        sinIncidencias: !conRetardo,
        message: conRetardo
          ? `Entrada registrada con folio ${folioIncidencia.trim().toUpperCase()} a las ${hora}.`
          : `Entrada registrada correctamente sin incidencias (${hora}).`,
        data: mapAsistenciaFromDb(data),
      });
    } catch (error: any) {
      console.error('Error al registrar entrada:', error);
      return res.status(500).json({ ok: false, message: 'Error al registrar entrada.' });
    }
  }

  static async registrarSalida(req: Request, res: Response) {
    try {
      const { empleadoId, folioSalidaTemprano, horaSimulada } = req.body;
      const empId = Number(empleadoId);
      const hoy = AsistenciasController.getTodayISO();
      const hora = horaSimulada || AsistenciasController.getCurrentTime();

      const { data: existente } = await supabase
        .from('asistencias')
        .select('*')
        .eq('id_empleado', empId)
        .eq('fecha', hoy)
        .maybeSingle();

      if (!existente || !existente.hora_entrada) {
        return res.status(400).json({
          ok: false,
          message: 'Debes registrar tu hora de entrada antes de registrar la salida.',
        });
      }

      if (existente.hora_salida) {
        return res.status(400).json({
          ok: false,
          message: 'Ya registraste tu salida el día de hoy.',
        });
      }

      // Consultar horario del empleado
      const { data: emp } = await supabase
        .from('empleados')
        .select('hora_salida')
        .eq('id_empleado', empId)
        .single();

      const actualMin = AsistenciasController.timeToMinutes(hora.slice(0, 5));
      const salidaMin = emp
        ? AsistenciasController.timeToMinutes(emp.hora_salida.slice(0, 5))
        : actualMin;
      const anticipada = actualMin < salidaMin;
      const minutosExtra = actualMin > salidaMin ? actualMin - salidaMin : 0;

      if (anticipada) {
        const cleanFolio = (folioSalidaTemprano || '').trim().toUpperCase();
        if (!cleanFolio) {
          return res.status(400).json({
            ok: false,
            requiereFolio: true,
            message:
              'Aún no es tu hora de salida establecida. Ingresa el folio de incidencia autorizado por RH.',
          });
        }

        const { data: solValida } = await supabase
          .from('solicitudes')
          .select('*')
          .eq('id_empleado', empId)
          .eq('tipo', 'Salida temprano')
          .ilike('folio', cleanFolio)
          .neq('estatus', 'Rechazada')
          .maybeSingle();

        if (!solValida) {
          return res.status(400).json({
            ok: false,
            requiereFolio: true,
            message:
              'El folio ingresado no corresponde a una autorización de salida temprano para tu usuario.',
          });
        }
      }

      const detalleSalida = anticipada
        ? `Salida anticipada (${folioSalidaTemprano?.trim().toUpperCase()})`
        : minutosExtra >= 60
          ? `Salida con ${Math.floor(minutosExtra / 60)}h extra(s)`
          : 'Salida normal';

      const { data, error } = await supabase
        .from('asistencias')
        .update({
          hora_salida: hora,
          detalle_salida: detalleSalida,
          estatus: 'Completado',
        })
        .eq('id_asistencia', existente.id_asistencia)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({
        ok: true,
        message: anticipada
          ? `Salida anticipada registrada con folio ${folioSalidaTemprano?.trim().toUpperCase()} (${hora}).`
          : `Salida registrada a las ${hora}.`,
        data: mapAsistenciaFromDb(data),
      });
    } catch (error: any) {
      console.error('Error al registrar salida:', error);
      return res.status(500).json({ ok: false, message: 'Error al registrar salida.' });
    }
  }
}
