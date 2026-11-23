const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const rawUrl = process.env.SUPABASE_URL || '';
const cleanUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const key = (process.env.SUPABASE_KEY || '').trim();

if (!cleanUrl || !key) {
  console.error('❌ Error: SUPABASE_URL o SUPABASE_KEY no definidos en backend/.env');
  process.exit(1);
}

const supabase = createClient(cleanUrl, key);

async function runHealthCheck() {
  console.log('================================================================');
  console.log('🔍 INICIANDO DIAGNÓSTICO DE CONEXIÓN CON SUPABASE');
  console.log('📡 URL Proyecto: ' + cleanUrl);
  console.log('================================================================\n');

  try {
    // 1. Departamentos
    const { data: deptos, error: errD } = await supabase.from('departamentos').select('*');
    if (errD) throw new Error('departamentos: ' + errD.message);
    console.log(`✅ [1/7] departamentos: Conexión OK (${deptos.length} registros encontrados)`);

    // 2. Puestos
    const { data: puestos, error: errP } = await supabase.from('puestos').select('*');
    if (errP) throw new Error('puestos: ' + errP.message);
    console.log(`✅ [2/7] puestos: Conexión OK (${puestos.length} registros encontrados)`);

    // 3. Empleados
    const { data: emps, error: errE } = await supabase.from('empleados').select('*');
    if (errE) throw new Error('empleados: ' + errE.message);
    console.log(`✅ [3/7] empleados: Conexión OK (${emps.length} registros encontrados)`);

    // 4. Configuración Retenciones
    const { data: ret, error: errR } = await supabase.from('configuracion_retenciones').select('*');
    if (errR) throw new Error('configuracion_retenciones: ' + errR.message);
    console.log(`✅ [4/7] configuracion_retenciones: Conexión OK (${ret.length} registros)`);

    // 5. Asistencias (Test de Lectura y Escritura)
    const empId = emps && emps.length > 0 ? emps[0].id_empleado : 1;
    const hoy = new Date().toISOString().slice(0, 10);
    const { data: testAsis, error: errA } = await supabase.from('asistencias').insert([{
      id_empleado: empId,
      fecha: hoy,
      hora_entrada: '09:00:00',
      hora_salida: '17:00:00',
      incidencia: 'Sin incidencias',
      detalle_salida: 'Salida normal',
      estatus: 'Completado'
    }]).select();
    if (errA) throw new Error('asistencias (escritura): ' + errA.message);
    console.log(`✅ [5/7] asistencias: Lectura y Escritura OK (Insert ID: ${testAsis[0].id_asistencia})`);
    await supabase.from('asistencias').delete().eq('id_asistencia', testAsis[0].id_asistencia);

    // 6. Solicitudes (Test de Lectura y Escritura)
    const { data: testSol, error: errS } = await supabase.from('solicitudes').insert([{
      folio: 'FOL-DIAG-001',
      id_empleado: empId,
      tipo: 'Vacaciones',
      fecha_inicio: hoy,
      fecha_fin: hoy,
      motivo: 'Diagnóstico de conectividad',
      estatus: 'Pendiente'
    }]).select();
    if (errS) throw new Error('solicitudes (escritura): ' + errS.message);
    console.log(`✅ [6/7] solicitudes: Lectura y Escritura OK (Insert Folio: ${testSol[0].folio})`);
    await supabase.from('solicitudes').delete().eq('id_solicitud', testSol[0].id_solicitud);

    // 7. Recibos de Nómina (Test de Lectura y Escritura)
    const { data: testNom, error: errN } = await supabase.from('recibos_nomina').insert([{
      clave_corte: 'CORTE-DIAG-001',
      id_empleado: empId,
      periodo_nombre: 'Periodo Diagnóstico',
      fecha_inicio: hoy,
      fecha_fin: hoy,
      sueldo_bruto: 15000.00,
      pago_horas_extra: 0,
      isr: 1500.00,
      imss: 350.00,
      infonavit: 750.00,
      prestamo_empresa: 0,
      otros_descuentos: 0,
      sueldo_neto: 12400.00,
      estatus: 'Borrador'
    }]).select();
    if (errN) throw new Error('recibos_nomina (escritura): ' + errN.message);
    console.log(`✅ [7/7] recibos_nomina: Lectura y Escritura OK (Insert ID: ${testNom[0].id_nomina})`);
    await supabase.from('recibos_nomina').delete().eq('id_nomina', testNom[0].id_nomina);

    console.log('\n================================================================');
    console.log('🎉 RESULTADO: LAS 7 TABLAS ESTÁN 100% OPERATIVAS Y CONECTADAS');
    console.log('================================================================');
  } catch (error) {
    console.error('\n❌ ERROR DURANTE EL DIAGNÓSTICO:');
    console.error(error.message);
    process.exit(1);
  }
}

runHealthCheck();
