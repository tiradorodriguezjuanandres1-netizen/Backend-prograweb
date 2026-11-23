import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export class CatalogosController {
  // ================= DEPARTAMENTOS =================
  static async getDepartamentos(req: Request, res: Response) {
    try {
      const { data, error } = await supabase
        .from('departamentos')
        .select('*')
        .order('id_departamento', { ascending: true });

      if (error) throw error;

      const format = (data || []).map((d) => ({
        id: d.id_departamento,
        nombre: d.nombre,
        descripcion: d.descripcion || '',
        activo: true,
      }));

      return res.status(200).json({ ok: true, data: format });
    } catch (error: any) {
      console.error('Error al obtener departamentos:', error);
      return res.status(500).json({ ok: false, message: 'Error al obtener departamentos.' });
    }
  }

  static async createDepartamento(req: Request, res: Response) {
    try {
      const { nombre, descripcion } = req.body;
      const cleanName = (nombre || '').trim();

      if (!cleanName) {
        return res.status(400).json({ ok: false, message: 'El nombre del departamento es obligatorio.' });
      }

      const { data, error } = await supabase
        .from('departamentos')
        .insert([{ nombre: cleanName, descripcion: (descripcion || '').trim() }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(400).json({ ok: false, message: 'Ya existe un departamento con ese nombre.' });
        }
        throw error;
      }

      return res.status(201).json({
        ok: true,
        message: 'Departamento creado correctamente.',
        data: {
          id: data.id_departamento,
          nombre: data.nombre,
          descripcion: data.descripcion || '',
          activo: true,
        },
      });
    } catch (error: any) {
      console.error('Error al crear departamento:', error);
      return res.status(500).json({ ok: false, message: 'Error al crear departamento.' });
    }
  }

  static async updateDepartamento(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { nombre, descripcion } = req.body;
      const cleanName = (nombre || '').trim();

      if (!cleanName) {
        return res.status(400).json({ ok: false, message: 'El nombre del departamento es obligatorio.' });
      }

      const { error } = await supabase
        .from('departamentos')
        .update({ nombre: cleanName, descripcion: (descripcion || '').trim() })
        .eq('id_departamento', id);

      if (error) throw error;

      return res.status(200).json({ ok: true, message: 'Departamento actualizado.' });
    } catch (error: any) {
      console.error('Error al actualizar departamento:', error);
      return res.status(500).json({ ok: false, message: 'Error al actualizar departamento.' });
    }
  }

  static async deleteDepartamento(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);

      // Validar si tiene puestos o empleados vinculados
      const { count: countEmpleados } = await supabase
        .from('empleados')
        .select('*', { count: 'exact', head: true })
        .eq('id_departamento', id);

      if (countEmpleados && countEmpleados > 0) {
        return res.status(400).json({
          ok: false,
          message: `No se puede eliminar este departamento porque tiene ${countEmpleados} empleado(s) vinculado(s).`,
        });
      }

      const { count: countPuestos } = await supabase
        .from('puestos')
        .select('*', { count: 'exact', head: true })
        .eq('id_departamento', id);

      if (countPuestos && countPuestos > 0) {
        return res.status(400).json({
          ok: false,
          message: `No se puede eliminar porque existen ${countPuestos} puesto(s) asignado(s) a este departamento.`,
        });
      }

      const { error } = await supabase.from('departamentos').delete().eq('id_departamento', id);
      if (error) throw error;

      return res.status(200).json({ ok: true, message: 'Departamento eliminado del catálogo.' });
    } catch (error: any) {
      console.error('Error al eliminar departamento:', error);
      return res.status(500).json({ ok: false, message: 'Error al eliminar departamento.' });
    }
  }

  // ================= PUESTOS =================
  static async getPuestos(req: Request, res: Response) {
    try {
      const { data, error } = await supabase
        .from('puestos')
        .select(`
          id_puesto,
          nombre,
          id_departamento,
          nivel,
          departamento:departamentos(nombre)
        `)
        .order('id_puesto', { ascending: true });

      if (error) throw error;

      const format = (data || []).map((p) => ({
        id: p.id_puesto,
        nombre: p.nombre,
        departamentoId: p.id_departamento,
        departamentoNombre: (p.departamento as any)?.nombre || '',
        nivel: p.nivel || 'Operativo',
      }));

      return res.status(200).json({ ok: true, data: format });
    } catch (error: any) {
      console.error('Error al obtener puestos:', error);
      return res.status(500).json({ ok: false, message: 'Error al obtener puestos.' });
    }
  }

  static async createPuesto(req: Request, res: Response) {
    try {
      const { nombre, departamentoId, nivel } = req.body;
      const cleanName = (nombre || '').trim();

      if (!cleanName) {
        return res.status(400).json({ ok: false, message: 'El nombre del puesto es obligatorio.' });
      }

      const { data: depto } = await supabase
        .from('departamentos')
        .select('nombre')
        .eq('id_departamento', Number(departamentoId))
        .single();

      if (!depto) {
        return res.status(400).json({ ok: false, message: 'Selecciona un departamento válido.' });
      }

      const { data, error } = await supabase
        .from('puestos')
        .insert([
          {
            nombre: cleanName,
            id_departamento: Number(departamentoId),
            nivel: (nivel || 'Operativo').trim(),
          },
        ])
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({
        ok: true,
        message: 'Puesto creado correctamente.',
        data: {
          id: data.id_puesto,
          nombre: data.nombre,
          departamentoId: data.id_departamento,
          departamentoNombre: depto.nombre,
          nivel: data.nivel,
        },
      });
    } catch (error: any) {
      console.error('Error al crear puesto:', error);
      return res.status(500).json({ ok: false, message: 'Error al crear puesto.' });
    }
  }

  static async updatePuesto(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { nombre, departamentoId, nivel } = req.body;
      const cleanName = (nombre || '').trim();

      if (!cleanName) {
        return res.status(400).json({ ok: false, message: 'El nombre del puesto es obligatorio.' });
      }

      const { error } = await supabase
        .from('puestos')
        .update({
          nombre: cleanName,
          id_departamento: Number(departamentoId),
          nivel: (nivel || 'Operativo').trim(),
        })
        .eq('id_puesto', id);

      if (error) throw error;

      return res.status(200).json({ ok: true, message: 'Puesto actualizado.' });
    } catch (error: any) {
      console.error('Error al actualizar puesto:', error);
      return res.status(500).json({ ok: false, message: 'Error al actualizar puesto.' });
    }
  }

  static async deletePuesto(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);

      const { count: countEmpleados } = await supabase
        .from('empleados')
        .select('*', { count: 'exact', head: true })
        .eq('id_puesto', id);

      if (countEmpleados && countEmpleados > 0) {
        return res.status(400).json({
          ok: false,
          message: `No se puede eliminar este puesto porque tiene ${countEmpleados} empleado(s) vinculado(s).`,
        });
      }

      const { error } = await supabase.from('puestos').delete().eq('id_puesto', id);
      if (error) throw error;

      return res.status(200).json({ ok: true, message: 'Puesto eliminado del catálogo.' });
    } catch (error: any) {
      console.error('Error al eliminar puesto:', error);
      return res.status(500).json({ ok: false, message: 'Error al eliminar puesto.' });
    }
  }
}
