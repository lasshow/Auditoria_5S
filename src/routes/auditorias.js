const express = require('express');
const { queryAll, queryOne, runQuery, pool } = require('../helpers/queries');
const { Validator } = require('../validators');
const { verificarAdmin } = require('../middleware/auth');

const router = express.Router();

// Obtener todas las auditorías
router.get('/', async (req, res) => {
  try {
    const auditorias = await queryAll('SELECT * FROM auditorias ORDER BY created_at DESC');
    res.json(auditorias);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener una auditoría completa por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!Validator.isValidId(id)) {
      return res.status(400).json({ error: 'ID de auditoría inválido' });
    }

    const auditoria = await queryOne('SELECT * FROM auditorias WHERE id = $1', [id]);

    if (!auditoria) {
      return res.status(404).json({ error: 'Auditoría no encontrada' });
    }

    const [clasificacion, orden, limpieza, inspeccion, acciones,
      desgloseDesconocidos, desgloseNoFullkit, desgloseHerramienta,
      desgloseEslingas, desgloseMaquinas, desgloseRopa] = await Promise.all([
      queryOne('SELECT * FROM respuestas_clasificacion WHERE auditoria_id = $1', [id]),
      queryOne('SELECT * FROM respuestas_orden WHERE auditoria_id = $1', [id]),
      queryOne('SELECT * FROM respuestas_limpieza WHERE auditoria_id = $1', [id]),
      queryOne('SELECT * FROM respuestas_inspeccion WHERE auditoria_id = $1', [id]),
      queryAll('SELECT * FROM acciones_correctivas WHERE auditoria_id = $1', [id]),
      queryAll('SELECT * FROM desglose_innecesarios WHERE auditoria_id = $1 AND categoria = $2', [id, 'desconocidos']),
      queryAll('SELECT * FROM desglose_innecesarios WHERE auditoria_id = $1 AND categoria = $2', [id, 'no_fullkit']),
      queryAll('SELECT * FROM desglose_orden WHERE auditoria_id = $1 AND categoria = $2', [id, 'herramienta']),
      queryAll('SELECT * FROM desglose_orden WHERE auditoria_id = $1 AND categoria = $2', [id, 'eslingas']),
      queryAll('SELECT * FROM desglose_orden WHERE auditoria_id = $1 AND categoria = $2', [id, 'maquinas']),
      queryAll('SELECT * FROM desglose_orden WHERE auditoria_id = $1 AND categoria = $2', [id, 'ropa'])
    ]);

    res.json({
      ...auditoria,
      clasificacion: clasificacion ? {
        ...clasificacion,
        desglose_desconocidos: desgloseDesconocidos,
        desglose_no_fullkit: desgloseNoFullkit
      } : null,
      orden: orden ? {
        ...orden,
        desglose_herramienta: desgloseHerramienta,
        desglose_eslingas: desgloseEslingas,
        desglose_maquinas: desgloseMaquinas,
        desglose_ropa: desgloseRopa
      } : null,
      limpieza,
      inspeccion,
      acciones
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear nueva auditoría
router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { fecha, parcela, auditor, clasificacion, orden, limpieza, inspeccion, acciones } = req.body;

    if (!Validator.isValidDate(fecha)) {
      return res.status(400).json({ error: 'Fecha inválida. Formato esperado: YYYY-MM-DD' });
    }

    if (!Validator.isValidParcela(parcela)) {
      return res.status(400).json({ error: 'Parcela inválida o no reconocida' });
    }

    const auditorSanitizado = Validator.sanitizeString(auditor || 'Sin especificar', 100);

    await client.query('BEGIN');

    // Insertar auditoría principal
    const auditoriaResult = await client.query(
      'INSERT INTO auditorias (fecha, parcela, auditor) VALUES ($1, $2, $3) RETURNING id',
      [fecha, parcela, auditorSanitizado]
    );
    const auditoriaId = auditoriaResult.rows[0].id;

    // Insertar respuestas de clasificación
    if (clasificacion) {
      await client.query(
        `INSERT INTO respuestas_clasificacion
        (auditoria_id, innecesarios_desconocidos, listado_desconocidos, innecesarios_no_fullkit, listado_no_fullkit)
        VALUES ($1, $2, $3, $4, $5)`,
        [
          auditoriaId,
          parseInt(clasificacion.innecesarios_desconocidos) || 0,
          Validator.sanitizeString(clasificacion.listado_desconocidos || '', 2000),
          parseInt(clasificacion.innecesarios_no_fullkit) || 0,
          Validator.sanitizeString(clasificacion.listado_no_fullkit || '', 2000)
        ]
      );

      // Insertar desgloses
      if (Validator.isValidDesglose(clasificacion.desglose_desconocidos)) {
        for (const item of clasificacion.desglose_desconocidos) {
          await client.query(
            'INSERT INTO desglose_innecesarios (auditoria_id, categoria, linea, tipo_innecesario, accion) VALUES ($1, $2, $3, $4, $5)',
            [auditoriaId, 'desconocidos', item.linea, Validator.sanitizeString(item.tipo_innecesario || ''), Validator.sanitizeString(item.accion || '')]
          );
        }
      }

      if (Validator.isValidDesglose(clasificacion.desglose_no_fullkit)) {
        for (const item of clasificacion.desglose_no_fullkit) {
          await client.query(
            'INSERT INTO desglose_innecesarios (auditoria_id, categoria, linea, tipo_innecesario, accion) VALUES ($1, $2, $3, $4, $5)',
            [auditoriaId, 'no_fullkit', item.linea, Validator.sanitizeString(item.tipo_innecesario || ''), Validator.sanitizeString(item.accion || '')]
          );
        }
      }
    }

    // Insertar respuestas de orden
    if (orden) {
      await client.query(
        `INSERT INTO respuestas_orden
        (auditoria_id, herramienta_fuera, herramienta_detalle, eslingas_fuera, eslingas_detalle,
         maquinas_fuera, maquinas_detalle, ropa_epis_fuera, ropa_epis_detalle, lugar_guardar, lugar_guardar_detalle)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          auditoriaId,
          Validator.toDbBoolean(orden.herramienta_fuera),
          Validator.sanitizeString(orden.herramienta_detalle || ''),
          Validator.toDbBoolean(orden.eslingas_fuera),
          Validator.sanitizeString(orden.eslingas_detalle || ''),
          Validator.toDbBoolean(orden.maquinas_fuera),
          Validator.sanitizeString(orden.maquinas_detalle || ''),
          Validator.toDbBoolean(orden.ropa_epis_fuera),
          Validator.sanitizeString(orden.ropa_epis_detalle || ''),
          Validator.toDbBoolean(orden.lugar_guardar),
          Validator.sanitizeString(orden.lugar_guardar_detalle || '')
        ]
      );

      // Insertar desgloses de orden
      const categoriasOrden = ['herramienta', 'eslingas', 'maquinas', 'ropa'];
      for (const cat of categoriasOrden) {
        const desgloseKey = `desglose_${cat}`;
        if (Validator.isValidDesglose(orden[desgloseKey])) {
          for (const item of orden[desgloseKey]) {
            await client.query(
              'INSERT INTO desglose_orden (auditoria_id, categoria, linea, tipo_elemento, accion) VALUES ($1, $2, $3, $4, $5)',
              [auditoriaId, cat, item.linea, Validator.sanitizeString(item.tipo_elemento || ''), Validator.sanitizeString(item.accion || '')]
            );
          }
        }
      }
    }

    // Insertar respuestas de limpieza
    if (limpieza) {
      await client.query(
        `INSERT INTO respuestas_limpieza
        (auditoria_id, area_sucia, area_sucia_detalle, area_residuos, area_residuos_detalle)
        VALUES ($1, $2, $3, $4, $5)`,
        [
          auditoriaId,
          Validator.toDbBoolean(limpieza.area_sucia),
          Validator.sanitizeString(limpieza.area_sucia_detalle || ''),
          Validator.toDbBoolean(limpieza.area_residuos),
          Validator.sanitizeString(limpieza.area_residuos_detalle || '')
        ]
      );
    }

    // Insertar respuestas de inspección
    if (inspeccion) {
      await client.query(
        `INSERT INTO respuestas_inspeccion
        (auditoria_id, salidas_gas_precintadas, riesgos_carteles, zonas_delimitadas,
         cuadros_electricos_ok, aire_comprimido_ok, inspeccion_detalle)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          auditoriaId,
          Validator.toDbBoolean(inspeccion.salidas_gas_precintadas),
          Validator.toDbBoolean(inspeccion.riesgos_carteles),
          Validator.toDbBoolean(inspeccion.zonas_delimitadas),
          Validator.toDbBoolean(inspeccion.cuadros_electricos_ok),
          Validator.toDbBoolean(inspeccion.aire_comprimido_ok),
          Validator.sanitizeString(inspeccion.inspeccion_detalle || '')
        ]
      );
    }

    // Insertar acciones correctivas
    if (acciones && Array.isArray(acciones)) {
      for (const accion of acciones) {
        if (!Validator.isNonEmptyString(accion.descripcion)) continue;

        await client.query(
          `INSERT INTO acciones_correctivas
          (auditoria_id, seccion, descripcion, responsable, fecha_limite, estado)
          VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            auditoriaId,
            Validator.sanitizeString(accion.seccion || 'general', 50),
            Validator.sanitizeString(accion.descripcion, 1000),
            Validator.sanitizeString(accion.responsable || '', 100),
            Validator.isValidDate(accion.fecha_limite) ? accion.fecha_limite : null,
            Validator.isValidEstado(accion.estado) ? accion.estado : 'pendiente'
          ]
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Auditoría guardada correctamente',
      id: auditoriaId
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Eliminar auditoría (requiere autenticación admin)
router.delete('/:id', verificarAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    if (!Validator.isValidId(id)) {
      return res.status(400).json({ error: 'ID de auditoría inválido' });
    }

    const existe = await queryOne('SELECT id FROM auditorias WHERE id = $1', [id]);
    if (!existe) {
      return res.status(404).json({ error: 'Auditoría no encontrada' });
    }

    await client.query('BEGIN');

    const tablasRelacionadas = [
      'respuestas_clasificacion', 'desglose_innecesarios', 'respuestas_orden',
      'desglose_orden', 'respuestas_limpieza', 'respuestas_inspeccion', 'acciones_correctivas'
    ];

    for (const tabla of tablasRelacionadas) {
      await client.query(`DELETE FROM ${tabla} WHERE auditoria_id = $1`, [id]);
    }

    await client.query('DELETE FROM auditorias WHERE id = $1', [id]);
    await client.query('COMMIT');

    res.json({ message: 'Auditoría eliminada correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
