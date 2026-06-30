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
const SHEET_LOGS       = 'Logs';
const SHEET_LEAVE      = 'Leave_Applications';
const ATTENDANCE_SHEET_PREFIX = 'Attendance - ';
const DEFAULT_OFFICE_START_TIME = '10:00';
const DEFAULT_LATE_CUTOFF_TIME = '10:15';
const EARLY_CHECKOUT_CUTOFF_TIME = '18:00';
const ATTENDANCE_EXTRA_HEADERS = ['Day', 'Late Check-In Reason', 'Early Check-Out Reason'];

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
      case 'migrateAttendanceHistory':
        result = migrateLegacyAttendanceHistoryToMonthlySheets();
        break;
      case 'getAttendanceMigrationSummary':
        result = getAttendanceMigrationSummary();
        break;
      case 'getPendingEmployees':
        result = getPendingEmployees();
        break;
      case 'getLeaveApplications':
        result = getLeaveApplications(params);
        break;
      case 'getPendingLeaveApplications':
        result = getPendingLeaveApplications(params);
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
      case 'migrateAttendanceHistory':
        result = migrateLegacyAttendanceHistoryToMonthlySheets();
        break;
      case 'getAttendanceMigrationSummary':
        result = getAttendanceMigrationSummary();
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
      case 'submitLeaveApplication':
        result = submitLeaveApplication(body);
        break;
      case 'updateLeaveApplicationStatus':
        result = updateLeaveApplicationStatus(body);
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

function getAttendanceSheetNameForDate(dateValue) {
  const normalized = normalizeDateValue(dateValue || getTodayDate());
  const parsed = new Date(normalized + 'T00:00:00+06:00');
  if (isNaN(parsed.getTime())) {
    return ATTENDANCE_SHEET_PREFIX + Utilities.formatDate(new Date(), 'Asia/Dhaka', 'MMMM yyyy');
  }
  return ATTENDANCE_SHEET_PREFIX + Utilities.formatDate(parsed, 'Asia/Dhaka', 'MMMM yyyy');
}

function isAttendanceSheetName(name) {
  return name === SHEET_ATTENDANCE || String(name || '').indexOf(ATTENDANCE_SHEET_PREFIX) === 0;
}

function ensureAttendanceSheetCore(sheet, shouldFormat) {
  if (!sheet) return null;
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Attendance ID', 'Employee ID', 'Employee Name',
      'Date', 'Check-In Time', 'Check-Out Time',
      'Status', 'Day', 'Late Check-In Reason', 'Early Check-Out Reason'
    ]);
    sheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#4cc6cf').setFontColor('#000000');
  }
  ensureAttendanceSheetSchema(sheet, shouldFormat);
  return sheet;
}

function getOrCreateAttendanceSheetForDate(dateValue, shouldFormat) {
  const ss = getSpreadsheet();
  const name = getAttendanceSheetNameForDate(dateValue);
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return ensureAttendanceSheetCore(sheet, shouldFormat);
}

function getAttendanceSheets() {
  const ss = getSpreadsheet();
  return ss.getSheets().filter(sheet => isAttendanceSheetName(sheet.getName()));
}

function getAttendanceSheetsForDate(dateValue, createIfMissing, shouldFormat) {
  const ss = getSpreadsheet();
  const sheets = [];
  const monthlyName = getAttendanceSheetNameForDate(dateValue);
  let monthlySheet = ss.getSheetByName(monthlyName);
  if (!monthlySheet && createIfMissing) {
    monthlySheet = getOrCreateAttendanceSheetForDate(dateValue, shouldFormat);
  } else if (monthlySheet) {
    ensureAttendanceSheetCore(monthlySheet, shouldFormat);
  }
  if (monthlySheet) sheets.push(monthlySheet);

  const legacySheet = ss.getSheetByName(SHEET_ATTENDANCE);
  if (legacySheet && legacySheet.getName() !== monthlyName) {
    ensureAttendanceSheetSchema(legacySheet, shouldFormat);
    sheets.push(legacySheet);
  }

  return sheets;
}

function migrateLegacyAttendanceHistoryToMonthlySheets() {
  const ss = getSpreadsheet();
  const legacySheet = ss.getSheetByName(SHEET_ATTENDANCE);
  if (!legacySheet || legacySheet.getLastRow() <= 1) {
    return {
      success: true,
      message: 'No legacy attendance data to migrate.',
      migratedRows: 0,
      targetSheets: [],
    };
  }

  ensureAttendanceSheetSchema(legacySheet, false);
  const data = legacySheet.getDataRange().getValues();
  const legacyHeaderMap = data.length ? buildHeaderMap(data[0]) : {};
  const pendingRowsBySheet = {};
  const existingIdsBySheet = {};
  let migratedRows = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const attendanceId = String(getRowValue(row, legacyHeaderMap, 'Attendance ID', 0) || '').trim();
    if (!attendanceId) continue;

    const dateStr = normalizeDateValue(getRowValue(row, legacyHeaderMap, 'Date', 3)) || getTodayDate();
    const targetName = getAttendanceSheetNameForDate(dateStr);

    if (!pendingRowsBySheet[targetName]) {
      pendingRowsBySheet[targetName] = [];
      const targetSheet = ss.getSheetByName(targetName);
      const existingIds = new Set();
      if (targetSheet && targetSheet.getLastRow() > 1) {
        ensureAttendanceSheetSchema(targetSheet, false);
        const targetData = targetSheet.getDataRange().getValues();
        const targetHeaderMap = targetData.length ? buildHeaderMap(targetData[0]) : {};
        for (let t = 1; t < targetData.length; t++) {
          const existingId = String(getRowValue(targetData[t], targetHeaderMap, 'Attendance ID', 0) || '').trim();
          if (existingId) existingIds.add(existingId);
        }
      }
      existingIdsBySheet[targetName] = existingIds;
    }

    if (existingIdsBySheet[targetName].has(attendanceId)) continue;

    const targetSheet = getOrCreateAttendanceSheetForDate(dateStr, false);
    pendingRowsBySheet[targetName].push(buildAttendanceRow(targetSheet, {
      'Attendance ID': attendanceId,
      'Employee ID': getRowValue(row, legacyHeaderMap, 'Employee ID', 1),
      'Employee Name': getRowValue(row, legacyHeaderMap, 'Employee Name', 2),
      'Date': dateStr,
      'Check-In Time': getRowValue(row, legacyHeaderMap, 'Check-In Time', 4),
      'Check-Out Time': getRowValue(row, legacyHeaderMap, 'Check-Out Time', 5),
      'Status': getRowValue(row, legacyHeaderMap, 'Status', 6),
      'Day': getRowValue(row, legacyHeaderMap, 'Day', 7) || getDayNameFromDateString(dateStr),
      'Late Check-In Reason': getRowValue(row, legacyHeaderMap, 'Late Check-In Reason', 8),
      'Early Check-Out Reason': getRowValue(row, legacyHeaderMap, 'Early Check-Out Reason', 9),
    }));
    existingIdsBySheet[targetName].add(attendanceId);
    migratedRows++;
  }

  const migratedSheets = [];
  Object.keys(pendingRowsBySheet).forEach(name => {
    const rows = pendingRowsBySheet[name];
    if (!rows.length) return;
    const targetSheet = ensureAttendanceSheetCore(ss.getSheetByName(name) || ss.insertSheet(name), false);
    targetSheet.getRange(targetSheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    applyAttendanceSheetFormatting(targetSheet);
    migratedSheets.push(name);
  });

  return {
    success: true,
    message: migratedRows > 0
      ? 'Legacy attendance history migrated successfully.'
      : 'Legacy attendance history already migrated.',
    migratedRows,
    targetSheets: migratedSheets,
  };
}

