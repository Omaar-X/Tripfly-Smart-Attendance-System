/* ============================================================
   TRIP FLY BD — SMART ATTENDANCE SYSTEM
   app.js  |  Core Application Layer
   ─────────────────────────────────────────────────────────
   Loaded by: index.html, admin.html, employee.html, reports.html
   Provides:
     - API module (GET / POST to Apps Script)
     - Toast notification system
     - CSV download helper
     - Shared utility functions
     - Session auth helpers
   ============================================================ */

'use strict';

/* ============================================================
   CONFIGURATION — paste your deployed Web App URL here
   ============================================================ */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyS1T7C1Y6w8Gzvpa5xOpdSTnHHzIOaGemmd7XNs4Q2Pmx6kLQkb11JJzCfRtrDlHpqFg/exec';
// Example:
// const APPS_SCRIPT_URL =
//   'https://script.google.com/macros/s/AKfycby.../exec';
// After deploying apps_script/apps_script.gs as a Web App, paste the
// /exec URL above. The Google Sheet ID is configured in apps_script.gs.

// ── Secret API Key ──────────────────────────────────────────
// apps_script.gs এর API_SECRET এর সাথে এটা EXACTLY মিলতে হবে।
// এই key ছাড়া কেউ আপনার data access করতে পারবে না।
const API_SECRET = 'TripFlyBD-2024-SecureKey-Omar';  // ← apps_script.gs এর মতো রাখুন


/* ============================================================
   API MODULE
   All communication with the Google Apps Script backend.
   Uses fetch() with timeout, retry on network error, and
   JSON parsing with error normalisation.
   ============================================================ */
const API = (() => {

  const REQUEST_TIMEOUT_MS = 20000; // 20 s

  // ── Internal fetch wrapper ─────────────────────────────
  async function _fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { redirect: 'follow', ...options, signal: controller.signal });
      clearTimeout(tid);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    } catch (err) {
      clearTimeout(tid);
      if (err.name === 'AbortError') throw new Error('Request timed out. Check network connection.');
      throw err;
    }
  }

  // ── Build query string ─────────────────────────────────
  function _buildQueryString(params) {
    const qs = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      // Skip internal client-side filter keys (prefixed with _)
      if (!key.startsWith('_') && val !== undefined && val !== null && val !== '') qs.set(key, val);
    }
    return qs.toString();
  }

  function _isConfigured() {
    return APPS_SCRIPT_URL &&
      APPS_SCRIPT_URL !== 'PASTE_YOUR_WEB_APP_URL_HERE' &&
      /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(APPS_SCRIPT_URL);
  }

  // ── GET request ────────────────────────────────────────
  async function get(params = {}) {
    if (!_isConfigured()) {
      console.error('[API] APPS_SCRIPT_URL is not configured in app.js');
      return { success: false, message: 'API URL not configured. Deploy Apps Script, then paste the Web App /exec URL into assets/js/app.js.' };
    }
    // Automatically add secret API key to every GET request
    const securedParams = { ...params, apiKey: API_SECRET };
    const qs  = _buildQueryString(securedParams);
    const url = qs ? `${APPS_SCRIPT_URL}?${qs}` : APPS_SCRIPT_URL;
    try {
      const res  = await _fetchWithTimeout(url);
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('[API GET Error]', err.message);
      throw err;
    }
  }

  // ── POST request ───────────────────────────────────────
  async function post(body = {}) {
    if (!_isConfigured()) {
      console.error('[API] APPS_SCRIPT_URL is not configured in app.js');
      return { success: false, message: 'API URL not configured. Deploy Apps Script, then paste the Web App /exec URL into assets/js/app.js.' };
    }
    // Automatically add secret API key to every POST request
    const securedBody = { ...body, apiKey: API_SECRET };
    try {
      const res = await _fetchWithTimeout(APPS_SCRIPT_URL, {
        method:  'POST',
        // text/plain keeps the request "simple" and avoids Apps Script
        // CORS preflight failures. doPost still receives the JSON string.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body:    JSON.stringify(securedBody),
      });
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('[API POST Error]', err.message);
      throw err;
    }
  }

  return { get, post, isConfigured: _isConfigured };

})();


