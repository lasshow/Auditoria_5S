const express = require('express');
const { queryAll, queryOne } = require('../helpers/queries');
const { verificarAdmin } = require('../middleware/auth');

const router = express.Router();

// Exportar datos como JSON (requiere admin)
router.get('/json', verificarAdmin, async (req, res) => {
  try {
    const auditorias = await queryAll('SELECT * FROM auditorias ORDER BY fecha DESC');

    const datosCompletos = await Promise.all(auditorias.map(async (auditoria) => {
      const [clasificacion, orden, limpieza, inspeccion, desglose_innecesarios, desglose_orden, acciones] = await Promise.all([
        queryOne('SELECT * FROM respuestas_clasificacion WHERE auditoria_id = $1', [auditoria.id]),
        queryOne('SELECT * FROM respuestas_orden WHERE auditoria_id = $1', [auditoria.id]),
        queryOne('SELECT * FROM respuestas_limpieza WHERE auditoria_id = $1', [auditoria.id]),
        queryOne('SELECT * FROM respuestas_inspeccion WHERE auditoria_id = $1', [auditoria.id]),
        queryAll('SELECT * FROM desglose_innecesarios WHERE auditoria_id = $1', [auditoria.id]),
        queryAll('SELECT * FROM desglose_orden WHERE auditoria_id = $1', [auditoria.id]),
        queryAll('SELECT * FROM acciones_correctivas WHERE auditoria_id = $1', [auditoria.id])
      ]);

      return {
        ...auditoria,
        clasificacion,
        orden,
        limpieza,
        inspeccion,
        desglose_innecesarios,
        desglose_orden,
        acciones
      };
    }));

    const fecha = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="auditorias_${fecha}.json"`);
    res.json(datosCompletos);
  } catch (error) {
    res.status(500).json({ error: 'Error al exportar datos: ' + error.message });
  }
});

module.exports = router;