function getAttendanceMigrationSummary() {
  const ss = getSpreadsheet();
  const sheets = ss.getSheets().filter(sheet => isAttendanceSheetName(sheet.getName()));
  const summary = sheets.map(sheet => {
    const rowCount = Math.max(sheet.getLastRow() - 1, 0);
    const data = sheet.getLastRow() > 1 ? sheet.getDataRange().getValues() : [];
    const headerMap = data.length ? buildHeaderMap(data[0]) : {};
    let firstDate = '';
    let lastDate = '';

    for (let i = 1; i < data.length; i++) {
      const dateStr = normalizeDateValue(getRowValue(data[i], headerMap, 'Date', 3));
      if (!dateStr) continue;
      if (!firstDate || dateStr < firstDate) firstDate = dateStr;
      if (!lastDate || dateStr > lastDate) lastDate = dateStr;
    }

    return {
      name: sheet.getName(),
      rows: rowCount,
      firstDate: firstDate || '',
      lastDate: lastDate || '',
      isLegacy: sheet.getName() === SHEET_ATTENDANCE,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const legacy = summary.find(item => item.isLegacy) || null;
  const monthlySheets = summary.filter(item => !item.isLegacy);

  return {
    success: true,
    data: {
      legacy,
      monthlySheets,
      totalSheets: summary.length,
      totalRows: summary.reduce((sum, item) => sum + item.rows, 0),
    },
  };
}

function ensureAttendanceSheetSchema(sheet, shouldFormat) {
  const attSheet = sheet || getSheet(SHEET_ATTENDANCE);
  if (attSheet.getLastRow() === 0) return;

  let lastCol = attSheet.getLastColumn();
  let headers = lastCol > 0
    ? attSheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim())
    : [];
  let changed = false;

  ATTENDANCE_EXTRA_HEADERS.forEach(header => {
    if (headers.indexOf(header) === -1) {
      lastCol += 1;
      attSheet.getRange(1, lastCol).setValue(header);
      headers.push(header);
      changed = true;
    }
  });

  if (changed || shouldFormat) applyAttendanceSheetFormatting(attSheet);
}

function getAttendanceHeaderMap(sheet) {
  ensureAttendanceSheetSchema(sheet, false);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach((header, idx) => {
    if (header) map[String(header).trim()] = idx;
  });
  return map;
}

function getAttendanceColumn(sheet, header) {
  const map = getAttendanceHeaderMap(sheet);
  return map[header] === undefined ? 0 : map[header] + 1;
}

function getRowValue(row, map, header, fallbackIndex) {
  const idx = map[header] === undefined ? fallbackIndex : map[header];
  return idx === undefined ? '' : row[idx];
}

function buildAttendanceRow(sheet, values) {
  const map = getAttendanceHeaderMap(sheet);
  const row = new Array(sheet.getLastColumn()).fill('');
  Object.keys(values).forEach(header => {
    if (map[header] !== undefined) row[map[header]] = values[header];
  });
  return row;
}

function setAttendanceRowValues(sheet, rowNumber, values) {
  const map = getAttendanceHeaderMap(sheet);
  Object.keys(values).forEach(header => {
    if (map[header] !== undefined) {
      sheet.getRange(rowNumber, map[header] + 1).setValue(values[header]);
    }
  });
}

function applyAttendanceSheetFormatting(sheet) {
  if (!sheet || sheet.getLastRow() === 0) return;
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, lastCol)
    .setFontWeight('bold')
    .setBackground('#4cc6cf')
    .setFontColor('#000000')
    .setHorizontalAlignment('center');

  if (lastRow <= 1) return;

  const dateCol = getHeaderColumnFromRow(sheet, 'Date') || 4;
  const checkInCol = getHeaderColumnFromRow(sheet, 'Check-In Time') || 5;
  const checkOutCol = getHeaderColumnFromRow(sheet, 'Check-Out Time') || 6;
  const statusCol = getHeaderColumnFromRow(sheet, 'Status') || 7;
  const dayCol  = getHeaderColumnFromRow(sheet, 'Day');

  sheet.getRange(2, 1, lastRow - 1, lastCol)
    .setFontColor('#000000')
    .setBorder(false, false, false, false, false, false)
    .setVerticalAlignment('middle');

  for (let row = 2; row <= lastRow; row++) {
    const bg = (row % 2 === 0) ? '#ffffff' : '#dff7f9';
    sheet.getRange(row, 1, 1, lastCol).setBackground(bg);
  }

  [dateCol, checkInCol, checkOutCol].forEach(col => {
    if (col) sheet.getRange(2, col, lastRow - 1, 1).setHorizontalAlignment('center');
  });

  if (statusCol) {
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Present', 'Late', 'Absence'], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, statusCol, lastRow - 1, 1).setDataValidation(statusRule);
  }

  if (dayCol) {
    const dayRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(2, dayCol, lastRow - 1, 1).setDataValidation(dayRule);
  }
}

function formatAttendanceDataRow(sheet, rowNumber) {
  if (!sheet || rowNumber <= 1) return;
  const lastCol = sheet.getLastColumn();
  const bg = (rowNumber % 2 === 0) ? '#ffffff' : '#dff7f9';
  sheet.getRange(rowNumber, 1, 1, lastCol)
    .setFontColor('#000000')
    .setBackground(bg)
    .setBorder(false, false, false, false, false, false)
    .setVerticalAlignment('middle');

  ['Date', 'Check-In Time', 'Check-Out Time'].forEach(header => {
    const col = getHeaderColumnFromRow(sheet, header);
    if (col) sheet.getRange(rowNumber, col).setHorizontalAlignment('center');
  });
}

function getHeaderColumnFromRow(sheet, header) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idx = headers.map(h => String(h || '').trim()).indexOf(header);
  return idx === -1 ? 0 : idx + 1;
}