/* ============================================================
   TOAST NOTIFICATION SYSTEM
   showToast(type, message, duration)
   type: 'success' | 'error' | 'info' | 'warning'
   ============================================================ */
function showToast(type = 'info', message = '', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = {
    success: 'fa-circle-check',
    error:   'fa-circle-xmark',
    info:    'fa-circle-info',
    warning: 'fa-triangle-exclamation',
  };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type] || icons.info}"></i>
    <span>${message}</span>
    <span class="toast__close" aria-label="Dismiss">
      <i class="fa-solid fa-xmark"></i>
    </span>
  `;

  // Close on click
  toast.querySelector('.toast__close').addEventListener('click', () => removeToast(toast));

  container.appendChild(toast);

  // Auto-remove after duration
  const tid = setTimeout(() => removeToast(toast), duration);
  toast._tid = tid;

  return toast;
}

function removeToast(toast) {
  if (!toast || !toast.parentNode) return;
  clearTimeout(toast._tid);
  toast.classList.add('removing');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
  // Fallback removal
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 500);
}


/* ============================================================
   CSV DOWNLOAD UTILITY
   downloadCSV(rows, filename)
   rows: array of arrays (first row = headers)
   ============================================================ */
function downloadCSV(rows, filename = 'export.csv') {
  const csv = rows
    .map(row =>
      row.map(cell => {
        const str = (cell === null || cell === undefined) ? '' : String(cell);
        // Wrap in quotes if contains comma, quote, or newline
        return /[,"\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',')
    )
    .join('\r\n');

  // BOM for Excel UTF-8 compatibility
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('success', `CSV exported: ${filename}`);
}


/* ============================================================
   DATE / TIME UTILITIES
   ============================================================ */

// Returns today's date as 'YYYY-MM-DD' (local timezone)
function getTodayString() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

// Returns current time as 'HH:MM:SS'
function getTimeString() {
  const now = new Date();
  return [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join(':');
}

// Format 'YYYY-MM-DD' → 'DD Mon YYYY'
function formatDateDisplay(dateStr) {
  if (!dateStr) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return `${d} ${months[m - 1]} ${y}`;
}

// Format ISO timestamp → readable
function formatTimestamp(isoStr) {
  if (!isoStr) return '—';
  try {
    return new Date(isoStr).toLocaleString('en-BD', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: true,
    });
  } catch { return isoStr; }
}


/* ============================================================
   SESSION AUTH HELPERS
   ============================================================ */

// Get admin session (returns object or null)
function getAdminSession() {
  try {
    const raw = sessionStorage.getItem('adminAuth');
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.role !== 'admin') return null;
    return data;
  } catch { return null; }
}

// Get employee session (returns object or null)
function getEmployeeSession() {
  try {
    const raw = sessionStorage.getItem('employeeAuth');
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.role !== 'employee') return null;
    return data;
  } catch { return null; }
}

// Require admin auth — redirect to login if missing
function requireAdmin() {
  if (!getAdminSession()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

// Require employee auth — redirect to login if missing
function requireEmployee() {
  if (!getEmployeeSession()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}


/* ============================================================
   DOM HELPERS
   ============================================================ */

// Safe querySelector with fallback
function qs(selector, parent = document) {
  return parent.querySelector(selector);
}

// Safe querySelectorAll
function qsa(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

// Set element inner HTML safely
function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

// Set element text content
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// Toggle loading state on a button
function setButtonLoading(btnId, loading) {
  const btn = typeof btnId === 'string' ? document.getElementById(btnId) : btnId;
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn._originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Loading…';
  } else {
    if (btn._originalHTML) btn.innerHTML = btn._originalHTML;
  }
}

// Show/hide element
function show(id) { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); }
function hide(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }

// Add/remove class
function addClass(id, cls)    { const el = document.getElementById(id); if (el) el.classList.add(cls); }
function removeClass(id, cls) { const el = document.getElementById(id); if (el) el.classList.remove(cls); }


/* ============================================================
   EMPLOYEE MODAL HELPERS
   (used in admin.html for Add/Edit employee)
   ============================================================ */

let _modalMode = 'add'; // 'add' | 'edit'
let _editingEmpId = null;

function openAddEmployeeModal() {
  _modalMode   = 'add';
  _editingEmpId = null;

  document.getElementById('empModalTitle').innerHTML =
    '<i class="fa-solid fa-user-plus gold-text"></i> Add Employee';

  // Clear all fields
  ['modalEmpId','modalName','modalEmail','modalPhone','modalPin'].forEach(id => setText(id, ''));
  const form = document.getElementById('empModalForm');
  if (form) form.reset();

  document.getElementById('modalEmpId').value = '';

  const alertEl = document.getElementById('empModalAlert');
  if (alertEl) { alertEl.className = 'login-alert'; alertEl.textContent = ''; }

  openModal('empModal');
}

function openEditEmployeeModal(emp) {
  _modalMode    = 'edit';
  _editingEmpId = emp.id;

  document.getElementById('empModalTitle').innerHTML =
    '<i class="fa-solid fa-user-pen gold-text"></i> Edit Employee';

  document.getElementById('modalEmpId').value    = emp.id;
  document.getElementById('modalName').value     = emp.name     || '';
  document.getElementById('modalDept').value     = emp.department || '';
  document.getElementById('modalEmail').value    = emp.email    || '';
  document.getElementById('modalPhone').value    = emp.phone    || '';
  document.getElementById('modalPin').value      = emp.pin      || '';
  document.getElementById('modalStatus').value   = emp.status   || 'Active';

  const alertEl = document.getElementById('empModalAlert');
  if (alertEl) { alertEl.className = 'login-alert'; alertEl.textContent = ''; }

  openModal('empModal');
}

function closeEmpModal() { closeModal('empModal'); }

async function saveEmployee(event) {
  event.preventDefault();
  const alertEl = document.getElementById('empModalAlert');
  const saveBtn = document.getElementById('empModalSaveBtn');

  const name   = document.getElementById('modalName').value.trim();
  const dept   = document.getElementById('modalDept').value.trim();
  const pin    = document.getElementById('modalPin').value.trim();

  if (!name || !dept || !pin) {
    showModalAlert(alertEl, 'error', 'Name, Department and PIN are required.');
    return;
  }
  if (!/^\d{4}$/.test(pin)) {
    showModalAlert(alertEl, 'error', 'PIN must be exactly 4 digits.');
    return;
  }

  const employeeData = {
    id:         document.getElementById('modalEmpId').value || '',
    name,
    department: dept,
    email:      document.getElementById('modalEmail').value.trim(),
    phone:      document.getElementById('modalPhone').value.trim(),
    pin,
    status:     document.getElementById('modalStatus').value,
  };

  setButtonLoading(saveBtn, true);

  try {
    let result;
    if (_modalMode === 'edit') {
      result = await API.post({ action: 'updateEmployee', employee: employeeData });
    } else {
      result = await API.post({ action: 'addEmployee', employee: employeeData });
    }

    if (result.success) {
      showToast('success', _modalMode === 'edit' ? 'Employee updated.' : `Employee added (${result.id}).`);
      closeEmpModal();
      if (typeof loadEmployees === 'function') loadEmployees();
    } else {
      showModalAlert(alertEl, 'error', result.message || 'Save failed.');
    }
  } catch (err) {
    showModalAlert(alertEl, 'error', 'Connection error: ' + err.message);
  } finally {
    setButtonLoading(saveBtn, false);
  }
}

async function deleteEmployee(empId, empName) {
  if (!confirm(`Deactivate employee: ${empName} (${empId})?\n\nThey will be marked Inactive and cannot log in.`)) return;

  try {
    const result = await API.post({ action: 'deleteEmployee', employeeId: empId });
    if (result.success) {
      showToast('success', `${empName} has been deactivated.`);
      if (typeof loadEmployees === 'function') loadEmployees();
    } else {
      showToast('error', result.message || 'Deactivation failed.');
    }
  } catch (err) {
    showToast('error', 'Connection error: ' + err.message);
  }
}


/* ============================================================
   MODAL OPEN / CLOSE
   ============================================================ */
function openModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (!overlay) return;
  overlay.classList.add('open');
  // Trap focus inside modal
  const first = overlay.querySelector('input, select, button, textarea');
  if (first) setTimeout(() => first.focus(), 100);
  // Close on backdrop click
  overlay.addEventListener('click', function onBackdrop(e) {
    if (e.target === overlay) {
      closeModal(modalId);
      overlay.removeEventListener('click', onBackdrop);
    }
  });
}

function closeModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (!overlay) return;
  overlay.classList.remove('open');
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

function showModalAlert(el, type, msg) {
  if (!el) return;
  el.className = `login-alert login-alert--${type} show`;
  el.innerHTML = `<i class="fa-solid fa-${type === 'error' ? 'circle-xmark' : 'circle-check'}"></i> ${msg}`;
}


/* ============================================================
   EXPORT HELPERS
   Wrappers that fetch data and trigger CSV download.
   ============================================================ */

// Export today's attendance from dashboard
async function exportTodayCSV() {
  try {
    const result = await API.get({ action: 'getTodayAttendance' });
    if (!result.success || !result.data.length) {
      showToast('warning', 'No attendance records for today.');
      return;
    }
    const headers = ['Att ID','Emp ID','Name','Date','Check-In','Check-Out','Status','Latitude','Longitude','Device'];
    const rows    = result.data.map(r => [
      r.id, r.employeeId, r.employeeName, r.date,
      r.checkIn, r.checkOut, r.status, r.latitude, r.longitude, r.deviceInfo,
    ]);
    downloadCSV([headers, ...rows], `attendance_today_${getTodayString()}.csv`);
  } catch (err) {
    showToast('error', 'Export failed: ' + err.message);
  }
}

// Export full filtered attendance table (admin attendance section)
async function exportAttendanceCSV() {
  try {
    const date   = document.getElementById('filterDate')?.value  || '';
    const empId  = document.getElementById('filterEmpId')?.value || '';
    const params = { action: 'getAttendance', limit: '5000' };
    if (date)  params.date = date;
    if (empId) params.employeeId = empId;

    const result = await API.get(params);
    if (!result.success) { showToast('error', result.message); return; }
    if (!result.data.length) { showToast('warning', 'No records match the current filter.'); return; }

    const headers = ['Att ID','Emp ID','Name','Date','Check-In','Check-Out','Status','Lat','Lng','Device','QR Token','Timestamp'];
    const rows    = result.data.map(r => [
      r.id, r.employeeId, r.employeeName, r.date,
      r.checkIn, r.checkOut, r.status,
      r.latitude, r.longitude, r.deviceInfo, r.qrToken, r.timestamp,
    ]);
    downloadCSV([headers, ...rows], `attendance_${date || 'all'}_${getTodayString()}.csv`);
  } catch (err) {
    showToast('error', 'Export failed: ' + err.message);
  }
}

// Export employee directory CSV
async function exportEmployeesCSV() {
  try {
    const result = await API.get({ action: 'getEmployees' });
    if (!result.success) { showToast('error', result.message); return; }
    const headers = ['Employee ID','Name','Department','Email','Phone','Status'];
    const rows    = result.data.map(e => [e.id, e.name, e.department, e.email, e.phone, e.status]);
    downloadCSV([headers, ...rows], `employees_${getTodayString()}.csv`);
  } catch (err) {
    showToast('error', 'Export failed: ' + err.message);
  }
}


/* ============================================================
   SETTINGS FUNCTIONS
   (used in admin.html settings section)
   ============================================================ */

// Load settings from API and populate form fields
async function loadSettings() {
  try {
    const result = await API.get({ action: 'getSettings' });
    if (!result.success) { showToast('error', 'Could not load settings.'); return; }

    const s = result.data;
    const setVal = (id, key) => {
      const el = document.getElementById(id);
      if (el && s[key] !== undefined) el.value = s[key];
    };

    setVal('sOfficeName', 'OFFICE_NAME');
    setVal('sStartTime',  'OFFICE_START_TIME');
    setVal('sQrExpiry',   'QR_EXPIRY_SECONDS');
    setVal('sLat',        'OFFICE_LATITUDE');
    setVal('sLng',        'OFFICE_LONGITUDE');
    setVal('sRadius',     'ALLOWED_RADIUS');
    setVal('sAdminUser',  'ADMIN_USERNAME');

    // Update system info panel
    setText('infoQrExpiry', (s['QR_EXPIRY_SECONDS'] || 30) + ' sec');
    setText('infoRadius',   (s['ALLOWED_RADIUS']    || 100) + ' m');
    setHTML('infoApiStatus', '<i class="fa-solid fa-circle-check" style="color:var(--green)"></i> Connected');

  } catch (err) {
    setHTML('infoApiStatus',
      '<i class="fa-solid fa-circle-xmark" style="color:var(--red)"></i> Error: ' + err.message);
  }
}

async function saveOfficeSettings() {
  const alertEl = document.getElementById('settingsAlert');
  const settings = {
    OFFICE_NAME:       document.getElementById('sOfficeName')?.value || '',
    OFFICE_START_TIME: document.getElementById('sStartTime')?.value  || '',
    QR_EXPIRY_SECONDS: document.getElementById('sQrExpiry')?.value   || '',
  };

  try {
    const result = await API.post({ action: 'updateSettings', settings });
    showSettingsAlert(alertEl, result.success ? 'success' : 'error',
      result.message || (result.success ? 'Office settings saved.' : 'Save failed.'));
    if (result.success) showToast('success', 'Office settings updated.');
  } catch (err) {
    showSettingsAlert(alertEl, 'error', err.message);
  }
}

async function saveGPSSettings() {
  const alertEl = document.getElementById('settingsAlert');
  const lat     = document.getElementById('sLat')?.value    || '';
  const lng     = document.getElementById('sLng')?.value    || '';
  const radius  = document.getElementById('sRadius')?.value || '';

  if (!lat || !lng) { showSettingsAlert(alertEl, 'error', 'Latitude and Longitude are required.'); return; }
  if (isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
    showSettingsAlert(alertEl, 'error', 'Latitude and Longitude must be valid numbers.');
    return;
  }

  const settings = {
    OFFICE_LATITUDE:  lat,
    OFFICE_LONGITUDE: lng,
    ALLOWED_RADIUS:   radius,
  };

  try {
    const result = await API.post({ action: 'updateSettings', settings });
    showSettingsAlert(alertEl, result.success ? 'success' : 'error',
      result.message || (result.success ? 'GPS settings saved.' : 'Save failed.'));
    if (result.success) showToast('success', 'GPS settings updated.');
  } catch (err) {
    showSettingsAlert(alertEl, 'error', err.message);
  }
}

async function saveAdminCredentials() {
  const alertEl  = document.getElementById('settingsAlert');
  const username = document.getElementById('sAdminUser')?.value.trim() || '';
  const password = document.getElementById('sAdminPass')?.value.trim() || '';

  if (!username) { showSettingsAlert(alertEl, 'error', 'Username cannot be empty.'); return; }

  const settings = { ADMIN_USERNAME: username };
  if (password) settings['ADMIN_PASSWORD'] = password;

  try {
    const result = await API.post({ action: 'updateSettings', settings });
    showSettingsAlert(alertEl, result.success ? 'success' : 'error',
      result.success ? 'Credentials updated. Re-login required.' : (result.message || 'Save failed.'));
    if (result.success) {
      showToast('info', 'Credentials updated — you will need to log in again.');
      if (password) setTimeout(() => {
        sessionStorage.removeItem('adminAuth');
        window.location.href = 'index.html';
      }, 2500);
    }
  } catch (err) {
    showSettingsAlert(alertEl, 'error', err.message);
  }
}

async function testAPIConnection() {
  const statusEl = document.getElementById('infoApiStatus');
  if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Testing…';

  try {
    const result = await API.get({ action: 'getDashboardStats' });
    if (result.success) {
      if (statusEl) statusEl.innerHTML =
        '<i class="fa-solid fa-circle-check" style="color:var(--green)"></i> Connected ✓';
      showToast('success', 'API connection successful!');
    } else {
      if (statusEl) statusEl.innerHTML =
        '<i class="fa-solid fa-circle-xmark" style="color:var(--red)"></i> ' + (result.message || 'Error');
      showToast('error', result.message || 'API returned an error.');
    }
  } catch (err) {
    if (statusEl) statusEl.innerHTML =
      '<i class="fa-solid fa-circle-xmark" style="color:var(--red)"></i> ' + err.message;
    showToast('error', 'Connection failed: ' + err.message);
  }
}

function detectOfficeLocation() {
  if (!navigator.geolocation) {
    showToast('error', 'Geolocation is not supported by this browser.');
    return;
  }
  showToast('info', 'Detecting your current location…');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      const latEl = document.getElementById('sLat');
      const lngEl = document.getElementById('sLng');
      if (latEl) latEl.value = lat;
      if (lngEl) lngEl.value = lng;
      showToast('success', `Location detected: ${lat}, ${lng}`);
    },
    (err) => {
      showToast('error', 'GPS error: ' + err.message);
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function showSettingsAlert(el, type, msg) {
  if (!el) return;
  el.className = `login-alert login-alert--${type} show`;
  el.innerHTML = `<i class="fa-solid fa-${type === 'error' ? 'circle-xmark' : 'circle-check'}"></i> ${msg}`;
  setTimeout(() => {
    el.className = 'login-alert';
    el.textContent = '';
  }, 5000);
}


/* ============================================================
   ATTENDANCE TABLE — Admin Attendance Section
   ============================================================ */
let _allAttendanceData   = [];
let _attCurrentPage      = 1;
const _ATT_PAGE_SIZE     = 25;

async function loadAttendanceTable(filters = {}) {
  const tbody   = document.getElementById('attTableBody');
  const countEl = document.getElementById('attTableCount');

  if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="table-empty">
    <i class="fa-solid fa-circle-notch fa-spin"></i> Loading records…</td></tr>`;

  try {
    const params = { action: 'getAttendance', limit: '500' };
    if (filters.date)       params.date       = filters.date;
    if (filters.employeeId) params.employeeId = filters.employeeId;

    const result = await API.get(params);
    if (!result.success) throw new Error(result.message);

    let records = result.data;

    // Client-side status filter
    if (filters.status) {
      records = records.filter(r => r.status === filters.status);
    }

    _allAttendanceData = records;
    _attCurrentPage    = 1;
    renderAttendancePage();

    if (countEl) countEl.textContent = records.length + ' records';

    const titleEl = document.getElementById('attTableTitle');
    if (titleEl) {
      if (filters.date) titleEl.textContent = `Attendance for ${formatDateDisplay(filters.date)}`;
      else titleEl.textContent = 'All Attendance Records';
    }

  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="table-empty">
      <i class="fa-solid fa-triangle-exclamation" style="color:var(--amber)"></i>
      ${err.message}</td></tr>`;
    showToast('error', 'Failed to load attendance: ' + err.message);
  }
}

function renderAttendancePage() {
  const tbody = document.getElementById('attTableBody');
  if (!tbody) return;

  const start   = (_attCurrentPage - 1) * _ATT_PAGE_SIZE;
  const end     = start + _ATT_PAGE_SIZE;
  const records = _allAttendanceData.slice(start, end);

  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="table-empty">No records found.</td></tr>';
    renderPagination();
    return;
  }

  tbody.innerHTML = records.map((r, i) => `
    <tr>
      <td style="color:var(--text-muted)">${start + i + 1}</td>
      <td><code style="color:var(--gold);font-size:.8rem">${r.id || '—'}</code></td>
      <td>
        <div style="font-weight:500;color:var(--text-primary)">${r.employeeName || '—'}</div>
        <div style="font-size:.72rem;color:var(--text-muted)">${r.employeeId || ''}</div>
      </td>
      <td>${formatDateDisplay(r.date)}</td>
      <td style="font-weight:500">${r.checkIn || '—'}</td>
      <td style="color:var(--text-muted)">${r.checkOut || '—'}</td>
      <td><span class="status-badge status-badge--${(r.status || '').toLowerCase()}">${r.status || '—'}</span></td>
      <td>
        ${r.latitude
          ? `<a class="gps-link" href="https://maps.google.com/?q=${r.latitude},${r.longitude}" target="_blank" rel="noopener">
               <i class="fa-solid fa-location-dot" style="color:var(--gold)"></i>
               ${parseFloat(r.latitude).toFixed(4)}, ${parseFloat(r.longitude).toFixed(4)}
             </a>`
          : '<span style="color:var(--text-muted)">—</span>'}
      </td>
      <td style="font-size:.75rem;color:var(--text-muted);max-width:140px;overflow:hidden;text-overflow:ellipsis">
        ${(r.deviceInfo || '—').substring(0, 35)}
      </td>
    </tr>
  `).join('');

  renderPagination();
}

function renderPagination() {
  const container = document.getElementById('attPagination');
  if (!container) return;

  const totalPages = Math.ceil(_allAttendanceData.length / _ATT_PAGE_SIZE);
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    pages.push(`
      <button
        class="btn-sm ${p === _attCurrentPage ? 'btn-gold' : 'btn-gold-outline'}"
        onclick="goToAttPage(${p})"
        ${p === _attCurrentPage ? 'disabled' : ''}
        style="min-width:36px"
      >${p}</button>
    `);
  }
  container.innerHTML = `
    <button class="btn-sm btn-gold-outline" onclick="goToAttPage(${_attCurrentPage - 1})"
      ${_attCurrentPage === 1 ? 'disabled' : ''}>
      <i class="fa-solid fa-chevron-left"></i>
    </button>
    ${pages.join('')}
    <button class="btn-sm btn-gold-outline" onclick="goToAttPage(${_attCurrentPage + 1})"
      ${_attCurrentPage === totalPages ? 'disabled' : ''}>
      <i class="fa-solid fa-chevron-right"></i>
    </button>
  `;
}

function goToAttPage(page) {
  const totalPages = Math.ceil(_allAttendanceData.length / _ATT_PAGE_SIZE);
  if (page < 1 || page > totalPages) return;
  _attCurrentPage = page;
  renderAttendancePage();
  document.getElementById('section-attendance')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Filter bar controls
function applyAttendanceFilter() {
  const date   = document.getElementById('filterDate')?.value  || '';
  const empId  = document.getElementById('filterEmpId')?.value || '';
  const status = document.getElementById('filterStatus')?.value || '';
  loadAttendanceTable({ date, employeeId: empId, status });
}

function clearAttendanceFilter() {
  const dateEl   = document.getElementById('filterDate');
  const empIdEl  = document.getElementById('filterEmpId');
  const statusEl = document.getElementById('filterStatus');
  if (dateEl)   dateEl.value   = '';
  if (empIdEl)  empIdEl.value  = '';
  if (statusEl) statusEl.value = '';
  loadAttendanceTable({});
}


/* ============================================================
   EMPLOYEE MANAGEMENT
   (used in admin.html employees section)
   ============================================================ */
let _allEmployeesData = [];

async function loadEmployees() {
  const grid  = document.getElementById('empGrid');
  const tbody = document.getElementById('empTableBody');

  if (grid)  grid.innerHTML  = '<div class="emp-grid__loading"><i class="fa-solid fa-circle-notch fa-spin gold-text"></i><span>Loading employees…</span></div>';
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="table-empty"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading…</td></tr>';

  try {
    const result = await API.get({ action: 'getEmployees' });
    if (!result.success) throw new Error(result.message);

    _allEmployeesData = result.data;
    renderEmployeeGrid(_allEmployeesData);
    renderEmployeeTable(_allEmployeesData);

    const countEl = document.getElementById('empTableCount');
    if (countEl) countEl.textContent = result.data.length + ' employees';

  } catch (err) {
    if (grid)  grid.innerHTML  = `<div class="emp-grid__loading" style="color:var(--red)"><i class="fa-solid fa-triangle-exclamation"></i> ${err.message}</div>`;
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="table-empty">${err.message}</td></tr>`;
  }
}

