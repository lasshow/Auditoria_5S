# Instrucciones del Proyecto - Auditoría 5S GHI

## MANDATORY: Consenso antes de Acciones Críticas

**OBLIGATORIO:** Antes de realizar cualquiera de estas acciones, SIEMPRE debo:
1. Presentar mis hallazgos al usuario
2. Explicar las opciones disponibles
3. **ESPERAR APROBACIÓN EXPLÍCITA** antes de proceder

### Acciones que requieren consenso previo:

- **Git commits** - cualquier commit, por pequeño que sea
- **Git push** - nunca push sin aprobación
- **Cambios en server.js** - es el núcleo del backend
- **Cambios en la base de datos** - estructura, rutas, configuración
- **Cambios de arquitectura** - decisiones que afectan múltiples archivos
- **Instalación de dependencias** - npm install de nuevos paquetes
- **Configuración de deployment** - Railway, variables de entorno
- **Eliminación de código** - cualquier delete significativo

### Flujo correcto:

```
1. Investigar el problema
2. Presentar hallazgos con /qaterminal o resumen estructurado
3. Ofrecer opciones claras
4. ESPERAR respuesta del usuario
5. Solo entonces ejecutar la acción aprobada
```

### Lo que NO debo hacer:

- Editar archivos críticos sin preguntar
- Hacer commits automáticamente
- Asumir que el usuario quiere X solución
- Proceder con cambios "obvios" sin validar

---

## Contexto del Proyecto

- **Stack:** Node.js + Express + sql.js (SQLite)
- **Frontend:** Vanilla JS, HTML, CSS
- **Deployment:** Railway (https://auditoria5s-production.up.railway.app/)
- **Repo:** https://github.com/lasshow/Auditoria_5S

## Credenciales Admin

- Usuario: `admin`
- Password: `GHIhornos`
