const express = require('express');
const { queryAll, runQuery } = require('../helpers/queries');
const { Validator } = require('../validators');

const router = express.Router();

// Obtener acciones personalizadas por categoría
router.get('/:categoria', async (req, res) => {
  try {
    const { categoria } = req.params;
    const categoriaSanitizada = Validator.sanitizeString(categoria, 50);
    const acciones = await queryAll('SELECT nombre FROM acciones_personalizadas WHERE categoria = $1 ORDER BY nombre', [categoriaSanitizada]);
    res.json(acciones.map(a => a.nombre));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener todas las acciones personalizadas
router.get('/', async (req, res) => {
  try {
    const acciones = await queryAll('SELECT * FROM acciones_personalizadas ORDER BY categoria, nombre');
    res.json(acciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Guardar nueva acción personalizada
router.post('/', async (req, res) => {
  try {
    const { categoria, nombre } = req.body;

    if (!Validator.isNonEmptyString(categoria, 50)) {
      return res.status(400).json({ error: 'Categoría es requerida (máximo 50 caracteres)' });
    }
    if (!Validator.isNonEmptyString(nombre, 200)) {
      return res.status(400).json({ error: 'Nombre es requerido (máximo 200 caracteres)' });
    }

    await runQuery(
      'INSERT INTO acciones_personalizadas (categoria, nombre) VALUES ($1, $2) ON CONFLICT (categoria, nombre) DO NOTHING',
      [Validator.sanitizeString(categoria, 50), Validator.sanitizeString(nombre, 200)]
    );
    res.status(201).json({ message: 'Acción guardada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
