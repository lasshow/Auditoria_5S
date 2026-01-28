const express = require('express');
const initSqlJs = require('sql.js');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Variable para la base de datos
let db;
const DB_PATH = path.join(__dirname, 'auditorias.db');

// ==================== UTILIDADES DE BASE DE DATOS ====================

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);

  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function runQuery(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
  return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0]?.values[0][0] };
}

// ==================== VALIDACIÓN DE DATOS ====================

const Validator = {
  // Validar string no vacío
  isNonEmptyString(value, maxLength = 500) {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
  },

  // Validar fecha en formato YYYY-MM-DD
  isValidDate(value) {
    if (!value || typeof value !== 'string') return false;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) return false;
    const date = new Date(value);
    return date instanceof Date && !isNaN(date);
  },

  // Validar parcela válida
  isValidParcela(value) {
    const parcelasValidas = [
      'Parcela horno grande 1', 'Parcela horno grande 2', 'Parcela horno grande 3 (FRB)',
      'Parcela horno pequeño 1', 'Dojo de formación', 'Af. Pack & Build',
      'Af. Ventiladores', 'Parcela BEAS', 'AF1', 'Patio exterior'
    ];
    return parcelasValidas.includes(value);
  },

  // Validar que es un booleano o string si/no
  isValidBoolean(value) {
    if (typeof value === 'boolean') return true;
    if (typeof value === 'string') {
      return ['si', 'no', 'true', 'false', '1', '0'].includes(value.toLowerCase());
    }
    return typeof value === 'number' && (value === 0 || value === 1);
  },

  // Convertir a booleano numérico (0 o 1)
  toDbBoolean(value) {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string') {
      return ['si', 'true', '1'].includes(value.toLowerCase()) ? 1 : 0;
    }
    return value ? 1 : 0;
  },

  // Validar array de desglose
  isValidDesglose(arr) {
    if (!Array.isArray(arr)) return false;
    return arr.every(item =>
      typeof item === 'object' &&
      typeof item.linea === 'number' &&
      item.linea > 0
    );
  },

  // Sanitizar string (prevenir XSS básico)
  sanitizeString(value, maxLength = 500) {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, maxLength);
  },

  // Validar ID numérico
  isValidId(value) {
    const num = parseInt(value);
    return !isNaN(num) && num > 0;
  },

  // Validar estado de acción
  isValidEstado(value) {
    const estadosValidos = ['pendiente', 'en_progreso', 'completado'];
    return estadosValidos.includes(value);
  }
};

// ==================== FUNCIONES HELPER DRY PARA INSERCIÓN ====================

const DbHelpers = {
  // Insertar múltiples registros de desglose
  insertDesglose(tableName, auditoriaId, categoria, items, fields) {
    if (!Array.isArray(items) || items.length === 0) return;

    for (const item of items) {
      const values = [auditoriaId, categoria, item.linea];
      const placeholders = ['?', '?', '?'];

      fields.forEach(field => {
        values.push(Validator.sanitizeString(item[field] || ''));
        placeholders.push('?');
      });

      db.run(
        `INSERT INTO ${tableName} (auditoria_id, categoria, linea, ${fields.join(', ')})
         VALUES (${placeholders.join(', ')})`,
        values
      );
    }
  },

  // Insertar desglose de innecesarios
  insertDesgloseInnecesarios(auditoriaId, categoria, items) {
    this.insertDesglose('desglose_innecesarios', auditoriaId, categoria, items, ['tipo_innecesario', 'accion']);
  },

  // Insertar desglose de orden
  insertDesgloseOrden(auditoriaId, categoria, items) {
    this.insertDesglose('desglose_orden', auditoriaId, categoria, items, ['tipo_elemento', 'accion']);
  }
};