function ensureDailyAttendanceRows(dateStr, shouldFormat) {
  const date = dateStr || getTodayDate();
  const empSheet = getSheet(SHEET_EMPLOYEES);
  const attSheet = getOrCreateAttendanceSheetForDate(date, false);

  const empData = empSheet.getDataRange().getValues();
  const attData = attSheet.getDataRange().getValues();
  const existing = {};

  for (let i = 1; i < attData.length; i++) {
    const row = attData[i];
    if (row[1] && normalizeDateValue(row[3]) === date) {
      existing[row[1].toString()] = true;
    }
  }

  const dayName = getDayNameFromDateString(date);
  let added = 0;
  for (let i = 1; i < empData.length; i++) {
    const emp = empData[i];
    if (!emp[0] || emp[6] !== 'Active') continue;
    const empId = emp[0].toString();
    if (existing[empId]) continue;

    attSheet.appendRow(buildAttendanceRow(attSheet, {
      'Attendance ID': 'ABS' + date.replace(/-/g, '') + empId.replace(/[^A-Za-z0-9]/g, ''),
      'Employee ID': emp[0],
      'Employee Name': emp[1],
      'Date': date,
      'Check-In Time': '',
      'Check-Out Time': '',
      'Status': 'Absence',
      'Day': dayName,
      'Late Check-In Reason': '',
      'Early Check-Out Reason': '',
    }));
    added++;
  }

  if (added > 0 && shouldFormat !== false) applyAttendanceSheetFormatting(attSheet);
  return added;
}

function fillMissingAttendanceDayValues(sheet, dateFilter) {
  const attSheet = sheet || getSheet(SHEET_ATTENDANCE);
  if (attSheet.getLastRow() <= 1) return 0;

  const dateCol = getHeaderColumnFromRow(attSheet, 'Date') || 4;
  const dayCol  = getHeaderColumnFromRow(attSheet, 'Day');
  if (!dayCol) return 0;

  const lastRow = attSheet.getLastRow();
  const rows = attSheet.getRange(2, 1, lastRow - 1, attSheet.getLastColumn()).getValues();
  let updated = 0;

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const dayVal = String(row[dayCol - 1] || '').trim();
    if (dayVal) return;

    const dateStr = normalizeDateValue(row[dateCol - 1]);
    if (dateFilter && dateStr !== dateFilter) return;
    const dayName = getDayNameFromDateString(dateStr);
    if (!dayName) return;

    attSheet.getRange(rowNum, dayCol).setValue(dayName);
    updated++;
  });

  return updated;
}

function maintainAttendanceSheetForDate(dateStr, options) {
  const date = dateStr || getTodayDate();
  const shouldFormat = !options || options.format !== false;
  const sheet = getOrCreateAttendanceSheetForDate(date, shouldFormat);

  const added = ensureDailyAttendanceRows(date, shouldFormat);
  const dayUpdates = fillMissingAttendanceDayValues(sheet, date);
  if (shouldFormat) applyAttendanceSheetFormatting(sheet);

  return {
    date: date,
    addedAbsenceRows: added,
    filledDayRows: dayUpdates,
  };
}

function ensureSettingsDefaults(sheet) {
  const setSheet = sheet || getSheet(SHEET_SETTINGS);
  const defaults = {
    OFFICE_START_TIME: DEFAULT_OFFICE_START_TIME,
    LATE_CUTOFF_TIME: DEFAULT_LATE_CUTOFF_TIME,
    EARLY_CHECKOUT_CUTOFF_TIME: EARLY_CHECKOUT_CUTOFF_TIME,
    ADMIN_PASSWORD: 'razib@123',
  };
  const data = setSheet.getDataRange().getValues();

  Object.keys(defaults).forEach(key => {
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        found = true;
        if (key === 'ADMIN_PASSWORD' && String(data[i][1] || '') === 'admin123') {
          setSheet.getRange(i + 1, 2).setValue(defaults[key]);
        }
        if (key === 'OFFICE_START_TIME' && String(data[i][1] || '') === '09:00') {
          setSheet.getRange(i + 1, 2).setValue(defaults[key]);
        }
        if (key === 'LATE_CUTOFF_TIME' && String(data[i][1] || '') === '10:30') {
          setSheet.getRange(i + 1, 2).setValue(defaults[key]);
        }
        if (key === 'EARLY_CHECKOUT_CUTOFF_TIME' && String(data[i][1] || '') === '17:00') {
          setSheet.getRange(i + 1, 2).setValue(defaults[key]);
        }
        break;
      }
    }
    if (!found) setSheet.appendRow([key, defaults[key]]);
  });
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
  ensureAttendanceSheetCore(getOrCreateAttendanceSheetForDate(getTodayDate(), true), true);
  migrateLegacyAttendanceHistoryToMonthlySheets();

  // ── Logs (technical data) ─────────────────
  let logsSheet = ss.getSheetByName(SHEET_LOGS);
  if (!logsSheet) logsSheet = ss.insertSheet(SHEET_LOGS);
  if (logsSheet.getLastRow() === 0) {
    logsSheet.appendRow(['Attendance ID', 'Latitude', 'Longitude', 'Device Info', 'QR Token', 'Timestamp']);
    logsSheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#1a1a1a').setFontColor('#D4AF37');
  }

  ensureLeaveApplicationsSheet();

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
      ['OFFICE_START_TIME', DEFAULT_OFFICE_START_TIME],
      ['LATE_CUTOFF_TIME',  DEFAULT_LATE_CUTOFF_TIME],
      ['QR_EXPIRY_SECONDS', '86400'],  // 24 hours = 86400 seconds
      ['GPS_REQUIRED',      'TRUE'],
      ['ADMIN_USERNAME',    'admin'],
      ['ADMIN_PASSWORD',    'razib@123'],
      ['EARLY_CHECKOUT_CUTOFF_TIME', EARLY_CHECKOUT_CUTOFF_TIME],
      ['STATIC_QR_TOKEN',   'TRIPFLYBD-OFFICE-GATE-QR-2024'],  // printed QR token
      ['STATIC_QR_EXPIRY',  ''],   // auto-set when generated (YYYY-MM-DD)
    ];
    defaults.forEach(row => setSheet.appendRow(row));
  }
  ensureSettingsDefaults(setSheet);

  return { success: true, message: 'Sheets initialized successfully' };
}