function renderEmployeeGrid(employees) {
  const grid = document.getElementById('empGrid');
  if (!grid) return;

  if (!employees.length) {
    grid.innerHTML = '<div class="emp-grid__loading"><i class="fa-solid fa-users" style="color:var(--text-muted)"></i> No employees found.</div>';
    return;
  }

  grid.innerHTML = employees.map(e => `
    <div class="emp-card glass-card">
      <div class="emp-card__top">
        <div class="emp-card__avatar">
          <i class="fa-solid fa-user-tie"></i>
        </div>
        <div>
          <div class="emp-card__name">${e.name}</div>
          <div class="emp-card__id">${e.id}</div>
          <div class="emp-card__dept">${e.department}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;font-size:.78rem">
        <span class="status-badge status-badge--${(e.status || 'Active').toLowerCase()}">${e.status || 'Active'}</span>
        <span style="color:var(--text-muted)">${e.email || ''}</span>
      </div>
      <div class="emp-card__actions">
        <button class="emp-card__btn emp-card__btn--edit" onclick='openEditEmployeeModal(${JSON.stringify(e)})'>
          <i class="fa-solid fa-pen-to-square"></i> Edit
        </button>
        <button class="emp-card__btn emp-card__btn--delete" onclick="deleteEmployee('${e.id}','${e.name.replace(/'/g,"\\'")}')">
          <i class="fa-solid fa-user-slash"></i> Deactivate
        </button>
      </div>
    </div>
  `).join('');
}