// ==================== INICIALIZACIÓN DE BASE DE DATOS ====================

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('Base de datos cargada desde archivo.');
  } else {
    db = new SQL.Database();
    console.log('Nueva base de datos creada.');
  }

  // Crear tablas
  db.run(`
    CREATE TABLE IF NOT EXISTS auditorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha DATE NOT NULL,
      parcela TEXT NOT NULL,
      auditor TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS respuestas_clasificacion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auditoria_id INTEGER NOT NULL,
      innecesarios_desconocidos INTEGER DEFAULT 0,
      listado_desconocidos TEXT,
      innecesarios_no_fullkit INTEGER DEFAULT 0,
      listado_no_fullkit TEXT,
      FOREIGN KEY (auditoria_id) REFERENCES auditorias(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS desglose_innecesarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auditoria_id INTEGER NOT NULL,
      categoria TEXT NOT NULL,
      linea INTEGER NOT NULL,
      tipo_innecesario TEXT,
      accion TEXT,
      FOREIGN KEY (auditoria_id) REFERENCES auditorias(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS desglose_orden (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auditoria_id INTEGER NOT NULL,
      categoria TEXT NOT NULL,
      linea INTEGER NOT NULL,
      tipo_elemento TEXT,
      accion TEXT,
      FOREIGN KEY (auditoria_id) REFERENCES auditorias(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tipos_personalizados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      categoria TEXT NOT NULL,
      nombre TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(categoria, nombre)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS acciones_personalizadas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      categoria TEXT NOT NULL,
      nombre TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(categoria, nombre)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS respuestas_orden (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auditoria_id INTEGER NOT NULL,
      herramienta_fuera BOOLEAN DEFAULT 0,
      herramienta_detalle TEXT,
      eslingas_fuera BOOLEAN DEFAULT 0,
      eslingas_detalle TEXT,
      maquinas_fuera BOOLEAN DEFAULT 0,
      maquinas_detalle TEXT,
      ropa_epis_fuera BOOLEAN DEFAULT 0,
      ropa_epis_detalle TEXT,
      lugar_guardar BOOLEAN DEFAULT 0,
      lugar_guardar_detalle TEXT,
      FOREIGN KEY (auditoria_id) REFERENCES auditorias(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS respuestas_limpieza (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auditoria_id INTEGER NOT NULL,
      area_sucia BOOLEAN DEFAULT 0,
      area_sucia_detalle TEXT,
      area_residuos BOOLEAN DEFAULT 0,
      area_residuos_detalle TEXT,
      FOREIGN KEY (auditoria_id) REFERENCES auditorias(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS respuestas_inspeccion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auditoria_id INTEGER NOT NULL,
      salidas_gas_precintadas BOOLEAN DEFAULT 0,
      riesgos_carteles BOOLEAN DEFAULT 0,
      zonas_delimitadas BOOLEAN DEFAULT 0,
      cuadros_electricos_ok BOOLEAN DEFAULT 0,
      aire_comprimido_ok BOOLEAN DEFAULT 0,
      inspeccion_detalle TEXT,
      FOREIGN KEY (auditoria_id) REFERENCES auditorias(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS acciones_correctivas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auditoria_id INTEGER NOT NULL,
      seccion TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      responsable TEXT,
      fecha_limite DATE,
      estado TEXT DEFAULT 'pendiente',
      FOREIGN KEY (auditoria_id) REFERENCES auditorias(id) ON DELETE CASCADE
    )
  `);

  // ==================== CREAR ÍNDICES PARA OPTIMIZAR CONSULTAS ====================

  // Índices en auditorias - frecuentemente filtrado por fecha y parcela
  db.run(`CREATE INDEX IF NOT EXISTS idx_auditorias_fecha ON auditorias(fecha)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_auditorias_parcela ON auditorias(parcela)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_auditorias_fecha_parcela ON auditorias(fecha, parcela)`);

  // Índices en tablas de respuestas - para JOINs eficientes
  db.run(`CREATE INDEX IF NOT EXISTS idx_resp_clasificacion_auditoria ON respuestas_clasificacion(auditoria_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resp_orden_auditoria ON respuestas_orden(auditoria_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resp_limpieza_auditoria ON respuestas_limpieza(auditoria_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resp_inspeccion_auditoria ON respuestas_inspeccion(auditoria_id)`);

  // Índices en tablas de desglose - para filtrar por auditoria y categoría
  db.run(`CREATE INDEX IF NOT EXISTS idx_desglose_innec_auditoria ON desglose_innecesarios(auditoria_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_desglose_innec_categoria ON desglose_innecesarios(auditoria_id, categoria)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_desglose_orden_auditoria ON desglose_orden(auditoria_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_desglose_orden_categoria ON desglose_orden(auditoria_id, categoria)`);

  // Índices en acciones correctivas - para filtrar por estado
  db.run(`CREATE INDEX IF NOT EXISTS idx_acciones_auditoria ON acciones_correctivas(auditoria_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_acciones_estado ON acciones_correctivas(estado)`);

  // Índices en tipos y acciones personalizadas
  db.run(`CREATE INDEX IF NOT EXISTS idx_tipos_categoria ON tipos_personalizados(categoria)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_acciones_pers_categoria ON acciones_personalizadas(categoria)`);

  saveDatabase();
}

