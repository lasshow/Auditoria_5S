# Auditoría 5S - GHI Hornos Industriales

Sistema web para la gestión de auditorías 5S en las parcelas de producción de GHI Smart Furnaces.

## Características

- Formulario de auditoría con las 5S (Clasificación, Orden, Limpieza, Estandarización, Disciplina)
- Mapa interactivo de parcelas
- Historial de auditorías con filtros
- Dashboard de KPIs y métricas
- Gestión de acciones correctivas
- Tipos y acciones personalizables
- Modo oscuro

## Tecnologías

- **Backend**: Node.js + Express.js
- **Base de datos**: SQLite (sql.js)
- **Frontend**: HTML5, CSS3, JavaScript vanilla

## Instalación

```bash
# Clonar repositorio
git clone https://github.com/TU_USUARIO/auditoria-5s-ghi.git
cd auditoria-5s-ghi

# Instalar dependencias
npm install

# Iniciar servidor
npm start
```

## Uso

Acceder a `http://localhost:3000` en el navegador.

### Páginas disponibles

- `/` - Formulario de nueva auditoría
- `/historial` - Listado de auditorías realizadas
- `/kpi` - Dashboard con métricas y gráficos

## Estructura del proyecto

```
auditoria-5s-ghi/
├── server.js           # Servidor Express y API REST
├── package.json        # Dependencias Node.js
├── .gitignore          # Archivos ignorados por git
└── public/
    ├── index.html      # Formulario de auditoría
    ├── historial.html  # Historial de auditorías
    ├── kpi.html        # Dashboard de KPIs
    ├── app.js          # Lógica del formulario
    ├── historial.js    # Lógica del historial
    └── styles.css      # Estilos CSS
```

## API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/auditorias` | Obtener todas las auditorías |
| GET | `/api/auditorias/:id` | Obtener auditoría por ID |
| POST | `/api/auditorias` | Crear nueva auditoría |
| DELETE | `/api/auditorias/:id` | Eliminar auditoría |
| GET | `/api/kpi` | Obtener métricas KPI |

## Despliegue

Compatible con:
- Railway
- Render
- Azure App Service
- Cualquier plataforma Node.js

## Licencia

ISC - GHI Smart Furnaces
