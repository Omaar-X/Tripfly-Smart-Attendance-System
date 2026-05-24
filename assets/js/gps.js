/* ============================================================
   TRIP FLY BD — SMART ATTENDANCE SYSTEM
   gps.js  |  GPS Location Module
   ─────────────────────────────────────────────────────────
   Loaded by: employee.html
   Depends on: app.js (for showToast)
   Provides:
     - GPSModule: continuous position watching
     - Single-shot GPS request with timeout
     - Haversine distance calculation (client-side estimate)
     - Status indicator updates
     - Settings-based office coordinates
   ============================================================ */

'use strict';

/* ============================================================
   GPS MODULE
   ============================================================ */
const GPSModule = (() => {

  // ── State ─────────────────────────────────────────────
  let _watchId        = null;
  let _currentPos     = null;   // { latitude, longitude, accuracy, timestamp }
  let _onSuccessCb    = null;
  let _onErrorCb      = null;
  let _officeCoords   = null;   // { lat, lng, radius } — loaded from server
  let _initialized    = false;
  let _errorCount     = 0;
  const MAX_ERRORS    = 5;

  // ── Geolocation options ───────────────────────────────
  const GEO_OPTIONS_WATCH = {
    enableHighAccuracy: true,
    timeout:            15000,
    maximumAge:         10000,   // accept cached position up to 10s old
  };

  const GEO_OPTIONS_ONCE = {
    enableHighAccuracy: true,
    timeout:            12000,
    maximumAge:         5000,
  };

  // ── Internal: handle new position ─────────────────────
  function _onPosition(position) {
    _errorCount  = 0;
    _currentPos  = {
      latitude:  position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy:  position.coords.accuracy,
      altitude:  position.coords.altitude,
      timestamp: position.timestamp,
    };
    _initialized = true;

    // Update UI status
    _updateStatusUI('ok', _currentPos);

    // Compute distance from office if coords loaded
    if (_officeCoords) {
      const dist = haversineDistance(
        _currentPos.latitude,  _currentPos.longitude,
        _officeCoords.lat,     _officeCoords.lng
      );
      _updateDistanceUI(dist, _officeCoords.radius);
    }

    if (typeof _onSuccessCb === 'function') _onSuccessCb(_currentPos);
  }

  // ── Internal: handle geolocation error ────────────────
  function _onGeoError(error) {
    _errorCount++;
    let msg;

    switch (error.code) {
      case error.PERMISSION_DENIED:
        msg = 'Location access denied. Please allow GPS permission.';
        break;
      case error.POSITION_UNAVAILABLE:
        msg = 'Location unavailable. Check GPS signal.';
        break;
      case error.TIMEOUT:
        msg = 'GPS timed out. Retrying…';
        break;
      default:
        msg = 'GPS error: ' + (error.message || 'Unknown');
    }

    _updateStatusUI('error', null, msg);

    if (typeof _onErrorCb === 'function') _onErrorCb(msg);

    // Stop watching after too many errors
    if (_errorCount >= MAX_ERRORS) {
      console.warn('[GPS] Too many errors — stopping watch.');
      stop();
      showToast('warning', 'GPS tracking stopped after repeated errors.', 5000);
    }
  }

  // ── Internal: update GPS status bar UI ────────────────
  function _updateStatusUI(state, pos, msg) {
    const dotEl  = document.getElementById('gpsDot');
    const textEl = document.getElementById('gpsStatusText');
    if (!dotEl || !textEl) return;

    if (state === 'ok') {
      dotEl.className   = 'gps-status-bar__dot gps-status-bar__dot--ok';
      const acc = pos?.accuracy ? ` (±${Math.round(pos.accuracy)}m)` : '';
      textEl.innerHTML  = `<i class="fa-solid fa-location-dot"></i> GPS Active${acc}`;
    } else if (state === 'error') {
      dotEl.className   = 'gps-status-bar__dot gps-status-bar__dot--error';
      textEl.innerHTML  = `<i class="fa-solid fa-location-slash"></i> ${msg || 'GPS error'}`;
    } else {
      dotEl.className   = 'gps-status-bar__dot';
      dotEl.style.background = '#666';
      textEl.innerHTML  = `<i class="fa-solid fa-circle-notch fa-spin"></i> Requesting GPS…`;
    }
  }

  // ── Internal: update distance label ───────────────────
  function _updateDistanceUI(distanceM, radiusM) {
    const distEl = document.getElementById('gpsDistance');
    if (!distEl) return;

    const inside = distanceM <= radiusM;
    distEl.textContent = inside
      ? `${Math.round(distanceM)}m from office ✓`
      : `${Math.round(distanceM)}m from office (limit: ${radiusM}m)`;
    distEl.style.color = inside ? 'var(--green)' : 'var(--red)';
  }

  // ── Internal: load office GPS from server ─────────────
  async function _loadOfficeCoords() {
    try {
      const result = await API.get({ action: 'getSettings' });
      if (result.success && result.data) {
        const s  = result.data;
        const lat = parseFloat(s['OFFICE_LATITUDE']  || '23.8103');
        const lng = parseFloat(s['OFFICE_LONGITUDE'] || '90.4125');
        const r   = parseFloat(s['ALLOWED_RADIUS']   || '100');
        if (!isNaN(lat) && !isNaN(lng) && !isNaN(r)) {
          _officeCoords = { lat, lng, radius: r };
        }
      }
    } catch {
      // Non-fatal — distance UI just won't show
    }
  }

  // ── Public: init continuous watch ─────────────────────
  function init(onSuccess, onError) {
    if (!navigator.geolocation) {
      const msg = 'Geolocation not supported by this browser.';
      _updateStatusUI('error', null, msg);
      if (typeof onError === 'function') onError(msg);
      return;
    }

    _onSuccessCb = onSuccess;
    _onErrorCb   = onError;

    // Load office coords in background
    _loadOfficeCoords();

    // Clear any existing watch
    if (_watchId !== null) {
      navigator.geolocation.clearWatch(_watchId);
      _watchId = null;
    }

    // Start watching
    _watchId = navigator.geolocation.watchPosition(
      _onPosition,
      _onGeoError,
      GEO_OPTIONS_WATCH
    );

    // Update UI to requesting state
    _updateStatusUI('requesting');
  }

  // ── Public: stop watching ─────────────────────────────
  function stop() {
    if (_watchId !== null) {
      navigator.geolocation.clearWatch(_watchId);
      _watchId = null;
    }
    _initialized = false;
  }

  // ── Public: one-shot position request with timeout ────
  function requestOnce(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      // If we already have a recent position, use it
      if (_currentPos && (Date.now() - _currentPos.timestamp) < 15000) {
        resolve(_currentPos);
        return;
      }

      const options = {
        ...GEO_OPTIONS_ONCE,
        timeout: timeoutMs,
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            latitude:  position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy:  position.coords.accuracy,
            timestamp: position.timestamp,
          };
          _currentPos = pos;
          resolve(pos);
        },
        (error) => {
          let msg;
          switch (error.code) {
            case error.PERMISSION_DENIED:
              msg = 'Location permission denied.';    break;
            case error.POSITION_UNAVAILABLE:
              msg = 'Location unavailable.';          break;
            case error.TIMEOUT:
              msg = 'GPS request timed out.';         break;
            default:
              msg = error.message || 'GPS error.';
          }
          reject(new Error(msg));
        },
        options
      );
    });
  }

  // ── Public: check if position available ───────────────
  function hasPosition() {
    if (!_currentPos) return false;
    // Position older than 30 seconds is considered stale
    return (Date.now() - _currentPos.timestamp) < 30000;
  }

  // ── Public: get last known position ───────────────────
  function getPosition() {
    return _currentPos;
  }

  // ── Public: validate position against office ──────────
  function validatePosition(lat, lng) {
    if (!_officeCoords) {
      return { valid: true, message: 'Office coordinates not loaded — skipping GPS check.', distance: 0 };
    }
    const dist   = haversineDistance(lat, lng, _officeCoords.lat, _officeCoords.lng);
    const inside = dist <= _officeCoords.radius;
    return {
      valid:    inside,
      distance: Math.round(dist),
      radius:   _officeCoords.radius,
      message:  inside
        ? `Within office (${Math.round(dist)}m away)`
        : `Out of range: ${Math.round(dist)}m from office (limit: ${_officeCoords.radius}m)`,
    };
  }

  return {
    init,
    stop,
    requestOnce,
    hasPosition,
    getPosition,
    validatePosition,
  };

})();


/* ============================================================
   HAVERSINE DISTANCE
   Returns distance in metres between two GPS coordinates.
   Uses the Haversine formula (same as Apps Script server-side).
   ============================================================ */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R  = 6371000;           // Earth radius in metres
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const dPhi = (lat2 - lat1) * Math.PI / 180;
  const dLam = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(dLam / 2) * Math.sin(dLam / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Make the module available to inline page scripts and diagnostics.
window.GPSModule = GPSModule;


/* ============================================================
   GPS PERMISSION CHECK UTILITY
   Checks current permission state without triggering prompt.
   ============================================================ */
async function checkGPSPermission() {
  if (!navigator.permissions) return 'unknown';
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state; // 'granted' | 'denied' | 'prompt'
  } catch {
    return 'unknown';
  }
}