// ─────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────
function getSettings(includePrivate) {
  const sheet = getSheet(SHEET_SETTINGS);
  ensureSettingsDefaults(sheet);
  const data  = sheet.getDataRange().getValues();
  const settings = {};
  const privateKeys = {
    ADMIN_PASSWORD: true,
    ADMIN_SESSION_TOKEN: true,
    ADMIN_SESSION_EXPIRES: true,
  };
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      const key = data[i][0];
      if (!includePrivate && privateKeys[key]) continue;
      let val = data[i][1];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, 'Asia/Dhaka', 'HH:mm');
      } else {
        val = String(val);
      }
      settings[key] = val;
    }
  }
  return { success: true, data: settings };
}

function updateSettings(body) {
  if (!body.internal && !validateAdminSession(body.adminToken)) {
    return { success: false, message: 'Admin authorization required.' };
  }

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
  const res = getSettings(true);
  return res.data || {};
}

function validateAdminSession(token) {
  if (!token) return false;
  const settings = getSettingsMap();
  if (token !== settings['ADMIN_SESSION_TOKEN']) return false;
  const expiresAt = new Date(settings['ADMIN_SESSION_EXPIRES'] || '');
  return !isNaN(expiresAt.getTime()) && expiresAt.getTime() > Date.now();
}

// ─────────────────────────────────────────────
// ADMIN LOGIN
// ─────────────────────────────────────────────
function adminLogin(body) {
  const settings = getSettingsMap();
  const username = (body.username || '').trim();
  const password = (body.password || '').trim();

  if (username === settings['ADMIN_USERNAME'] && password === settings['ADMIN_PASSWORD']) {
    const token = generateSecureToken();
    updateSettings({ internal: true, settings: {
      ADMIN_SESSION_TOKEN: token,
      ADMIN_SESSION_EXPIRES: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    }});
    return {
      success: true,
      message: 'Admin login successful',
      role: 'admin',
      username: username,
      token: token,
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
  const sheet = getSheet(SHEET_QR_TOKENS);

  // Deactivate all existing active tokens before creating a new one
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][3] === 'Active') {
      sheet.getRange(i + 1, 4).setValue('Replaced');
    }
  }

  const now   = new Date();
  const token = generateSecureToken();

  sheet.appendRow([
    token,
    now.toISOString(),
    '',       // No time-based expiry — active until replaced
    'Active',
  ]);

  return {
    success:     true,
    token:       token,
    generatedAt: now.toISOString(),
  };
}

function getCurrentQR() {
  const sheet = getSheet(SHEET_QR_TOKENS);
  const data  = sheet.getDataRange().getValues();

  // Return the most recent Active token — no time-based expiry check
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][3] === 'Active') {
      return {
        success:     true,
        token:       data[i][0],
        generatedAt: data[i][1] ? new Date(data[i][1]).toISOString() : new Date().toISOString(),
      };
    }
  }

  return { success: false, message: 'কোনো active QR নেই। Admin "Generate New QR" বাটন চাপুন।' };
}

function validateQRToken(token, settingsOverride) {
  if (!token) return { valid: false, message: 'No token provided' };

  // ── Check if this is the static/printed office QR ──────
  const settings    = settingsOverride || getSettingsMap();
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

  // ── Check dynamic QR tokens — valid only if status is Active ──
  const sheet = getSheet(SHEET_QR_TOKENS);
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0] === token) {
      const status = row[3];
      if (status !== 'Active') {
        return { valid: false, message: 'QR code has been replaced. Please scan the current QR displayed at the office.' };
      }
      return { valid: true, message: 'Token valid', token: token };
    }
  }
  return { valid: false, message: 'Invalid QR code. Please scan the office QR.' };
}

