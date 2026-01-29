const express = require('express');
const { queryAll, queryOne } = require('../helpers/queries');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const total = await queryOne('SELECT COUNT(*) as count FROM auditorias');
    const porParcela = await queryAll(`
      SELECT parcela, COUNT(*) as count
      FROM auditorias
      GROUP BY parcela
      ORDER BY count DESC
    `);
    const ultimaSemana = await queryOne(`
      SELECT COUNT(*) as count
      FROM auditorias
      WHERE fecha >= CURRENT_DATE - INTERVAL '7 days'
    `);
    const accionesPendientes = await queryOne(`
      SELECT COUNT(*) as count
      FROM acciones_correctivas
      WHERE estado = 'pendiente'
    `);

    res.json({
      totalAuditorias: parseInt(total?.count) || 0,
      auditoriasUltimaSemana: parseInt(ultimaSemana?.count) || 0,
      accionesPendientes: parseInt(accionesPendientes?.count) || 0,
      porParcela
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
