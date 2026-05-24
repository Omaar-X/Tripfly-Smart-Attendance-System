/**
 * ============================================================
 * TRIP FLY BD - SMART ATTENDANCE MANAGEMENT SYSTEM
 * Google Apps Script Backend
 * Version: 1.0.0
 * ============================================================
 *
 * SHEET TABS REQUIRED:
 *   - Employees
 *   - Attendance
 *   - QR_Tokens
 *   - Settings
 *
 * DEPLOYMENT: Publish as Web App
 *   - Execute as: Me
 *   - Who has access: Anyone
 * ============================================================
 */

// ─────────────────────────────────────────────
// CONFIGURATION — update SPREADSHEET_ID below
// ─────────────────────────────────────────────
const SPREADSHEET_ID = '1fiehE5K4KY1y1oT3eDPJ2uSNfeYJSwEj-1g0XvKQVvM';
const SHEET_EMPLOYEES  = 'Employees';
const SHEET_ATTENDANCE = 'Attendance';
const SHEET_QR_TOKENS  = 'QR_Tokens';
const SHEET_SETTINGS   = 'Settings';

// ─────────────────────────────────────────────
// SECURITY — Secret API Key
// এই key শুধু আপনার app জানে। URL জানলেও
// এই key ছাড়া কেউ data access করতে পারবে না।
// app.js এর API_SECRET এর সাথে এটা match করতে হবে।
// ─────────────────────────────────────────────
const API_SECRET = 'TripFlyBD-2024-SecureKey-Omar';  // ← এটা পরিবর্তন করুন

function validateApiKey(key) {
  return typeof key === 'string' && key === API_SECRET;
}

