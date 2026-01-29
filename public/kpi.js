// ==================== KPIs AUDITORÍA 5S GHI ====================

// Cargar tema guardado
(function() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
  }
})();

// Variables globales para gráficos
let chartEvolucion = null;
let chartParcelas = null;

// Colores para parcelas
const COLORES_PARCELAS = {
  'Parcela horno grande 1': '#d32f2f',
  'Parcela horno grande 2': '#5c85d6',
  'Parcela horno grande 3 (FRB)': '#4caf50',
  'Parcela horno pequeño 1': '#f5d742',
  'Dojo de formación': '#b0b0b0',
  'Af. Pack & Build': '#9966cc',
  'Af. Ventiladores': '#7ecef4',
  'Parcela BEAS': '#ff69b4',
  'AF1': '#ff9966',
  'Patio exterior': '#8B4513'
};

document.addEventListener('DOMContentLoaded', () => {
  initializeThemeToggle();
  cargarKPIs();
});

function initializeThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
      localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
      // Actualizar colores de gráficos
      if (chartEvolucion || chartParcelas) {
        cargarKPIs();
      }
    });
  }
}

async function cargarKPIs() {
  const parcela = document.getElementById('filtro-parcela').value;
  const semanas = document.getElementById('filtro-semanas').value;

  try {
    const response = await fetch(`/api/kpi?semanas=${semanas}&parcela=${encodeURIComponent(parcela)}`);
    const data = await response.json();

    actualizarResumen(data);
    actualizarGraficoEvolucion(data);
    actualizarGraficoParcelas(data);
    actualizarTabla(data);
    actualizarRanking(data);
  } catch (error) {
    console.error('Error cargando KPIs:', error);
  }
}

function actualizarResumen(data) {
  document.getElementById('total-auditorias').textContent = data.totalAuditorias || 0;
  document.getElementById('total-innecesarios').textContent = data.totalInnecesarios || 0;
  document.getElementById('promedio-semanal').textContent = (data.promedioSemanal || 0).toFixed(1);

  const tendenciaEl = document.getElementById('tendencia');
  if (data.tendencia > 0) {
    tendenciaEl.textContent = `+${data.tendencia.toFixed(1)}%`;
    tendenciaEl.parentElement.classList.remove('tendencia-positiva');
    tendenciaEl.parentElement.classList.add('tendencia-negativa');
  } else if (data.tendencia < 0) {
    tendenciaEl.textContent = `${data.tendencia.toFixed(1)}%`;
    tendenciaEl.parentElement.classList.remove('tendencia-negativa');
    tendenciaEl.parentElement.classList.add('tendencia-positiva');
  } else {
    tendenciaEl.textContent = '0%';
    tendenciaEl.parentElement.classList.remove('tendencia-positiva', 'tendencia-negativa');
  }
}

function actualizarGraficoEvolucion(data) {
  const ctx = document.getElementById('chart-evolucion').getContext('2d');
  const isDark = document.body.classList.contains('dark-mode');

  if (chartEvolucion) {
    chartEvolucion.destroy();
  }

  const semanas = data.porSemana || [];
  const labels = semanas.map(s => `Sem ${s.semana}`);

  // Si hay filtro de parcela, mostrar solo esa línea
  const parcelaFiltro = document.getElementById('filtro-parcela').value;
  let datasets = [];

  if (parcelaFiltro) {
    datasets = [{
      label: parcelaFiltro,
      data: semanas.map(s => parseInt(s.totalinnecesarios) || 0),
      borderColor: COLORES_PARCELAS[parcelaFiltro] || '#8B0000',
      backgroundColor: (COLORES_PARCELAS[parcelaFiltro] || '#8B0000') + '40',
      fill: true,
      tension: 0.3
    }];
  } else {
    // Agrupar por parcela
    const parcelas = {};
    semanas.forEach(s => {
      if (!parcelas[s.parcela]) {
        parcelas[s.parcela] = [];
      }
    });

    // Crear datasets por parcela
    const parcelasUnicas = [...new Set(semanas.map(s => s.parcela))];
    const semanasUnicas = [...new Set(semanas.map(s => s.semana))].sort();

    parcelasUnicas.forEach(parcela => {
      const dataParcela = semanasUnicas.map(sem => {
        const registro = semanas.find(s => s.semana === sem && s.parcela === parcela);
        return registro ? parseInt(registro.totalinnecesarios) || 0 : 0;
      });

      datasets.push({
        label: parcela,
        data: dataParcela,
        borderColor: COLORES_PARCELAS[parcela] || '#999',
        backgroundColor: 'transparent',
        tension: 0.3,
        borderWidth: 2
      });
    });

    // Actualizar labels para semanas únicas
    labels.length = 0;
    semanasUnicas.forEach(s => labels.push(`Sem ${s}`));
  }

  chartEvolucion = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: isDark ? '#e0e0e0' : '#333'
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: isDark ? '#e0e0e0' : '#333' },
          grid: { color: isDark ? '#444' : '#ddd' }
        },
        x: {
          ticks: { color: isDark ? '#e0e0e0' : '#333' },
          grid: { color: isDark ? '#444' : '#ddd' }
        }
      }
    }
  });
}

