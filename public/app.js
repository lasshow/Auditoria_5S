// ==================== APLICACIÓN DE AUDITORÍA 5S GHI ====================
// Refactorizado para cumplir con principios DRY

// Cargar tema guardado inmediatamente para evitar flash
(function() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
  }
})();

document.addEventListener('DOMContentLoaded', async () => {
  await cargarPersonalizados();

  initializeThemeToggle();
  initializeDateField();
  initializeMapInteraction();
  initializeFormHandlers();
  initializeModalHandlers();

  // Inicializar todos los desgloses usando el sistema genérico
  DesgloseManager.initAll();
});

// ==================== CONFIGURACIÓN DE TIPOS Y ACCIONES ====================

// Tipos de innecesarios disponibles (base)
const TIPOS_INNECESARIOS_BASE = [
  'Botes de pintura', 'Palets', 'Herramienta', 'Basura', 'Material de embalaje',
  'Piezas sueltas', 'Cables/Mangueras', 'EPIs', 'Documentación', 'Químicos',
  'Aceites', 'Bidones', 'Restos metálicos'
];

// Acciones posibles (base)
const ACCIONES_INNECESARIOS_BASE = [
  'Tirar a la basura', 'Ordenar en balda de proyecto', 'Preguntar a Superior',
  'Llevar a almacén', 'Reciclar', 'Devolver a proveedor', 'Reubicar en otra parcela',
  'Etiquetar para revisión', 'Documentar y almacenar', 'Llevar a punto limpio'
];

// Tipos para sección ORDEN (base)
const TIPOS_ORDEN_BASE = {
  herramienta: ['Llave fija', 'Llave inglesa', 'Destornillador', 'Martillo', 'Alicates',
    'Flexómetro', 'Nivel', 'Sierra', 'Taladro manual', 'Llaves Allen', 'Llaves Torx', 'Gato hidráulico'],
  eslingas: ['Eslinga textil', 'Eslinga de cadena', 'Cadena', 'Grillete', 'Gancho', 'Tensor', 'Cáncamo'],
  maquinas: ['Máquina de soldar', 'Máquina de flushing', 'Taladro magnético', 'Máquina apriete control par',
    'Pantalla de soldadura', 'Enano de horno', 'Radial/Amoladora', 'Compresor portátil'],
  ropa: ['Casco', 'Gafas de seguridad', 'Guantes', 'Botas de seguridad', 'Chaleco reflectante',
    'Ropa de trabajo', 'Protector auditivo', 'Mascarilla', 'Arnés'],
  lugar: ['Herramienta sin ubicación', 'Material sin balda', 'Equipo sin zona asignada',
    'Documentación sin archivador', 'EPI sin percha', 'Repuesto sin estante', 'Consumible sin almacén', 'Otro elemento sin lugar']
};

// Acciones para sección ORDEN (base)
const ACCIONES_ORDEN_BASE = {
  herramienta: ['Recoger y llevar a su ubicación', 'Inspeccionar y reparar', 'Desechar (deteriorada)', 'Etiquetar para revisión', 'Preguntar a Superior'],
  eslingas: ['Recoger y colgar en percha', 'Inspeccionar visualmente', 'Retirar de servicio (defectuosa)', 'Etiquetar para revisión', 'Llevar a mantenimiento'],
  maquinas: ['Recoger y llevar a su ubicación', 'Inspeccionar funcionamiento', 'Llevar a mantenimiento', 'Etiquetar para revisión', 'Preguntar a Superior'],
  ropa: ['Identificar propietario', 'Colocar en perchero temporal', 'Tirar (sin identificar tras 1 semana)', 'Lavar y guardar', 'Desechar (deteriorado)'],
  lugar: ['Crear ubicación en panel', 'Asignar balda en estantería', 'Crear zona específica', 'Solicitar armario/archivador', 'Instalar percha/gancho', 'Solicitar a mantenimiento', 'Preguntar a Superior']
};

// Tipos para sección LIMPIEZA
const TIPOS_LIMPIEZA_BASE = {
  suciedad: ['Polvo', 'Basura general', 'Virutas metálicas', 'Restos de soldadura', 'Manchas de aceite', 'Suciedad acumulada', 'Restos de pintura', 'Otro tipo de suciedad'],
  residuos: ['Pallets', 'Restos de embalaje', 'Aceites usados', 'Bidones vacíos', 'Botes de pintura', 'Cartón', 'Plásticos', 'Chatarra', 'Cables/Mangueras', 'Otro residuo']
};

// Acciones para sección LIMPIEZA
const ACCIONES_LIMPIEZA_BASE = {
  suciedad: ['Barrer zona', 'Aspirar', 'Fregar suelo', 'Limpiar con desengrasante', 'Recoger manualmente', 'Solicitar limpieza industrial'],
  residuos: ['Llevar a contenedor apropiado', 'Llevar a punto limpio', 'Almacenar en zona de residuos', 'Llevar a almacén de aceites', 'Reciclar', 'Gestionar con PRL', 'Solicitar recogida especial']
};