// ==================== RUTAS API ====================

// Obtener todas las auditorías
app.get('/api/auditorias', (req, res) => {
  try {
    const auditorias = queryAll('SELECT * FROM auditorias ORDER BY created_at DESC');
    res.json(auditorias);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener una auditoría completa por ID
app.get('/api/auditorias/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Validar ID
    if (!Validator.isValidId(id)) {
      return res.status(400).json({ error: 'ID de auditoría inválido' });
    }

    const auditoria = queryOne('SELECT * FROM auditorias WHERE id = ?', [id]);

    if (!auditoria) {
      return res.status(404).json({ error: 'Auditoría no encontrada' });
    }

    const clasificacion = queryOne('SELECT * FROM respuestas_clasificacion WHERE auditoria_id = ?', [id]);
    const orden = queryOne('SELECT * FROM respuestas_orden WHERE auditoria_id = ?', [id]);
    const limpieza = queryOne('SELECT * FROM respuestas_limpieza WHERE auditoria_id = ?', [id]);
    const inspeccion = queryOne('SELECT * FROM respuestas_inspeccion WHERE auditoria_id = ?', [id]);
    const acciones = queryAll('SELECT * FROM acciones_correctivas WHERE auditoria_id = ?', [id]);
    const desgloseDesconocidos = queryAll('SELECT * FROM desglose_innecesarios WHERE auditoria_id = ? AND categoria = ?', [id, 'desconocidos']);
    const desgloseNoFullkit = queryAll('SELECT * FROM desglose_innecesarios WHERE auditoria_id = ? AND categoria = ?', [id, 'no_fullkit']);
    const desgloseHerramienta = queryAll('SELECT * FROM desglose_orden WHERE auditoria_id = ? AND categoria = ?', [id, 'herramienta']);
    const desgloseEslingas = queryAll('SELECT * FROM desglose_orden WHERE auditoria_id = ? AND categoria = ?', [id, 'eslingas']);
    const desgloseMaquinas = queryAll('SELECT * FROM desglose_orden WHERE auditoria_id = ? AND categoria = ?', [id, 'maquinas']);
    const desgloseRopa = queryAll('SELECT * FROM desglose_orden WHERE auditoria_id = ? AND categoria = ?', [id, 'ropa']);

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
app.post('/api/auditorias', (req, res) => {
  try {
    const { fecha, parcela, auditor, clasificacion, orden, limpieza, inspeccion, acciones } = req.body;

    // ==================== VALIDACIÓN DE DATOS ====================

    // Validar fecha
    if (!Validator.isValidDate(fecha)) {
      return res.status(400).json({ error: 'Fecha inválida. Formato esperado: YYYY-MM-DD' });
    }

    // Validar parcela
    if (!Validator.isValidParcela(parcela)) {
      return res.status(400).json({ error: 'Parcela inválida o no reconocida' });
    }

    // Sanitizar auditor
    const auditorSanitizado = Validator.sanitizeString(auditor || 'Sin especificar', 100);

    // Insertar auditoría principal
    db.run(
      'INSERT INTO auditorias (fecha, parcela, auditor) VALUES (?, ?, ?)',
      [fecha, parcela, auditorSanitizado]
    );
    const auditoriaId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];

    // Insertar respuestas de clasificación
    if (clasificacion) {
      db.run(
        `INSERT INTO respuestas_clasificacion
        (auditoria_id, innecesarios_desconocidos, listado_desconocidos, innecesarios_no_fullkit, listado_no_fullkit)
        VALUES (?, ?, ?, ?, ?)`,
        [
          auditoriaId,
          parseInt(clasificacion.innecesarios_desconocidos) || 0,
          Validator.sanitizeString(clasificacion.listado_desconocidos || '', 2000),
          parseInt(clasificacion.innecesarios_no_fullkit) || 0,
          Validator.sanitizeString(clasificacion.listado_no_fullkit || '', 2000)
        ]
      );

      // Insertar desgloses usando helper DRY
      if (Validator.isValidDesglose(clasificacion.desglose_desconocidos)) {
        DbHelpers.insertDesgloseInnecesarios(auditoriaId, 'desconocidos', clasificacion.desglose_desconocidos);
      }

      if (Validator.isValidDesglose(clasificacion.desglose_no_fullkit)) {
        DbHelpers.insertDesgloseInnecesarios(auditoriaId, 'no_fullkit', clasificacion.desglose_no_fullkit);
      }
    }

    // Insertar respuestas de orden
    if (orden) {
      db.run(
        `INSERT INTO respuestas_orden
        (auditoria_id, herramienta_fuera, herramienta_detalle, eslingas_fuera, eslingas_detalle,
         maquinas_fuera, maquinas_detalle, ropa_epis_fuera, ropa_epis_detalle, lugar_guardar, lugar_guardar_detalle)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

      // Insertar desgloses de orden usando helper DRY
      const categoriasOrden = ['herramienta', 'eslingas', 'maquinas', 'ropa'];
      categoriasOrden.forEach(cat => {
        const desgloseKey = `desglose_${cat}`;
        if (Validator.isValidDesglose(orden[desgloseKey])) {
          DbHelpers.insertDesgloseOrden(auditoriaId, cat, orden[desgloseKey]);
        }
      });
    }

    // Insertar respuestas de limpieza
    if (limpieza) {
      db.run(
        `INSERT INTO respuestas_limpieza
        (auditoria_id, area_sucia, area_sucia_detalle, area_residuos, area_residuos_detalle)
        VALUES (?, ?, ?, ?, ?)`,
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
      db.run(
        `INSERT INTO respuestas_inspeccion
        (auditoria_id, salidas_gas_precintadas, riesgos_carteles, zonas_delimitadas,
         cuadros_electricos_ok, aire_comprimido_ok, inspeccion_detalle)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
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

        db.run(
          `INSERT INTO acciones_correctivas
          (auditoria_id, seccion, descripcion, responsable, fecha_limite, estado)
          VALUES (?, ?, ?, ?, ?, ?)`,
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

    saveDatabase();

    res.status(201).json({
      message: 'Auditoría guardada correctamente',
      id: auditoriaId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar auditoría
app.delete('/api/auditorias/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Validar ID
    if (!Validator.isValidId(id)) {
      return res.status(400).json({ error: 'ID de auditoría inválido' });
    }

    const existe = queryOne('SELECT id FROM auditorias WHERE id = ?', [id]);
    if (!existe) {
      return res.status(404).json({ error: 'Auditoría no encontrada' });
    }

    // Eliminar registros relacionados
    const tablasRelacionadas = [
      'respuestas_clasificacion', 'desglose_innecesarios', 'respuestas_orden',
      'desglose_orden', 'respuestas_limpieza', 'respuestas_inspeccion', 'acciones_correctivas'
    ];

    tablasRelacionadas.forEach(tabla => {
      db.run(`DELETE FROM ${tabla} WHERE auditoria_id = ?`, [id]);
    });

    db.run('DELETE FROM auditorias WHERE id = ?', [id]);
    saveDatabase();

    res.json({ message: 'Auditoría eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar estado de acción correctiva
app.patch('/api/acciones/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    // Validar ID
    if (!Validator.isValidId(id)) {
      return res.status(400).json({ error: 'ID de acción inválido' });
    }

    // Validar estado
    if (!Validator.isValidEstado(estado)) {
      return res.status(400).json({ error: 'Estado inválido. Valores permitidos: pendiente, en_progreso, completado' });
    }

    db.run('UPDATE acciones_correctivas SET estado = ? WHERE id = ?', [estado, id]);
    saveDatabase();

    res.json({ message: 'Estado actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener tipos personalizados por categoría
app.get('/api/tipos/:categoria', (req, res) => {
  try {
    const { categoria } = req.params;
    const categoriaSanitizada = Validator.sanitizeString(categoria, 50);
    const tipos = queryAll('SELECT nombre FROM tipos_personalizados WHERE categoria = ? ORDER BY nombre', [categoriaSanitizada]);
    res.json(tipos.map(t => t.nombre));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener todos los tipos personalizados
app.get('/api/tipos', (req, res) => {
  try {
    const tipos = queryAll('SELECT * FROM tipos_personalizados ORDER BY categoria, nombre');
    res.json(tipos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Guardar nuevo tipo personalizado
app.post('/api/tipos', (req, res) => {
  try {
    const { categoria, nombre } = req.body;

    // Validar datos
    if (!Validator.isNonEmptyString(categoria, 50)) {
      return res.status(400).json({ error: 'Categoría es requerida (máximo 50 caracteres)' });
    }
    if (!Validator.isNonEmptyString(nombre, 100)) {
      return res.status(400).json({ error: 'Nombre es requerido (máximo 100 caracteres)' });
    }

    db.run(
      'INSERT OR IGNORE INTO tipos_personalizados (categoria, nombre) VALUES (?, ?)',
      [Validator.sanitizeString(categoria, 50), Validator.sanitizeString(nombre, 100)]
    );
    saveDatabase();
    res.status(201).json({ message: 'Tipo guardado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener acciones personalizadas por categoría
app.get('/api/acciones-personalizadas/:categoria', (req, res) => {
  try {
    const { categoria } = req.params;
    const categoriaSanitizada = Validator.sanitizeString(categoria, 50);
    const acciones = queryAll('SELECT nombre FROM acciones_personalizadas WHERE categoria = ? ORDER BY nombre', [categoriaSanitizada]);
    res.json(acciones.map(a => a.nombre));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener todas las acciones personalizadas
app.get('/api/acciones-personalizadas', (req, res) => {
  try {
    const acciones = queryAll('SELECT * FROM acciones_personalizadas ORDER BY categoria, nombre');
    res.json(acciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Guardar nueva acción personalizada
app.post('/api/acciones-personalizadas', (req, res) => {
  try {
    const { categoria, nombre } = req.body;

    // Validar datos
    if (!Validator.isNonEmptyString(categoria, 50)) {
      return res.status(400).json({ error: 'Categoría es requerida (máximo 50 caracteres)' });
    }
    if (!Validator.isNonEmptyString(nombre, 200)) {
      return res.status(400).json({ error: 'Nombre es requerido (máximo 200 caracteres)' });
    }

    db.run(
      'INSERT OR IGNORE INTO acciones_personalizadas (categoria, nombre) VALUES (?, ?)',
      [Validator.sanitizeString(categoria, 50), Validator.sanitizeString(nombre, 200)]
    );
    saveDatabase();
    res.status(201).json({ message: 'Acción guardada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Estadísticas generales
app.get('/api/estadisticas', (req, res) => {
  try {
    const total = queryOne('SELECT COUNT(*) as count FROM auditorias');
    const porParcela = queryAll(`
      SELECT parcela, COUNT(*) as count
      FROM auditorias
      GROUP BY parcela
      ORDER BY count DESC
    `);
    const ultimaSemana = queryOne(`
      SELECT COUNT(*) as count
      FROM auditorias
      WHERE fecha >= date('now', '-7 days')
    `);
    const accionesPendientes = queryOne(`
      SELECT COUNT(*) as count
      FROM acciones_correctivas
      WHERE estado = 'pendiente'
    `);

    res.json({
      totalAuditorias: total?.count || 0,
      auditoriasUltimaSemana: ultimaSemana?.count || 0,
      accionesPendientes: accionesPendientes?.count || 0,
      porParcela
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
app.get('/api/kpi', (req, res) => {
  try {
    const { semanas = 8, parcela = '' } = req.query;
    const numSemanas = Math.min(Math.max(parseInt(semanas) || 8, 1), 52);

    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - (numSemanas * 7));
    const fechaInicioStr = fechaInicio.toISOString().split('T')[0];

    let whereClause = 'WHERE a.fecha >= ?';
    let params = [fechaInicioStr];

    if (parcela && Validator.isValidParcela(parcela)) {
      whereClause += ' AND a.parcela = ?';
      params.push(parcela);
    }

    const totalAuditoriasResult = queryOne(`
      SELECT COUNT(*) as total FROM auditorias a ${whereClause}
    `, params);
    const totalAuditorias = totalAuditoriasResult?.total || 0;

    const totalInnecesariosResult = queryOne(`
      SELECT
        COALESCE(SUM(rc.innecesarios_desconocidos), 0) + COALESCE(SUM(rc.innecesarios_no_fullkit), 0) as total
      FROM auditorias a
      LEFT JOIN respuestas_clasificacion rc ON a.id = rc.auditoria_id
      ${whereClause}
    `, params);
    const totalInnecesarios = totalInnecesariosResult?.total || 0;

    const promedioSemanal = numSemanas > 0 ? totalInnecesarios / numSemanas : 0;

    const porSemanaQuery = `
      SELECT
        strftime('%W', a.fecha) as semana,
        strftime('%Y', a.fecha) as anio,
        a.parcela,
        COALESCE(SUM(rc.innecesarios_desconocidos), 0) + COALESCE(SUM(rc.innecesarios_no_fullkit), 0) as totalInnecesarios,
        COUNT(*) as numAuditorias
      FROM auditorias a
      LEFT JOIN respuestas_clasificacion rc ON a.id = rc.auditoria_id
      ${whereClause}
      GROUP BY strftime('%Y-%W', a.fecha), a.parcela
      ORDER BY anio, semana
    `;
    const porSemana = queryAll(porSemanaQuery, params);

    const porParcelaQuery = `
      SELECT
        a.parcela,
        COALESCE(SUM(rc.innecesarios_desconocidos), 0) + COALESCE(SUM(rc.innecesarios_no_fullkit), 0) as totalInnecesarios,
        COUNT(*) as numAuditorias
      FROM auditorias a
      LEFT JOIN respuestas_clasificacion rc ON a.id = rc.auditoria_id
      ${whereClause}
      GROUP BY a.parcela
      ORDER BY totalInnecesarios DESC
    `;
    const porParcela = queryAll(porParcelaQuery, params);

    const detalleQuery = `
      SELECT
        strftime('%W', a.fecha) as semana,
        a.fecha,
        a.parcela,
        COALESCE(rc.innecesarios_desconocidos, 0) as innecesariosDesconocidos,
        COALESCE(rc.innecesarios_no_fullkit, 0) as innecesariosNoFullkit,
        COALESCE(rc.innecesarios_desconocidos, 0) + COALESCE(rc.innecesarios_no_fullkit, 0) as totalInnecesarios
      FROM auditorias a
      LEFT JOIN respuestas_clasificacion rc ON a.id = rc.auditoria_id
      ${whereClause}
      ORDER BY a.fecha DESC
    `;
    const detalle = queryAll(detalleQuery, params);

    const rankingQuery = `
      SELECT
        a.parcela,
        COALESCE(SUM(rc.innecesarios_desconocidos), 0) + COALESCE(SUM(rc.innecesarios_no_fullkit), 0) as totalInnecesarios,
        COUNT(*) as numAuditorias,
        CAST((COALESCE(SUM(rc.innecesarios_desconocidos), 0) + COALESCE(SUM(rc.innecesarios_no_fullkit), 0)) AS FLOAT) /
          CASE WHEN COUNT(*) > 0 THEN COUNT(*) ELSE 1 END as promedio
      FROM auditorias a
      LEFT JOIN respuestas_clasificacion rc ON a.id = rc.auditoria_id
      ${whereClause}
      GROUP BY a.parcela
      ORDER BY totalInnecesarios ASC
    `;
    const ranking = queryAll(rankingQuery, params);

    let tendencia = 0;
    if (porSemana.length >= 2) {
      const mitad = Math.floor(porSemana.length / 2);
      const primeraMitad = porSemana.slice(0, mitad);
      const segundaMitad = porSemana.slice(mitad);

      const sumaPrimera = primeraMitad.reduce((acc, s) => acc + (s.totalInnecesarios || 0), 0);
      const sumaSegunda = segundaMitad.reduce((acc, s) => acc + (s.totalInnecesarios || 0), 0);

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
  await initDatabase();

  app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  Servidor de Auditoría 5S GHI`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`========================================\n`);
  });
}

startServer().catch(console.error);
