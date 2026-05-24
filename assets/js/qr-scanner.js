/* ============================================================
   TRIP FLY BD — SMART ATTENDANCE SYSTEM
   qr-scanner.js  |  Employee QR Scanning & Attendance Marking
   ─────────────────────────────────────────────────────────
   Loaded by: employee.html
   Depends on: app.js, gps.js, html5-qrcode (CDN)
   Provides:
     - Camera-based QR scanning via html5-qrcode
     - 1st scan  → Check-In  (with GPS + QR validation)
     - 2nd scan  → Check-Out (QR confirms presence)
     - Success / error popup triggers
   ============================================================ */

'use strict';

/* ============================================================
   SCANNER MODULE
   ============================================================ */
const Scanner = (() => {

  // ── State ─────────────────────────────────────────────
  let _html5QrCode  = null;
  let _isScanning   = false;
  let _isProcessing = false;
  let _scanLock     = false;
  let _scanMode     = 'checkin';   // 'checkin' | 'checkout'

  // ── Config ────────────────────────────────────────────
  const READER_ID        = 'qrReaderViewfinder';
  const SCAN_FPS         = 10;
  const SCAN_QR_BOX_SIZE = 220;

  const CAMERA_CONFIG = {
    fps:      SCAN_FPS,
    qrbox:    { width: SCAN_QR_BOX_SIZE, height: SCAN_QR_BOX_SIZE },
    aspectRatio: 1.0,
    showTorchButtonIfSupported: true,
    showZoomSliderIfSupported:  true,
    defaultZoomValueIfSupported: 1.5,
    formatsToSupport: [0],
  };

  // ── Public: set scan mode before starting ─────────────
  function setScanMode(mode) {
    _scanMode = mode === 'checkout' ? 'checkout' : 'checkin';
  }

  // ── Start scanner ─────────────────────────────────────
  async function start() {
    if (_isScanning) return;

    const startBtn  = document.getElementById('startScanBtn');
    const stopBtn   = document.getElementById('stopScanBtn');
    const container = document.getElementById('scannerContainer');
    const scanFrame = document.getElementById('scanFrame');
    const hint      = document.getElementById('scannerHint');

    if (!document.getElementById(READER_ID)) {
      console.error('[Scanner] Reader element not found:', READER_ID);
      return;
    }
    if (typeof Html5Qrcode === 'undefined') {
      const msg = 'QR scanner library did not load. Check your internet connection and reload.';
      if (typeof showErrorPopup === 'function') showErrorPopup('Scanner Error', msg);
      else showToast('error', msg, 6000);
      return;
    }

    try {
      if (container) container.classList.add('active');
      if (scanFrame) {
        scanFrame.style.display = '';
        // Teal frame for check-out, gold for check-in
        scanFrame.style.setProperty('--frame-color',
          _scanMode === 'checkout' ? '#63cab7' : 'var(--gold)');
      }
      if (startBtn) startBtn.classList.add('hidden');
      if (stopBtn)  stopBtn.classList.remove('hidden');

      // Update hint text based on mode
      if (hint) {
        hint.innerHTML = _scanMode === 'checkout'
          ? '<i class="fa-solid fa-door-open" style="color:#63cab7"></i> QR scan করুন — Check-Out হবে'
          : '<i class="fa-solid fa-camera-rotate"></i> QR code এ camera point করুন';
      }

      _html5QrCode = new Html5Qrcode(READER_ID);
      await _html5QrCode.start(
        { facingMode: 'environment' },
        CAMERA_CONFIG,
        _onScanSuccess,
        _onScanError
      );

      _isScanning = true;
      _scanLock   = false;

      const scanLine = document.getElementById('scanLine');
      if (scanLine) scanLine.style.display = '';

      const modeMsg = _scanMode === 'checkout'
        ? '📤 Camera active — scan করুন Check-Out এর জন্য'
        : '📷 Camera active — QR code এ point করুন';
      showToast('info', modeMsg, 3000);

    } catch (err) {
      console.error('[Scanner] Start error:', err);
      _handleStartError(err);
    }
  }

  // ── Stop scanner ──────────────────────────────────────
  async function stop() {
    if (!_isScanning || !_html5QrCode) return;

    const startBtn  = document.getElementById('startScanBtn');
    const stopBtn   = document.getElementById('stopScanBtn');
    const container = document.getElementById('scannerContainer');

    try {
      await _html5QrCode.stop();
      await _html5QrCode.clear();
    } catch (err) {
      console.warn('[Scanner] Stop warning:', err);
    }

    _html5QrCode = null;
    _isScanning  = false;

    if (container) container.classList.remove('active');
    if (startBtn)  startBtn.classList.remove('hidden');
    if (stopBtn)   stopBtn.classList.add('hidden');
  }

  // ── Handle camera start errors ────────────────────────
  function _handleStartError(err) {
    const container = document.getElementById('scannerContainer');
    if (container) container.classList.remove('active');
    const startBtn = document.getElementById('startScanBtn');
    const stopBtn  = document.getElementById('stopScanBtn');
    if (startBtn) startBtn.classList.remove('hidden');
    if (stopBtn)  stopBtn.classList.add('hidden');

    let msg = 'Camera error: ' + err.message;
    if (err.message && err.message.toLowerCase().includes('permission'))
      msg = 'Camera permission denied. Please allow camera access and retry.';
    else if (err.message && err.message.toLowerCase().includes('notfound'))
      msg = 'No camera found on this device.';
    else if (err.message && err.message.toLowerCase().includes('insecure'))
      msg = 'Camera requires HTTPS. Please serve the page over a secure connection.';

    if (typeof showErrorPopup === 'function') showErrorPopup('Camera Error', msg);
    else showToast('error', msg, 6000);
  }

  // ── QR scan success ───────────────────────────────────
  async function _onScanSuccess(decodedText) {
    if (_isProcessing || _scanLock) return;
    _isProcessing = true;

    // Visual feedback — flash frame
    const scanFrame = document.getElementById('scanFrame');
    if (scanFrame) {
      const flashColor = _scanMode === 'checkout' ? '#63cab7' : 'var(--gold)';
      scanFrame.style.borderColor = flashColor;
      setTimeout(() => { if (scanFrame) scanFrame.style.borderColor = ''; }, 600);
    }

    // Pause scanner during processing
    if (_html5QrCode && _isScanning) {
      try { await _html5QrCode.pause(true); } catch {}
    }

    try {
      // ── 1. Parse QR payload ──────────────────────────
      let token = null;
      try {
        const payload = JSON.parse(decodedText);
        token = payload.token;
      } catch {
        token = decodedText.trim();
      }
      if (!token) throw new Error('Invalid QR code — no token found.');

      // ── 2. Get employee session ──────────────────────
      const session = getEmployeeSession();
      if (!session || !session.employee) {
        window.location.href = 'index.html';
        return;
      }
      const employee = session.employee;

      // ── 3. GPS (check-in only) ───────────────────────
      let latitude = null, longitude = null;

      if (_scanMode === 'checkin') {
        const gps = window.GPSModule || (typeof GPSModule !== 'undefined' ? GPSModule : null);
        if (gps && gps.hasPosition()) {
          const pos = gps.getPosition();
          latitude  = pos.latitude;
          longitude = pos.longitude;
        } else {
          try {
            if (!gps) throw new Error('GPS module did not load.');
            const pos = await gps.requestOnce(8000);
            latitude  = pos.latitude;
            longitude = pos.longitude;
          } catch (gpsErr) {
            console.warn('[Scanner] GPS unavailable:', gpsErr.message);
            throw new Error('GPS is required for attendance. Please allow location access and try again.');
          }
        }
      }

      // ── 4. Show processing state ─────────────────────
      _showProcessingUI(true);

      // ── 5. API call based on mode ────────────────────
      let result;

      if (_scanMode === 'checkout') {
        // Check-Out — validate QR token too so presence at gate is confirmed
        result = await API.post({
          action:     'checkOut',
          employeeId: employee.id,
          qrToken:    token,       // passed for logging; server validates if desired
        });
      } else {
        // Check-In — full markAttendance with GPS + QR validation
        const deviceInfo = _getDeviceInfo();
        const body = {
          action:     'markAttendance',
          employeeId: employee.id,
          qrToken:    token,
          deviceInfo,
        };
        if (latitude  !== null) body.latitude  = latitude;
        if (longitude !== null) body.longitude = longitude;
        result = await API.post(body);
      }

      // ── 6. Handle response ───────────────────────────
      _showProcessingUI(false);

      if (result.success) {
        _scanLock = true;
        await stop();

        if (_scanMode === 'checkout') {
          if (typeof showCheckoutPopup === 'function') showCheckoutPopup(result.checkOut);
        } else {
          if (typeof showSuccessPopup === 'function') showSuccessPopup(result);
        }

      } else {
        const label  = _scanMode === 'checkout' ? 'Check-Out Failed' : 'Check-In Failed';
        const errMsg = result.message || 'Could not process. Please try again.';

        if (typeof showErrorPopup === 'function') showErrorPopup(label, errMsg);
        else showToast('error', errMsg, 5000);

        setTimeout(() => {
          if (_html5QrCode && _isScanning) {
            try { _html5QrCode.resume(); } catch {}
          }
          _isProcessing = false;
        }, 2500);
        return;
      }

    } catch (err) {
      console.error('[Scanner] Processing error:', err);
      _showProcessingUI(false);

      if (typeof showErrorPopup === 'function') showErrorPopup('Scan Error', err.message);
      else showToast('error', err.message, 5000);

      setTimeout(() => {
        if (_html5QrCode && _isScanning) {
          try { _html5QrCode.resume(); } catch {}
        }
        _isProcessing = false;
      }, 2000);
      return;
    }

    _isProcessing = false;
  }

  // ── Scan error (silent — fires every frame without QR) ─
  function _onScanError() {}

  // ── Processing overlay ────────────────────────────────
  function _showProcessingUI(loading) {
    const hint = document.getElementById('scannerHint');
    if (!hint) return;
    if (loading) {
      const msg = _scanMode === 'checkout'
        ? '<i class="fa-solid fa-circle-notch fa-spin"></i> Check-Out করা হচ্ছে…'
        : '<i class="fa-solid fa-circle-notch fa-spin"></i> Attendance verify হচ্ছে…';
      const bg = _scanMode === 'checkout'
        ? 'rgba(99,202,183,0.15)'
        : 'rgba(212,175,55,0.15)';
      hint.innerHTML  = msg;
      hint.style.background = bg;
    } else {
      hint.innerHTML = '<i class="fa-solid fa-camera-rotate"></i> QR code এ camera point করুন';
      hint.style.background = '';
    }
  }

  // ── Device info string ────────────────────────────────
  function _getDeviceInfo() {
    const ua = navigator.userAgent || '';
    let browser = 'Unknown', os = 'Unknown';
    if (/Chrome\/(\d+)/.test(ua))       browser = 'Chrome/'  + ua.match(/Chrome\/(\d+)/)[1];
    else if (/Firefox\/(\d+)/.test(ua)) browser = 'Firefox/' + ua.match(/Firefox\/(\d+)/)[1];
    else if (/Safari\/(\d+)/.test(ua))  browser = 'Safari';
    else if (/Edge\/(\d+)/.test(ua))    browser = 'Edge/'    + ua.match(/Edge\/(\d+)/)[1];
    if (/Android/.test(ua))             os = 'Android';
    else if (/iPhone|iPad/.test(ua))    os = 'iOS';
    else if (/Windows/.test(ua))        os = 'Windows';
    else if (/Mac/.test(ua))            os = 'macOS';
    else if (/Linux/.test(ua))          os = 'Linux';
    return `${browser} / ${os}`;
  }

  return { start, stop, setScanMode };

})();


/* ============================================================
   GLOBAL BINDINGS
   ============================================================ */
window.empQRScanner = Scanner;

function startQRScan() {
  const alreadyDiv  = document.getElementById('alreadyCheckedIn');
  const checkoutBtn = document.getElementById('checkoutBtn');

  const hasCheckedIn  = alreadyDiv  && !alreadyDiv.classList.contains('hidden');
  // checkoutBtn hidden means checkout already done (or not loaded yet)
  const checkoutDone  = !checkoutBtn || checkoutBtn.classList.contains('hidden');

  // Both done → nothing to do
  if (hasCheckedIn && checkoutDone) {
    showToast('info', 'আজকের check-in এবং check-out দুটোই সম্পন্ন হয়েছে ✓', 4000);
    return;
  }

  // Determine mode
  const mode = hasCheckedIn ? 'checkout' : 'checkin';
  Scanner.setScanMode(mode);
  Scanner.start();
}

function stopQRScan() {
  Scanner.stop();
}