// ─────────────────────────────────────────────
// JSON RESPONSE
// Google Apps Script ContentService does not support custom response
// headers. Keep browser requests "simple" from the frontend to avoid
// CORS preflight requests.
// ─────────────────────────────────────────────
function jsonResponse(result) {
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────
// ENTRY POINT — GET
// ─────────────────────────────────────────────
function doGet(e) {
  const params = e.parameter || {};
  const action = params.action || '';

  // ── API Key validation ─────────────────────
  // initializeSheets শুধুমাত্র একবার manually run করার জন্য
  // বাকি সব request এ secret key লাগবে
  if (action !== 'initializeSheets' && !validateApiKey(params.apiKey)) {
    return jsonResponse({ success: false, message: 'Unauthorized: Invalid API key.' });
  }

  let result;

  try {
    switch (action) {
      case 'getSettings':
        result = getSettings();
        break;
      case 'getEmployees':
        result = getEmployees();
        break;
      case 'getAttendance':
        result = getAttendance(params);
        break;
      case 'getTodayAttendance':
        result = getTodayAttendance();
        break;
      case 'getDashboardStats':
        result = getDashboardStats();
        break;
      case 'getMonthlyStats':
        result = getMonthlyStats(params);
        break;
      case 'getCurrentQR':
        result = getCurrentQR();
        break;
      case 'validateQR':
        result = validateQRToken(params.token);
        break;
      case 'initializeSheets':
        result = initializeSheets();
        break;
      case 'getPendingEmployees':
        result = getPendingEmployees();
        break;
      default:
        result = { success: false, message: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { success: false, message: 'Server error: ' + err.message };
  }

  return jsonResponse(result);
}

// ─────────────────────────────────────────────
// ENTRY POINT — POST
// ─────────────────────────────────────────────
function doPost(e) {
  let body = {};
  let result;

  try {
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }

    const action = body.action || '';

    // ── API Key validation ─────────────────────
    if (!validateApiKey(body.apiKey)) {
      return jsonResponse({ success: false, message: 'Unauthorized: Invalid API key.' });
    }

    switch (action) {
      case 'adminLogin':
        result = adminLogin(body);
        break;
      case 'employeeLogin':
        result = employeeLogin(body);
        break;
      case 'generateQR':
        result = generateQRToken();
        break;
      case 'markAttendance':
        result = markAttendance(body);
        break;
      case 'checkOut':
        result = checkOut(body);
        break;
      case 'addEmployee':
        result = addEmployee(body);
        break;
      case 'updateEmployee':
        result = updateEmployee(body);
        break;
      case 'deleteEmployee':
        result = deleteEmployee(body);
        break;
      case 'updateSettings':
        result = updateSettings(body);
        break;
      case 'generateMonthlyQR':
        result = generateMonthlyQR();
        break;
      case 'registerEmployee':
        result = registerEmployee(body);
        break;
      case 'approveEmployee':
        result = approveEmployee(body);
        break;
      case 'getPendingEmployees':
        result = getPendingEmployees();
        break;
      default:
        result = { success: false, message: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { success: false, message: 'Server error: ' + err.message };
  }

  return jsonResponse(result);
}

// ─────────────────────────────────────────────
// HELPER — GET SPREADSHEET
// ─────────────────────────────────────────────
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getSheet(name) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet not found: ' + name);
  return sheet;
}

// ─────────────────────────────────────────────
// INITIALIZE SHEETS (run once to set up headers)
// ─────────────────────────────────────────────
function initializeSheets() {
  const ss = getSpreadsheet();

  // ── Employees ─────────────────────────────
  let empSheet = ss.getSheetByName(SHEET_EMPLOYEES);
  if (!empSheet) empSheet = ss.insertSheet(SHEET_EMPLOYEES);
  if (empSheet.getLastRow() === 0) {
    empSheet.appendRow([
      'Employee ID', 'Employee Name', 'Department',
      'Email', 'Phone', 'PIN', 'Status'
    ]);
    empSheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#1a1a1a').setFontColor('#D4AF37');

    // Sample employees
    const employees = [
      ['EMP001', 'Rahim Uddin',   'Sales',       'rahim@tripflybd.com',   '01711000001', '1234', 'Active'],
      ['EMP002', 'Karim Hossain', 'Operations',  'karim@tripflybd.com',   '01711000002', '2345', 'Active'],
      ['EMP003', 'Nasrin Akter',  'Marketing',   'nasrin@tripflybd.com',  '01711000003', '3456', 'Active'],
      ['EMP004', 'Sabbir Ahmed',  'Accounts',    'sabbir@tripflybd.com',  '01711000004', '4567', 'Active'],
      ['EMP005', 'Mitu Begum',    'Customer Care','mitu@tripflybd.com',   '01711000005', '5678', 'Active'],
      ['EMP006', 'Farhan Islam',  'IT',          'farhan@tripflybd.com',  '01711000006', '6789', 'Active'],
    ];
    employees.forEach(row => empSheet.appendRow(row));
  }

  // ── Attendance ────────────────────────────
  let attSheet = ss.getSheetByName(SHEET_ATTENDANCE);
  if (!attSheet) attSheet = ss.insertSheet(SHEET_ATTENDANCE);
  if (attSheet.getLastRow() === 0) {
    attSheet.appendRow([
      'Attendance ID', 'Employee ID', 'Employee Name',
      'Date', 'Check-In Time', 'Check-Out Time',
      'Status', 'Latitude', 'Longitude',
      'Device Info', 'QR Token', 'Timestamp'
    ]);
    attSheet.getRange(1, 1, 1, 12).setFontWeight('bold').setBackground('#1a1a1a').setFontColor('#D4AF37');
  }

  // ── QR_Tokens ─────────────────────────────
  let qrSheet = ss.getSheetByName(SHEET_QR_TOKENS);
  if (!qrSheet) qrSheet = ss.insertSheet(SHEET_QR_TOKENS);
  if (qrSheet.getLastRow() === 0) {
    qrSheet.appendRow(['Token', 'Generated Time', 'Expiry Time', 'Status']);
    qrSheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#1a1a1a').setFontColor('#D4AF37');
  }

  // ── Settings ──────────────────────────────
  let setSheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!setSheet) setSheet = ss.insertSheet(SHEET_SETTINGS);
  if (setSheet.getLastRow() === 0) {
    setSheet.appendRow(['Key', 'Value']);
    setSheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#1a1a1a').setFontColor('#D4AF37');
    const defaults = [
      ['OFFICE_NAME',       'Trip Fly BD'],
      ['OFFICE_LATITUDE',   '23.8103'],       // Dhaka default
      ['OFFICE_LONGITUDE',  '90.4125'],
      ['ALLOWED_RADIUS',    '100'],           // metres
      ['OFFICE_START_TIME', '09:00'],
      ['QR_EXPIRY_SECONDS', '86400'],  // 24 hours = 86400 seconds
      ['GPS_REQUIRED',      'TRUE'],
      ['ADMIN_USERNAME',    'admin'],
      ['ADMIN_PASSWORD',    'admin123'],
      ['STATIC_QR_TOKEN',   'TRIPFLYBD-OFFICE-GATE-QR-2024'],  // printed QR token
      ['STATIC_QR_EXPIRY',  ''],   // auto-set when generated (YYYY-MM-DD)
    ];
    defaults.forEach(row => setSheet.appendRow(row));
  }

  return { success: true, message: 'Sheets initialized successfully' };
}

// ─────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────
function getSettings() {
  const sheet = getSheet(SHEET_SETTINGS);
  const data  = sheet.getDataRange().getValues();
  const settings = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) settings[data[i][0]] = data[i][1];
  }
  return { success: true, data: settings };
}

