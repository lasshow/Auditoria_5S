const express = require('express');
const { queryAll, runQuery } = require('../helpers/queries');
const { Validator } = require('../validators');

const router = express.Router();

// Obtener tipos personalizados por categoría
router.get('/:categoria', async (req, res) => {
  try {
    const { categoria } = req.params;
    const categoriaSanitizada = Validator.sanitizeString(categoria, 50);
    const tipos = await queryAll('SELECT nombre FROM tipos_personalizados WHERE categoria = $1 ORDER BY nombre', [categoriaSanitizada]);
    res.json(tipos.map(t => t.nombre));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener todos los tipos personalizados
router.get('/', async (req, res) => {
  try {
    const tipos = await queryAll('SELECT * FROM tipos_personalizados ORDER BY categoria, nombre');
    res.json(tipos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Guardar nuevo tipo personalizado
router.post('/', async (req, res) => {
  try {
    const { categoria, nombre } = req.body;

    if (!Validator.isNonEmptyString(categoria, 50)) {
      return res.status(400).json({ error: 'Categoría es requerida (máximo 50 caracteres)' });
    }
    if (!Validator.isNonEmptyString(nombre, 100)) {
      return res.status(400).json({ error: 'Nombre es requerido (máximo 100 caracteres)' });
    }

    await runQuery(
      'INSERT INTO tipos_personalizados (categoria, nombre) VALUES ($1, $2) ON CONFLICT (categoria, nombre) DO NOTHING',
      [Validator.sanitizeString(categoria, 50), Validator.sanitizeString(nombre, 100)]
    );
    res.status(201).json({ message: 'Tipo guardado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
