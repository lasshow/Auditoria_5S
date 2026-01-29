-- Auditoría 5S - PostgreSQL Schema
-- Migration: 001_schema.sql

-- Main auditorias table
CREATE TABLE IF NOT EXISTS auditorias (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  parcela VARCHAR(100) NOT NULL,
  auditor VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Respuestas clasificación
CREATE TABLE IF NOT EXISTS respuestas_clasificacion (
  id SERIAL PRIMARY KEY,
  auditoria_id INTEGER NOT NULL REFERENCES auditorias(id) ON DELETE CASCADE,
  innecesarios_desconocidos INTEGER DEFAULT 0,
  listado_desconocidos TEXT,
  innecesarios_no_fullkit INTEGER DEFAULT 0,
  listado_no_fullkit TEXT
);

-- Desglose innecesarios
CREATE TABLE IF NOT EXISTS desglose_innecesarios (
  id SERIAL PRIMARY KEY,
  auditoria_id INTEGER NOT NULL REFERENCES auditorias(id) ON DELETE CASCADE,
  categoria VARCHAR(50) NOT NULL,
  linea INTEGER NOT NULL,
  tipo_innecesario VARCHAR(200),
  accion VARCHAR(500)
);

-- Desglose orden
CREATE TABLE IF NOT EXISTS desglose_orden (
  id SERIAL PRIMARY KEY,
  auditoria_id INTEGER NOT NULL REFERENCES auditorias(id) ON DELETE CASCADE,
  categoria VARCHAR(50) NOT NULL,
  linea INTEGER NOT NULL,
  tipo_elemento VARCHAR(200),
  accion VARCHAR(500)
);

-- Tipos personalizados
CREATE TABLE IF NOT EXISTS tipos_personalizados (
  id SERIAL PRIMARY KEY,
  categoria VARCHAR(50) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(categoria, nombre)
);

-- Acciones personalizadas
CREATE TABLE IF NOT EXISTS acciones_personalizadas (
  id SERIAL PRIMARY KEY,
  categoria VARCHAR(50) NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(categoria, nombre)
);

-- Respuestas orden
CREATE TABLE IF NOT EXISTS respuestas_orden (
  id SERIAL PRIMARY KEY,
  auditoria_id INTEGER NOT NULL REFERENCES auditorias(id) ON DELETE CASCADE,
  herramienta_fuera BOOLEAN DEFAULT FALSE,
  herramienta_detalle TEXT,
  eslingas_fuera BOOLEAN DEFAULT FALSE,
  eslingas_detalle TEXT,
  maquinas_fuera BOOLEAN DEFAULT FALSE,
  maquinas_detalle TEXT,
  ropa_epis_fuera BOOLEAN DEFAULT FALSE,
  ropa_epis_detalle TEXT,
  lugar_guardar BOOLEAN DEFAULT FALSE,
  lugar_guardar_detalle TEXT
);

-- Respuestas limpieza
CREATE TABLE IF NOT EXISTS respuestas_limpieza (
  id SERIAL PRIMARY KEY,
  auditoria_id INTEGER NOT NULL REFERENCES auditorias(id) ON DELETE CASCADE,
  area_sucia BOOLEAN DEFAULT FALSE,
  area_sucia_detalle TEXT,
  area_residuos BOOLEAN DEFAULT FALSE,
  area_residuos_detalle TEXT
);

-- Respuestas inspección
CREATE TABLE IF NOT EXISTS respuestas_inspeccion (
  id SERIAL PRIMARY KEY,
  auditoria_id INTEGER NOT NULL REFERENCES auditorias(id) ON DELETE CASCADE,
  salidas_gas_precintadas BOOLEAN DEFAULT FALSE,
  riesgos_carteles BOOLEAN DEFAULT FALSE,
  zonas_delimitadas BOOLEAN DEFAULT FALSE,
  cuadros_electricos_ok BOOLEAN DEFAULT FALSE,
  aire_comprimido_ok BOOLEAN DEFAULT FALSE,
  inspeccion_detalle TEXT
);

-- Acciones correctivas
CREATE TABLE IF NOT EXISTS acciones_correctivas (
  id SERIAL PRIMARY KEY,
  auditoria_id INTEGER NOT NULL REFERENCES auditorias(id) ON DELETE CASCADE,
  seccion VARCHAR(50) NOT NULL,
  descripcion TEXT NOT NULL,
  responsable VARCHAR(100),
  fecha_limite DATE,
  estado VARCHAR(20) DEFAULT 'pendiente'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_auditorias_fecha ON auditorias(fecha);
CREATE INDEX IF NOT EXISTS idx_auditorias_parcela ON auditorias(parcela);
CREATE INDEX IF NOT EXISTS idx_auditorias_fecha_parcela ON auditorias(fecha, parcela);

CREATE INDEX IF NOT EXISTS idx_resp_clasificacion_auditoria ON respuestas_clasificacion(auditoria_id);
CREATE INDEX IF NOT EXISTS idx_resp_orden_auditoria ON respuestas_orden(auditoria_id);
CREATE INDEX IF NOT EXISTS idx_resp_limpieza_auditoria ON respuestas_limpieza(auditoria_id);
CREATE INDEX IF NOT EXISTS idx_resp_inspeccion_auditoria ON respuestas_inspeccion(auditoria_id);

CREATE INDEX IF NOT EXISTS idx_desglose_innec_auditoria ON desglose_innecesarios(auditoria_id);
CREATE INDEX IF NOT EXISTS idx_desglose_innec_categoria ON desglose_innecesarios(auditoria_id, categoria);
CREATE INDEX IF NOT EXISTS idx_desglose_orden_auditoria ON desglose_orden(auditoria_id);
CREATE INDEX IF NOT EXISTS idx_desglose_orden_categoria ON desglose_orden(auditoria_id, categoria);

CREATE INDEX IF NOT EXISTS idx_acciones_auditoria ON acciones_correctivas(auditoria_id);
CREATE INDEX IF NOT EXISTS idx_acciones_estado ON acciones_correctivas(estado);

CREATE INDEX IF NOT EXISTS idx_tipos_categoria ON tipos_personalizados(categoria);
CREATE INDEX IF NOT EXISTS idx_acciones_pers_categoria ON acciones_personalizadas(categoria);