function updateSettings(body) {
  const sheet = getSheet(SHEET_SETTINGS);
  const data  = sheet.getDataRange().getValues();
  const updates = body.settings || {};

  for (const key in updates) {
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(updates[key]);
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([key, updates[key]]);
    }
  }
  return { success: true, message: 'Settings updated' };
}

function getSettingsMap() {
  const res = getSettings();
  return res.data || {};
}

// ─────────────────────────────────────────────
// ADMIN LOGIN
// ─────────────────────────────────────────────
function adminLogin(body) {
  const settings = getSettingsMap();
  const username = (body.username || '').trim();
  const password = (body.password || '').trim();

  if (username === settings['ADMIN_USERNAME'] && password === settings['ADMIN_PASSWORD']) {
    return {
      success: true,
      message: 'Admin login successful',
      role: 'admin',
      username: username,
      token: generateSecureToken(),
    };
  }
  return { success: false, message: 'Invalid admin credentials' };
}

// ─────────────────────────────────────────────
// EMPLOYEE LOGIN
// ─────────────────────────────────────────────
function employeeLogin(body) {
  const sheet  = getSheet(SHEET_EMPLOYEES);
  const data   = sheet.getDataRange().getValues();
  const empId  = (body.employeeId || '').trim().toUpperCase();
  const pin    = (body.pin || '').trim();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0].toString().toUpperCase() === empId && row[5].toString() === pin && row[6] === 'Active') {
      return {
        success: true,
        message: 'Login successful',
        employee: {
          id:         row[0],
          name:       row[1],
          department: row[2],
          email:      row[3],
          phone:      row[4],
        },
      };
    }
  }
  return { success: false, message: 'Invalid Employee ID or PIN' };
}

// ─────────────────────────────────────────────
// EMPLOYEES CRUD
// ─────────────────────────────────────────────
function getEmployees() {
  const sheet  = getSheet(SHEET_EMPLOYEES);
  const data   = sheet.getDataRange().getValues();
  const employees = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0]) {
      employees.push({
        id:         row[0],
        name:       row[1],
        department: row[2],
        email:      row[3],
        phone:      row[4],
        pin:        row[5],
        status:     row[6],
      });
    }
  }
  return { success: true, data: employees };
}

function addEmployee(body) {
  const sheet    = getSheet(SHEET_EMPLOYEES);
  const emp      = body.employee || {};
  const newId    = generateEmployeeId();

  sheet.appendRow([
    newId,
    emp.name       || '',
    emp.department || '',
    emp.email      || '',
    emp.phone      || '',
    emp.pin        || generatePIN(),
    emp.status     || 'Active',
  ]);
  return { success: true, message: 'Employee added', id: newId };
}