// Tipos para sección INSPECCIÓN
const TIPOS_INSPECCION_BASE = {
  gas: ['Salida de gas zona 1', 'Salida de gas zona 2', 'Salida de gas zona 3', 'Válvula principal', 'Conexión de equipo', 'Otra salida de gas'],
  carteles: ['Riesgo eléctrico', 'Riesgo de caída', 'Riesgo de atrapamiento', 'Riesgo químico', 'Riesgo de incendio', 'Uso obligatorio EPI', 'Zona de paso restringido', 'Otro riesgo'],
  zonas: ['Zona de trabajo principal', 'Zona de almacenamiento', 'Zona de paso peatonal', 'Zona de carga/descarga', 'Zona de emergencia', 'Otra zona'],
  electricos: ['Cuadro abierto', 'Cuadro con rotura', 'Cables expuestos', 'Falta de señalización', 'Humedad en cuadro', 'Otro problema eléctrico'],
  aire: ['Fuga de aire', 'Conexión dañada', 'Manguera en mal estado', 'Válvula defectuosa', 'Filtro sucio', 'Otro problema']
};

// Acciones para sección INSPECCIÓN
const ACCIONES_INSPECCION_BASE = {
  gas: ['Precintar inmediatamente', 'Avisar a mantenimiento', 'Cerrar válvula', 'Solicitar revisión', 'Preguntar a Superior'],
  carteles: ['Solicitar cartel a Naroa', 'Instalar cartel temporal', 'Señalizar zona', 'Avisar a PRL', 'Preguntar a Superior'],
  zonas: ['Pintar líneas de delimitación', 'Colocar cintas/barreras', 'Solicitar pintado a mantenimiento', 'Instalar señalización', 'Preguntar a Superior'],
  electricos: ['Cerrar cuadro', 'Avisar a electricista', 'Solicitar reparación', 'Señalizar peligro', 'Cortar suministro', 'Preguntar a Superior'],
  aire: ['Reparar conexión', 'Cambiar manguera', 'Avisar a mantenimiento', 'Sustituir válvula', 'Limpiar/cambiar filtro', 'Preguntar a Superior']
};

// ==================== LISTAS DINÁMICAS (con personalizados) ====================

let TIPOS_INNECESARIOS = ['Seleccionar tipo...', ...TIPOS_INNECESARIOS_BASE];
let ACCIONES_INNECESARIOS = ['Seleccionar acción...', ...ACCIONES_INNECESARIOS_BASE];

let TIPOS_ORDEN = {};
let ACCIONES_ORDEN = {};
let TIPOS_LIMPIEZA = {};
let ACCIONES_LIMPIEZA = {};
let TIPOS_INSPECCION = {};
let ACCIONES_INSPECCION = {};

// Inicializar listas con "Seleccionar..."
function initLists() {
  Object.keys(TIPOS_ORDEN_BASE).forEach(cat => {
    TIPOS_ORDEN[cat] = ['Seleccionar tipo...', ...TIPOS_ORDEN_BASE[cat]];
  });
  Object.keys(ACCIONES_ORDEN_BASE).forEach(cat => {
    ACCIONES_ORDEN[cat] = ['Seleccionar acción...', ...ACCIONES_ORDEN_BASE[cat]];
  });
  Object.keys(TIPOS_LIMPIEZA_BASE).forEach(cat => {
    TIPOS_LIMPIEZA[cat] = ['Seleccionar tipo...', ...TIPOS_LIMPIEZA_BASE[cat]];
  });
  Object.keys(ACCIONES_LIMPIEZA_BASE).forEach(cat => {
    ACCIONES_LIMPIEZA[cat] = ['Seleccionar acción...', ...ACCIONES_LIMPIEZA_BASE[cat]];
  });
  Object.keys(TIPOS_INSPECCION_BASE).forEach(cat => {
    TIPOS_INSPECCION[cat] = ['Seleccionar ' + getPlaceholderForCategory(cat) + '...', ...TIPOS_INSPECCION_BASE[cat]];
  });
  Object.keys(ACCIONES_INSPECCION_BASE).forEach(cat => {
    ACCIONES_INSPECCION[cat] = ['Seleccionar acción...', ...ACCIONES_INSPECCION_BASE[cat]];
  });
}

function getPlaceholderForCategory(cat) {
  const placeholders = {
    gas: 'ubicación', carteles: 'riesgo', zonas: 'zona', electricos: 'problema', aire: 'problema'
  };
  return placeholders[cat] || 'tipo';
}

initLists();

// ==================== GESTOR GENÉRICO DE DESGLOSES (DRY) ====================

