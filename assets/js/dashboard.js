/* ============================================================
   TRIP FLY BD — SMART ATTENDANCE SYSTEM
   dashboard.js  |  Admin Dashboard, Charts & Analytics
   ─────────────────────────────────────────────────────────
   Loaded by: admin.html
   Depends on: app.js, Chart.js (CDN)
   Provides:
     - Dashboard stat cards
     - Today's attendance table
     - Monthly line, bar, doughnut, area charts
     - Settings load/save wrappers
   ============================================================ */

'use strict';

/* ============================================================
   CHART DEFAULTS — global Chart.js configuration
   ============================================================ */
if (typeof Chart !== 'undefined') {
  Chart.defaults.font = Chart.defaults.font || {};
  Chart.defaults.plugins = Chart.defaults.plugins || {};
  Chart.defaults.plugins.legend = Chart.defaults.plugins.legend || {};
  Chart.defaults.plugins.legend.labels = Chart.defaults.plugins.legend.labels || {};
  Chart.defaults.plugins.tooltip = Chart.defaults.plugins.tooltip || {};

  Chart.defaults.color              = '#888';
  Chart.defaults.font.family        = "'DM Sans', sans-serif";
  Chart.defaults.font.size          = 12;
  Chart.defaults.borderColor        = 'rgba(212,175,55,0.08)';
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.pointStyle    = 'circle';
  Chart.defaults.plugins.tooltip.backgroundColor     = 'rgba(10,10,18,0.95)';
  Chart.defaults.plugins.tooltip.borderColor         = 'rgba(212,175,55,0.3)';
  Chart.defaults.plugins.tooltip.borderWidth         = 1;
  Chart.defaults.plugins.tooltip.padding             = 10;
  Chart.defaults.plugins.tooltip.titleColor          = '#D4AF37';
  Chart.defaults.plugins.tooltip.bodyColor           = '#a89f94';
  Chart.defaults.plugins.tooltip.cornerRadius        = 8;
}


/* ============================================================
   CHART REGISTRY
   Keeps track of Chart.js instances so we can destroy/recreate.
   ============================================================ */
const ChartRegistry = (() => {
  const _charts = {};

  function destroy(id) {
    if (_charts[id]) {
      try { _charts[id].destroy(); } catch {}
      delete _charts[id];
    }
  }

  function register(id, chart) {
    destroy(id); // always destroy previous before registering
    _charts[id] = chart;
  }

  function get(id) { return _charts[id] || null; }

  return { destroy, register, get };
})();


/* ============================================================
   DASHBOARD OVERVIEW
   ============================================================ */
