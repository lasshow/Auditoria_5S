// ==================== HISTORIAL DE AUDITORÍAS ====================

// Cargar tema guardado inmediatamente para evitar flash
(function() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
  }
})();

let auditorias = [];
let auditoriasFiltradas = [];
let auditoriaAEliminar = null;
const ITEMS_POR_PAGINA = 10;
let paginaActual = 1;
let adminCredentials = null; // Guardará las credenciales del admin si está logueado

document.addEventListener('DOMContentLoaded', () => {
  initializeThemeToggle();
  cargarEstadisticas();
  cargarAuditorias();
  initializeFilters();
  initializeModals();
});

// Inicializar toggle de tema
function initializeThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');

      // Guardar preferencia en localStorage
      const isDark = document.body.classList.contains('dark-mode');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
  }
}

// Cargar estadísticas generales
async function cargarEstadisticas() {
  try {
    const response = await fetch('/api/estadisticas');
    const stats = await response.json();

    document.getElementById('stat-total').textContent = stats.totalAuditorias;
    document.getElementById('stat-semana').textContent = stats.auditoriasUltimaSemana;
    document.getElementById('stat-pendientes').textContent = stats.accionesPendientes;
  } catch (error) {
    console.error('Error al cargar estadísticas:', error);
  }
}

// Cargar todas las auditorías
async function cargarAuditorias() {
  try {
    const response = await fetch('/api/auditorias');
    auditorias = await response.json();
    auditoriasFiltradas = [...auditorias];
    renderizarTabla();
  } catch (error) {
    console.error('Error al cargar auditorías:', error);
    document.getElementById('tabla-body').innerHTML = `
      <tr><td colspan="5" class="no-data">Error al cargar los datos. Verifica que el servidor esté activo.</td></tr>
    `;
  }
}