const DesgloseManager = {
  // Configuración de cada sección
  configs: {
    // Sección INNECESARIOS
    innecesarios: {
      categorias: ['desconocidos', 'nofullkit'],
      getTipos: () => TIPOS_INNECESARIOS,
      getAcciones: () => ACCIONES_INNECESARIOS,
      contadores: { desconocidos: 0, nofullkit: 0 },
      prefijo: 'innecesario',
      selectClass: 'select-tipo',
      accionClass: 'select-accion',
      tipoField: 'tipo_innecesario',
      categoriaApi: 'innecesarios',
      addToList: (valor) => {
        if (!TIPOS_INNECESARIOS.includes(valor)) TIPOS_INNECESARIOS.push(valor);
      },
      addAccionToList: (valor) => {
        if (!ACCIONES_INNECESARIOS.includes(valor)) ACCIONES_INNECESARIOS.push(valor);
      }
    },
    // Sección ORDEN
    orden: {
      categorias: ['herramienta', 'eslingas', 'maquinas', 'ropa', 'lugar'],
      getTipos: (cat) => TIPOS_ORDEN[cat] || [],
      getAcciones: (cat) => ACCIONES_ORDEN[cat] || [],
      contadores: { herramienta: 0, eslingas: 0, maquinas: 0, ropa: 0, lugar: 0 },
      prefijo: '',
      selectClass: 'select-tipo-orden',
      accionClass: 'select-accion-orden',
      tipoField: 'tipo_elemento',
      categoriaApi: (cat) => cat,
      addToList: (cat, valor) => {
        if (!TIPOS_ORDEN[cat].includes(valor)) TIPOS_ORDEN[cat].push(valor);
      },
      addAccionToList: (cat, valor) => {
        if (!ACCIONES_ORDEN[cat].includes(valor)) ACCIONES_ORDEN[cat].push(valor);
      },
      triggerSelector: '.select-orden-trigger'
    },
    // Sección LIMPIEZA
    limpieza: {
      categorias: ['suciedad', 'residuos'],
      getTipos: (cat) => TIPOS_LIMPIEZA[cat] || [],
      getAcciones: (cat) => ACCIONES_LIMPIEZA[cat] || [],
      contadores: { suciedad: 0, residuos: 0 },
      prefijo: 'limpieza',
      selectClass: 'select-tipo-limpieza',
      accionClass: 'select-accion-limpieza',
      tipoField: 'tipo_elemento',
      categoriaApi: (cat) => `limpieza_${cat}`,
      addToList: (cat, valor) => {
        if (!TIPOS_LIMPIEZA[cat].includes(valor)) TIPOS_LIMPIEZA[cat].push(valor);
      },
      addAccionToList: (cat, valor) => {
        if (!ACCIONES_LIMPIEZA[cat].includes(valor)) ACCIONES_LIMPIEZA[cat].push(valor);
      },
      triggerSelector: '.select-limpieza-trigger'
    },
    // Sección INSPECCIÓN
    inspeccion: {
      categorias: ['gas', 'carteles', 'zonas', 'electricos', 'aire'],
      getTipos: (cat) => TIPOS_INSPECCION[cat] || [],
      getAcciones: (cat) => ACCIONES_INSPECCION[cat] || [],
      contadores: { gas: 0, carteles: 0, zonas: 0, electricos: 0, aire: 0 },
      prefijo: 'inspeccion',
      selectClass: 'select-tipo-inspeccion',
      accionClass: 'select-accion-inspeccion',
      tipoField: 'tipo_elemento',
      categoriaApi: (cat) => `inspeccion_${cat}`,
      addToList: (cat, valor) => {
        if (!TIPOS_INSPECCION[cat].includes(valor)) TIPOS_INSPECCION[cat].push(valor);
      },
      addAccionToList: (cat, valor) => {
        if (!ACCIONES_INSPECCION[cat].includes(valor)) ACCIONES_INSPECCION[cat].push(valor);
      },
      triggerSelector: '.select-inspeccion-trigger'
    }
  },

  // Inicializar todos los desgloses
  initAll() {
    this.initTriggers('orden');
    this.initTriggers('limpieza');
    this.initTriggers('inspeccion');
  },

  // Inicializar triggers para mostrar/ocultar desgloses
  initTriggers(seccion) {
    const config = this.configs[seccion];
    if (!config.triggerSelector) return;

    const selects = document.querySelectorAll(config.triggerSelector);
    selects.forEach(select => {
      select.addEventListener('change', (e) => {
        const categoria = e.target.dataset[seccion] || e.target.dataset.orden || e.target.dataset.limpieza || e.target.dataset.inspeccion;
        const invertir = e.target.dataset.invertir === 'true';
        const valor = e.target.value;
        const mostrar = invertir ? (valor === 'no') : (valor === 'si');

        if (mostrar) {
          this.mostrar(seccion, categoria);
        } else {
          this.ocultar(seccion, categoria);
        }
      });
    });
  },

  // Mostrar desglose
  mostrar(seccion, categoria) {
    const row = document.getElementById(`desglose-${categoria}-row`);
    const config = this.configs[seccion];
    if (row) {
      row.style.display = '';
      if (config.contadores[categoria] === 0) {
        this.agregarLinea(seccion, categoria);
      }
    }
  },

  // Ocultar desglose
  ocultar(seccion, categoria) {
    const config = this.configs[seccion];
    const row = document.getElementById(`desglose-${categoria}-row`);
    const desgloseContainer = document.getElementById(`desglose-${categoria}`);
    const accionesContainer = document.getElementById(`acciones-${categoria}`);

    if (row) row.style.display = 'none';
    if (desgloseContainer) desgloseContainer.innerHTML = '';
    if (accionesContainer) accionesContainer.innerHTML = '';
    config.contadores[categoria] = 0;
  },

  // Agregar línea genérica
  agregarLinea(seccion, categoria) {
    const config = this.configs[seccion];
    config.contadores[categoria]++;
    const lineaNum = config.contadores[categoria];

    const desgloseRow = document.getElementById(`desglose-${categoria}-row`);
    const desgloseContainer = document.getElementById(`desglose-${categoria}`);
    const accionesContainer = document.getElementById(`acciones-${categoria}`);

    if (!desgloseContainer || !accionesContainer) return;

    // Mostrar la fila
    if (desgloseRow) desgloseRow.style.display = '';

    // Obtener tipos y acciones según la sección
    const tipos = typeof config.getTipos === 'function'
      ? (seccion === 'innecesarios' ? config.getTipos() : config.getTipos(categoria))
      : [];
    const acciones = typeof config.getAcciones === 'function'
      ? (seccion === 'innecesarios' ? config.getAcciones() : config.getAcciones(categoria))
      : [];

    // Crear IDs únicos según la sección
    const prefijo = config.prefijo ? `${config.prefijo}-` : '';
    const tipoId = seccion === 'innecesarios'
      ? `tipo-${categoria}-${lineaNum}`
      : `tipo-${prefijo}${categoria}-${lineaNum}`;
    const lineaId = seccion === 'innecesarios'
      ? `linea-innecesario-${categoria}-${lineaNum}`
      : `linea-${prefijo}${categoria}-${lineaNum}`;

    // Crear línea de tipo
    const lineaTipo = document.createElement('div');
    lineaTipo.className = 'desglose-linea';
    lineaTipo.id = lineaId;
    lineaTipo.innerHTML = `
      <span class="linea-numero">${lineaNum}.</span>
      <select id="${tipoId}" class="${config.selectClass}" data-categoria="${categoria}" data-linea="${lineaNum}" data-seccion="${seccion}">
        ${tipos.map((t, idx) => `<option value="${idx === 0 ? '' : t}">${t}</option>`).join('')}
        <option value="__nuevo__">+ Añadir nuevo tipo...</option>
      </select>
      <input type="text" id="nuevo-tipo-${prefijo}${categoria}-${lineaNum}" class="input-nuevo-tipo" placeholder="Escribir nuevo tipo..." style="display:none;">
      <button type="button" id="btn-guardar-tipo-${prefijo}${categoria}-${lineaNum}" class="btn-guardar-nuevo" style="display:none;" onclick="DesgloseManager.confirmarNuevoTipo('${seccion}', '${categoria}', ${lineaNum})">✓</button>
      <button type="button" class="btn-remove-line" onclick="DesgloseManager.eliminarLinea('${seccion}', '${categoria}', ${lineaNum})">✕</button>
    `;
    desgloseContainer.appendChild(lineaTipo);

    // Crear línea de acción
    const accionId = seccion === 'innecesarios'
      ? `accion-${categoria}-${lineaNum}`
      : `accion-${prefijo}${categoria}-${lineaNum}`;
    const accionLineaId = seccion === 'innecesarios'
      ? `accion-linea-${categoria}-${lineaNum}`
      : `accion-linea-${prefijo}${categoria}-${lineaNum}`;
    const tipoMostradoId = seccion === 'innecesarios'
      ? `tipo-mostrado-${categoria}-${lineaNum}`
      : `tipo-mostrado-${prefijo}${categoria}-${lineaNum}`;

    const lineaAccion = document.createElement('div');
    lineaAccion.className = 'accion-linea';
    lineaAccion.id = accionLineaId;
    lineaAccion.innerHTML = `
      <span class="tipo-mostrado" id="${tipoMostradoId}">Sin seleccionar</span>
      <select id="${accionId}" class="${config.accionClass}" data-categoria="${categoria}" data-linea="${lineaNum}" data-seccion="${seccion}">
        ${acciones.map((a, idx) => `<option value="${idx === 0 ? '' : a}">${a}</option>`).join('')}
        <option value="__nuevo__">+ Añadir nueva acción...</option>
      </select>
      <input type="text" id="nueva-accion-${prefijo}${categoria}-${lineaNum}" class="input-nueva-accion" placeholder="Escribir nueva acción..." style="display:none;">
      <button type="button" id="btn-guardar-accion-${prefijo}${categoria}-${lineaNum}" class="btn-guardar-nuevo" style="display:none;" onclick="DesgloseManager.confirmarNuevaAccion('${seccion}', '${categoria}', ${lineaNum})">✓</button>
    `;
    accionesContainer.appendChild(lineaAccion);

    // Añadir event listeners
    this.addSelectListeners(seccion, categoria, lineaNum);

    // Actualizar contador si es innecesarios
    if (seccion === 'innecesarios') {
      this.actualizarContador(categoria);
    }
  },

  // Añadir listeners a los selects
  addSelectListeners(seccion, categoria, lineaNum) {
    const config = this.configs[seccion];
    const prefijo = config.prefijo ? `${config.prefijo}-` : '';

    const tipoId = seccion === 'innecesarios'
      ? `tipo-${categoria}-${lineaNum}`
      : `tipo-${prefijo}${categoria}-${lineaNum}`;
    const accionId = seccion === 'innecesarios'
      ? `accion-${categoria}-${lineaNum}`
      : `accion-${prefijo}${categoria}-${lineaNum}`;
    const tipoMostradoId = seccion === 'innecesarios'
      ? `tipo-mostrado-${categoria}-${lineaNum}`
      : `tipo-mostrado-${prefijo}${categoria}-${lineaNum}`;

    const selectTipo = document.getElementById(tipoId);
    const selectAccion = document.getElementById(accionId);

    if (selectTipo) {
      selectTipo.addEventListener('change', (e) => {
        const inputNuevo = document.getElementById(`nuevo-tipo-${prefijo}${categoria}-${lineaNum}`);
        const btnGuardar = document.getElementById(`btn-guardar-tipo-${prefijo}${categoria}-${lineaNum}`);
        const tipoMostrado = document.getElementById(tipoMostradoId);

        if (e.target.value === '__nuevo__') {
          inputNuevo.style.display = 'inline-block';
          btnGuardar.style.display = 'inline-block';
          inputNuevo.focus();
        } else {
          inputNuevo.style.display = 'none';
          btnGuardar.style.display = 'none';
          if (tipoMostrado) tipoMostrado.textContent = e.target.value || 'Sin seleccionar';
        }
      });
    }

    if (selectAccion) {
      selectAccion.addEventListener('change', (e) => {
        const inputNuevo = document.getElementById(`nueva-accion-${prefijo}${categoria}-${lineaNum}`);
        const btnGuardar = document.getElementById(`btn-guardar-accion-${prefijo}${categoria}-${lineaNum}`);

        if (e.target.value === '__nuevo__') {
          inputNuevo.style.display = 'inline-block';
          btnGuardar.style.display = 'inline-block';
          inputNuevo.focus();
        } else {
          inputNuevo.style.display = 'none';
          btnGuardar.style.display = 'none';
        }
      });
    }
  },

  // Eliminar línea genérica
  eliminarLinea(seccion, categoria, lineaNum) {
    const config = this.configs[seccion];
    const prefijo = config.prefijo ? `${config.prefijo}-` : '';

    const lineaId = seccion === 'innecesarios'
      ? `linea-innecesario-${categoria}-${lineaNum}`
      : `linea-${prefijo}${categoria}-${lineaNum}`;
    const accionLineaId = seccion === 'innecesarios'
      ? `accion-linea-${categoria}-${lineaNum}`
      : `accion-linea-${prefijo}${categoria}-${lineaNum}`;

    const lineaTipo = document.getElementById(lineaId);
    const lineaAccion = document.getElementById(accionLineaId);

    if (lineaTipo) lineaTipo.remove();
    if (lineaAccion) lineaAccion.remove();

    this.renumerarLineas(seccion, categoria);

    if (seccion === 'innecesarios') {
      this.actualizarContador(categoria);
    }
  },

  // Renumerar líneas
  renumerarLineas(seccion, categoria) {
    const desgloseContainer = document.getElementById(`desglose-${categoria}`);
    if (!desgloseContainer) return;

    const lineas = desgloseContainer.querySelectorAll('.desglose-linea');
    lineas.forEach((linea, index) => {
      const numSpan = linea.querySelector('.linea-numero');
      if (numSpan) numSpan.textContent = `${index + 1}.`;
    });
  },

  // Actualizar contador (para innecesarios)
  actualizarContador(categoria) {
    const desgloseContainer = document.getElementById(`desglose-${categoria}`);
    const desgloseRow = document.getElementById(`desglose-${categoria}-row`);
    const contador = document.getElementById(`contador-${categoria}`);

    const cantidad = desgloseContainer ? desgloseContainer.querySelectorAll('.desglose-linea').length : 0;

    if (contador) contador.textContent = cantidad;

    if (desgloseRow) {
      desgloseRow.style.display = cantidad > 0 ? '' : 'none';
    }
  },

  // Confirmar nuevo tipo
  async confirmarNuevoTipo(seccion, categoria, linea) {
    const config = this.configs[seccion];
    const prefijo = config.prefijo ? `${config.prefijo}-` : '';

    const input = document.getElementById(`nuevo-tipo-${prefijo}${categoria}-${linea}`);
    const tipoId = seccion === 'innecesarios'
      ? `tipo-${categoria}-${linea}`
      : `tipo-${prefijo}${categoria}-${linea}`;
    const select = document.getElementById(tipoId);
    const nuevoValor = input.value.trim();

    if (!nuevoValor) {
      alert('Por favor, escribe un nombre para el nuevo tipo.');
      return;
    }

    // Añadir a la lista local
    if (seccion === 'innecesarios') {
      config.addToList(nuevoValor);
    } else {
      config.addToList(categoria, nuevoValor);
    }

    // Guardar en la base de datos
    const categoriaApi = typeof config.categoriaApi === 'function'
      ? config.categoriaApi(categoria)
      : config.categoriaApi;
    await guardarTipoPersonalizado(categoriaApi, nuevoValor);

    // Actualizar el select
    const newOption = document.createElement('option');
    newOption.value = nuevoValor;
    newOption.textContent = nuevoValor;
    select.insertBefore(newOption, select.querySelector('option[value="__nuevo__"]'));
    select.value = nuevoValor;

    // Ocultar input
    input.style.display = 'none';
    document.getElementById(`btn-guardar-tipo-${prefijo}${categoria}-${linea}`).style.display = 'none';

    const tipoMostradoId = seccion === 'innecesarios'
      ? `tipo-mostrado-${categoria}-${linea}`
      : `tipo-mostrado-${prefijo}${categoria}-${linea}`;
    const tipoMostrado = document.getElementById(tipoMostradoId);
    if (tipoMostrado) tipoMostrado.textContent = nuevoValor;

    input.value = '';

    // Actualizar otros selects
    this.actualizarSelectsTipo(seccion, categoria, nuevoValor);
  },

  // Confirmar nueva acción
  async confirmarNuevaAccion(seccion, categoria, linea) {
    const config = this.configs[seccion];
    const prefijo = config.prefijo ? `${config.prefijo}-` : '';

    const input = document.getElementById(`nueva-accion-${prefijo}${categoria}-${linea}`);
    const accionId = seccion === 'innecesarios'
      ? `accion-${categoria}-${linea}`
      : `accion-${prefijo}${categoria}-${linea}`;
    const select = document.getElementById(accionId);
    const nuevoValor = input.value.trim();

    if (!nuevoValor) {
      alert('Por favor, escribe un nombre para la nueva acción.');
      return;
    }

    // Añadir a la lista local
    if (seccion === 'innecesarios') {
      config.addAccionToList(nuevoValor);
    } else {
      config.addAccionToList(categoria, nuevoValor);
    }

    // Guardar en la base de datos
    const categoriaApi = typeof config.categoriaApi === 'function'
      ? config.categoriaApi(categoria)
      : config.categoriaApi;
    await guardarAccionPersonalizada(categoriaApi, nuevoValor);

    // Actualizar el select
    const newOption = document.createElement('option');
    newOption.value = nuevoValor;
    newOption.textContent = nuevoValor;
    select.insertBefore(newOption, select.querySelector('option[value="__nuevo__"]'));
    select.value = nuevoValor;

    // Ocultar input
    input.style.display = 'none';
    const btnGuardar = document.getElementById(`btn-guardar-accion-${prefijo}${categoria}-${linea}`);
    if (btnGuardar) btnGuardar.style.display = 'none';
    input.value = '';
  },

  // Actualizar selects de tipo en la misma categoría
  actualizarSelectsTipo(seccion, categoria, nuevoValor) {
    const config = this.configs[seccion];
    const selector = seccion === 'innecesarios'
      ? `.${config.selectClass}`
      : `.${config.selectClass}[data-categoria="${categoria}"]`;

    const selects = document.querySelectorAll(selector);
    selects.forEach(select => {
      if (!select.querySelector(`option[value="${nuevoValor}"]`)) {
        const newOption = document.createElement('option');
        newOption.value = nuevoValor;
        newOption.textContent = nuevoValor;
        select.insertBefore(newOption, select.querySelector('option[value="__nuevo__"]'));
      }
    });
  },

  // Obtener datos del desglose
  obtenerDatos(seccion, categoria) {
    const config = this.configs[seccion];
    const datos = [];
    const desgloseContainer = document.getElementById(`desglose-${categoria}`);

    if (!desgloseContainer) return datos;

    const lineas = desgloseContainer.querySelectorAll('.desglose-linea');
    lineas.forEach((linea, index) => {
      const selectTipo = linea.querySelector(`.${config.selectClass}`);
      const lineaNum = selectTipo?.dataset.linea;

      const prefijo = config.prefijo ? `${config.prefijo}-` : '';
      const accionId = seccion === 'innecesarios'
        ? `accion-${categoria}-${lineaNum}`
        : `accion-${prefijo}${categoria}-${lineaNum}`;
      const selectAccion = document.getElementById(accionId);

      if (selectTipo && selectAccion) {
        const dato = {
          linea: index + 1,
          accion: selectAccion.value || ''
        };
        dato[config.tipoField] = selectTipo.value || '';
        datos.push(dato);
      }
    });

    return datos;
  },

  // Limpiar desglose
  limpiar(seccion, categoria) {
    this.ocultar(seccion, categoria);
  }
};