function updateEmployee(body) {
  const sheet  = getSheet(SHEET_EMPLOYEES);
  const data   = sheet.getDataRange().getValues();
  const emp    = body.employee || {};

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === emp.id.toString()) {
      sheet.getRange(i + 1, 1, 1, 7).setValues([[
        emp.id,
        emp.name       || data[i][1],
        emp.department || data[i][2],
        emp.email      || data[i][3],
        emp.phone      || data[i][4],
        emp.pin        || data[i][5],
        emp.status     || data[i][6],
      ]]);
      return { success: true, message: 'Employee updated' };
    }
  }
  return { success: false, message: 'Employee not found' };
}

function deleteEmployee(body) {
  const sheet  = getSheet(SHEET_EMPLOYEES);
  const data   = sheet.getDataRange().getValues();
  const empId  = (body.employeeId || '').toString();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === empId) {
      // Soft delete — mark as Inactive
      sheet.getRange(i + 1, 7).setValue('Inactive');
      return { success: true, message: 'Employee deactivated' };
    }
  }
  return { success: false, message: 'Employee not found' };
}

// ─────────────────────────────────────────────
// QR TOKEN GENERATION & VALIDATION
// ─────────────────────────────────────────────
function generateQRToken() {
  const sheet    = getSheet(SHEET_QR_TOKENS);
  const settings = getSettingsMap();
  const expirySec = parseInt(settings['QR_EXPIRY_SECONDS'] || '30');

  // Expire all current tokens
  expireOldTokens();

  const now    = new Date();
  const expiry = new Date(now.getTime() + expirySec * 1000);
  const token  = generateSecureToken();

  sheet.appendRow([
    token,
    now.toISOString(),
    expiry.toISOString(),
    'Active',
  ]);

  return {
    success:    true,
    token:      token,
    generatedAt: now.toISOString(),
    expiresAt:  expiry.toISOString(),
    expirySec:  expirySec,
  };
}

function getCurrentQR() {
  const sheet    = getSheet(SHEET_QR_TOKENS);
  expireOldTokens();
  const data     = sheet.getDataRange().getValues();
  const now      = new Date();
  const settings = getSettingsMap();

  for (let i = data.length - 1; i >= 1; i--) {
    const row    = data[i];
    const expiry = new Date(row[2]);
    const status = row[3];

    if (status === 'Active' && expiry > now) {
      return {
        success:   true,
        token:     row[0],
        expiresAt: row[2],
        expirySec: parseInt(settings['QR_EXPIRY_SECONDS'] || '30'),
      };
    }
  }

  // No active QR — auto-generate
  return generateQRToken();
}

function validateQRToken(token) {
  if (!token) return { valid: false, message: 'No token provided' };

  // ── Check if this is the static/printed office QR ──────
  const settings    = getSettingsMap();
  const staticToken  = settings['STATIC_QR_TOKEN']  || '';
  const staticExpiry = settings['STATIC_QR_EXPIRY'] || '';

  if (staticToken && token === staticToken) {
    // Check monthly expiry
    if (staticExpiry) {
      const today  = getTodayDate();
      if (today > staticExpiry) {
        return { valid: false, message: 'QR Code মেয়াদ শেষ। Admin নতুন QR print করবেন।' };
      }
    }
    return { valid: true, message: 'Static QR verified', token: token, isStatic: true };
  }

  // ── Check dynamic (rotating) QR tokens ─────────────────
  const sheet = getSheet(SHEET_QR_TOKENS);
  const data  = sheet.getDataRange().getValues();
  const now   = new Date();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] === token) {
      const expiry = new Date(row[2]);
      const status = row[3];

      if (status !== 'Active') {
        return { valid: false, message: 'QR token already used or expired' };
      }
      if (expiry < now) {
        sheet.getRange(i + 1, 4).setValue('Expired');
        return { valid: false, message: 'QR token expired' };
      }
      return { valid: true, message: 'Token valid', token: token };
    }
  }
  return { valid: false, message: 'Invalid QR code. Please scan the office QR.' };
}