function expireOldTokens() {
  // No-op: tokens no longer expire by time — they stay active until replaced by admin.
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

  const settings = getSettingsMap();

  // 1. Validate QR Token
  const qrResult = validateQRToken(qrToken, settings);
  if (!qrResult.valid) {
    return { success: false, message: qrResult.message };
  }

  // 2. GPS — optional, logged for audit, never blocks attendance
  let gpsResult = { valid: true, message: 'GPS not provided', distance: 0 };
  const hasGps = latitude !== undefined && latitude !== null && latitude !== '' &&
                 longitude !== undefined && longitude !== null && longitude !== '';

  if (hasGps) {
    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    if (!isNaN(latNum) && !isNaN(lngNum)) {
      const dist = haversineDistance(latNum, lngNum,
        parseFloat(settings['OFFICE_LATITUDE']  || '23.8103'),
        parseFloat(settings['OFFICE_LONGITUDE'] || '90.4125'));
      gpsResult = { valid: true, distance: Math.round(dist), message: 'Location logged' };
    }
  }

  // 3. Check for duplicate attendance today
  const today = getTodayDate();
  const existing = getEmployeeAttendanceToday(employeeId, today);
  if (existing && existing.checkIn) {
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
  const dayName    = Utilities.formatDate(now, 'Asia/Dhaka', 'EEEE');

  // 6. Determine status
  const lateCutoff = settings['LATE_CUTOFF_TIME'] || DEFAULT_LATE_CUTOFF_TIME;
  const status     = determineAttendanceStatus(timeStr, lateCutoff);
  const lateReason = cleanReason(
    body.lateCheckInReason || body.checkInReason || body.lateReason || body.reason || ''
  );

  if (status === 'Late' && !lateReason) {
    return {
      success: false,
      requireReason: true,
      reasonType: 'late-checkin',
      cutoffTime: lateCutoff,
      status: status,
      message: formatOfficeTimeLabel(lateCutoff) + ' এর পরে Check-In করতে হলে কারণ লিখতে হবে।',
    };
  }

  // 7. Generate attendance ID
  const attId = 'ATT' + Utilities.formatDate(now, 'Asia/Dhaka', 'yyyyMMddHHmmss') + Math.floor(Math.random() * 100);

  // 8. Save attendance
  const attSheet = getOrCreateAttendanceSheetForDate(dateStr, false);
  const rowValues = {
    'Attendance ID': attId,
    'Employee ID': employeeId,
    'Employee Name': empInfo.name,
    'Date': dateStr,
    'Check-In Time': timeStr,
    'Check-Out Time': '',
    'Status': status,
    'Day': dayName,
    'Late Check-In Reason': lateReason,
    'Early Check-Out Reason': '',
  };
  let touchedRowNumber = 0;
  if (existing && existing.rowNumber && !existing.checkIn) {
    setAttendanceRowValues(attSheet, existing.rowNumber, rowValues);
    touchedRowNumber = existing.rowNumber;
  } else {
    attSheet.appendRow(buildAttendanceRow(attSheet, rowValues));
    touchedRowNumber = attSheet.getLastRow();
  }
  formatAttendanceDataRow(attSheet, touchedRowNumber);

  // Technical data → Logs sheet (separate from main attendance view)
  try {
    const logsSheet = getSheet(SHEET_LOGS);
    logsSheet.appendRow([attId, latitude || '', longitude || '', deviceInfo || 'Unknown', qrToken, serverTime]);
  } catch (_) {}

  return {
    success:    true,
    message:    'Attendance marked successfully',
    attendanceId: attId,
    employeeName: empInfo.name,
    date:       dateStr,
    day:        dayName,
    checkIn:    timeStr,
    status:     status,
    lateCheckInReason: lateReason,
    distance:   gpsResult.distance,
  };
}

// ─────────────────────────────────────────────
// CHECK-OUT
// ─────────────────────────────────────────────
function checkOut(body) {
  const { employeeId } = body;
  if (!employeeId) return { success: false, message: 'Employee ID required' };

  const today = getTodayDate();
  const now   = new Date();
  const timeStr = Utilities.formatDate(now, 'Asia/Dhaka', 'HH:mm:ss');
  const settings = getSettingsMap();
  const cutoffTime = settings['EARLY_CHECKOUT_CUTOFF_TIME'] || EARLY_CHECKOUT_CUTOFF_TIME;
  const earlyCheckout = isBeforeOfficeTime(now, cutoffTime);
  const earlyReason = cleanReason(
    body.earlyCheckoutReason || body.checkoutReason || body.reason || ''
  );

  if (earlyCheckout && !earlyReason) {
    return {
      success: false,
      requireReason: true,
      cutoffTime: cutoffTime,
      message: formatOfficeTimeLabel(cutoffTime) + ' এর আগে Check-Out করতে হলে কারণ লিখতে হবে।',
    };
  }

  const sheets = getAttendanceSheetsForDate(today, false, false);
  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    ensureAttendanceSheetSchema(sheet, false);
    const data  = sheet.getDataRange().getValues();
    const headerMap = data.length ? buildHeaderMap(data[0]) : {};

    for (let i = data.length - 1; i >= 1; i--) {
      const row = data[i];
      const rowEmpId = getRowValue(row, headerMap, 'Employee ID', 1);
      const rowDate = normalizeDateValue(getRowValue(row, headerMap, 'Date', 3));
      if (rowEmpId.toString() === employeeId.toString() && rowDate === today) {
        const checkIn = getRowValue(row, headerMap, 'Check-In Time', 4);
        const checkOut = getRowValue(row, headerMap, 'Check-Out Time', 5);
        if (!checkIn) {
          return { success: false, message: 'No check-in found for today' };
        }
        if (checkOut) {
          return { success: false, message: 'Already checked out today' };
        }
        setAttendanceRowValues(sheet, i + 1, {
          'Check-Out Time': timeStr,
          'Day': getRowValue(row, headerMap, 'Day', 7) || getDayNameFromDateString(rowDate || today),
          'Early Check-Out Reason': earlyReason,
        });
        formatAttendanceDataRow(sheet, i + 1);
        return {
          success:  true,
          message:  'Check-out recorded',
          checkOut: timeStr,
          earlyCheckout: earlyCheckout,
          earlyCheckoutReason: earlyReason,
        };
      }
    }
  }
  return { success: false, message: 'No check-in found for today' };
}

// ─────────────────────────────────────────────
// ATTENDANCE QUERIES
// ─────────────────────────────────────────────
function getAttendance(params) {
  const filterDate = params.date || '';
  const records = [];

  const filterEmp  = params.employeeId || '';
  const limitStr   = params.limit || '100';
  const limit      = parseInt(limitStr);
  const seenIds = new Set();

  const sheets = getAttendanceSheets();
  sheets.forEach(sheet => {
    ensureAttendanceSheetSchema(sheet, false);
    const data  = sheet.getDataRange().getValues();
    const headerMap = data.length ? buildHeaderMap(data[0]) : {};

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const id = getRowValue(row, headerMap, 'Attendance ID', 0);
      const employeeId = getRowValue(row, headerMap, 'Employee ID', 1);
      const employeeName = getRowValue(row, headerMap, 'Employee Name', 2);
      const dateStr = normalizeDateValue(getRowValue(row, headerMap, 'Date', 3));
      const checkIn = getRowValue(row, headerMap, 'Check-In Time', 4);
      const checkOut = getRowValue(row, headerMap, 'Check-Out Time', 5);
      const status = getRowValue(row, headerMap, 'Status', 6);
      if (!id || seenIds.has(String(id))) continue;
      const day = getRowValue(row, headerMap, 'Day', 7) || getDayNameFromDateString(dateStr);
      if (filterDate && dateStr !== filterDate) continue;
      if (filterEmp  && employeeId.toString() !== filterEmp) continue;

      seenIds.add(String(id));
      records.push({
        rowNumber:     i + 1,
        id:           id,
        employeeId:   employeeId,
        employeeName: employeeName,
        date:         dateStr,
        checkIn:      checkIn,
        checkOut:     checkOut,
        status:       status,
        day:          day,
        lateCheckInReason:   getRowValue(row, headerMap, 'Late Check-In Reason', 8),
        earlyCheckoutReason: getRowValue(row, headerMap, 'Early Check-Out Reason', 9),
      });
    }
  });

  records.sort((a, b) => {
    const dateOrder = String(b.date || '').localeCompare(String(a.date || ''));
    if (dateOrder !== 0) return dateOrder;
    const checkInOrder = (b.checkIn ? 1 : 0) - (a.checkIn ? 1 : 0);
    if (checkInOrder !== 0) return checkInOrder;
    return (b.rowNumber || 0) - (a.rowNumber || 0);
  });
  return { success: true, data: records.slice(0, limit) };
}