// ==================== FUNCIONES AUXILIARES PARA COMPATIBILIDAD ====================

// Funciones globales para onclick en HTML (mantener compatibilidad)
function agregarInnecesario(tipo) {
  DesgloseManager.agregarLinea('innecesarios', tipo);
}

function eliminarInnecesario(tipo, lineaNum) {
  DesgloseManager.eliminarLinea('innecesarios', tipo, lineaNum);
}

function agregarLineaOrden(categoria) {
  DesgloseManager.agregarLinea('orden', categoria);
}

function eliminarLineaOrden(categoria, lineaNum) {
  DesgloseManager.eliminarLinea('orden', categoria, lineaNum);
}

function agregarLineaLimpieza(categoria) {
  DesgloseManager.agregarLinea('limpieza', categoria);
}

function eliminarLineaLimpieza(categoria, lineaNum) {
  DesgloseManager.eliminarLinea('limpieza', categoria, lineaNum);
}

function agregarLineaInspeccion(categoria) {
  DesgloseManager.agregarLinea('inspeccion', categoria);
}

function eliminarLineaInspeccion(categoria, lineaNum) {
  DesgloseManager.eliminarLinea('inspeccion', categoria, lineaNum);
}

// Funciones de limpieza
function limpiarDesgloseInnecesarios(tipo) {
  DesgloseManager.limpiar('innecesarios', tipo);
}