function actualizarGraficoParcelas(data) {
  const ctx = document.getElementById('chart-parcelas').getContext('2d');
  const isDark = document.body.classList.contains('dark-mode');

  if (chartParcelas) {
    chartParcelas.destroy();
  }

  const porParcela = data.porParcela || [];
  const labels = porParcela.map(p => p.parcela);
  const valores = porParcela.map(p => parseInt(p.totalinnecesarios) || 0);
  const colores = labels.map(l => COLORES_PARCELAS[l] || '#999');

  chartParcelas = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Total Innecesarios',
        data: valores,
        backgroundColor: colores,
        borderColor: colores.map(c => c),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: isDark ? '#e0e0e0' : '#333' },
          grid: { color: isDark ? '#444' : '#ddd' }
        },
        x: {
          ticks: {
            color: isDark ? '#e0e0e0' : '#333',
            maxRotation: 45,
            minRotation: 45
          },
          grid: { color: isDark ? '#444' : '#ddd' }
        }
      }
    }
  });
}

function actualizarTabla(data) {
  const tbody = document.getElementById('tabla-body');
  const registros = data.detalle || [];

  if (registros.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="no-data">No hay datos para el período seleccionado</td></tr>';
    return;
  }

  tbody.innerHTML = registros.map(r => `
    <tr>
      <td>${r.semana}</td>
      <td>${formatearFecha(r.fecha)}</td>
      <td><span class="parcela-badge" style="border-left-color: ${COLORES_PARCELAS[r.parcela] || '#999'}">${r.parcela}</span></td>
      <td class="num-cell">${r.innecesariosdesconocidos || 0}</td>
      <td class="num-cell">${r.innecesariosnofullkit || 0}</td>
      <td class="num-cell total-cell">${r.totalinnecesarios || 0}</td>
    </tr>
  `).join('');
}

function actualizarRanking(data) {
  const container = document.getElementById('ranking-container');
  const ranking = data.ranking || [];

  if (ranking.length === 0) {
    container.innerHTML = '<p class="no-data">No hay datos suficientes</p>';
    return;
  }

  container.innerHTML = ranking.map((r, idx) => {
    let medalla = '';
    if (idx === 0) medalla = '<span class="medalla oro">1</span>';
    else if (idx === 1) medalla = '<span class="medalla plata">2</span>';
    else if (idx === 2) medalla = '<span class="medalla bronce">3</span>';
    else medalla = `<span class="medalla">${idx + 1}</span>`;

    const promedio = parseFloat(r.promedio) || 0;
    return `
      <div class="ranking-item">
        ${medalla}
        <span class="ranking-parcela" style="border-left-color: ${COLORES_PARCELAS[r.parcela] || '#999'}">${r.parcela}</span>
        <span class="ranking-valor">${r.totalinnecesarios || 0} incidencias</span>
        <span class="ranking-promedio">(${promedio.toFixed(1)}/semana)</span>
      </div>
    `;
  }).join('');
}

function formatearFecha(fecha) {
  if (!fecha) return '-';
  const d = new Date(fecha);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function obtenerNumeroSemana(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// ==================== AUTENTICACIÓN Y BACKUP ====================

let adminCredentials = null;
let pendingBackupType = null;

function mostrarModalLogin() {
  document.getElementById('modal-login').classList.add('show');
  document.getElementById('login-usuario').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').style.display = 'none';
}

function cerrarModalLogin() {
  document.getElementById('modal-login').classList.remove('show');
  pendingBackupType = null;
}

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
      document.getElementById('admin-status').textContent = 'Autenticado como admin';
      document.getElementById('admin-status').classList.add('authenticated');

      // Si había una descarga pendiente, ejecutarla
      if (pendingBackupType) {
        descargarBackup(pendingBackupType);
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

async function descargarBackup(tipo) {
  // Si no está autenticado, mostrar login
  if (!adminCredentials) {
    pendingBackupType = tipo;
    mostrarModalLogin();
    return;
  }

  try {
    const url = tipo === 'json' ? '/api/backup/json' : '/api/backup/csv';

    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${adminCredentials}`
      }
    });

    if (response.status === 401 || response.status === 403) {
      adminCredentials = null;
      document.getElementById('admin-status').textContent = '';
      document.getElementById('admin-status').classList.remove('authenticated');
      pendingBackupType = tipo;
      mostrarModalLogin();
      return;
    }

    if (!response.ok) {
      const error = await response.json();
      alert('Error: ' + error.error);
      return;
    }

    // Descargar el archivo
    const blob = await response.blob();
    const fecha = new Date().toISOString().split('T')[0];
    const extension = tipo === 'json' ? 'json' : 'csv';
    const filename = `auditorias_backup_${fecha}.${extension}`;

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

  } catch (error) {
    console.error('Error descargando backup:', error);
    alert('Error al descargar el backup');
  }
}
