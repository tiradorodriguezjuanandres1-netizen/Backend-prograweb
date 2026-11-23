import {
  AsistenciaDb,
  ConfiguracionRetencionesDb,
  DiaSemana,
  EmpleadoDb,
  PuestoDb,
  ReciboNominaDb,
  SolicitudDb,
} from '../types';

export const calcularHorasHorario = (horaEntrada: string, horaSalida: string): number => {
  if (!horaEntrada || !horaSalida) return 0;
  const [h1, m1] = horaEntrada.split(':').map(Number);
  const [h2, m2] = horaSalida.split(':').map(Number);
  const min1 = (h1 || 0) * 60 + (m1 || 0);
  const min2 = (h2 || 0) * 60 + (m2 || 0);
  if (min2 <= min1) return 0;
  return Math.round(((min2 - min1) / 60) * 10) / 10;
};

export const parseDiasLaborales = (diasStr: string): DiaSemana[] => {
  if (!diasStr) return ['L', 'M', 'Mi', 'J', 'V'];
  try {
    if (diasStr.startsWith('[') && diasStr.endsWith(']')) {
      return JSON.parse(diasStr);
    }
  } catch {
    // Fallback a CSV
  }
  return diasStr.split(',').map((d) => d.trim()) as DiaSemana[];
};

export const normalizeRol = (rolRaw: string): 'ADMIN' | 'EMPLEADO' => {
  const clean = (rolRaw || '').trim().toUpperCase();
  if (clean.includes('ADMIN')) return 'ADMIN';
  return 'EMPLEADO';
};

export const denormalizeRol = (rol: 'ADMIN' | 'EMPLEADO' | string): string => {
  const clean = (rol || '').trim().toUpperCase();
  return clean === 'ADMIN' ? 'Admin RH' : 'Empleado';
};

export const formatDiasLaborales = (dias: DiaSemana[] | string): string => {
  if (Array.isArray(dias)) {
    return dias.join(',');
  }
  return dias;
};

export const mapEmpleadoFromDb = (
  emp: EmpleadoDb,
  deptoNombre?: string,
  puestoNombre?: string,
) => {
  const entrada = (emp.hora_entrada || '09:00:00').slice(0, 5);
  const salida = (emp.hora_salida || '17:00:00').slice(0, 5);
  const diasLaborales = parseDiasLaborales(emp.dias_laborales);
  const horasPorDia = calcularHorasHorario(entrada, salida);

  return {
    id: emp.id_empleado,
    numeroEmpleado: emp.matricula,
    rol: normalizeRol(emp.rol),
    nombre: emp.nombre,
    apellidoPaterno: emp.apellido_paterno,
    apellidoMaterno: emp.apellido_materno,
    correoInstitucional: emp.correo,
    telefono: emp.telefono,
    departamentoId: emp.id_departamento,
    departamentoNombre: deptoNombre || '',
    puestoId: emp.id_puesto,
    puestoNombre: puestoNombre || '',
    salarioBase: Number(emp.salario_base_mensual),
    fechaIngreso: emp.fecha_ingreso,
    horaEntradaEstablecida: entrada,
    horaSalidaEstablecida: salida,
    horasPorDia,
    diasLaborales,
    diasPorSemana: diasLaborales.length,
    tienePrestamoEmpresa: Boolean(emp.tiene_prestamo_empresa),
    montoPrestamoQuincenal: Number(emp.cuota_prestamo_quincenal || 0),
    tieneCreditoInfonavit: Boolean(emp.tiene_credito_infonavit),
    descuentoInfonavitQuincenal: Number(emp.cuota_infonavit_quincenal || 0),
    estatus: emp.estatus,
    primerInicioSesion: Boolean(emp.primer_ingreso),
  };
};

export const mapAsistenciaFromDb = (a: AsistenciaDb) => {
  return {
    id: a.id_asistencia,
    empleadoId: a.id_empleado,
    fecha: a.fecha,
    horaEntrada: a.hora_entrada,
    horaSalida: a.hora_salida,
    estatusDia: a.estatus || 'En jornada',
    incidenciaEntrada: a.incidencia || undefined,
    incidenciaSalida: a.detalle_salida || undefined,
  };
};

export const mapSolicitudFromDb = (
  s: SolicitudDb,
  empleadoNombre?: string,
  numeroEmpleado?: string,
  departamentoNombre?: string,
) => {
  const inicio = new Date(s.fecha_inicio + 'T00:00:00');
  const fin = new Date(s.fecha_fin + 'T00:00:00');
  const diffMs = fin.getTime() - inicio.getTime();
  const diasSolicitados = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);

  return {
    id: s.id_solicitud,
    folio: s.folio,
    empleadoId: s.id_empleado,
    empleadoNombre: empleadoNombre || '',
    numeroEmpleado: numeroEmpleado || '',
    departamentoNombre: departamentoNombre || '',
    tipo: s.tipo,
    fechaInicio: s.fecha_inicio,
    fechaFin: s.fecha_fin,
    diasSolicitados,
    reponerEnDescanso: Boolean(s.repone_descanso),
    fechaReposicion: s.fecha_reposicion || undefined,
    horasExtrasSolicitadas: Number(s.cantidad_horas_extra || 0),
    motivo: s.motivo,
    estatus: s.estatus,
    fechaSolicitud: s.fecha_creacion,
    comentarioAdmin: s.comentario_rh || undefined,
  };
};

export const mapRetencionesFromDb = (r: ConfiguracionRetencionesDb) => {
  return {
    isrPorcentaje: Number(r.isr_porcentaje),
    imssPorcentaje: Number(r.imss_porcentaje),
    infonavitPorcentaje: Number(r.infonavit_porcentaje),
    ivaPorcentaje: Number(r.iva_otros_porcentaje),
  };
};

export const mapReciboFromDb = (
  r: ReciboNominaDb,
  empleadoNombre?: string,
  numeroEmpleado?: string,
  departamentoNombre?: string,
  puestoNombre?: string,
) => {
  const sueldoBruto = Number(r.sueldo_bruto);
  const pagoHorasExtra = Number(r.pago_horas_extra);
  const isr = Number(r.isr);
  const imss = Number(r.imss);
  const infonavit = Number(r.infonavit);
  const prestamo = Number(r.prestamo_empresa);
  const otros = Number(r.otros_descuentos);
  const totalRetenciones = Math.round((isr + imss + infonavit + prestamo + otros) * 100) / 100;

  return {
    id: r.id_nomina,
    corteId: r.clave_corte,
    periodoLabel: r.periodo_nombre,
    fechaInicio: r.fecha_inicio,
    fechaFin: r.fecha_fin,
    empleadoId: r.id_empleado,
    numeroEmpleado: numeroEmpleado || '',
    empleadoNombre: empleadoNombre || '',
    departamento: departamentoNombre || '',
    puesto: puestoNombre || '',
    diasTrabajados: 15,
    diasJustificados: 0,
    horasTrabajadas: 120,
    horasExtrasPagadas: pagoHorasExtra > 0 ? 5 : 0,
    pagoHorasExtras: pagoHorasExtra,
    sueldoBrutoQuincenal: sueldoBruto,
    descuentoIsr: isr,
    descuentoImss: imss,
    descuentoInfonavit: infonavit,
    descuentoIva: otros,
    descuentoPrestamoEmpresa: prestamo,
    totalRetenciones,
    sueldoNeto: Number(r.sueldo_neto),
    aprobadoPorRh: r.estatus === 'Aprobado',
  };
};