function ocultarDesgloseOrden(categoria) {
  DesgloseManager.ocultar('orden', categoria);
}

function ocultarDesgloseLimpieza(categoria) {
  DesgloseManager.ocultar('limpieza', categoria);
}

function ocultarDesgloseInspeccion(categoria) {
  DesgloseManager.ocultar('inspeccion', categoria);
}

// Funciones para obtener datos
function obtenerDatosDesglose(tipo) {
  return DesgloseManager.obtenerDatos('innecesarios', tipo);
}

function obtenerDatosDesgloseOrden(categoria) {
  return DesgloseManager.obtenerDatos('orden', categoria);
}

function obtenerDatosDesgloseLimpieza(categoria) {
  return DesgloseManager.obtenerDatos('limpieza', categoria);
}

function obtenerCantidadInnecesarios(tipo) {
  const desgloseContainer = document.getElementById(`desglose-${tipo}`);
  return desgloseContainer ? desgloseContainer.querySelectorAll('.desglose-linea').length : 0;
}

// ==================== CARGA DE DATOS PERSONALIZADOS ====================

async function cargarPersonalizados() {
  try {
    const tiposResponse = await fetch('/api/tipos');
    if (tiposResponse.ok) {
      const tipos = await tiposResponse.json();
      if (Array.isArray(tipos)) {
        tipos.forEach(t => {
          if (t.categoria === 'innecesarios') {
            if (!TIPOS_INNECESARIOS.includes(t.nombre)) {
              TIPOS_INNECESARIOS.push(t.nombre);
            }
          } else if (TIPOS_ORDEN[t.categoria]) {
            if (!TIPOS_ORDEN[t.categoria].includes(t.nombre)) {
              TIPOS_ORDEN[t.categoria].push(t.nombre);
            }
          }
        });
      }
    }

    const accionesResponse = await fetch('/api/acciones-personalizadas');
    if (accionesResponse.ok) {
      const acciones = await accionesResponse.json();
      if (Array.isArray(acciones)) {
        acciones.forEach(a => {
          if (a.categoria === 'innecesarios') {
            if (!ACCIONES_INNECESARIOS.includes(a.nombre)) {
              ACCIONES_INNECESARIOS.push(a.nombre);
            }
          } else if (ACCIONES_ORDEN[a.categoria]) {
            if (!ACCIONES_ORDEN[a.categoria].includes(a.nombre)) {
              ACCIONES_ORDEN[a.categoria].push(a.nombre);
            }
          }
        });
      }
    }
  } catch (error) {
    console.warn('No se pudieron cargar los tipos/acciones personalizados:', error);
  }
}