function expireOldTokens() {
  const sheet = getSheet(SHEET_QR_TOKENS);
  const data  = sheet.getDataRange().getValues();
  const now   = new Date();

  for (let i = 1; i < data.length; i++) {
    if (data[i][3] === 'Active') {
      const expiry = new Date(data[i][2]);
      if (expiry < now) {
        sheet.getRange(i + 1, 4).setValue('Expired');
      }
    }
  }
}

// ─────────────────────────────────────────────
// GPS VALIDATION
// ─────────────────────────────────────────────
function validateGPS(lat, lng) {
  const settings    = getSettingsMap();
  const officeLat   = parseFloat(settings['OFFICE_LATITUDE']  || '23.8103');
  const officeLng   = parseFloat(settings['OFFICE_LONGITUDE'] || '90.4125');
  const allowedRadius = parseFloat(settings['ALLOWED_RADIUS'] || '100');

  const distance = haversineDistance(lat, lng, officeLat, officeLng);

  return {
    valid:    distance <= allowedRadius,
    distance: Math.round(distance),
    radius:   allowedRadius,
    message:  distance <= allowedRadius
      ? 'Location verified — within office premises'
      : `Out of range: ${Math.round(distance)}m from office (limit: ${allowedRadius}m)`,
  };
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R    = 6371000; // Earth radius in metres
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

// ─────────────────────────────────────────────
// MARK ATTENDANCE (CHECK-IN)
// ─────────────────────────────────────────────
function markAttendance(body) {
  const { employeeId, qrToken, latitude, longitude, deviceInfo } = body;

  if (!employeeId || !qrToken) {
    return { success: false, message: 'Missing required fields' };
  }

  // 1. Validate QR Token
  const qrResult = validateQRToken(qrToken);
  if (!qrResult.valid) {
    return { success: false, message: qrResult.message };
  }

  // 2. Validate GPS
  const settings = getSettingsMap();
  const allowedRadius = parseFloat(settings['ALLOWED_RADIUS'] || '100');
  const gpsRequired = String(settings['GPS_REQUIRED'] || 'TRUE').toUpperCase() !== 'FALSE' &&
                      allowedRadius < 999999;
  let gpsResult = { valid: true, message: 'GPS not provided', distance: 0 };
  const hasGps = latitude !== undefined && latitude !== null && latitude !== '' &&
                 longitude !== undefined && longitude !== null && longitude !== '';

  if (!hasGps && gpsRequired) {
    return { success: false, message: 'GPS coordinates required. Please allow location access and try again.' };
  }

  if (hasGps) {
    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    if (isNaN(latNum) || isNaN(lngNum)) {
      return { success: false, message: 'Invalid GPS coordinates.' };
    }
    gpsResult = validateGPS(latNum, lngNum);
    if (!gpsResult.valid) {
      return { success: false, message: gpsResult.message };
    }
  }

  // 3. Check for duplicate attendance today
  const today = getTodayDate();
  const existing = getEmployeeAttendanceToday(employeeId, today);
  if (existing) {
    return {
      success:   false,
      message:   'Attendance already recorded for today',
      checkIn:   existing.checkIn,
      status:    existing.status,
    };
  }

  // 4. Get employee info
  const empInfo = getEmployeeById(employeeId);
  if (!empInfo) {
    return { success: false, message: 'Employee not found' };
  }

  // 5. Server-side timestamp (cannot be manipulated by client)
  const now        = new Date();
  const serverTime = now.toISOString();
  const timeStr    = Utilities.formatDate(now, 'Asia/Dhaka', 'HH:mm:ss');
  const dateStr    = Utilities.formatDate(now, 'Asia/Dhaka', 'yyyy-MM-dd');

  // 6. Determine status
  const startTime  = settings['OFFICE_START_TIME'] || '09:00';
  const status     = determineAttendanceStatus(timeStr, startTime);

  // 7. Generate attendance ID
  const attId = 'ATT' + Utilities.formatDate(now, 'Asia/Dhaka', 'yyyyMMddHHmmss') + Math.floor(Math.random() * 100);

  // 8. Save attendance
  const attSheet = getSheet(SHEET_ATTENDANCE);
  attSheet.appendRow([
    attId,
    employeeId,
    empInfo.name,
    dateStr,
    timeStr,
    '',                         // Check-out (empty for now)
    status,
    latitude  || '',
    longitude || '',
    deviceInfo || 'Unknown',
    qrToken,
    serverTime,
  ]);

  return {
    success:    true,
    message:    'Attendance marked successfully',
    attendanceId: attId,
    employeeName: empInfo.name,
    date:       dateStr,
    checkIn:    timeStr,
    status:     status,
    distance:   gpsResult.distance,
  };
}

// ─────────────────────────────────────────────
// CHECK-OUT
// ─────────────────────────────────────────────
function checkOut(body) {
  const { employeeId } = body;
  if (!employeeId) return { success: false, message: 'Employee ID required' };

  const sheet = getSheet(SHEET_ATTENDANCE);
  const data  = sheet.getDataRange().getValues();
  const today = getTodayDate();
  const now   = new Date();
  const timeStr = Utilities.formatDate(now, 'Asia/Dhaka', 'HH:mm:ss');

  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][1].toString() === employeeId.toString() && normalizeDateValue(data[i][3]) === today) {
      if (data[i][5]) {
        return { success: false, message: 'Already checked out today' };
      }
      sheet.getRange(i + 1, 6).setValue(timeStr);
      return {
        success:  true,
        message:  'Check-out recorded',
        checkOut: timeStr,
      };
    }
  }
  return { success: false, message: 'No check-in found for today' };
}

