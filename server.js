require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== CONFIGURACIÓN POSTGRESQL ====================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// ==================== AUTENTICACIÓN ADMIN ====================

const ADMIN_CREDENTIALS = {
  username: process.env.ADMIN_USER || 'admin',
  password: process.env.ADMIN_PASSWORD || 'GHIhornos'
};

function verificarAdmin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Autenticación requerida', needsAuth: true });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
  const [username, password] = credentials.split(':');

  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    next();
  } else {
    return res.status(403).json({ error: 'Credenciales incorrectas' });
  }
}

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    res.json({ success: true, message: 'Autenticación exitosa' });
  } else {
    res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
  }
});

app.get('/api/auth/check', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.json({ authenticated: false });
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
  const [username, password] = credentials.split(':');

  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    res.json({ authenticated: true });
  } else {
    res.json({ authenticated: false });
  }
});

// ==================== UTILIDADES DE BASE DE DATOS ====================

async function queryAll(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function queryOne(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows.length > 0 ? result.rows[0] : null;
}

async function runQuery(sql, params = []) {
  const result = await pool.query(sql, params);
  return result;
}

// ==================== VALIDACIÓN DE DATOS ====================

const Validator = {
  isNonEmptyString(value, maxLength = 500) {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
  },

  isValidDate(value) {
    if (!value || typeof value !== 'string') return false;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) return false;
    const date = new Date(value);
    return date instanceof Date && !isNaN(date);
  },

  isValidParcela(value) {
    const parcelasValidas = [
      'Parcela horno grande 1', 'Parcela horno grande 2', 'Parcela horno grande 3 (FRB)',
      'Parcela horno pequeño 1', 'Dojo de formación', 'Af. Pack & Build',
      'Af. Ventiladores', 'Parcela BEAS', 'AF1', 'Patio exterior'
    ];
    return parcelasValidas.includes(value);
  },

  isValidBoolean(value) {
    if (typeof value === 'boolean') return true;
    if (typeof value === 'string') {
      return ['si', 'no', 'true', 'false', '1', '0'].includes(value.toLowerCase());
    }
    return typeof value === 'number' && (value === 0 || value === 1);
  },

  toDbBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return ['si', 'true', '1'].includes(value.toLowerCase());
    }
    return Boolean(value);
  },

  isValidDesglose(arr) {
    if (!Array.isArray(arr)) return false;
    return arr.every(item =>
      typeof item === 'object' &&
      typeof item.linea === 'number' &&
      item.linea > 0
    );
  },

  sanitizeString(value, maxLength = 500) {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, maxLength);
  },

  isValidId(value) {
    const num = parseInt(value);
    return !isNaN(num) && num > 0;
  },

  isValidEstado(value) {
    const estadosValidos = ['pendiente', 'en_progreso', 'completado'];
    return estadosValidos.includes(value);
  }
};

// ==================== HELPERS PARA INSERCIÓN ====================

const DbHelpers = {
  async insertDesglose(tableName, auditoriaId, categoria, items, fields) {
    if (!Array.isArray(items) || items.length === 0) return;

    for (const item of items) {
      const values = [auditoriaId, categoria, item.linea];
      fields.forEach(field => {
        values.push(Validator.sanitizeString(item[field] || ''));
      });

      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      await pool.query(
        `INSERT INTO ${tableName} (auditoria_id, categoria, linea, ${fields.join(', ')})
         VALUES (${placeholders})`,
        values
      );
    }
  },

  async insertDesgloseInnecesarios(auditoriaId, categoria, items) {
    await this.insertDesglose('desglose_innecesarios', auditoriaId, categoria, items, ['tipo_innecesario', 'accion']);
  },

  async insertDesgloseOrden(auditoriaId, categoria, items) {
    await this.insertDesglose('desglose_orden', auditoriaId, categoria, items, ['tipo_elemento', 'accion']);
  }
};

// ==================== INICIALIZACIÓN DE BASE DE DATOS ====================