async function guardarTipoPersonalizado(categoria, nombre) {
  try {
    await fetch('/api/tipos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria, nombre })
    });
  } catch (error) {
    console.error('Error guardando tipo:', error);
  }
}

async function guardarAccionPersonalizada(categoria, nombre) {
  try {
    await fetch('/api/acciones-personalizadas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoria, nombre })
    });
  } catch (error) {
    console.error('Error guardando acción:', error);
  }
}

// ==================== FUNCIONES DE UI ====================

function initializeThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      const isDark = document.body.classList.contains('dark-mode');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
  }
}

function initializeDateField() {
  const fechaInput = document.getElementById('fecha');
  if (fechaInput) {
    const today = new Date().toISOString().split('T')[0];
    fechaInput.value = today;
  }
}

function initializeMapInteraction() {
  const parcelaAreas = document.querySelectorAll('.parcela-area');
  const parcelaRadios = document.querySelectorAll('input[name="parcela"]');

  parcelaAreas.forEach(area => {
    area.addEventListener('click', () => {
      const parcelaValue = area.dataset.parcela;
      parcelaAreas.forEach(a => a.classList.remove('selected'));
      area.classList.add('selected');
      parcelaRadios.forEach(radio => {
        if (radio.value === parcelaValue) radio.checked = true;
      });
    });
  });

  parcelaRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const selectedValue = radio.value;
      parcelaAreas.forEach(area => {
        area.classList.remove('selected');
        if (area.dataset.parcela === selectedValue) area.classList.add('selected');
      });
    });
  });
}