// ─────────────────────────────────────────────
// ATTENDANCE QUERIES
// ─────────────────────────────────────────────
function getAttendance(params) {
  const sheet = getSheet(SHEET_ATTENDANCE);
  const data  = sheet.getDataRange().getValues();
  const records = [];

  const filterDate = params.date || '';
  const filterEmp  = params.employeeId || '';
  const limitStr   = params.limit || '100';
  const limit      = parseInt(limitStr);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    const dateStr = normalizeDateValue(row[3]);
    if (filterDate && dateStr !== filterDate) continue;
    if (filterEmp  && row[1].toString() !== filterEmp) continue;

    records.push({
      id:           row[0],
      employeeId:   row[1],
      employeeName: row[2],
      date:         dateStr,
      checkIn:      row[4],
      checkOut:     row[5],
      status:       row[6],
      latitude:     row[7],
      longitude:    row[8],
      deviceInfo:   row[9],
      qrToken:      row[10],
      timestamp:    row[11],
    });
  }

  // Return newest first, limited
  records.reverse();
  return { success: true, data: records.slice(0, limit) };
}

function getTodayAttendance() {
  return getAttendance({ date: getTodayDate() });
}

function getEmployeeAttendanceToday(employeeId, date) {
  const sheet = getSheet(SHEET_ATTENDANCE);
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[1].toString() === employeeId.toString() && normalizeDateValue(row[3]) === date) {
      return {
        id:      row[0],
        checkIn: row[4],
        checkOut:row[5],
        status:  row[6],
      };
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// DASHBOARD STATISTICS
// ─────────────────────────────────────────────
function getDashboardStats() {
  const empSheet  = getSheet(SHEET_EMPLOYEES);
  const attSheet  = getSheet(SHEET_ATTENDANCE);
  const empData   = empSheet.getDataRange().getValues();
  const attData   = attSheet.getDataRange().getValues();
  const today     = getTodayDate();

  let totalEmployees = 0;
  let presentToday   = 0;
  let lateToday      = 0;
  let absentToday    = 0;

  // Count active employees
  for (let i = 1; i < empData.length; i++) {
    if (empData[i][0] && empData[i][6] === 'Active') totalEmployees++;
  }

  // Count today's attendance
  const todayEmpIds = new Set();
  for (let i = 1; i < attData.length; i++) {
    if (normalizeDateValue(attData[i][3]) === today) {
      todayEmpIds.add(attData[i][1].toString());
      if (attData[i][6] === 'Late') lateToday++;
      else presentToday++;
    }
  }

  absentToday = Math.max(0, totalEmployees - todayEmpIds.size);

  return {
    success: true,
    data: {
      totalEmployees,
      presentToday,
      lateToday,
      absentToday,
      attendanceRate: totalEmployees > 0
        ? Math.round((todayEmpIds.size / totalEmployees) * 100)
        : 0,
      date: today,
    },
  };
}

function getMonthlyStats(params) {
  const sheet  = getSheet(SHEET_ATTENDANCE);
  const data   = sheet.getDataRange().getValues();
  const now    = new Date();
  const year   = parseInt(params.year  || now.getFullYear());
  const month  = parseInt(params.month || (now.getMonth() + 1));

  // Pad month
  const monthStr = month.toString().padStart(2, '0');
  const prefix   = `${year}-${monthStr}`;

  const dailyStats = {};

  for (let i = 1; i < data.length; i++) {
    const row  = data[i];
    const date = normalizeDateValue(row[3]);
    if (!date.startsWith(prefix)) continue;

    if (!dailyStats[date]) {
      dailyStats[date] = { present: 0, late: 0, absent: 0 };
    }
    if (row[6] === 'Late') dailyStats[date].late++;
    else dailyStats[date].present++;
  }

  const labels = [];
  const presentArr = [];
  const lateArr    = [];

  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${prefix}-${d.toString().padStart(2, '0')}`;
    labels.push(d);
    presentArr.push((dailyStats[dateKey] || {}).present || 0);
    lateArr.push((dailyStats[dateKey] || {}).late || 0);
  }

  return { success: true, data: { labels, present: presentArr, late: lateArr } };
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function getTodayDate() {
  return Utilities.formatDate(new Date(), 'Asia/Dhaka', 'yyyy-MM-dd');
}

function normalizeDateValue(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, 'Asia/Dhaka', 'yyyy-MM-dd');
  }
  const str = value.toString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, 'Asia/Dhaka', 'yyyy-MM-dd');
  }
  return str;
}

function generateSecureToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token + Date.now().toString(36).toUpperCase();
}

function generateEmployeeId() {
  const sheet = getSheet(SHEET_EMPLOYEES);
  const count = Math.max(sheet.getLastRow() - 1, 0);
  return 'EMP' + (count + 1).toString().padStart(3, '0');
}

function generatePIN() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function determineAttendanceStatus(timeStr, startTime) {
  const [h, m] = timeStr.split(':').map(Number);
  const [sh, sm] = startTime.split(':').map(Number);
  const minutesNow   = h * 60 + m;
  const minutesStart = sh * 60 + sm;
  return minutesNow <= minutesStart ? 'Present' : 'Late';
}

function getEmployeeById(employeeId) {
  const sheet = getSheet(SHEET_EMPLOYEES);
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === employeeId.toString()) {
      return {
        id:         data[i][0],
        name:       data[i][1],
        department: data[i][2],
        email:      data[i][3],
        phone:      data[i][4],
      };
    }
  }
  return null;
}

function markTokenUsed(token) {
  const sheet = getSheet(SHEET_QR_TOKENS);
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === token) {
      sheet.getRange(i + 1, 4).setValue('Used');
      return;
    }
  }
}

// ─────────────────────────────────────────────
// AUTO QR REFRESH (set as time-based trigger)
// Run every 30 seconds via Apps Script trigger
// ─────────────────────────────────────────────
function autoRefreshQR() {
  generateQRToken();
}

// ─────────────────────────────────────────────
// GENERATE NEW MONTHLY STATIC QR
// ─────────────────────────────────────────────
function generateMonthlyQR() {
  const now    = new Date();
  const month  = Utilities.formatDate(now, 'Asia/Dhaka', 'yyyyMM');

  // Expiry = last day of current month
  const year   = now.getFullYear();
  const mon    = now.getMonth(); // 0-indexed
  const lastDay = new Date(year, mon + 1, 0); // day 0 of next month = last day of this month
  const expiry  = Utilities.formatDate(lastDay, 'Asia/Dhaka', 'yyyy-MM-dd');

  // New token includes month so it changes automatically each month
  const newToken = 'TFBD-GATE-' + month + '-' + generateSecureToken().substring(0, 8).toUpperCase();

  // Save to settings
  updateSettings({ settings: {
    STATIC_QR_TOKEN:  newToken,
    STATIC_QR_EXPIRY: expiry,
  }});

  return {
    success:   true,
    token:     newToken,
    expiresOn: expiry,
    message:   'New monthly QR generated. Valid until ' + expiry,
  };
}

// ─────────────────────────────────────────────
// EMPLOYEE SELF-REGISTRATION
// ─────────────────────────────────────────────
function registerEmployee(body) {
  const emp = body.employee || {};

  if (!emp.name || !emp.department || !emp.pin) {
    return { success: false, message: 'Name, Department and PIN are required.' };
  }
  if (!/^\d{4}$/.test(emp.pin)) {
    return { success: false, message: 'PIN must be exactly 4 digits.' };
  }

  const sheet = getSheet(SHEET_EMPLOYEES);
  const data  = sheet.getDataRange().getValues();

  // Check if name already registered (pending or active)
  for (let i = 1; i < data.length; i++) {
    if (data[i][1].toString().toLowerCase() === emp.name.trim().toLowerCase()
        && data[i][6] !== 'Inactive') {
      return { success: false, message: 'এই নামে আগেই registration আছে। Admin এর সাথে যোগাযোগ করুন।' };
    }
  }

  const newId = generateEmployeeId();

  sheet.appendRow([
    newId,
    emp.name.trim(),
    emp.department.trim(),
    emp.email  || '',
    emp.phone  || '',
    emp.pin,
    'Pending',   // ← Admin approve করলে Active হবে
  ]);

  return {
    success: true,
    message: 'Registration সফল! Admin approve করলে আপনি login করতে পারবেন।',
    id: newId,
  };
}

function getPendingEmployees() {
  const sheet = getSheet(SHEET_EMPLOYEES);
  const data  = sheet.getDataRange().getValues();
  const pending = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] && data[i][6] === 'Pending') {
      pending.push({
        id:         data[i][0],
        name:       data[i][1],
        department: data[i][2],
        email:      data[i][3],
        phone:      data[i][4],
        status:     data[i][6],
      });
    }
  }
  return { success: true, data: pending };
}

function approveEmployee(body) {
  const sheet  = getSheet(SHEET_EMPLOYEES);
  const data   = sheet.getDataRange().getValues();
  const empId  = (body.employeeId || '').toString();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === empId && data[i][6] === 'Pending') {
      sheet.getRange(i + 1, 7).setValue('Active');
      return { success: true, message: data[i][1] + ' approved successfully.' };
    }
  }
  return { success: false, message: 'Pending employee not found.' };
}

// ─────────────────────────────────────────────
// ADD STATIC QR TOKEN TO EXISTING SETTINGS
// Run this ONCE manually from Apps Script editor
// if sheets were already initialized before
// ─────────────────────────────────────────────
function addStaticQRToken() {
  const sheet = getSheet(SHEET_SETTINGS);
  const data  = sheet.getDataRange().getValues();

  // Check if already exists
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'STATIC_QR_TOKEN') {
      Logger.log('STATIC_QR_TOKEN already exists: ' + data[i][1]);
      return;
    }
  }

  // Add it
  sheet.appendRow(['STATIC_QR_TOKEN', 'TRIPFLYBD-OFFICE-GATE-QR-2024']);
  Logger.log('STATIC_QR_TOKEN added successfully!');
}
