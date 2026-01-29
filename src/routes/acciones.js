const express = require('express');
const { runQuery } = require('../helpers/queries');
const { Validator } = require('../validators');

const router = express.Router();

// Actualizar estado de acción correctiva
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!Validator.isValidId(id)) {
      return res.status(400).json({ error: 'ID de acción inválido' });
    }

    if (!Validator.isValidEstado(estado)) {
      return res.status(400).json({ error: 'Estado inválido. Valores permitidos: pendiente, en_progreso, completado' });
    }

    await runQuery('UPDATE acciones_correctivas SET estado = $1 WHERE id = $2', [estado, id]);

    res.json({ message: 'Estado actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