async function initDatabase() {
  const client = await pool.connect();
  try {
    // Crear tablas
    await client.query(`
      CREATE TABLE IF NOT EXISTS auditorias (
        id SERIAL PRIMARY KEY,
        fecha DATE NOT NULL,
        parcela TEXT NOT NULL,
        auditor TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS respuestas_clasificacion (
        id SERIAL PRIMARY KEY,
        auditoria_id INTEGER NOT NULL REFERENCES auditorias(id) ON DELETE CASCADE,
        innecesarios_desconocidos INTEGER DEFAULT 0,
        listado_desconocidos TEXT,
        innecesarios_no_fullkit INTEGER DEFAULT 0,
        listado_no_fullkit TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS desglose_innecesarios (
        id SERIAL PRIMARY KEY,
        auditoria_id INTEGER NOT NULL REFERENCES auditorias(id) ON DELETE CASCADE,
        categoria TEXT NOT NULL,
        linea INTEGER NOT NULL,
        tipo_innecesario TEXT,
        accion TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS desglose_orden (
        id SERIAL PRIMARY KEY,
        auditoria_id INTEGER NOT NULL REFERENCES auditorias(id) ON DELETE CASCADE,
        categoria TEXT NOT NULL,
        linea INTEGER NOT NULL,
        tipo_elemento TEXT,
        accion TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tipos_personalizados (
        id SERIAL PRIMARY KEY,
        categoria TEXT NOT NULL,
        nombre TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(categoria, nombre)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS acciones_personalizadas (
        id SERIAL PRIMARY KEY,
        categoria TEXT NOT NULL,
        nombre TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(categoria, nombre)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS respuestas_orden (
        id SERIAL PRIMARY KEY,
        auditoria_id INTEGER NOT NULL REFERENCES auditorias(id) ON DELETE CASCADE,
        herramienta_fuera BOOLEAN DEFAULT false,
        herramienta_detalle TEXT,
        eslingas_fuera BOOLEAN DEFAULT false,
        eslingas_detalle TEXT,
        maquinas_fuera BOOLEAN DEFAULT false,
        maquinas_detalle TEXT,
        ropa_epis_fuera BOOLEAN DEFAULT false,
        ropa_epis_detalle TEXT,
        lugar_guardar BOOLEAN DEFAULT false,
        lugar_guardar_detalle TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS respuestas_limpieza (
        id SERIAL PRIMARY KEY,
        auditoria_id INTEGER NOT NULL REFERENCES auditorias(id) ON DELETE CASCADE,
        area_sucia BOOLEAN DEFAULT false,
        area_sucia_detalle TEXT,
        area_residuos BOOLEAN DEFAULT false,
        area_residuos_detalle TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS respuestas_inspeccion (
        id SERIAL PRIMARY KEY,
        auditoria_id INTEGER NOT NULL REFERENCES auditorias(id) ON DELETE CASCADE,
        salidas_gas_precintadas BOOLEAN DEFAULT false,
        riesgos_carteles BOOLEAN DEFAULT false,
        zonas_delimitadas BOOLEAN DEFAULT false,
        cuadros_electricos_ok BOOLEAN DEFAULT false,
        aire_comprimido_ok BOOLEAN DEFAULT false,
        inspeccion_detalle TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS acciones_correctivas (
        id SERIAL PRIMARY KEY,
        auditoria_id INTEGER NOT NULL REFERENCES auditorias(id) ON DELETE CASCADE,
        seccion TEXT NOT NULL,
        descripcion TEXT NOT NULL,
        responsable TEXT,
        fecha_limite DATE,
        estado TEXT DEFAULT 'pendiente'
      )
    `);

    // Crear índices
    await client.query(`CREATE INDEX IF NOT EXISTS idx_auditorias_fecha ON auditorias(fecha)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_auditorias_parcela ON auditorias(parcela)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_auditorias_fecha_parcela ON auditorias(fecha, parcela)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_resp_clasificacion_auditoria ON respuestas_clasificacion(auditoria_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_resp_orden_auditoria ON respuestas_orden(auditoria_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_resp_limpieza_auditoria ON respuestas_limpieza(auditoria_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_resp_inspeccion_auditoria ON respuestas_inspeccion(auditoria_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_desglose_innec_auditoria ON desglose_innecesarios(auditoria_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_desglose_orden_auditoria ON desglose_orden(auditoria_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_acciones_auditoria ON acciones_correctivas(auditoria_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_acciones_estado ON acciones_correctivas(estado)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tipos_categoria ON tipos_personalizados(categoria)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_acciones_pers_categoria ON acciones_personalizadas(categoria)`);

    console.log('Base de datos PostgreSQL inicializada correctamente');
  } finally {
    client.release();
  }
}

