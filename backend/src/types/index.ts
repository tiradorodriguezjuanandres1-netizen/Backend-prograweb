export type RolUsuario = 'ADMIN' | 'EMPLEADO';
export type EstatusEmpleado = 'Activo' | 'Inactivo';
export type EstatusSolicitud = 'Pendiente' | 'Aprobada' | 'Rechazada';
export type DiaSemana = 'L' | 'M' | 'Mi' | 'J' | 'V' | 'S' | 'D';

// Database Models (Exact DB columns)
export interface DepartamentoDb {
  id_departamento: number;
  nombre: string;
  descripcion: string;
}

export interface PuestoDb {
  id_puesto: number;
  nombre: string;
  id_departamento: number;
  nivel: string;
}

export interface EmpleadoDb {
  id_empleado: number;
  matricula: string;
  rol: RolUsuario;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  correo: string;
  telefono: string;
  id_departamento: number;
  id_puesto: number;
  salario_base_mensual: number;
  fecha_ingreso: string;
  hora_entrada: string;
  hora_salida: string;
  dias_laborales: string;
  tiene_prestamo_empresa: boolean;
  cuota_prestamo_quincenal: number;
  tiene_credito_infonavit: boolean;
  cuota_infonavit_quincenal: number;
  password_hash: string;
  estatus: EstatusEmpleado;
  primer_ingreso: boolean;
}

export interface AsistenciaDb {
  id_asistencia: number;
  id_empleado: number;
  fecha: string;
  hora_entrada: string | null;
  hora_salida: string | null;
  incidencia: string | null;
  detalle_salida: string | null;
  estatus: string | null;
}

export interface SolicitudDb {
  id_solicitud: number;
  folio: string;
  id_empleado: number;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  repone_descanso: boolean;
  fecha_reposicion: string | null;
  cantidad_horas_extra: number;
  motivo: string;
  comentario_rh: string | null;
  estatus: EstatusSolicitud;
  fecha_creacion: string;
}

export interface ConfiguracionRetencionesDb {
  id_retenciones: number;
  isr_porcentaje: number;
  imss_porcentaje: number;
  infonavit_porcentaje: number;
  iva_otros_porcentaje: number;
  ultima_actualizacion?: string;
}

export interface ReciboNominaDb {
  id_nomina: number;
  clave_corte: string;
  id_empleado: number;
  periodo_nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  sueldo_bruto: number;
  pago_horas_extra: number;
  isr: number;
  imss: number;
  infonavit: number;
  prestamo_empresa: number;
  otros_descuentos: number;
  sueldo_neto: number;
  estatus: string;
  id_retenciones: number;
}