function initializeFormHandlers() {
  const form = document.getElementById('auditoria-form');
  const btnLimpiar = document.getElementById('btn-limpiar');
  const btnImprimir = document.getElementById('btn-imprimir');

  if (form) form.addEventListener('submit', handleFormSubmit);
  if (btnLimpiar) btnLimpiar.addEventListener('click', limpiarFormulario);
  if (btnImprimir) btnImprimir.addEventListener('click', () => window.print());
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const fecha = document.getElementById('fecha').value;
  const parcela = document.querySelector('input[name="parcela"]:checked');

  if (!fecha) {
    alert('Por favor, selecciona una fecha para la auditoría.');
    return;
  }

  if (!parcela) {
    alert('Por favor, selecciona una parcela a auditar.');
    return;
  }

  const auditoriaData = {
    fecha: fecha,
    parcela: parcela.value,
    auditor: document.getElementById('auditor').value || 'Sin especificar',

    clasificacion: {
      innecesarios_desconocidos: obtenerCantidadInnecesarios('desconocidos'),
      listado_desconocidos: document.getElementById('listado_desconocidos').value,
      innecesarios_no_fullkit: obtenerCantidadInnecesarios('nofullkit'),
      listado_no_fullkit: document.getElementById('listado_no_fullkit').value,
      desglose_desconocidos: obtenerDatosDesglose('desconocidos'),
      desglose_no_fullkit: obtenerDatosDesglose('nofullkit')
    },

    orden: {
      herramienta_fuera: document.getElementById('herramienta_fuera').value,
      herramienta_detalle: '',
      desglose_herramienta: obtenerDatosDesgloseOrden('herramienta'),
      eslingas_fuera: document.getElementById('eslingas_fuera').value,
      eslingas_detalle: '',
      desglose_eslingas: obtenerDatosDesgloseOrden('eslingas'),
      maquinas_fuera: document.getElementById('maquinas_fuera').value,
      maquinas_detalle: '',
      desglose_maquinas: obtenerDatosDesgloseOrden('maquinas'),
      ropa_epis_fuera: document.getElementById('ropa_epis_fuera').value,
      ropa_epis_detalle: '',
      desglose_ropa: obtenerDatosDesgloseOrden('ropa'),
      lugar_guardar: document.getElementById('lugar_guardar').value,
      lugar_guardar_detalle: document.getElementById('orden_detalle')?.value || ''
    },

    limpieza: {
      area_sucia: document.getElementById('area_sucia').value,
      area_sucia_detalle: '',
      area_residuos: document.getElementById('area_residuos').value,
      area_residuos_detalle: ''
    },

    inspeccion: {
      salidas_gas_precintadas: document.getElementById('salidas_gas_precintadas').value,
      riesgos_carteles: document.getElementById('riesgos_carteles').value,
      zonas_delimitadas: document.getElementById('zonas_delimitadas').value,
      cuadros_electricos_ok: document.getElementById('cuadros_electricos_ok').value,
      aire_comprimido_ok: document.getElementById('aire_comprimido_ok').value,
      inspeccion_detalle: ''
    },

    acciones: []
  };

  try {
    const response = await fetch('/api/auditorias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auditoriaData)
    });

    const result = await response.json();

    if (response.ok) {
      mostrarModal(`La auditoría #${result.id} ha sido guardada correctamente en la base de datos.`);
    } else {
      alert(`Error al guardar: ${result.error}`);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error de conexión. Verifica que el servidor esté activo.');
  }
}