function getTodayAttendance() {
  return getAttendance({ date: getTodayDate() });
}

function getEmployeeAttendanceToday(employeeId, date) {
  const sheets = getAttendanceSheetsForDate(date, false, false);
  let fallback = null;

  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    ensureAttendanceSheetSchema(sheet, false);
    const data  = sheet.getDataRange().getValues();
    const headerMap = data.length ? buildHeaderMap(data[0]) : {};

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowEmpId = getRowValue(row, headerMap, 'Employee ID', 1);
      const rowDate = normalizeDateValue(getRowValue(row, headerMap, 'Date', 3));
      if (rowEmpId.toString() === employeeId.toString() && rowDate === date) {
        const record = {
          rowNumber: i + 1,
          id:      getRowValue(row, headerMap, 'Attendance ID', 0),
          checkIn: getRowValue(row, headerMap, 'Check-In Time', 4),
          checkOut:getRowValue(row, headerMap, 'Check-Out Time', 5),
          status:  getRowValue(row, headerMap, 'Status', 6),
          day:     getRowValue(row, headerMap, 'Day', 7),
          lateCheckInReason: getRowValue(row, headerMap, 'Late Check-In Reason', 8),
          earlyCheckoutReason: getRowValue(row, headerMap, 'Early Check-Out Reason', 9),
          sheetName: sheet.getName(),
        };
        if (record.checkIn) return record;
        fallback = record;
      }
    }
  }
  return fallback;
}

// ─────────────────────────────────────────────
// DASHBOARD STATISTICS
// ─────────────────────────────────────────────
function getDashboardStats() {
  const empSheet  = getSheet(SHEET_EMPLOYEES);
  const empData   = empSheet.getDataRange().getValues();
  const today     = getTodayDate();
  const attResult  = getAttendance({ date: today, limit: '5000' });
  const attData    = attResult.success ? attResult.data : [];

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
  attData.forEach(row => {
    if (row.status === 'Late') {
      lateToday++;
      if (row.employeeId) todayEmpIds.add(String(row.employeeId));
    } else if (row.status === 'Present') {
      presentToday++;
      if (row.employeeId) todayEmpIds.add(String(row.employeeId));
    }
  });

  absentToday = Math.max(0, totalEmployees - presentToday - lateToday);

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
  const now    = new Date();
  const year   = parseInt(params.year  || now.getFullYear());
  const month  = parseInt(params.month || (now.getMonth() + 1));

  // Pad month
  const monthStr = month.toString().padStart(2, '0');
  const prefix   = `${year}-${monthStr}`;

  const dailyStats = {};
  const seenIds = new Set();
  const sheets = getAttendanceSheets();
  sheets.forEach(sheet => {
    ensureAttendanceSheetSchema(sheet, false);
    const data   = sheet.getDataRange().getValues();
    const headerMap = data.length ? buildHeaderMap(data[0]) : {};

    for (let i = 1; i < data.length; i++) {
      const row  = data[i];
      const id   = getRowValue(row, headerMap, 'Attendance ID', 0);
      const date = normalizeDateValue(getRowValue(row, headerMap, 'Date', 3));
      if (!id || seenIds.has(String(id)) || !date.startsWith(prefix)) continue;
      seenIds.add(String(id));

      if (!dailyStats[date]) {
        dailyStats[date] = { present: 0, late: 0, absent: 0 };
      }
      const status = getRowValue(row, headerMap, 'Status', 6);
      if (status === 'Late') dailyStats[date].late++;
      else if (status === 'Present') dailyStats[date].present++;
    }
  });

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

function buildHeaderMap(headers) {
  const map = {};
  (headers || []).forEach((header, idx) => {
    if (header) map[String(header).trim()] = idx;
  });
  return map;
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

function getDayNameFromDateString(dateStr) {
  if (!dateStr) return '';
  const parsed = new Date(dateStr + 'T00:00:00+06:00');
  if (isNaN(parsed.getTime())) return '';
  return Utilities.formatDate(parsed, 'Asia/Dhaka', 'EEEE');
}

function normalizeOfficeTime(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2})(?::(\d{1,2}))?/);
  if (!match) return EARLY_CHECKOUT_CUTOFF_TIME;
  const hours = Math.max(0, Math.min(23, parseInt(match[1], 10)));
  const minutes = Math.max(0, Math.min(59, parseInt(match[2] || '0', 10)));
  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
}

function isBeforeOfficeTime(date, cutoffTime) {
  const current = Utilities.formatDate(date, 'Asia/Dhaka', 'HH:mm');
  return current < normalizeOfficeTime(cutoffTime);
}

function formatOfficeTimeLabel(timeStr) {
  const normalized = normalizeOfficeTime(timeStr);
  const parts = normalized.split(':').map(Number);
  const suffix = parts[0] >= 12 ? 'PM' : 'AM';
  const hour = parts[0] % 12 || 12;
  return hour + ':' + String(parts[1]).padStart(2, '0') + ' ' + suffix;
}

