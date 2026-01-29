const express = require('express');
const { checkAuth, ADMIN_CREDENTIALS } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    res.json({ success: true, message: 'Autenticación exitosa' });
  } else {
    res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
  }
});

router.get('/check', (req, res) => {
  res.json({ authenticated: checkAuth(req) });
});

module.exports = router;