async function loadDashboard() {
  try {
    const result = await API.get({ action: 'getDashboardStats' });
    if (!result.success) throw new Error(result.message);

    const d = result.data;

    // Animate stat card values
    animateCount('statTotal',   d.totalEmployees || 0);
    animateCount('statPresent', d.presentToday   || 0);
    animateCount('statLate',    d.lateToday      || 0);
    animateCount('statAbsent',  d.absentToday    || 0);

    // Attendance rate progress bar
    const rate    = d.attendanceRate || 0;
    const fillEl  = document.getElementById('rateBarFill');
    const pctEl   = document.getElementById('rateBarPct');
    if (fillEl) {
      requestAnimationFrame(() => {
        setTimeout(() => { fillEl.style.width = rate + '%'; }, 100);
      });
    }
    if (pctEl) pctEl.textContent = rate + '%';

    // Date display
    const dashDate = document.getElementById('dashDate');
    if (dashDate) {
      dashDate.textContent = 'Today — ' + new Date().toLocaleDateString('en-BD', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
    }

    // Load today's table
    await loadTodayTable();

  } catch (err) {
    console.error('[Dashboard] loadDashboard error:', err);
    showToast('error', 'Dashboard load failed: ' + err.message);
  }
}

// ── Animated number count-up ────────────────────────────
function animateCount(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const duration = 700;
  const start    = Date.now();
  const from     = parseInt(el.textContent) || 0;

  function tick() {
    const elapsed  = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased    = 1 - Math.pow(1 - progress, 3);
    const current  = Math.round(from + (target - from) * eased);
    el.textContent = current;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}


/* ============================================================
   TODAY'S ATTENDANCE TABLE (Dashboard section)
   ============================================================ */
async function loadTodayTable() {
  const tbody = document.getElementById('todayTableBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" class="table-empty">
    <i class="fa-solid fa-circle-notch fa-spin"></i> Loading…</td></tr>`;

  try {
    // Also fetch employees to get department info
    const [attResult, empResult] = await Promise.all([
      API.get({ action: 'getTodayAttendance' }),
      API.get({ action: 'getEmployees' }),
    ]);

    if (!attResult.success) throw new Error(attResult.message);

    const records  = attResult.data || [];
    const empMap   = {};
    if (empResult.success) {
      empResult.data.forEach(e => { empMap[e.id] = e; });
    }

    if (!records.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty">
        <i class="fa-solid fa-calendar-xmark" style="color:var(--text-muted)"></i>
        No attendance recorded today yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = records.map((r, i) => {
      const emp  = empMap[r.employeeId] || {};
      const dept = emp.department || '—';
      const gps  = r.latitude
        ? `<a class="gps-link" href="https://maps.google.com/?q=${r.latitude},${r.longitude}" target="_blank" rel="noopener">
             <i class="fa-solid fa-location-dot" style="color:var(--gold)"></i>
             ${parseFloat(r.latitude).toFixed(4)}, ${parseFloat(r.longitude).toFixed(4)}
           </a>`
        : '<span style="color:var(--text-muted)">—</span>';

      return `
        <tr>
          <td style="color:var(--text-muted)">${i + 1}</td>
          <td>
            <div style="font-weight:500;color:var(--text-primary)">${r.employeeName || '—'}</div>
            <div style="font-size:.72rem;color:var(--text-muted)">${r.employeeId}</div>
          </td>
          <td style="font-size:.82rem;color:var(--text-secondary)">${dept}</td>
          <td style="font-weight:500">${r.checkIn  || '—'}</td>
          <td style="color:var(--text-muted)">${r.checkOut || '—'}</td>
          <td>
            <span class="status-badge status-badge--${(r.status || '').toLowerCase()}">
              ${r.status || '—'}
            </span>
          </td>
          <td>${gps}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">
      <i class="fa-solid fa-triangle-exclamation" style="color:var(--amber)"></i>
      ${err.message}</td></tr>`;
  }
}


/* ============================================================
   ANALYTICS — CHART LOADING
   ============================================================ */
async function loadCharts() {
  if (typeof Chart === 'undefined') {
    showToast('error', 'Chart.js did not load. Check your internet connection and reload the page.');
    return;
  }

  const monthEl = document.getElementById('chartMonth');
  const yearEl  = document.getElementById('chartYear');

  const month = parseInt(monthEl?.value || new Date().getMonth() + 1);
  const year  = parseInt(yearEl?.value  || new Date().getFullYear());

  try {
    const [monthlyResult, statsResult] = await Promise.all([
      API.get({ action: 'getMonthlyStats', month, year }),
      API.get({ action: 'getDashboardStats' }),
    ]);

    if (!monthlyResult.success) throw new Error(monthlyResult.message);

    const { labels, present, late } = monthlyResult.data;
    const stats = statsResult.success ? statsResult.data : {};

    _renderLineChart(labels, present, late);
    _renderBarChart(labels, present, late);
    _renderDoughnut(stats);
    _renderAreaChart(labels, present, late);

  } catch (err) {
    console.error('[Dashboard] loadCharts error:', err);
    showToast('error', 'Charts failed to load: ' + err.message);
  }
}

// ── Common chart colors ──────────────────────────────────
const CHART_COLORS = {
  gold:       'rgba(212, 175, 55, 0.85)',
  goldFill:   'rgba(212, 175, 55, 0.12)',
  goldLine:   'rgb(212, 175, 55)',
  amber:      'rgba(245, 158, 11, 0.7)',
  amberFill:  'rgba(245, 158, 11, 0.1)',
  green:      'rgba(34, 197, 94, 0.7)',
  greenFill:  'rgba(34, 197, 94, 0.12)',
  red:        'rgba(239, 68, 68, 0.7)',
  redFill:    'rgba(239, 68, 68, 0.12)',
};

// Common axis config factory
function _axisConfig(extras = {}) {
  return {
    ticks:  { color: '#666', ...extras.ticks },
    grid:   { color: 'rgba(212,175,55,0.07)', ...extras.grid },
    border: { color: 'rgba(212,175,55,0.15)', ...extras.border },
    ...extras.axis,
  };
}

// ── Line chart — Present vs Late daily ──────────────────
function _renderLineChart(labels, present, late) {
  const canvas = document.getElementById('monthlyLineChart');
  if (!canvas) return;

  ChartRegistry.destroy('lineChart');
  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label:            'Present',
          data:             present,
          borderColor:      CHART_COLORS.goldLine,
          backgroundColor:  CHART_COLORS.goldFill,
          borderWidth:      2.5,
          pointRadius:      3,
          pointHoverRadius: 6,
          pointBackgroundColor: CHART_COLORS.goldLine,
          tension:          0.4,
          fill:             true,
        },
        {
          label:            'Late',
          data:             late,
          borderColor:      CHART_COLORS.amber,
          backgroundColor:  CHART_COLORS.amberFill,
          borderWidth:      2,
          pointRadius:      3,
          pointHoverRadius: 6,
          pointBackgroundColor: CHART_COLORS.amber,
          tension:          0.4,
          fill:             true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: { color: '#D4AF37', padding: 16 },
        },
      },
      scales: {
        x: { ..._axisConfig(), ticks: { color: '#555', maxTicksLimit: 15 } },
        y: { ..._axisConfig(), beginAtZero: true, ticks: { stepSize: 1, color: '#555' } },
      },
    },
  });
  ChartRegistry.register('lineChart', chart);
}

// ── Bar chart — daily breakdown ──────────────────────────
function _renderBarChart(labels, present, late) {
  const canvas = document.getElementById('monthlyBarChart');
  if (!canvas) return;

  ChartRegistry.destroy('barChart');
  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label:           'Present',
          data:            present,
          backgroundColor: CHART_COLORS.gold,
          borderColor:     CHART_COLORS.goldLine,
          borderWidth:     1,
          borderRadius:    4,
          borderSkipped:   false,
        },
        {
          label:           'Late',
          data:            late,
          backgroundColor: CHART_COLORS.amber,
          borderColor:     'rgba(245,158,11,0.9)',
          borderWidth:     1,
          borderRadius:    4,
          borderSkipped:   false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#D4AF37' } } },
      scales: {
        x: { ..._axisConfig(), stacked: false, ticks: { color: '#555', maxTicksLimit: 15 } },
        y: { ..._axisConfig(), beginAtZero: true, ticks: { stepSize: 1, color: '#555' } },
      },
    },
  });
  ChartRegistry.register('barChart', chart);
}

// ── Doughnut — today's distribution ─────────────────────
function _renderDoughnut(stats) {
  const canvas = document.getElementById('todayDoughnut');
  if (!canvas) return;

  const present = stats.presentToday  || 0;
  const late    = stats.lateToday     || 0;
  const absent  = stats.absentToday   || 0;
  const total   = present + late + absent;

  ChartRegistry.destroy('doughnut');
  const centrePlugin = {
    id: 'centreLabel',
    beforeDraw(ch) {
      const { ctx, chartArea: { left, right, top, bottom } } = ch;
      const cx = (left + right) / 2;
      const cy = (top  + bottom) / 2;
      ctx.save();
      ctx.fillStyle = '#D4AF37';
      ctx.font = "bold 1.4rem 'Cormorant Garamond', serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(total === 0 ? '—' : `${Math.round(((present + late) / total) * 100)}%`, cx, cy - 6);
      ctx.fillStyle = '#666';
      ctx.font = "0.65rem 'DM Sans', sans-serif";
      ctx.fillText('Attendance', cx, cy + 14);
      ctx.restore();
    },
  };

  const chart = new Chart(canvas, {
    type: 'doughnut',
    plugins: [centrePlugin],
    data: {
      labels:   ['Present', 'Late', 'Absent'],
      datasets: [{
        data:            [present, late, absent || (total === 0 ? 1 : 0)],
        backgroundColor: [
          'rgba(34, 197, 94, 0.75)',
          'rgba(245, 158, 11, 0.75)',
          'rgba(239, 68, 68, 0.75)',
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(239, 68, 68, 1)',
        ],
        borderWidth:  2,
        hoverOffset:  8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels:   { color: '#888', padding: 14, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed;
              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
              return `  ${ctx.label}: ${val} (${pct}%)`;
            },
          },
        },
      },
    },
  });

  ChartRegistry.register('doughnut', chart);
}

// ── Area chart — monthly totals trend ───────────────────
function _renderAreaChart(labels, present, late) {
  const canvas = document.getElementById('totalAreaChart');
  if (!canvas) return;

  // Combined total per day
  const total = labels.map((_, i) => (present[i] || 0) + (late[i] || 0));

  ChartRegistry.destroy('areaChart');
  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label:            'Total Attendance',
        data:             total,
        borderColor:      CHART_COLORS.goldLine,
        backgroundColor:  'rgba(212,175,55,0.08)',
        borderWidth:      2.5,
        pointRadius:      2,
        pointHoverRadius: 5,
        pointBackgroundColor: CHART_COLORS.goldLine,
        tension:          0.45,
        fill:             'origin',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `  Check-ins: ${ctx.parsed.y}`,
          },
        },
      },
      scales: {
        x: { ..._axisConfig(), ticks: { color: '#555', maxTicksLimit: 15 } },
        y: {
          ..._axisConfig(),
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: '#555',
            callback: (v) => Number.isInteger(v) ? v : '',
          },
        },
      },
    },
  });
  ChartRegistry.register('areaChart', chart);
}