function cleanReason(reason) {
  return String(reason || '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 250);
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

function determineAttendanceStatus(timeStr, lateCutoff) {
  return timeToSeconds(timeStr) <= timeToSeconds(lateCutoff) ? 'Present' : 'Late';
}

function timeToSeconds(timeStr) {
  const parts = String(timeStr || '00:00').split(':').map(Number);
  const h = Number.isFinite(parts[0]) ? parts[0] : 0;
  const m = Number.isFinite(parts[1]) ? parts[1] : 0;
  const s = Number.isFinite(parts[2]) ? parts[2] : 0;
  return h * 3600 + m * 60 + s;
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
// AUTO QR REFRESH — DISABLED
// এই trigger Apps Script editor থেকে delete করুন:
// Triggers menu → autoRefreshQR → Delete
// ─────────────────────────────────────────────
function autoRefreshQR() {
  // disabled — QR now generated only on manual request
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
  updateSettings({ internal: true, settings: {
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
// LEAVE APPLICATIONS
// ─────────────────────────────────────────────
function ensureLeaveApplicationsSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_LEAVE);
  if (!sheet) sheet = ss.insertSheet(SHEET_LEAVE);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Leave ID', 'Employee ID', 'Employee Name', 'Department',
      'Start Date', 'End Date', 'Reason', 'Formal Draft',
      'Status', 'Admin Note', 'Applied At', 'Reviewed At'
    ]);
  }

  sheet.getRange(1, 1, 1, 12)
    .setFontWeight('bold')
    .setBackground('#4cc6cf')
    .setFontColor('#000000')
    .setHorizontalAlignment('center');

  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 5, sheet.getLastRow() - 1, 2).setHorizontalAlignment('center');
    sheet.getRange(2, 9, sheet.getLastRow() - 1, 1).setHorizontalAlignment('center');
  }

  return sheet;
}

function buildLeaveDraft(employee, startDate, endDate, reason) {
  const dateRange = startDate === endDate ? startDate : startDate + ' to ' + endDate;
  return [
    'To',
    'The Management',
    'Trip Fly BD',
    '',
    'Subject: Application for Leave',
    '',
    'Dear Sir/Madam,',
    '',
    'I, ' + employee.name + ' (' + employee.id + '), from ' + employee.department + ', would like to request leave for ' + dateRange + '.',
    'Reason: ' + reason,
    '',
    'I request you to kindly approve my leave application.',
    '',
    'Sincerely,',
    employee.name
  ].join('\n');
}

function submitLeaveApplication(body) {
  const employeeId = (body.employeeId || '').toString().trim();
  const startDate = normalizeDateValue(body.startDate || '');
  const endDate = normalizeDateValue(body.endDate || body.startDate || '');
  const reason = cleanReason(body.reason || '');

  if (!employeeId || !startDate || !endDate || !reason) {
    return { success: false, message: 'Employee, leave date and reason are required.' };
  }

  const employee = getEmployeeById(employeeId);
  if (!employee) return { success: false, message: 'Employee not found.' };

  const sheet = ensureLeaveApplicationsSheet();
  const now = new Date();
  const leaveId = 'LV' + Utilities.formatDate(now, 'Asia/Dhaka', 'yyyyMMddHHmmss') + employeeId.replace(/[^A-Za-z0-9]/g, '');
  const draft = buildLeaveDraft(employee, startDate, endDate, reason);

  sheet.appendRow([
    leaveId,
    employee.id,
    employee.name,
    employee.department,
    startDate,
    endDate,
    reason,
    draft,
    'Pending',
    '',
    now.toISOString(),
    ''
  ]);
  ensureLeaveApplicationsSheet();

  return {
    success: true,
    message: 'Leave application submitted. Admin approval pending.',
    data: {
      id: leaveId,
      status: 'Pending',
      formalDraft: draft,
    },
  };
}

function getLeaveApplications(params) {
  const sheet = ensureLeaveApplicationsSheet();
  const data = sheet.getDataRange().getValues();
  const employeeId = (params.employeeId || '').toString().trim();
  const status = (params.status || '').toString().trim();
  const adminToken = params.adminToken || '';

  if (!employeeId && !validateAdminSession(adminToken)) {
    return { success: false, message: 'Admin authorization required.' };
  }

  const applications = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    if (employeeId && row[1].toString() !== employeeId) continue;
    if (status && row[8].toString() !== status) continue;

    applications.push({
      id: row[0],
      employeeId: row[1],
      employeeName: row[2],
      department: row[3],
      startDate: normalizeDateValue(row[4]),
      endDate: normalizeDateValue(row[5]),
      reason: row[6],
      formalDraft: row[7],
      status: row[8],
      adminNote: row[9],
      appliedAt: row[10],
      reviewedAt: row[11],
    });
  }

  applications.sort((a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0));
  return { success: true, data: applications };
}

function getPendingLeaveApplications(params) {
  if (!validateAdminSession(params.adminToken || '')) {
    return { success: false, message: 'Admin authorization required.' };
  }
  return getLeaveApplications({ adminToken: params.adminToken, status: 'Pending' });
}

function updateLeaveApplicationStatus(body) {
  if (!validateAdminSession(body.adminToken)) {
    return { success: false, message: 'Admin authorization required.' };
  }

  const leaveId = (body.leaveId || '').toString().trim();
  const status = (body.status || '').toString().trim();
  const adminNote = cleanReason(body.adminNote || '');
  if (!leaveId || ['Approved', 'Rejected'].indexOf(status) === -1) {
    return { success: false, message: 'Valid leave ID and status are required.' };
  }

  const sheet = ensureLeaveApplicationsSheet();
  const data = sheet.getDataRange().getValues();
  const reviewedAt = new Date().toISOString();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === leaveId) {
      sheet.getRange(i + 1, 9).setValue(status);
      sheet.getRange(i + 1, 10).setValue(adminNote);
      sheet.getRange(i + 1, 12).setValue(reviewedAt);
      return {
        success: true,
        message: 'Leave application ' + status.toLowerCase() + '.',
        data: { id: leaveId, status: status, adminNote: adminNote, reviewedAt: reviewedAt },
      };
    }
  }

  return { success: false, message: 'Leave application not found.' };
}

