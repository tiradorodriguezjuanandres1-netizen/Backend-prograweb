# Portal de Recursos Humanos — Backend (Node.js & Express)

Proyecto Backend desarrollado en **Node.js**, **Express** y **TypeScript** conectado a una base de datos **PostgreSQL en Supabase** para la gestión integral de Recursos Humanos, control de personal, asistencia, solicitudes de ausencia y cálculo de nómina.

---

## Requisitos Previos e Instalación

1. Tener **Node.js** (v20+ recomendado) y **npm** instalados.
2. Ingresa a la carpeta del backend e instala las dependencias:
   ```bash
   cd backend
   npm install
   ```
3. Configurar el archivo de variables de entorno `.env` en la raíz de la carpeta `backend/` con las credenciales del proyecto Supabase. La informacion de la base de datos ya esta configurada exceptuando JWT_SECRET:
   ```env
   PORT=3000
   SUPABASE_URL=https://Nuestro-URL-base-En-Supa.supabase.co 
   SUPABASE_KEY=Secret-Key-de-Supabase
   JWT_SECRET=super_secret_jwt_key_rrhh_2026
   FRONTEND_URL=http://localhost:4200
   ```
4. Iniciar el servidor en modo desarrollo:
   ```bash
   npm run dev
   ```
   O compilar e inicia en modo producción:
   ```bash
   npm run build
   npm start
   ```
5. El servidor estará disponible en `http://localhost:3000/api`.

---

## Cuentas de Prueba (Sincronizadas con Supabase)

El backend valida las credenciales directamente contra la tabla `empleados` de Supabase, admitiendo contraseñas almacenadas tanto en texto plano como encriptadas con bcrypt:

| Rol / Escenario | Correo Institucional | Contraseña | Regla que prueba |
| :--- | :--- | :--- | :--- |
| **Administrador RH** | `admin.rh@empresa.mx` | `admin123` / `Admin123` | Token con rol ADMIN, acceso completo a directores, catálogos y nómina (RF 1.1.2) |
| **Empleado Activo** | `diego.alvarez@empresa.mx` | `202DieMa` / `Emp12345` | Token con rol EMPLEADO, checador de asistencia y solicitudes (RF 1.3.1 - 1.3.3) |
| **Primer Ingreso** | `sofia.ramirez@empresa.mx` | `202SofLo` | Retorna requirePasswordChange: true para forzar cambio de contraseña (RF 1.1.4) |
| **Cuenta Inactiva** | `mariana.torres@empresa.mx` | `202MarSa` / `Inactivo1` | Bloqueo con HTTP 403 por estatus Inactivo (RN 3.3) |

---

## Estructura de Endpoints de la API REST

Los endpoints corresponden a los requerimientos funcionales y reglas de negocio del sistema:

### Autenticación
- `POST /api/auth/login` -> Valida correo y credencial en Supabase, verifica estatus 'Activo' (RN 3.3) y retorna token JWT y datos del empleado.
- `POST /api/auth/primer-ingreso` -> Actualiza contraseña obligatoria y marca `primer_ingreso = false` (RF 1.1.4). Requiere token Bearer.
- `POST /api/auth/cambiar-password` -> Actualización voluntaria de contraseña validando la anterior y reglas de complejidad. Requiere token Bearer.
- `GET /api/auth/me` -> Retorna los datos del empleado en sesión. Requiere token Bearer.

### Empleados (Admin RH)
- `GET /api/empleados` -> Consulta el directorio de empleados con datos de departamento y puesto (RF 1.2.3).
- `GET /api/empleados/:id` -> Obtiene el detalle de un empleado por ID.
- `POST /api/empleados` -> Alta de nuevo empleado, autogeneración de contraseña inicial (RF 1.2.2) y validación de salario > 0 (RN 3.2).
- `PUT /api/empleados/:id` -> Edición de información del empleado, horario y créditos (RF 1.2.4).
- `PATCH /api/empleados/:id/estatus` -> Baja lógica a 'Inactivo' o reactivación (RF 1.2.5).

### Catálogos (Departamentos y Puestos)
- `GET /api/catalogos/departamentos` -> Consulta el catálogo de departamentos.
- `POST / PUT / DELETE /api/catalogos/departamentos` -> Alta, edición y eliminación de departamentos con validación de integridad referencial (RN 3.4).
- `GET /api/catalogos/puestos` -> Consulta el catálogo de puestos con relación al departamento.
- `POST / PUT / DELETE /api/catalogos/puestos` -> Alta, edición y eliminación de puestos (RF 1.2.6).

### Asistencias y Checador
- `GET /api/asistencias` -> Consulta general de asistencias o filtrada por empleado (`?empleadoId=X`).
- `GET /api/asistencias/hoy/:empleadoId` -> Obtiene el registro de jornada del día en curso.
- `POST /api/asistencias/entrada` -> Registro de entrada con tolerancia estricta de 10 minutos y validación de folios de retardo (RF 1.3.2, RN 3.1).
- `POST /api/asistencias/salida` -> Registro de salida y validación de salida anticipada con folio autorizado.

### Solicitudes de Ausencia y Permisos
- `GET /api/solicitudes` -> Consulta de solicitudes general o por empleado (`?empleadoId=X`).
- `POST /api/solicitudes` -> Creación de solicitud con asignación automática de folio consecutivo (FOL-2026-XXX) y validación de días de descanso (RF 1.3.3).
- `PUT /api/solicitudes/:id/resolver` -> Aprobación o rechazo de solicitudes por parte de RH con comentarios opcionales (RF 1.2.7).

### Retenciones y Leyes Laborales
- `GET /api/retenciones` -> Consulta porcentajes vigentes de retención (ISR, IMSS, Infonavit, IVA).
- `PUT /api/retenciones` -> Actualización de porcentajes por personal administrativo de RH.

### Nómina Quincenal
- `GET /api/nomina/recibos` -> Consulta de recibos generados por clave de corte (`?corteId=X`) o por empleado.
- `POST /api/nomina/corte` -> Generación automática del borrador de corte quincenal calculando salario bruto, horas extras aprobadas, retenciones y salario neto.
- `PUT /api/nomina/recibos/:id` -> Ajuste manual de percepciones y deducciones en el borrador de nómina.
- `POST /api/nomina/aprobar` -> Aprobación y liberación del periodo de corte para consulta de los empleados.

---

## Verificación de Conectividad con Supabase

El backend incluye un script para verificar la conexion, lectura y escritura en todas las tablas de Supabase:

```bash
npm run test:supabase
```

El script comprueba las tablas:
1. `departamentos`
2. `puestos`
3. `empleados`
4. `configuracion_retenciones`
5. `asistencias`
6. `solicitudes`
7. `recibos_nomina`
