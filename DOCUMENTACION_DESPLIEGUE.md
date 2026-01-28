# Documentación de Despliegue - Auditoría 5S GHI

**Fecha:** 2026-01-28
**Proyecto:** Sistema de Auditoría 5S para GHI Smart Furnaces

---

## 1. Resumen del Proyecto

### Stack Tecnológico
- **Backend:** Node.js + Express
- **Base de datos:** SQLite (sql.js)
- **Frontend:** HTML, CSS, JavaScript vanilla
- **Gráficos:** Chart.js

### Funcionalidades
- Registro de auditorías 5S por parcela
- Historial con filtros y paginación
- Dashboard KPIs con gráficos
- Sistema de autenticación admin
- Backup de base de datos (SQLite y JSON)
- Modo oscuro
- Impresión de hojas de auditoría

---

## 2. Repositorio GitHub

**URL:** https://github.com/lasshow/Auditoria_5S

### Historial de Commits

| Commit | Descripción |
|--------|-------------|
| `30a6375` | Versión inicial - Sistema de Auditoría 5S GHI |
| `e548b5d` | Corregir error en modal de detalles |
| `2c6b55d` | Corregir lógica SI/NO y añadir sistema admin |
| `aab0dfa` | Corregir estilos de impresión para hoja de auditoría |
| `d2d119a` | Corregir CSS de impresión para modal dentro de container |

### Estructura del Proyecto

```
Auditoria/
├── server.js           # Backend Express + API
├── package.json        # Dependencias
├── auditorias.db       # Base de datos SQLite (local)
├── CLAUDE.md           # Instrucciones para Claude Code
├── public/
│   ├── index.html      # Formulario de auditoría
│   ├── historial.html  # Listado de auditorías
│   ├── kpi.html        # Dashboard KPIs
│   ├── app.js          # Lógica formulario
│   ├── historial.js    # Lógica historial
│   ├── kpi.js          # Lógica KPIs
│   └── styles.css      # Estilos globales
```

---

## 3. Despliegue en Railway (Estado Actual)

**URL:** https://auditoria5s-production.up.railway.app/

### Problema Identificado

Railway usa contenedores efímeros. Cada vez que se despliega una nueva versión o se reinicia el servicio:
- Se crea un contenedor nuevo
- El archivo `auditorias.db` no existe
- Se crea una base de datos vacía nueva
- **Todas las auditorías anteriores se pierden**

### Causa Técnica

```javascript
// server.js línea 73
const DB_PATH = path.join(__dirname, 'auditorias.db');
```

El archivo se guarda en el filesystem efímero del contenedor, no en almacenamiento persistente.

---

## 4. Investigación de Soluciones

### Plataformas Evaluadas

| Plataforma | SQLite Persistente FREE | Notas |
|------------|------------------------|-------|
| Railway (sin Volume) | ❌ NO | Filesystem efímero |
| Railway (con Volume) | ✅ SÍ | Requiere plan Hobby ($5/mes) |
| Render Free | ❌ NO | Sin disco persistente en free |
| Fly.io | ❌ NO | Ya no tienen free tier |
| Koyeb Free | ❌ NO | Volumes solo en plan de pago |
| **Glitch** | ✅ SÍ | Carpeta `.data/` persiste |
| Oracle Cloud | ✅ SÍ | VM gratis, más setup |
| Turso | ✅ SÍ | Requiere cambiar driver |

### Fuentes Consultadas

- [Railway Volumes Docs](https://docs.railway.com/reference/volumes)
- [Railway Pricing](https://railway.com/pricing)
- [Glitch Hello SQLite](https://glitch.com/~glitch-hello-sqlite)
- [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/)
- [Litestream](https://litestream.io/)
- [Turso](https://turso.tech/)

---

## 5. Solución Elegida: Glitch

### Por qué Glitch

- **Gratis para siempre** (no trial)
- **SQLite persistente** via carpeta `.data/`
- **Cambio mínimo en código** (1 línea)
- **Import directo desde GitHub**

### Limitaciones Aceptables

| Limitación | Impacto |
|------------|---------|
| Duerme tras 5 min sin tráfico | Se despierta al recibir request (~10s) |
| 200MB de disco | DB actual es ~2MB |
| 4000 requests/hora | Suficiente para uso interno |

---

## 6. Cambios Pendientes

### Modificación en server.js

```javascript
// ANTES:
const DB_PATH = path.join(__dirname, 'auditorias.db');

// DESPUÉS:
const DB_PATH = process.env.GLITCH_PROJECT_ID
  ? path.join(__dirname, '.data', 'auditorias.db')
  : path.join(__dirname, 'auditorias.db');
```

Este cambio permite:
- Usar `.data/auditorias.db` en Glitch (persistente)
- Usar `auditorias.db` en desarrollo local

### Pasos para Migrar a Glitch

1. Ir a [glitch.com](https://glitch.com)
2. New Project → Import from GitHub
3. URL: `https://github.com/lasshow/Auditoria_5S`
4. Editar `server.js` con el cambio de ruta
5. El proyecto se despliega automáticamente
6. URL será: `https://[nombre-proyecto].glitch.me`

---

## 7. Credenciales Admin

| Campo | Valor |
|-------|-------|
| Usuario | `admin` |
| Contraseña | `GHIhornos` |

Estas credenciales se usan para:
- Eliminar auditorías (historial)
- Descargar backups (KPIs)

---

## 8. Archivos de Configuración

### CLAUDE.md (Instrucciones para Claude Code)

Contiene reglas mandatory:
- Consensuar antes de commits
- Consensuar antes de cambios en server.js
- Consensuar antes de cambios de arquitectura
- Presentar hallazgos antes de actuar

### package.json

```json
{
  "name": "auditoria-5s-ghi",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "sql.js": "^1.8.0"
  }
}
```

---

## 9. Próximos Pasos

- [ ] Aprobar cambio en server.js para soporte Glitch
- [ ] Crear proyecto en Glitch importando desde GitHub
- [ ] Verificar que la DB persiste entre reinicios
- [ ] Actualizar esta documentación con URL final de Glitch
- [ ] Decidir si mantener Railway o migrar completamente

---

*Documento generado con Claude Code*