// ─────────────────────────────────────────────
// MIGRATE TECHNICAL COLUMNS TO LOGS SHEET — run once manually
// Apps Script editor → select moveColumnsToLogsSheet → Run
// Moves Latitude, Longitude, Device Info, QR Token, Timestamp
// out of Attendance sheet into the new Logs sheet
// ─────────────────────────────────────────────
function moveColumnsToLogsSheet() {
  const ss       = getSpreadsheet();
  const attSheet = getSheet(SHEET_ATTENDANCE);

  // Ensure Logs sheet exists
  let logsSheet = ss.getSheetByName(SHEET_LOGS);
  if (!logsSheet) {
    logsSheet = ss.insertSheet(SHEET_LOGS);
    logsSheet.appendRow(['Attendance ID', 'Latitude', 'Longitude', 'Device Info', 'QR Token', 'Timestamp']);
    logsSheet.getRange(1, 1, 1, 6).setFontWeight('bold').setBackground('#1a1a1a').setFontColor('#D4AF37');
  }

  const headers   = attSheet.getRange(1, 1, 1, attSheet.getLastColumn()).getValues()[0];
  const headerMap = {};
  headers.forEach((h, i) => { if (h) headerMap[String(h).trim()] = i; }); // 0-indexed

  const techFields = ['Latitude', 'Longitude', 'Device Info', 'QR Token', 'Timestamp'];
  const presentFields = techFields.filter(f => headerMap[f] !== undefined);

  if (presentFields.length === 0) {
    Logger.log('Technical columns not found — already migrated or never existed.');
    return;
  }

  const lastRow = attSheet.getLastRow();
  if (lastRow > 1) {
    const data = attSheet.getDataRange().getValues();

    // Collect existing Attendance IDs already in Logs to avoid duplicates
    const logsLastRow = logsSheet.getLastRow();
    const existingIds = new Set();
    if (logsLastRow > 1) {
      logsSheet.getRange(2, 1, logsLastRow - 1, 1).getValues()
        .forEach(r => { if (r[0]) existingIds.add(String(r[0])); });
    }

    const newLogRows = [];
    for (let i = 1; i < data.length; i++) {
      const row   = data[i];
      const attId = String(row[headerMap['Attendance ID'] !== undefined ? headerMap['Attendance ID'] : 0] || '');
      if (!attId || existingIds.has(attId)) continue;
      newLogRows.push([
        attId,
        headerMap['Latitude']    !== undefined ? row[headerMap['Latitude']]    : '',
        headerMap['Longitude']   !== undefined ? row[headerMap['Longitude']]   : '',
        headerMap['Device Info'] !== undefined ? row[headerMap['Device Info']] : '',
        headerMap['QR Token']    !== undefined ? row[headerMap['QR Token']]    : '',
        headerMap['Timestamp']   !== undefined ? row[headerMap['Timestamp']]   : '',
      ]);
    }

    if (newLogRows.length > 0) {
      logsSheet.getRange(logsSheet.getLastRow() + 1, 1, newLogRows.length, 6).setValues(newLogRows);
      Logger.log('Copied ' + newLogRows.length + ' rows to Logs sheet.');
    }
  }

  // Delete technical columns from Attendance sheet (right → left to avoid index shift)
  const colsToDelete = presentFields
    .map(f => headerMap[f] + 1) // convert to 1-indexed
    .sort((a, b) => b - a);     // descending order

  colsToDelete.forEach(col => attSheet.deleteColumn(col));
  Logger.log('Deleted columns: ' + presentFields.join(', ') + ' from Attendance sheet.');

  // Re-apply schema and formatting
  ensureAttendanceSheetSchema(attSheet, true);
  Logger.log('Migration complete.');
}

// ─────────────────────────────────────────────
// DELETE TECHNICAL COLUMNS FROM ATTENDANCE SHEET — run once manually
// Run this AFTER moveColumnsToLogsSheet if columns weren't deleted
// ─────────────────────────────────────────────
function deleteTechColumnsFromAttendance() {
  const sheet   = getSheet(SHEET_ATTENDANCE);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const techFields = ['Latitude', 'Longitude', 'Device Info', 'QR Token', 'Timestamp'];
  const colsToDelete = [];

  headers.forEach((h, i) => {
    const name = String(h || '').trim();
    if (techFields.indexOf(name) !== -1) {
      colsToDelete.push(i + 1); // 1-indexed
      Logger.log('Found: ' + name + ' at column ' + (i + 1));
    }
  });

  if (colsToDelete.length === 0) {
    Logger.log('No technical columns found — already removed.');
    return;
  }

  // Delete right → left to avoid index shifting
  colsToDelete.sort((a, b) => b - a);
  colsToDelete.forEach(col => {
    Logger.log('Deleting column ' + col);
    sheet.deleteColumn(col);
  });

  Logger.log('Done. Removed ' + colsToDelete.length + ' column(s).');
  ensureAttendanceSheetSchema(sheet, true);
}

// ─────────────────────────────────────────────
// REFORMAT EXISTING ATTENDANCE — run once manually
// Apps Script editor → select reformatAttendanceSheet → Run
// ─────────────────────────────────────────────
function reformatAttendanceSheet() {
  const sheet = getSheet(SHEET_ATTENDANCE);
  ensureAttendanceSheetSchema(sheet, false);

  if (sheet.getLastRow() <= 1) {
    Logger.log('No attendance data to format.');
    return;
  }

  fillMissingAttendanceDayValues(sheet);
  applyAttendanceSheetFormatting(sheet);
  Logger.log('Attendance sheet reformatted successfully. Rows: ' + (sheet.getLastRow() - 1));
}

// ─────────────────────────────────────────────
// APPLY REQUESTED ATTENDANCE SHEET SETUP — run once manually
// Keeps visible Attendance sheet clean: dropdowns, teal header,
// centered Date/Time columns, and today's Absence rows.
// ─────────────────────────────────────────────
function applyRequestedAttendanceSheetSetup() {
  try {
    deleteTechColumnsFromAttendance();
  } catch (err) {
    Logger.log('Tech column cleanup skipped: ' + err.message);
  }

  runDailyAttendanceMaintenance();
  Logger.log('Requested attendance sheet setup applied.');
}

// ─────────────────────────────────────────────
// DAILY ATTENDANCE MAINTENANCE
// Run installDailyAttendanceTrigger() once from Apps Script editor.
// After that, every morning the Attendance sheet keeps the same
// dropdowns, colors, centered Date/Time columns, and Absence rows.
// ─────────────────────────────────────────────
function runDailyAttendanceMaintenance() {
  const result = maintainAttendanceSheetForDate(getTodayDate());
  Logger.log(
    'Daily attendance maintenance complete for ' + result.date +
    '. Absence rows added: ' + result.addedAbsenceRows +
    ', Day cells filled: ' + result.filledDayRows
  );
  return result;
}

function installDailyAttendanceTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runDailyAttendanceMaintenance') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('runDailyAttendanceMaintenance')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  runDailyAttendanceMaintenance();
  Logger.log('Daily attendance maintenance trigger installed for every day around 6 AM.');
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
