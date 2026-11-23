import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { calcularHorasHorario, mapReciboFromDb } from '../utils/mappers';

export class NominaController {
  static async getRecibos(req: Request, res: Response) {
    try {
      const corteId = req.query.corteId as string;
      const empleadoId = req.query.empleadoId ? Number(req.query.empleadoId) : null;

      let query = supabase
        .from('recibos_nomina')
        .select(`
          *,
          empleado:empleados(
            nombre,
            apellido_paterno,
            apellido_materno,
            matricula,
            departamento:departamentos(nombre),
            puesto:puestos(nombre)
          )
        `)
        .order('id_nomina', { ascending: false });

      if (corteId) {
        query = query.eq('clave_corte', corteId);
      }
      if (empleadoId) {
        query = query.eq('id_empleado', empleadoId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const format = (data || []).map((r) => {
        const emp = r.empleado as any;
        const empNombre = emp
          ? `${emp.nombre} ${emp.apellido_paterno} ${emp.apellido_materno}`
          : '';
        const matricula = emp?.matricula || '';
        const depto = emp?.departamento?.nombre || '';
        const puesto = emp?.puesto?.nombre || '';
        return mapReciboFromDb(r, empNombre, matricula, depto, puesto);
      });

      return res.status(200).json({ ok: true, data: format });
    } catch (error: any) {
      console.error('Error al obtener recibos:', error);
      return res.status(500).json({ ok: false, message: 'Error al consultar recibos.' });
    }
  }

  static async generarCorte(req: Request, res: Response) {
    try {
      const { fechaInicio, fechaFin, periodoLabel } = req.body;

      if (!fechaInicio || !fechaFin || !periodoLabel) {
        return res.status(400).json({
          ok: false,
          message: 'Fechas de corte y etiqueta del periodo requeridas.',
        });
      }

      const claveCorte = `CORTE-${fechaInicio}-${fechaFin}`;

      // Verificar si ya fue aprobado
      const { data: yaAprobado } = await supabase
        .from('recibos_nomina')
        .select('id_nomina')
        .eq('clave_corte', claveCorte)
        .eq('estatus', 'Aprobado')
        .limit(1)
        .maybeSingle();

      if (yaAprobado) {
        return res.status(400).json({
          ok: false,
          message: 'Este periodo de corte ya fue aprobado y liberado por RH.',
        });
      }

      // Obtener configuración de retenciones
      const { data: retencionesData } = await supabase
        .from('configuracion_retenciones')
        .select('*')
        .order('id_retenciones', { ascending: false })
        .limit(1)
        .maybeSingle();

      const ret = retencionesData || {
        id_retenciones: 1,
        isr_porcentaje: 10.5,
        imss_porcentaje: 2.38,
        infonavit_porcentaje: 5.0,
        iva_otros_porcentaje: 0.0,
      };

      // Obtener empleados activos
      const { data: empleados, error: errEmp } = await supabase
        .from('empleados')
        .select(`
          *,
          departamento:departamentos(nombre),
          puesto:puestos(nombre)
        `)
        .eq('estatus', 'Activo');

      if (errEmp || !empleados) {
        return res.status(500).json({ ok: false, message: 'Error al obtener empleados activos.' });
      }

      // Obtener asistencias y solicitudes del periodo
      const { data: asistencias } = await supabase
        .from('asistencias')
        .select('*')
        .gte('fecha', fechaInicio)
        .lte('fecha', fechaFin);

      const { data: solicitudes } = await supabase
        .from('solicitudes')
        .select('*')
        .eq('estatus', 'Aprobada')
        .gte('fecha_fin', fechaInicio)
        .lte('fecha_inicio', fechaFin);

      // Eliminar borradores previos para este corte si existen
      await supabase.from('recibos_nomina').delete().eq('clave_corte', claveCorte);

      // Calcular nómina por empleado
      const nuevosRecibos = empleados.map((emp) => {
        const salario = Number(emp.salario_base_mensual);
        const sueldoBrutoQuincenal = Math.round((salario / 2) * 100) / 100;

        const horasPorDia = calcularHorasHorario(
          emp.hora_entrada || '09:00',
          emp.hora_salida || '17:00'
        );
        const tarifaHora = salario / 30 / Math.max(1, horasPorDia);

        // Sumar horas extras aprobadas
        const solExtras = (solicitudes || []).filter(
          (s) => s.id_empleado === emp.id_empleado && s.tipo === 'Horas extras'
        );
        const totalHorasExtras = solExtras.reduce(
          (sum, s) => sum + Number(s.cantidad_horas_extra || 0),
          0
        );
        const pagoHorasExtras = Math.round(totalHorasExtras * tarifaHora * 2 * 100) / 100;
        const baseGravable = sueldoBrutoQuincenal + pagoHorasExtras;

        const isr = Math.round(baseGravable * (Number(ret.isr_porcentaje) / 100) * 100) / 100;
        const imss = Math.round(baseGravable * (Number(ret.imss_porcentaje) / 100) * 100) / 100;
        const otrosDescuentos =
          Math.round(baseGravable * (Number(ret.iva_otros_porcentaje) / 100) * 100) / 100;

        const infonavit = emp.tiene_credito_infonavit
          ? Number(emp.cuota_infonavit_quincenal) > 0
            ? Number(emp.cuota_infonavit_quincenal)
            : Math.round(baseGravable * (Number(ret.infonavit_porcentaje) / 100) * 100) / 100
          : 0;

        const prestamo = emp.tiene_prestamo_empresa
          ? Number(emp.cuota_prestamo_quincenal || 0)
          : 0;

        const totalRetenciones =
          Math.round((isr + imss + infonavit + prestamo + otrosDescuentos) * 100) / 100;
        const sueldoNeto = Math.max(0, Math.round((baseGravable - totalRetenciones) * 100) / 100);

        return {
          clave_corte: claveCorte,
          id_empleado: emp.id_empleado,
          periodo_nombre: periodoLabel,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          sueldo_bruto: sueldoBrutoQuincenal,
          pago_horas_extra: pagoHorasExtras,
          isr,
          imss,
          infonavit,
          prestamo_empresa: prestamo,
          otros_descuentos: otrosDescuentos,
          sueldo_neto: sueldoNeto,
          estatus: 'Borrador',
          id_retenciones: ret.id_retenciones || null,
        };
      });

      const { data: insertados, error: errInsert } = await supabase
        .from('recibos_nomina')
        .insert(nuevosRecibos)
        .select(`
          *,
          empleado:empleados(
            nombre,
            apellido_paterno,
            apellido_materno,
            matricula,
            departamento:departamentos(nombre),
            puesto:puestos(nombre)
          )
        `);

      if (errInsert) throw errInsert;

      const format = (insertados || []).map((r) => {
        const emp = r.empleado as any;
        const empNombre = emp
          ? `${emp.nombre} ${emp.apellido_paterno} ${emp.apellido_materno}`
          : '';
        const matricula = emp?.matricula || '';
        const depto = emp?.departamento?.nombre || '';
        const puesto = emp?.puesto?.nombre || '';
        return mapReciboFromDb(r, empNombre, matricula, depto, puesto);
      });

      return res.status(201).json({
        ok: true,
        message: `Borrador de corte generado para ${format.length} empleados. Revísalo y apruébalo para liberar recibos.`,
        data: format,
      });
    } catch (error: any) {
      console.error('Error al generar corte de nómina:', error);
      return res.status(500).json({ ok: false, message: 'Error al generar corte de nómina.' });
    }
  }

  static async updateReciboDetalle(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const cambios = req.body;

      const { data: actual, error: errFetch } = await supabase
        .from('recibos_nomina')
        .select('*')
        .eq('id_nomina', id)
        .single();

      if (errFetch || !actual) {
        return res.status(404).json({ ok: false, message: 'Recibo no encontrado.' });
      }

      const sueldoBruto =
        cambios.sueldoBrutoQuincenal !== undefined
          ? Number(cambios.sueldoBrutoQuincenal)
          : Number(actual.sueldo_bruto);
      const pagoHorasExtra =
        cambios.pagoHorasExtras !== undefined
          ? Number(cambios.pagoHorasExtras)
          : Number(actual.pago_horas_extra);
      const isr =
        cambios.descuentoIsr !== undefined ? Number(cambios.descuentoIsr) : Number(actual.isr);
      const imss =
        cambios.descuentoImss !== undefined ? Number(cambios.descuentoImss) : Number(actual.imss);
      const infonavit =
        cambios.descuentoInfonavit !== undefined
          ? Number(cambios.descuentoInfonavit)
          : Number(actual.infonavit);
      const prestamo =
        cambios.descuentoPrestamoEmpresa !== undefined
          ? Number(cambios.descuentoPrestamoEmpresa)
          : Number(actual.prestamo_empresa);
      const otros =
        cambios.descuentoIva !== undefined
          ? Number(cambios.descuentoIva)
          : Number(actual.otros_descuentos);

      const totalRetenciones = Math.round((isr + imss + infonavit + prestamo + otros) * 100) / 100;
      const sueldoNeto = Math.max(
        0,
        Math.round((sueldoBruto + pagoHorasExtra - totalRetenciones) * 100) / 100
      );

      const { data, error } = await supabase
        .from('recibos_nomina')
        .update({
          sueldo_bruto: sueldoBruto,
          pago_horas_extra: pagoHorasExtra,
          isr,
          imss,
          infonavit,
          prestamo_empresa: prestamo,
          otros_descuentos: otros,
          sueldo_neto: sueldoNeto,
        })
        .eq('id_nomina', id)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({
        ok: true,
        message: 'Detalle del recibo actualizado en el corte.',
        data,
      });
    } catch (error: any) {
      console.error('Error al actualizar recibo:', error);
      return res.status(500).json({ ok: false, message: 'Error al actualizar recibo.' });
    }
  }

  static async aprobarCorte(req: Request, res: Response) {
    try {
      const { corteId } = req.body;

      if (!corteId) {
        return res.status(400).json({ ok: false, message: 'Identificador de corte requerido.' });
      }

      const { error } = await supabase
        .from('recibos_nomina')
        .update({ estatus: 'Aprobado' })
        .eq('clave_corte', corteId);

      if (error) throw error;

      return res.status(200).json({
        ok: true,
        message:
          'Corte de nómina aprobado. Los empleados ya pueden consultar sus recibos de este periodo.',
      });
    } catch (error: any) {
      console.error('Error al aprobar corte:', error);
      return res.status(500).json({ ok: false, message: 'Error al aprobar corte de nómina.' });
    }
  }
}