// ==================== RUTAS API ====================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Obtener todas las auditorías
app.get('/api/auditorias', async (req, res) => {
  try {
    const auditorias = await queryAll('SELECT * FROM auditorias ORDER BY created_at DESC');
    res.json(auditorias);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener una auditoría completa por ID
app.get('/api/auditorias/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!Validator.isValidId(id)) {
      return res.status(400).json({ error: 'ID de auditoría inválido' });
    }

    const auditoria = await queryOne('SELECT * FROM auditorias WHERE id = $1', [id]);

    if (!auditoria) {
      return res.status(404).json({ error: 'Auditoría no encontrada' });
    }

    const clasificacion = await queryOne('SELECT * FROM respuestas_clasificacion WHERE auditoria_id = $1', [id]);
    const orden = await queryOne('SELECT * FROM respuestas_orden WHERE auditoria_id = $1', [id]);
    const limpieza = await queryOne('SELECT * FROM respuestas_limpieza WHERE auditoria_id = $1', [id]);
    const inspeccion = await queryOne('SELECT * FROM respuestas_inspeccion WHERE auditoria_id = $1', [id]);
    const acciones = await queryAll('SELECT * FROM acciones_correctivas WHERE auditoria_id = $1', [id]);
    const desgloseDesconocidos = await queryAll('SELECT * FROM desglose_innecesarios WHERE auditoria_id = $1 AND categoria = $2', [id, 'desconocidos']);
    const desgloseNoFullkit = await queryAll('SELECT * FROM desglose_innecesarios WHERE auditoria_id = $1 AND categoria = $2', [id, 'no_fullkit']);
    const desgloseHerramienta = await queryAll('SELECT * FROM desglose_orden WHERE auditoria_id = $1 AND categoria = $2', [id, 'herramienta']);
    const desgloseEslingas = await queryAll('SELECT * FROM desglose_orden WHERE auditoria_id = $1 AND categoria = $2', [id, 'eslingas']);
    const desgloseMaquinas = await queryAll('SELECT * FROM desglose_orden WHERE auditoria_id = $1 AND categoria = $2', [id, 'maquinas']);
    const desgloseRopa = await queryAll('SELECT * FROM desglose_orden WHERE auditoria_id = $1 AND categoria = $2', [id, 'ropa']);

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
app.post('/api/auditorias', async (req, res) => {
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
            `INSERT INTO desglose_innecesarios (auditoria_id, categoria, linea, tipo_innecesario, accion)
             VALUES ($1, $2, $3, $4, $5)`,
            [auditoriaId, 'desconocidos', item.linea, Validator.sanitizeString(item.tipo_innecesario || ''), Validator.sanitizeString(item.accion || '')]
          );
        }
      }

      if (Validator.isValidDesglose(clasificacion.desglose_no_fullkit)) {
        for (const item of clasificacion.desglose_no_fullkit) {
          await client.query(
            `INSERT INTO desglose_innecesarios (auditoria_id, categoria, linea, tipo_innecesario, accion)
             VALUES ($1, $2, $3, $4, $5)`,
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
              `INSERT INTO desglose_orden (auditoria_id, categoria, linea, tipo_elemento, accion)
               VALUES ($1, $2, $3, $4, $5)`,
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
app.delete('/api/auditorias/:id', verificarAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!Validator.isValidId(id)) {
      return res.status(400).json({ error: 'ID de auditoría inválido' });
    }

    const existe = await queryOne('SELECT id FROM auditorias WHERE id = $1', [id]);
    if (!existe) {
      return res.status(404).json({ error: 'Auditoría no encontrada' });
    }

    // ON DELETE CASCADE se encarga de eliminar los registros relacionados
    await runQuery('DELETE FROM auditorias WHERE id = $1', [id]);

    res.json({ message: 'Auditoría eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar estado de acción correctiva
app.patch('/api/acciones/:id', async (req, res) => {
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

// Obtener tipos personalizados por categoría
app.get('/api/tipos/:categoria', async (req, res) => {
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
app.get('/api/tipos', async (req, res) => {
  try {
    const tipos = await queryAll('SELECT * FROM tipos_personalizados ORDER BY categoria, nombre');
    res.json(tipos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Guardar nuevo tipo personalizado
app.post('/api/tipos', async (req, res) => {
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

// Obtener acciones personalizadas por categoría
app.get('/api/acciones-personalizadas/:categoria', async (req, res) => {
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
app.get('/api/acciones-personalizadas', async (req, res) => {
  try {
    const acciones = await queryAll('SELECT * FROM acciones_personalizadas ORDER BY categoria, nombre');
    res.json(acciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Guardar nueva acción personalizada
app.post('/api/acciones-personalizadas', async (req, res) => {
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

// Estadísticas generales
app.get('/api/estadisticas', async (req, res) => {
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

// ==================== BACKUP (requiere admin) ====================

app.get('/api/backup/json', verificarAdmin, async (req, res) => {
  try {
    const auditorias = await queryAll('SELECT * FROM auditorias ORDER BY fecha DESC');

    const datosCompletos = await Promise.all(auditorias.map(async (auditoria) => {
      return {
        ...auditoria,
        clasificacion: await queryOne('SELECT * FROM respuestas_clasificacion WHERE auditoria_id = $1', [auditoria.id]),
        orden: await queryOne('SELECT * FROM respuestas_orden WHERE auditoria_id = $1', [auditoria.id]),
        limpieza: await queryOne('SELECT * FROM respuestas_limpieza WHERE auditoria_id = $1', [auditoria.id]),
        inspeccion: await queryOne('SELECT * FROM respuestas_inspeccion WHERE auditoria_id = $1', [auditoria.id]),
        desglose_innecesarios: await queryAll('SELECT * FROM desglose_innecesarios WHERE auditoria_id = $1', [auditoria.id]),
        desglose_orden: await queryAll('SELECT * FROM desglose_orden WHERE auditoria_id = $1', [auditoria.id]),
        acciones: await queryAll('SELECT * FROM acciones_correctivas WHERE auditoria_id = $1', [auditoria.id])
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

// Servir páginas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/historial', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'historial.html'));
});

app.get('/kpi', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kpi.html'));
});

// API de KPIs
app.get('/api/kpi', async (req, res) => {
  try {
    const { semanas = 8, parcela = '' } = req.query;
    const numSemanas = Math.min(Math.max(parseInt(semanas) || 8, 1), 52);

    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - (numSemanas * 7));
    const fechaInicioStr = fechaInicio.toISOString().split('T')[0];

    let whereClause = 'WHERE a.fecha >= $1';
    let params = [fechaInicioStr];

    if (parcela && Validator.isValidParcela(parcela)) {
      whereClause += ' AND a.parcela = $2';
      params.push(parcela);
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

    const porSemanaQuery = `
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
    `;
    const porSemana = await queryAll(porSemanaQuery, params);

    const porParcelaQuery = `
      SELECT
        a.parcela,
        COALESCE(SUM(rc.innecesarios_desconocidos), 0) + COALESCE(SUM(rc.innecesarios_no_fullkit), 0) as totalinnecesarios,
        COUNT(*) as numauditorias
      FROM auditorias a
      LEFT JOIN respuestas_clasificacion rc ON a.id = rc.auditoria_id
      ${whereClause}
      GROUP BY a.parcela
      ORDER BY totalinnecesarios DESC
    `;
    const porParcela = await queryAll(porParcelaQuery, params);

    const detalleQuery = `
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
    `;
    const detalle = await queryAll(detalleQuery, params);

    const rankingQuery = `
      SELECT
        a.parcela,
        COALESCE(SUM(rc.innecesarios_desconocidos), 0) + COALESCE(SUM(rc.innecesarios_no_fullkit), 0) as totalinnecesarios,
        COUNT(*) as numauditorias,
        CAST((COALESCE(SUM(rc.innecesarios_desconocidos), 0) + COALESCE(SUM(rc.innecesarios_no_fullkit), 0)) AS FLOAT) /
          CASE WHEN COUNT(*) > 0 THEN COUNT(*) ELSE 1 END as promedio
      FROM auditorias a
      LEFT JOIN respuestas_clasificacion rc ON a.id = rc.auditoria_id
      ${whereClause}
      GROUP BY a.parcela
      ORDER BY totalinnecesarios ASC
    `;
    const ranking = await queryAll(rankingQuery, params);

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

// Iniciar servidor
async function startServer() {
  try {
    await initDatabase();

    app.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`  Servidor de Auditoría 5S GHI`);
      console.log(`  Puerto: ${PORT}`);
      console.log(`  Base de datos: PostgreSQL`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();