function renderEmployeeTable(employees) {
  const tbody = document.getElementById('empTableBody');
  if (!tbody) return;

  if (!employees.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No employees found.</td></tr>';
    return;
  }

  tbody.innerHTML = employees.map(e => `
    <tr>
      <td><code style="color:var(--gold)">${e.id}</code></td>
      <td style="font-weight:500;color:var(--text-primary)">${e.name}</td>
      <td>${e.department}</td>
      <td style="font-size:.82rem">${e.email || '—'}</td>
      <td style="font-size:.82rem">${e.phone || '—'}</td>
      <td>
        <code style="background:rgba(212,175,55,.07);padding:2px 8px;border-radius:4px;font-size:.8rem;color:var(--gold)">
          ${e.pin || '****'}
        </code>
      </td>
      <td><span class="status-badge status-badge--${(e.status || 'active').toLowerCase()}">${e.status || 'Active'}</span></td>
      <td>
        <div style="display:flex;gap:.4rem">
          <button class="btn-sm btn-gold-outline" onclick='openEditEmployeeModal(${JSON.stringify(e)})' title="Edit">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn-sm" style="background:var(--red-dim);border:1px solid rgba(239,68,68,.3);color:var(--red);border-radius:var(--radius-full);padding:.42rem .9rem;font-size:.8rem"
            onclick="deleteEmployee('${e.id}','${e.name.replace(/'/g,"\\'")}')">
            <i class="fa-solid fa-user-slash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Search/filter employees table in real time
function filterEmployeeTable() {
  const q = (document.getElementById('empSearch')?.value || '').toLowerCase();
  if (!q) {
    renderEmployeeGrid(_allEmployeesData);
    renderEmployeeTable(_allEmployeesData);
    return;
  }
  const filtered = _allEmployeesData.filter(e =>
    e.name.toLowerCase().includes(q) ||
    e.id.toLowerCase().includes(q) ||
    (e.department || '').toLowerCase().includes(q) ||
    (e.email || '').toLowerCase().includes(q)
  );
  renderEmployeeGrid(filtered);
  renderEmployeeTable(filtered);
}


/* ============================================================
   GLOBAL ERROR HANDLER
   ============================================================ */
window.addEventListener('unhandledrejection', (e) => {
  console.error('[Unhandled Promise]', e.reason);
});
