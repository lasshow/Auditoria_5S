require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

// Routes
const authRoutes = require('./routes/auth');
const auditoriasRoutes = require('./routes/auditorias');
const accionesRoutes = require('./routes/acciones');
const tiposRoutes = require('./routes/tipos');
const accionesPersonalizadasRoutes = require('./routes/acciones-personalizadas');
const kpiRoutes = require('./routes/kpi');
const estadisticasRoutes = require('./routes/estadisticas');
const backupRoutes = require('./routes/backup');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/auditorias', auditoriasRoutes);
app.use('/api/acciones', accionesRoutes);
app.use('/api/tipos', tiposRoutes);
app.use('/api/acciones-personalizadas', accionesPersonalizadasRoutes);
app.use('/api/kpi', kpiRoutes);
app.use('/api/estadisticas', estadisticasRoutes);
app.use('/api/backup', backupRoutes);

// Serve pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/historial', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'historial.html'));
});

app.get('/kpi', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'kpi.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  Servidor de Auditoría 5S GHI`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`========================================\n`);
});

module.exports = app;