// Renderizar tabla de auditorías
function renderizarTabla() {
  const tbody = document.getElementById('tabla-body');

  if (auditoriasFiltradas.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="5" class="no-data">No se encontraron auditorías.</td></tr>
    `;
    document.getElementById('paginacion').innerHTML = '';
    return;
  }

  // Calcular paginación
  const inicio = (paginaActual - 1) * ITEMS_POR_PAGINA;
  const fin = inicio + ITEMS_POR_PAGINA;
  const auditoriasEnPagina = auditoriasFiltradas.slice(inicio, fin);

  tbody.innerHTML = auditoriasEnPagina.map(auditoria => `
    <tr>
      <td><strong>#${auditoria.id}</strong></td>
      <td>${formatearFecha(auditoria.fecha)}</td>
      <td>${auditoria.puesto ? auditoria.parcela + ' &rsaquo; ' + auditoria.puesto : auditoria.parcela}</td>
      <td>${auditoria.auditor || '-'}</td>
      <td>
        <button class="btn btn-info btn-small" onclick="verDetalles(${auditoria.id})">Ver</button>
        <button class="btn btn-warning btn-small" onclick="modificarAuditoria(${auditoria.id})">Modificar</button>
        <button class="btn btn-danger btn-small" onclick="confirmarEliminar(${auditoria.id})">Eliminar</button>
      </td>
    </tr>
  `).join('');

  renderizarPaginacion();
}

// Renderizar paginación
function renderizarPaginacion() {
  const totalPaginas = Math.ceil(auditoriasFiltradas.length / ITEMS_POR_PAGINA);
  const paginacion = document.getElementById('paginacion');

  if (totalPaginas <= 1) {
    paginacion.innerHTML = '';
    return;
  }

  let html = '';

  // Botón anterior
  html += `<button ${paginaActual === 1 ? 'disabled' : ''} onclick="cambiarPagina(${paginaActual - 1})">Anterior</button>`;

  // Números de página
  for (let i = 1; i <= totalPaginas; i++) {
    if (
      i === 1 ||
      i === totalPaginas ||
      (i >= paginaActual - 2 && i <= paginaActual + 2)
    ) {
      html += `<button class="${i === paginaActual ? 'active' : ''}" onclick="cambiarPagina(${i})">${i}</button>`;
    } else if (i === paginaActual - 3 || i === paginaActual + 3) {
      html += `<span>...</span>`;
    }
  }

  // Botón siguiente
  html += `<button ${paginaActual === totalPaginas ? 'disabled' : ''} onclick="cambiarPagina(${paginaActual + 1})">Siguiente</button>`;

  paginacion.innerHTML = html;
}

// Cambiar página
function cambiarPagina(pagina) {
  paginaActual = pagina;
  renderizarTabla();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Formatear fecha
function formatearFecha(fecha) {
  if (!fecha) return '-';
  const date = new Date(fecha);
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// Inicializar filtros
function initializeFilters() {
  const btnFiltrar = document.getElementById('btn-filtrar');
  const btnLimpiar = document.getElementById('btn-limpiar-filtros');

  btnFiltrar.addEventListener('click', aplicarFiltros);
  btnLimpiar.addEventListener('click', limpiarFiltros);
}

// Aplicar filtros
function aplicarFiltros() {
  const parcela = document.getElementById('filtro-parcela').value;
  const desde = document.getElementById('filtro-desde').value;
  const hasta = document.getElementById('filtro-hasta').value;

  auditoriasFiltradas = auditorias.filter(auditoria => {
    // Filtro por parcela
    if (parcela && auditoria.parcela !== parcela) return false;

    // Filtro por fecha desde
    if (desde && auditoria.fecha < desde) return false;

    // Filtro por fecha hasta
    if (hasta && auditoria.fecha > hasta) return false;

    return true;
  });

  paginaActual = 1;
  renderizarTabla();
}

// Limpiar filtros
function limpiarFiltros() {
  document.getElementById('filtro-parcela').value = '';
  document.getElementById('filtro-desde').value = '';
  document.getElementById('filtro-hasta').value = '';

  auditoriasFiltradas = [...auditorias];
  paginaActual = 1;
  renderizarTabla();
}

// Ver detalles de una auditoría
async function verDetalles(id) {
  try {
    const response = await fetch(`/api/auditorias/${id}`);
    const auditoria = await response.json();

    const hoja = document.getElementById('hoja-auditoria');
    hoja.innerHTML = generarHojaAuditoria(auditoria);

    document.getElementById('modal-detalles').classList.add('show');
  } catch (error) {
    console.error('Error al cargar detalles:', error);
    alert('Error al cargar los detalles de la auditoría.');
  }
}

// Función para imprimir la hoja
function imprimirHoja() {
  window.print();
}

// Generar hoja de auditoría completa para impresión
function generarHojaAuditoria(auditoria) {
  // Si es Taller Eléctrico, generar hoja específica
  if (auditoria.puesto) {
    return generarHojaTallerElectrico(auditoria);
  }

  const clasificacion = auditoria.clasificacion || {};
  const orden = auditoria.orden || {};
  const limpieza = auditoria.limpieza || {};
  const inspeccion = auditoria.inspeccion || {};

  // Función auxiliar para mostrar SI/NO con estilo
  // invertir=false: SI=problema (rojo), NO=ok (verde) - ej: "¿Hay herramienta fuera?"
  // invertir=true: SI=ok (verde), NO=problema (rojo) - ej: "¿Están precintadas?"
  const siNo = (valor, invertir = false) => {
    if (valor === null || valor === undefined) {
      return `<span class="respuesta-valor valor-na">NA</span>`;
    }
    const hayProblema = invertir ? !valor : valor;
    const texto = valor ? 'SI' : 'NO';
    const clase = hayProblema ? 'valor-problema' : 'valor-ok';
    return `<span class="respuesta-valor ${clase}">${texto}</span>`;
  };

  // Función para formatear acción (negrita si menciona supervisor)
  const formatearAccion = (texto) => {
    const palabrasClave = ['supervisor', 'superior', 'preguntar', 'consultar', 'jefe'];
    const necesitaSupervisor = palabrasClave.some(p => texto.toLowerCase().includes(p));
    if (necesitaSupervisor) {
      return `<strong class="accion-supervisor">${texto}</strong>`;
    }
    return texto;
  };

  // Generar filas de desglose si existen
  const generarDesglose = (items, tipo) => {
    if (!items || items.length === 0) return '';
    return items.map((item, idx) => {
      const accionTexto = item.accion || '-';
      const esSupervisor = ['supervisor', 'superior', 'preguntar', 'consultar', 'jefe'].some(p => accionTexto.toLowerCase().includes(p));
      return `
      <div class="desglose-item-print ${esSupervisor ? 'desglose-supervisor' : ''}">
        <span class="desglose-num">${idx + 1}.</span>
        <span class="desglose-tipo">${item.tipo_innecesario || item.tipo_elemento || '-'}</span>
        <span class="desglose-flecha">→</span>
        <span class="desglose-accion">${esSupervisor ? '<strong>' + accionTexto + '</strong>' : accionTexto}</span>
      </div>
    `}).join('');
  };

  return `
    <!-- ENCABEZADO -->
    <div class="hoja-header">
      <div class="hoja-logo">AUDITORÍA 5S GHI</div>
      <div class="hoja-info">
        <div class="hoja-titulo">Informe de Auditoría para Limpieza</div>
        <div class="hoja-subtitulo">Limpieza del taller - Viernes</div>
      </div>
      <div class="hoja-empresa">
        <strong>GHI Smart Furnaces</strong><br>
        Barrio de Aperribai, 4<br>
        48960 Galdakao
      </div>
    </div>

    <!-- DATOS GENERALES -->
    <div class="hoja-datos-generales">
      <div class="dato-general">
        <span class="dato-label">Fecha auditoría:</span>
        <span class="dato-valor">${formatearFecha(auditoria.fecha)}</span>
      </div>
      <div class="dato-general">
        <span class="dato-label">Parcela:</span>
        <span class="dato-valor dato-parcela">${auditoria.parcela}</span>
      </div>
      <div class="dato-general">
        <span class="dato-label">Auditor:</span>
        <span class="dato-valor">${auditoria.auditor || '-'}</span>
      </div>
    </div>

    <!-- SECCIÓN 1: CLASIFICACIÓN -->
    <table class="hoja-tabla">
      <thead>
        <tr>
          <th class="hoja-header-seccion" colspan="4">1 - CLASIFICACIÓN (Eliminar del espacio de trabajo lo innecesario)</th>
        </tr>
        <tr class="hoja-subheader">
          <th width="45%">Pregunta</th>
          <th width="10%">Resultado</th>
          <th width="5%"></th>
          <th width="40%">Acción requerida</th>
        </tr>
      </thead>
      <tbody>
        <tr class="${(clasificacion.innecesarios_desconocidos || 0) > 0 ? 'fila-requiere-accion' : ''}">
          <td>Nº de innecesarios que NO sé lo que son</td>
          <td class="celda-centro"><strong>${clasificacion.innecesarios_desconocidos || 0}</strong></td>
          <td class="celda-flecha">➜</td>
          <td>${formatearAccion('Identificar cada innecesario y decidir si se tira o se almacena')}</td>
        </tr>
        ${clasificacion.desglose_desconocidos && clasificacion.desglose_desconocidos.length > 0 ? `
        <tr class="fila-requiere-accion">
          <td colspan="4" class="celda-desglose">
            <div class="desglose-titulo">Desglose de elementos encontrados:</div>
            ${generarDesglose(clasificacion.desglose_desconocidos)}
          </td>
        </tr>
        ` : ''}
        ${clasificacion.listado_desconocidos ? `
        <tr class="fila-requiere-accion">
          <td colspan="4" class="celda-detalle">
            <strong>Detalle adicional:</strong> ${clasificacion.listado_desconocidos}
          </td>
        </tr>
        ` : ''}
        <tr class="${(clasificacion.innecesarios_no_fullkit || 0) > 0 ? 'fila-requiere-accion' : ''}">
          <td>Nº de innecesarios que NO pertenecen al FullKit del momento actual</td>
          <td class="celda-centro"><strong>${clasificacion.innecesarios_no_fullkit || 0}</strong></td>
          <td class="celda-flecha">➜</td>
          <td>${formatearAccion('Recoger y llevar a baldas o a almacén')}</td>
        </tr>
        ${clasificacion.desglose_no_fullkit && clasificacion.desglose_no_fullkit.length > 0 ? `
        <tr class="fila-requiere-accion">
          <td colspan="4" class="celda-desglose">
            <div class="desglose-titulo">Desglose de elementos encontrados:</div>
            ${generarDesglose(clasificacion.desglose_no_fullkit)}
          </td>
        </tr>
        ` : ''}
        ${clasificacion.listado_no_fullkit ? `
        <tr class="fila-requiere-accion">
          <td colspan="4" class="celda-detalle">
            <strong>Detalle adicional:</strong> ${clasificacion.listado_no_fullkit}
          </td>
        </tr>
        ` : ''}
      </tbody>
    </table>

    <!-- SECCIÓN 2: ORDEN -->
    <table class="hoja-tabla">
      <thead>
        <tr>
          <th class="hoja-header-seccion" colspan="4">2 - ORDEN (Cada cosa en su lugar y un lugar para cada cosa)</th>
        </tr>
        <tr class="hoja-subheader">
          <th width="45%">Pregunta</th>
          <th width="10%">Resultado</th>
          <th width="5%"></th>
          <th width="40%">Acción requerida</th>
        </tr>
      </thead>
      <tbody>
        <tr class="${orden.herramienta_fuera === true ? 'fila-requiere-accion' : ''}">
          <td>¿Hay herramienta fuera de su ubicación?</td>
          <td class="celda-centro">${siNo(orden.herramienta_fuera)}</td>
          <td class="celda-flecha">➜</td>
          <td>${formatearAccion('Recoger e inspeccionar')}</td>
        </tr>
        ${orden.desglose_herramienta && orden.desglose_herramienta.length > 0 ? `
        <tr class="fila-requiere-accion">
          <td colspan="4" class="celda-desglose">
            ${generarDesglose(orden.desglose_herramienta)}
          </td>
        </tr>
        ` : ''}
        <tr class="${orden.eslingas_fuera === true ? 'fila-requiere-accion' : ''}">
          <td>¿Hay eslingas, cadenas, grilletes fuera de sus perchas?</td>
          <td class="celda-centro">${siNo(orden.eslingas_fuera)}</td>
          <td class="celda-flecha">➜</td>
          <td>${formatearAccion('Recoger, inspeccionar y ubicar en sus perchas')}</td>
        </tr>
        ${orden.desglose_eslingas && orden.desglose_eslingas.length > 0 ? `
        <tr class="fila-requiere-accion">
          <td colspan="4" class="celda-desglose">
            ${generarDesglose(orden.desglose_eslingas)}
          </td>
        </tr>
        ` : ''}
        <tr class="${orden.maquinas_fuera === true ? 'fila-requiere-accion' : ''}">
          <td>¿Hay máquinas fuera de su lugar?</td>
          <td class="celda-centro">${siNo(orden.maquinas_fuera)}</td>
          <td class="celda-flecha">➜</td>
          <td>${formatearAccion('Recoger e inspeccionar')}</td>
        </tr>
        ${orden.desglose_maquinas && orden.desglose_maquinas.length > 0 ? `
        <tr class="fila-requiere-accion">
          <td colspan="4" class="celda-desglose">
            ${generarDesglose(orden.desglose_maquinas)}
          </td>
        </tr>
        ` : ''}
        <tr class="${orden.ropa_epis_fuera === true ? 'fila-requiere-accion' : ''}">
          <td>¿Hay ropa o EPIS fuera de su lugar?</td>
          <td class="celda-centro">${siNo(orden.ropa_epis_fuera)}</td>
          <td class="celda-flecha">➜</td>
          <td>${formatearAccion('Recoger, identificar, colocar en perchero')}</td>
        </tr>
        ${orden.desglose_ropa && orden.desglose_ropa.length > 0 ? `
        <tr class="fila-requiere-accion">
          <td colspan="4" class="celda-desglose">
            ${generarDesglose(orden.desglose_ropa)}
          </td>
        </tr>
        ` : ''}
        <tr class="${orden.lugar_guardar === false ? 'fila-requiere-accion' : ''}">
          <td>¿Hay un lugar donde guardar cada cosa encontrada?</td>
          <td class="celda-centro">${siNo(orden.lugar_guardar, true)}</td>
          <td class="celda-flecha">➜</td>
          <td>${formatearAccion('Crear lugares para guardar')}</td>
        </tr>
      </tbody>
    </table>

    <!-- SECCIÓN 3: LIMPIEZA -->
    <table class="hoja-tabla">
      <thead>
        <tr>
          <th class="hoja-header-seccion" colspan="4">3 - LIMPIEZA (Gestionar los residuos. Limpieza = inspección)</th>
        </tr>
        <tr class="hoja-subheader">
          <th width="45%">Pregunta</th>
          <th width="10%">Resultado</th>
          <th width="5%"></th>
          <th width="40%">Acción requerida</th>
        </tr>
      </thead>
      <tbody>
        <tr class="${limpieza.area_sucia === true ? 'fila-requiere-accion' : ''}">
          <td>¿Está el área sucia (polvo, basura)?</td>
          <td class="celda-centro">${siNo(limpieza.area_sucia)}</td>
          <td class="celda-flecha">➜</td>
          <td>${formatearAccion('Recoger y desechar residuos. Barrer.')}</td>
        </tr>
        <tr class="${limpieza.area_residuos === false ? 'fila-requiere-accion' : ''}">
          <td>¿Está el área libre de residuos (pallets, embalajes, aceites...)?</td>
          <td class="celda-centro">${siNo(limpieza.area_residuos, true)}</td>
          <td class="celda-flecha">➜</td>
          <td>${formatearAccion('Recoger residuos y desecharlos')}</td>
        </tr>
      </tbody>
    </table>

    <!-- SECCIÓN 4: INSPECCIÓN VISUAL -->
    <table class="hoja-tabla">
      <thead>
        <tr>
          <th class="hoja-header-seccion" colspan="4">4 - INSPECCIÓN VISUAL (Prevenir el desorden, señalizar)</th>
        </tr>
        <tr class="hoja-subheader">
          <th width="45%">Pregunta</th>
          <th width="10%">Resultado</th>
          <th width="5%"></th>
          <th width="40%">Acción requerida</th>
        </tr>
      </thead>
      <tbody>
        <tr class="${inspeccion.salidas_gas_precintadas === false ? 'fila-requiere-accion' : ''}">
          <td>¿Todas las salidas de gas están precintadas?</td>
          <td class="celda-centro">${siNo(inspeccion.salidas_gas_precintadas, true)}</td>
          <td class="celda-flecha">➜</td>
          <td>${formatearAccion('Precintar de inmediato')}</td>
        </tr>
        <tr class="${inspeccion.riesgos_carteles === false ? 'fila-requiere-accion' : ''}">
          <td>¿Todos los riesgos están identificados en carteles?</td>
          <td class="celda-centro">${siNo(inspeccion.riesgos_carteles, true)}</td>
          <td class="celda-flecha">➜</td>
          <td>${formatearAccion('Indicar para compra de carteles')}</td>
        </tr>
        <tr class="${inspeccion.zonas_delimitadas === false ? 'fila-requiere-accion' : ''}">
          <td>¿Están correctamente delimitadas las zonas de trabajo?</td>
          <td class="celda-centro">${siNo(inspeccion.zonas_delimitadas, true)}</td>
          <td class="celda-flecha">➜</td>
          <td>${formatearAccion('Delimitar zonas correctamente')}</td>
        </tr>
        <tr class="${inspeccion.cuadros_electricos_ok === false ? 'fila-requiere-accion' : ''}">
          <td>¿Los cuadros eléctricos están cerrados y sin roturas?</td>
          <td class="celda-centro">${siNo(inspeccion.cuadros_electricos_ok, true)}</td>
          <td class="celda-flecha">➜</td>
          <td>${formatearAccion('Cerrar/reparar cuadros eléctricos')}</td>
        </tr>
        <tr class="${inspeccion.aire_comprimido_ok === false ? 'fila-requiere-accion' : ''}">
          <td>¿Las tomas de aire comprimido están en buen estado?</td>
          <td class="celda-centro">${siNo(inspeccion.aire_comprimido_ok, true)}</td>
          <td class="celda-flecha">➜</td>
          <td>${formatearAccion('Reparar tomas de aire comprimido')}</td>
        </tr>
      </tbody>
    </table>

    <!-- PIE DE PÁGINA -->
    <div class="hoja-footer">
      <div class="firma-seccion">
        <div class="firma-linea"></div>
        <div class="firma-label">Firma responsable limpieza</div>
      </div>
      <div class="hoja-fecha-impresion">
        Generado: ${new Date().toLocaleDateString('es-ES')} | Auditoría #${auditoria.id}
      </div>
    </div>
  `;
}

// Inicializar modales
function initializeModals() {
  // Modal de eliminar
  const modalEliminar = document.getElementById('modal-eliminar');
  if (modalEliminar) {
    const closeEliminar = modalEliminar.querySelector('.modal-close');
    const btnConfirmar = document.getElementById('btn-confirmar-eliminar');
    const btnCancelar = document.getElementById('btn-cancelar-eliminar');

    if (closeEliminar) {
      closeEliminar.addEventListener('click', () => {
        modalEliminar.classList.remove('show');
        auditoriaAEliminar = null;
      });
    }

    if (btnCancelar) {
      btnCancelar.addEventListener('click', () => {
        modalEliminar.classList.remove('show');
        auditoriaAEliminar = null;
      });
    }

    if (btnConfirmar) {
      btnConfirmar.addEventListener('click', eliminarAuditoria);
    }

    modalEliminar.addEventListener('click', (e) => {
      if (e.target === modalEliminar) {
        modalEliminar.classList.remove('show');
        auditoriaAEliminar = null;
      }
    });
  }

  // Modal de detalles
  const modalDetalles = document.getElementById('modal-detalles');
  if (modalDetalles) {
    const closeDetalles = modalDetalles.querySelector('.modal-close');

    if (closeDetalles) {
      closeDetalles.addEventListener('click', cerrarModalDetalles);
    }

    modalDetalles.addEventListener('click', (e) => {
      if (e.target === modalDetalles) {
        cerrarModalDetalles();
      }
    });
  }
}

// Eliminar auditoría (requiere autenticación)
async function eliminarAuditoria() {
  if (!auditoriaAEliminar) return;

  // Si no hay credenciales, mostrar login
  if (!adminCredentials) {
    mostrarModalLogin();
    return;
  }

  // Mostrar modal de confirmación si viene del login
  if (!document.getElementById('modal-eliminar').classList.contains('show')) {
    document.getElementById('modal-eliminar').classList.add('show');
    return;
  }

  try {
    const response = await fetch(`/api/auditorias/${auditoriaAEliminar}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Basic ${adminCredentials}`
      }
    });

    if (response.ok) {
      document.getElementById('modal-eliminar').classList.remove('show');
      auditoriaAEliminar = null;

      // Recargar datos
      await cargarAuditorias();
      await cargarEstadisticas();
    } else {
      const result = await response.json();
      if (result.needsAuth) {
        adminCredentials = null;
        mostrarModalLogin();
      } else {
        alert(`Error al eliminar: ${result.error}`);
      }
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error de conexión al eliminar.');
  }
}

// Cerrar modal de detalles
function cerrarModalDetalles() {
  document.getElementById('modal-detalles').classList.remove('show');
}

// ==================== AUTENTICACIÓN ADMIN ====================

// Mostrar modal de login
function mostrarModalLogin() {
  document.getElementById('modal-login').classList.add('show');
  document.getElementById('login-usuario').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').style.display = 'none';
}

// Cerrar modal de login
function cerrarModalLogin() {
  document.getElementById('modal-login').classList.remove('show');
}

// Realizar login
async function realizarLogin() {
  const usuario = document.getElementById('login-usuario').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');

  if (!usuario || !password) {
    errorEl.textContent = 'Por favor, rellena todos los campos.';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usuario, password: password })
    });

    const result = await response.json();

    if (result.success) {
      adminCredentials = btoa(`${usuario}:${password}`);
      cerrarModalLogin();

      // Si había una acción pendiente, ejecutarla
      if (auditoriaAEliminar) {
        eliminarAuditoria();
      }
    } else {
      errorEl.textContent = 'Credenciales incorrectas.';
      errorEl.style.display = 'block';
    }
  } catch (error) {
    errorEl.textContent = 'Error de conexión.';
    errorEl.style.display = 'block';
  }
}

// Verificar si está autenticado antes de eliminar
function confirmarEliminar(id) {
  auditoriaAEliminar = id;

  if (!adminCredentials) {
    mostrarModalLogin();
  } else {
    document.getElementById('modal-eliminar').classList.add('show');
  }
}

// Redirigir al formulario en modo edición
function modificarAuditoria(id) {
  window.location.href = `/?editar=${id}`;
}

// ==================== HOJA TALLER ELÉCTRICO ====================

// Preguntas variables por puesto (duplicado del frontend para la hoja imprimible)
const PREGUNTAS_POR_PUESTO_HIST = {
  'Puesto de Montaje 1': {
    p10: '¿Están colocados los indicadores de los armarios?',
    p12: '¿Están indicados los lugares donde se pueden producir accidentes?',
    p13: '¿Están ordenados los materiales en la playa exterior?'
  },
  'Puesto de Montaje 2': {
    p10: '¿Están colocados los indicadores de los armarios?',
    p12: '¿Están indicados los lugares donde se pueden producir accidentes?',
    p13: '¿Están ordenados los materiales en la playa exterior?'
  },
  'Puesto de Preparación de Cables 1': {
    p10: '¿Hay signos visuales para control máximo y mínimo de stock?',
    p12: '¿Los cables están bien identificados?',
    p13: '¿Se han vaciado los residuos de cables?'
  },
  'Puesto de Preparación de Cables 2': {
    p10: '¿Hay signos visuales para control máximo y mínimo de stock?',
    p12: '¿Los cables están bien identificados?',
    p13: '¿Se han vaciado los residuos de cables?'
  },
  'Cableado Intermodular': {
    p10: '¿Están completas las herramientas?',
    p12: '¿Están indicados los lugares donde se pueden producir accidentes?',
    p13: '¿Están preparados los materiales para la siguiente tarea?'
  },
  'Puesto de Canaleta': {
    p10: '¿Hay signos visuales para control máximo y mínimo de stock?',
    p12: '¿Están indicados los lugares donde se pueden producir accidentes?',
    p13: '¿Se han depositado los recortes en su contenedor?'
  },
  'Mecanizado de Tapas': {
    p10: '¿Hay signos visuales para control máximo y mínimo de stock?',
    p12: '¿Están indicados los lugares donde se pueden producir accidentes?',
    p13: '¿Quedan recortes fuera de los lugares correspondientes?'
  },
  'Puesto de Cajas Pequeñas': {
    p10: '¿Hay signos visuales para control máximo y mínimo de stock?',
    p12: '¿Están indicados los lugares donde se pueden producir accidentes?',
    p13: '¿Quedan recortes fuera de los lugares correspondientes?'
  }
};

function generarHojaTallerElectrico(auditoria) {
  const te = auditoria.taller_electrico || {};
  const preguntas = PREGUNTAS_POR_PUESTO_HIST[auditoria.puesto] || {
    p10: '¿Hay signos visuales para control máximo y mínimo de stock?',
    p12: '¿Están indicados los lugares donde se pueden producir accidentes?',
    p13: '(Seleccionar puesto para ver pregunta)'
  };

  const siNo = (valor, invertir = false) => {
    if (valor === null || valor === undefined) {
      return '<span class="respuesta-valor valor-na">NA</span>';
    }
    const hayProblema = invertir ? !valor : valor;
    const texto = valor ? 'SI' : 'NO';
    const clase = hayProblema ? 'valor-problema' : 'valor-ok';
    return '<span class="respuesta-valor ' + clase + '">' + texto + '</span>';
  };

  const filaTE = (pregunta, campo, invertir = false) => {
    const valor = te[campo];
    const detalle = te[campo + '_detalle'] || '';
    const hayProblema = valor !== null && valor !== undefined && (invertir ? !valor : valor);
    return `
      <tr class="${hayProblema ? 'fila-requiere-accion' : ''}">
        <td>${pregunta}</td>
        <td class="celda-centro">${siNo(valor, invertir)}</td>
        <td>${detalle}</td>
      </tr>
    `;
  };

  return `
    <div class="hoja-header">
      <div class="hoja-logo">AUDITORÍA 5S GHI</div>
      <div class="hoja-info">
        <div class="hoja-titulo">Auditoría Taller Eléctrico</div>
        <div class="hoja-subtitulo">${auditoria.puesto}</div>
      </div>
      <div class="hoja-empresa">
        <strong>GHI Smart Furnaces</strong><br>
        Barrio de Aperribai, 4<br>
        48960 Galdakao
      </div>
    </div>

    <div class="hoja-datos-generales">
      <div class="dato-general">
        <span class="dato-label">Fecha:</span>
        <span class="dato-valor">${formatearFecha(auditoria.fecha)}</span>
      </div>
      <div class="dato-general">
        <span class="dato-label">Parcela:</span>
        <span class="dato-valor dato-parcela">Taller Eléctrico</span>
      </div>
      <div class="dato-general">
        <span class="dato-label">Puesto:</span>
        <span class="dato-valor dato-parcela">${auditoria.puesto}</span>
      </div>
      <div class="dato-general">
        <span class="dato-label">Auditor:</span>
        <span class="dato-valor">${auditoria.auditor || '-'}</span>
      </div>
    </div>

    <!-- A: ORGANIZACIÓN -->
    <table class="hoja-tabla">
      <thead>
        <tr><th class="hoja-header-seccion" colspan="3">A - ORGANIZACIÓN</th></tr>
        <tr class="hoja-subheader">
          <th width="55%">Pregunta</th>
          <th width="10%">Resultado</th>
          <th width="35%">Detalle</th>
        </tr>
      </thead>
      <tbody>
        ${filaTE('1. ¿Vuelven a proliferar cosas innecesarias en el puesto?', 'org_innecesarios')}
        ${filaTE('2. ¿Se cumplen los procedimientos?', 'org_procedimientos', true)}
        ${filaTE('3. ¿Están en buen estado los signos de identificación?', 'org_identificacion', true)}
      </tbody>
    </table>

    <!-- B: ORDEN -->
    <table class="hoja-tabla">
      <thead>
        <tr><th class="hoja-header-seccion" colspan="3">B - ORDEN</th></tr>
        <tr class="hoja-subheader">
          <th width="55%">Pregunta</th>
          <th width="10%">Resultado</th>
          <th width="35%">Detalle</th>
        </tr>
      </thead>
      <tbody>
        ${filaTE('4. ¿Hay cosas fuera de los lugares marcados?', 'ord_fuera_lugar')}
        ${filaTE('5. ¿Hay elementos colocados sobre el suelo?', 'ord_suelo')}
        ${filaTE('6. ¿Las herramientas están identificadas a nivel micro?', 'ord_herramientas_id', true)}
      </tbody>
    </table>

    <!-- C: LIMPIEZA -->
    <table class="hoja-tabla">
      <thead>
        <tr><th class="hoja-header-seccion" colspan="3">C - LIMPIEZA</th></tr>
        <tr class="hoja-subheader">
          <th width="55%">Pregunta</th>
          <th width="10%">Resultado</th>
          <th width="35%">Detalle</th>
        </tr>
      </thead>
      <tbody>
        ${filaTE('7. ¿Están limpios los puestos de trabajo?', 'lim_puestos_limpios', true)}
        ${filaTE('8. ¿Hay útiles de limpieza en los lugares definidos?', 'lim_utiles', true)}
        ${filaTE('9. ¿Se cumplen los procedimientos de limpieza?', 'lim_procedimientos', true)}
      </tbody>
    </table>

    <!-- D: CONTROL VISUAL -->
    <table class="hoja-tabla">
      <thead>
        <tr><th class="hoja-header-seccion" colspan="3">D - CONTROL VISUAL</th></tr>
        <tr class="hoja-subheader">
          <th width="55%">Pregunta</th>
          <th width="10%">Resultado</th>
          <th width="35%">Detalle</th>
        </tr>
      </thead>
      <tbody>
        ${filaTE('10. ' + preguntas.p10, 'cv_pregunta10', true)}
        ${filaTE('11. ¿Hay planes de reacción ante anomalías en los puestos?', 'cv_anomalias', true)}
        ${filaTE('12. ' + preguntas.p12, 'cv_pregunta12', true)}
      </tbody>
    </table>

    <!-- E: DISCIPLINA Y HÁBITO -->
    <table class="hoja-tabla">
      <thead>
        <tr><th class="hoja-header-seccion" colspan="3">E - DISCIPLINA Y HÁBITO</th></tr>
        <tr class="hoja-subheader">
          <th width="55%">Pregunta</th>
          <th width="10%">Resultado</th>
          <th width="35%">Detalle</th>
        </tr>
      </thead>
      <tbody>
        ${filaTE('13. ' + preguntas.p13, 'disc_pregunta13', true)}
        ${filaTE('14. ¿Se cumple el plan de paseos?', 'disc_paseos', true)}
        ${filaTE('15. ¿Se ejecutan las acciones correctivas en plazo?', 'disc_acciones_plazo', true)}
      </tbody>
    </table>

    <div class="hoja-footer">
      <div class="firma-seccion">
        <div class="firma-linea"></div>
        <div class="firma-label">Firma responsable</div>
      </div>
      <div class="hoja-fecha-impresion">
        Generado: ${new Date().toLocaleDateString('es-ES')} | Auditoría #${auditoria.id}
      </div>
    </div>
  `;
}
