const express = require('express');
const { queryAll, queryOne } = require('../helpers/queries');
const { Validator } = require('../validators');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { semanas = 8, parcela = '' } = req.query;
    const numSemanas = Math.min(Math.max(parseInt(semanas) || 8, 1), 52);

    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - (numSemanas * 7));
    const fechaInicioStr = fechaInicio.toISOString().split('T')[0];

    let whereClause = 'WHERE a.fecha >= $1';
    let params = [fechaInicioStr];
    let paramIndex = 2;

    if (parcela && Validator.isValidParcela(parcela)) {
      whereClause += ` AND a.parcela = $${paramIndex}`;
      params.push(parcela);
      paramIndex++;
    }

    const totalAuditoriasResult = await queryOne(`
      SELECT COUNT(*) as total FROM auditorias a ${whereClause}
    `, params);
    const totalAuditorias = parseInt(totalAuditoriasResult?.total) || 0;

    const totalInnecesariosResult = await queryOne(`
      SELECT
        COALESCE(SUM(rc.innecesarios_desconocidos), 0) + COALESCE(SUM(rc.innecesarios_no_fullkit), 0) as total
      FROM auditorias a
      LEFT JOIN respuestas_clasificacion rc ON a.id = rc.auditoria_id
      ${whereClause}
    `, params);
    const totalInnecesarios = parseInt(totalInnecesariosResult?.total) || 0;

    const promedioSemanal = numSemanas > 0 ? totalInnecesarios / numSemanas : 0;

    const porSemana = await queryAll(`
      SELECT
        EXTRACT(WEEK FROM a.fecha)::int as semana,
        EXTRACT(YEAR FROM a.fecha)::int as anio,
        a.parcela,
        COALESCE(SUM(rc.innecesarios_desconocidos), 0) + COALESCE(SUM(rc.innecesarios_no_fullkit), 0) as totalinnecesarios,
        COUNT(*) as numauditorias
      FROM auditorias a
      LEFT JOIN respuestas_clasificacion rc ON a.id = rc.auditoria_id
      ${whereClause}
      GROUP BY EXTRACT(YEAR FROM a.fecha), EXTRACT(WEEK FROM a.fecha), a.parcela
      ORDER BY anio, semana
    `, params);

    const porParcela = await queryAll(`
      SELECT
        a.parcela,
        COALESCE(SUM(rc.innecesarios_desconocidos), 0) + COALESCE(SUM(rc.innecesarios_no_fullkit), 0) as totalinnecesarios,
        COUNT(*) as numauditorias
      FROM auditorias a
      LEFT JOIN respuestas_clasificacion rc ON a.id = rc.auditoria_id
      ${whereClause}
      GROUP BY a.parcela
      ORDER BY totalinnecesarios DESC
    `, params);

    const detalle = await queryAll(`
      SELECT
        EXTRACT(WEEK FROM a.fecha)::int as semana,
        a.fecha,
        a.parcela,
        COALESCE(rc.innecesarios_desconocidos, 0) as innecesariosdesconocidos,
        COALESCE(rc.innecesarios_no_fullkit, 0) as innecesariosnofullkit,
        COALESCE(rc.innecesarios_desconocidos, 0) + COALESCE(rc.innecesarios_no_fullkit, 0) as totalinnecesarios
      FROM auditorias a
      LEFT JOIN respuestas_clasificacion rc ON a.id = rc.auditoria_id
      ${whereClause}
      ORDER BY a.fecha DESC
    `, params);

    const ranking = await queryAll(`
      SELECT
        a.parcela,
        COALESCE(SUM(rc.innecesarios_desconocidos), 0) + COALESCE(SUM(rc.innecesarios_no_fullkit), 0) as totalinnecesarios,
        COUNT(*) as numauditorias,
        CAST((COALESCE(SUM(rc.innecesarios_desconocidos), 0) + COALESCE(SUM(rc.innecesarios_no_fullkit), 0)) AS FLOAT) /
          NULLIF(COUNT(*), 0) as promedio
      FROM auditorias a
      LEFT JOIN respuestas_clasificacion rc ON a.id = rc.auditoria_id
      ${whereClause}
      GROUP BY a.parcela
      ORDER BY totalinnecesarios ASC
    `, params);

    let tendencia = 0;
    if (porSemana.length >= 2) {
      const mitad = Math.floor(porSemana.length / 2);
      const primeraMitad = porSemana.slice(0, mitad);
      const segundaMitad = porSemana.slice(mitad);

      const sumaPrimera = primeraMitad.reduce((acc, s) => acc + (parseInt(s.totalinnecesarios) || 0), 0);
      const sumaSegunda = segundaMitad.reduce((acc, s) => acc + (parseInt(s.totalinnecesarios) || 0), 0);

      if (sumaPrimera > 0) {
        tendencia = ((sumaSegunda - sumaPrimera) / sumaPrimera) * 100;
      }
    }

    res.json({
      totalAuditorias,
      totalInnecesarios,
      promedioSemanal,
      tendencia,
      porSemana,
      porParcela,
      detalle,
      ranking
    });
  } catch (error) {
    console.error('Error en /api/kpi:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
