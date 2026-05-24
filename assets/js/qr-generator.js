/* ============================================================
   TRIP FLY BD — SMART ATTENDANCE SYSTEM
   qr-generator.js  |  QR Code Generation & Admin Station
   ─────────────────────────────────────────────────────────
   Loaded by: admin.html
   Depends on: app.js, qrcode.js (CDN)
   Provides:
     - Dynamic QR code generation using QRCode.js
     - Manual "Generate New QR" button
     - Scan stats polling
   ============================================================ */

'use strict';

/* ============================================================
   QR GENERATOR MODULE
   ============================================================ */
const QRGenerator = (() => {

  // ── State ─────────────────────────────────────────────
  let _qrInstance   = null;
  let _pollTimer    = null;
  let _currentToken = null;
  let _initialized  = false;

  // ── DOM element IDs ───────────────────────────────────
  const IDS = {
    canvas:      'qrCanvas',
    activeToken: 'activeToken',
    genTime:     'tokenGenTime',
    expTime:     'tokenExpTime',
    scanPresent: 'scanStatPresent',
    scanLate:    'scanStatLate',
    scanAbsent:  'scanStatAbsent',
  };

  // ── Render QR into #qrCanvas ──────────────────────────
  function _renderQR(token) {
    const container = document.getElementById(IDS.canvas);
    if (!container) return;

    container.innerHTML = '';

    if (!token) {
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:.5rem;
                    color:var(--text-muted);font-size:.8rem;padding:2rem">
          <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem;color:var(--amber)"></i>
          <span>No active QR — click Generate</span>
        </div>`;
      return;
    }

    try {
      if (typeof QRCode === 'undefined') throw new Error('QRCode.js library did not load.');

      const qrPayload = JSON.stringify({
        token:     token,
        system:    'TripFlyBD',
        timestamp: Date.now(),
      });

      _qrInstance = new QRCode(container, {
        text:         qrPayload,
        width:        220,
        height:       220,
        colorDark:    '#000000',
        colorLight:   '#ffffff',
        correctLevel: QRCode.CorrectLevel.H,
      });
    } catch (err) {
      console.error('[QRGenerator] render error:', err);
      container.innerHTML = `<span style="color:var(--red);font-size:.8rem">QR render failed: ${err.message}</span>`;
    }
  }

  // ── Update token info panel ───────────────────────────
  function _updateTokenInfo(data) {
    const tokenEl = document.getElementById(IDS.activeToken);
    const genEl   = document.getElementById(IDS.genTime);
    const expEl   = document.getElementById(IDS.expTime);

    if (tokenEl) tokenEl.textContent = data.token || '—';

    if (genEl && data.generatedAt) {
      genEl.textContent = new Date(data.generatedAt).toLocaleTimeString('en-BD', {
        hour: '2-digit', minute: '2-digit', hour12: true,
      });
    }
    if (expEl && data.expiresAt) {
      // Show as date+time since it's 24h
      expEl.textContent = new Date(data.expiresAt).toLocaleString('en-BD', {
        day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: true,
      });
    }
  }

  // ── Fetch active QR from server ───────────────────────
  async function fetchAndDisplay() {
    // Show loading
    const canvas = document.getElementById(IDS.canvas);
    if (canvas) {
      canvas.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;
                    width:220px;height:220px">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size:2.5rem;color:var(--gold)"></i>
        </div>`;
    }

    try {
      const result = await API.get({ action: 'getCurrentQR' });

      if (!result.success) {
        console.warn('[QRGenerator] getCurrentQR failed:', result.message);
        if (canvas) canvas.innerHTML =
          `<div style="padding:1rem;text-align:center;color:var(--red);font-size:.8rem">
            <i class="fa-solid fa-circle-xmark" style="font-size:1.5rem"></i><br>${result.message}
          </div>`;
        return;
      }

      _currentToken = result.token;

      _renderQR(_currentToken);
      _updateTokenInfo({
        token:       result.token,
        generatedAt: result.generatedAt || new Date().toISOString(),
        expiresAt:   result.expiresAt,
      });

    } catch (err) {
      console.error('[QRGenerator] Fetch error:', err.message);
      showToast('error', 'QR fetch failed: ' + err.message);
      if (canvas) canvas.innerHTML =
        `<div style="padding:1rem;text-align:center;color:var(--red);font-size:.8rem">
          <i class="fa-solid fa-wifi" style="font-size:1.5rem"></i><br>Connection error
        </div>`;
    }
  }

  // ── Update scan stats ─────────────────────────────────
  async function _updateScanStats() {
    try {
      const result = await API.get({ action: 'getDashboardStats' });
      if (!result.success) return;
      const d = result.data;
      setText(IDS.scanPresent, d.presentToday || 0);
      setText(IDS.scanLate,    d.lateToday    || 0);
      setText(IDS.scanAbsent,  d.absentToday  || 0);
    } catch { /* silent */ }
  }

  // ── Public: init QR station ───────────────────────────
  function initQRStation() {
    if (_initialized) {
      _updateScanStats();
      return;
    }
    _initialized = true;

    // Fetch QR on load
    fetchAndDisplay();

    // Poll scan stats every 30 seconds
    _pollTimer = setInterval(_updateScanStats, 30000);
    _updateScanStats();
  }

  // ── Public: force generate new QR ────────────────────
  async function forceRefreshQR() {
    const canvas = document.getElementById(IDS.canvas);
    if (canvas) {
      canvas.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;
                    width:220px;height:220px">
          <i class="fa-solid fa-circle-notch fa-spin" style="font-size:2.5rem;color:var(--gold)"></i>
        </div>`;
    }

    try {
      const result = await API.post({ action: 'generateQR' });
      if (!result.success) throw new Error(result.message);

      _currentToken = result.token;
      _renderQR(_currentToken);
      _updateTokenInfo({
        token:       result.token,
        generatedAt: result.generatedAt,
        expiresAt:   result.expiresAt,
      });

      showToast('success', 'নতুন QR generate হয়েছে — valid for 24 hours.');
      _updateScanStats();

    } catch (err) {
      showToast('error', 'QR generation failed: ' + err.message);
      fetchAndDisplay();
    }
  }

  // ── Public: destroy ───────────────────────────────────
  function destroy() {
    clearInterval(_pollTimer);
    _initialized = false;
  }

  function getCurrentToken() { return _currentToken; }

  return { initQRStation, forceRefreshQR, destroy, getCurrentToken };

})();


/* ============================================================
   GLOBAL BINDINGS
   ============================================================ */
function initQRStation()  { QRGenerator.initQRStation();  }
function forceRefreshQR() { QRGenerator.forceRefreshQR(); }