function limpiarFormulario() {
  if (confirm('¿Estás seguro de que quieres limpiar el formulario? Se perderán todos los datos introducidos.')) {
    limpiarFormularioSinConfirmar();
  }
}

function limpiarFormularioSinConfirmar() {
  const form = document.getElementById('auditoria-form');
  form.reset();

  document.querySelectorAll('.parcela-area').forEach(area => area.classList.remove('selected'));
  document.querySelectorAll('input[name="parcela"]').forEach(radio => radio.checked = false);

  // Limpiar desgloses de innecesarios
  limpiarDesgloseInnecesarios('desconocidos');
  limpiarDesgloseInnecesarios('nofullkit');

  // Limpiar desgloses de ORDEN
  ['herramienta', 'eslingas', 'maquinas', 'ropa', 'lugar'].forEach(cat => ocultarDesgloseOrden(cat));

  // Limpiar desgloses de LIMPIEZA
  ['suciedad', 'residuos'].forEach(cat => ocultarDesgloseLimpieza(cat));

  // Limpiar desgloses de INSPECCIÓN
  ['gas', 'carteles', 'zonas', 'electricos', 'aire'].forEach(cat => ocultarDesgloseInspeccion(cat));

  initializeDateField();
}

// ==================== MODAL ====================

function initializeModalHandlers() {
  const modal = document.getElementById('modal-confirmacion');
  const closeBtn = modal?.querySelector('.modal-close');
  const btnNueva = document.getElementById('btn-nueva');
  const btnHistorial = document.getElementById('btn-ver-historial');

  if (closeBtn) closeBtn.addEventListener('click', cerrarModal);
  if (btnNueva) {
    btnNueva.addEventListener('click', () => {
      cerrarModal();
      limpiarFormularioSinConfirmar();
    });
  }
  if (btnHistorial) {
    btnHistorial.addEventListener('click', () => window.location.href = '/historial');
  }
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cerrarModal();
    });
  }
}

function mostrarModal(mensaje) {
  const modal = document.getElementById('modal-confirmacion');
  const mensajeEl = document.getElementById('modal-mensaje');
  if (mensajeEl) mensajeEl.textContent = mensaje;
  if (modal) modal.classList.add('show');
}

function cerrarModal() {
  const modal = document.getElementById('modal-confirmacion');
  if (modal) modal.classList.remove('show');
}
