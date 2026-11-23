import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { mapRetencionesFromDb } from '../utils/mappers';

export class RetencionesController {
  static async getRetenciones(req: Request, res: Response) {
    try {
      const { data, error } = await supabase
        .from('configuracion_retenciones')
        .select('*')
        .order('id_retenciones', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Valores por defecto
        return res.status(200).json({
          ok: true,
          data: {
            isrPorcentaje: 10.5,
            imssPorcentaje: 2.38,
            infonavitPorcentaje: 5.0,
            ivaPorcentaje: 0.0,
          },
        });
      }

      return res.status(200).json({ ok: true, data: mapRetencionesFromDb(data) });
    } catch (error: any) {
      console.error('Error al obtener retenciones:', error);
      return res.status(500).json({ ok: false, message: 'Error al consultar retenciones.' });
    }
  }

  static async updateRetenciones(req: Request, res: Response) {
    try {
      const { isrPorcentaje, imssPorcentaje, infonavitPorcentaje, ivaPorcentaje } = req.body;

      if (
        isrPorcentaje < 0 ||
        imssPorcentaje < 0 ||
        infonavitPorcentaje < 0 ||
        ivaPorcentaje < 0
      ) {
        return res.status(400).json({
          ok: false,
          message: 'Los porcentajes de retención no pueden ser negativos.',
        });
      }

      // Buscar si existe registro 1 o el más reciente
      const { data: existente } = await supabase
        .from('configuracion_retenciones')
        .select('id_retenciones')
        .order('id_retenciones', { ascending: false })
        .limit(1)
        .maybeSingle();

      let opError;
      if (existente) {
        const { error } = await supabase
          .from('configuracion_retenciones')
          .update({
            isr_porcentaje: Number(isrPorcentaje),
            imss_porcentaje: Number(imssPorcentaje),
            infonavit_porcentaje: Number(infonavitPorcentaje),
            iva_otros_porcentaje: Number(ivaPorcentaje),
            ultima_actualizacion: new Date().toISOString(),
          })
          .eq('id_retenciones', existente.id_retenciones);
        opError = error;
      } else {
        const { error } = await supabase.from('configuracion_retenciones').insert([
          {
            isr_porcentaje: Number(isrPorcentaje),
            imss_porcentaje: Number(imssPorcentaje),
            infonavit_porcentaje: Number(infonavitPorcentaje),
            iva_otros_porcentaje: Number(ivaPorcentaje),
          },
        ]);
        opError = error;
      }

      if (opError) throw opError;

      return res.status(200).json({
        ok: true,
        message: 'Configuración de retenciones actualizada.',
        data: {
          isrPorcentaje: Number(isrPorcentaje),
          imssPorcentaje: Number(imssPorcentaje),
          infonavitPorcentaje: Number(infonavitPorcentaje),
          ivaPorcentaje: Number(ivaPorcentaje),
        },
      });
    } catch (error: any) {
      console.error('Error al actualizar retenciones:', error);
      return res.status(500).json({ ok: false, message: 'Error al actualizar retenciones.' });
    }
  }
}
