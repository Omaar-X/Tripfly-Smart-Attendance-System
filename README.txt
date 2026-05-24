================================================================
         TRIP FLY BD — SMART ATTENDANCE MANAGEMENT SYSTEM
                    Complete Setup & Deployment Guide
                           Version 1.0.0
================================================================

  Company:     Trip Fly BD
  System Type: Dynamic QR-Based Smart Attendance System
  Tech Stack:  HTML5 + CSS3 + Vanilla JS + Google Apps Script
  Database:    Google Sheets
  Author:      Trip Fly BD IT Department

================================================================
TABLE OF CONTENTS
================================================================

  01. Project Overview
  02. Complete File Structure
  03. Quick Start (3 Steps)
  04. Google Sheet Setup Guide
  05. Google Apps Script Deployment
  06. Frontend Configuration
  07. Running Locally (VS Code / Live Server)
  08. Mobile QR Scanning Workflow
  09. Admin Panel Guide
  10. Employee Panel Guide
  11. Reports & Analytics Guide
  12. GPS Validation Guide
  13. Security Overview
  14. Default Logins & Sample Data
  15. Troubleshooting
  16. Frequently Asked Questions

================================================================
01. PROJECT OVERVIEW
================================================================

Trip Fly BD Smart Attendance System is a production-ready,
browser-based attendance management system that uses:

  ✓ Dynamic QR codes (rotate every 30 seconds)
  ✓ GPS location verification (Haversine formula)
  ✓ Server-side timestamps (cannot be faked)
  ✓ One-time-use tokens (prevents replay attacks)
  ✓ Google Sheets as database (zero server cost)
  ✓ Google Apps Script backend (serverless)

HOW IT WORKS:
  1. Admin opens admin.html → QR Station → Live QR displayed
  2. Employee opens employee.html on mobile phone
  3. Employee logs in with Employee ID + PIN
  4. Employee scans QR code with camera
  5. GPS is captured and validated server-side
  6. Attendance saved to Google Sheets automatically
  7. Admin sees real-time dashboard with charts

================================================================
02. COMPLETE FILE STRUCTURE
================================================================

tripfly-attendance-system/
│
├── index.html                  ← Login page (Admin + Employee)
├── admin.html                  ← Admin dashboard
├── employee.html               ← Employee mobile panel
├── reports.html                ← Reports & analytics
├── README.txt                  ← This file
│
├── assets/
│   ├── css/
│   │   └── style.css           ← All styles (3154 lines)
│   │
│   ├── js/
│   │   ├── app.js              ← Core: API, utils, auth (989 lines)
│   │   ├── qr-generator.js     ← Admin QR display (294 lines)
│   │   ├── qr-scanner.js       ← Employee scanner (335 lines)
│   │   ├── dashboard.js        ← Charts & stats (484 lines)
│   │   └── gps.js              ← GPS module (317 lines)
│   │
│   └── images/
│       └── logo.svg            ← Company logo
│
└── apps_script/
    └── apps_script.gs          ← Google Apps Script backend (868 lines)

TOTAL: 12 files | ~9,600 lines of production code

================================================================
03. QUICK START (3 STEPS)
================================================================

STEP 1 — Create Google Sheet
  a. Go to: https://sheets.google.com
  b. Create a new blank spreadsheet
  c. Name it: "TripFlyBD Attendance System"
  d. Copy the Sheet ID from the URL:
     https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit
     Example ID: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms

STEP 2 — Deploy Apps Script
  a. In your Google Sheet: Extensions → Apps Script
  b. Delete the default code
  c. Paste ALL contents of: apps_script/apps_script.gs
  d. On line 13, replace:
       'YOUR_SPREADSHEET_ID_HERE'
     with your Sheet ID from Step 1
  e. Click Save (Ctrl+S)
  f. Select function: initializeSheets → Click Run
  g. Grant permissions when prompted
  h. Deploy → New Deployment → Web App
       Execute as: Me
       Access: Anyone
  i. Copy the Web App URL

STEP 3 — Configure Frontend
  a. Open: assets/js/app.js
  b. On line 19, replace:
       'PASTE_YOUR_WEB_APP_URL_HERE'
     with your Web App URL from Step 2
  c. Open index.html in a browser → Done!

================================================================
04. GOOGLE SHEET SETUP GUIDE
================================================================

The initializeSheets() function creates all tabs automatically.
After running it, your sheet will have 4 tabs:

TAB 1: Employees
  ┌──────────────┬───────────────┬─────────────┬──────────────────────────┬──────────────┬─────┬────────┐
  │ Employee ID  │ Employee Name │ Department  │ Email                    │ Phone        │ PIN │ Status │
  ├──────────────┼───────────────┼─────────────┼──────────────────────────┼──────────────┼─────┼────────┤
  │ EMP001       │ Rahim Uddin   │ Sales       │ rahim@tripflybd.com      │ 01711000001  │1234 │ Active │
  │ EMP002       │ Karim Hossain │ Operations  │ karim@tripflybd.com      │ 01711000002  │2345 │ Active │
  │ EMP003       │ Nasrin Akter  │ Marketing   │ nasrin@tripflybd.com     │ 01711000003  │3456 │ Active │
  │ EMP004       │ Sabbir Ahmed  │ Accounts    │ sabbir@tripflybd.com     │ 01711000004  │4567 │ Active │
  │ EMP005       │ Mitu Begum    │ Customer Care│ mitu@tripflybd.com      │ 01711000005  │5678 │ Active │
  │ EMP006       │ Farhan Islam  │ IT          │ farhan@tripflybd.com     │ 01711000006  │6789 │ Active │
  └──────────────┴───────────────┴─────────────┴──────────────────────────┴──────────────┴─────┴────────┘

TAB 2: Attendance
  Columns: Attendance ID | Employee ID | Employee Name | Date |
           Check-In Time | Check-Out Time | Status |
           Latitude | Longitude | Device Info | QR Token | Timestamp

TAB 3: QR_Tokens
  Columns: Token | Generated Time | Expiry Time | Status
  Token status values: Active | Used | Expired

TAB 4: Settings
  Key                  │ Value (edit these to configure system)
  ────────────────────────────────────────────────────────────
  OFFICE_NAME          │ Trip Fly BD
  OFFICE_LATITUDE      │ 23.8103        ← YOUR OFFICE LAT
  OFFICE_LONGITUDE     │ 90.4125        ← YOUR OFFICE LNG
  ALLOWED_RADIUS       │ 100            ← metres radius
  OFFICE_START_TIME    │ 09:00          ← HH:MM 24-hour
  QR_EXPIRY_SECONDS    │ 30             ← 15-120 seconds
  ADMIN_USERNAME       │ admin
  ADMIN_PASSWORD       │ admin123       ← CHANGE THIS!

HOW TO FIND YOUR OFFICE COORDINATES:
  1. Open Google Maps: https://maps.google.com
  2. Search for your office address
  3. Right-click on the exact building location
  4. Click the coordinates shown at the top of the menu
  5. This copies them — paste into Settings tab

================================================================
05. GOOGLE APPS SCRIPT DEPLOYMENT GUIDE
================================================================

FIRST-TIME DEPLOYMENT:

  1. Open Google Sheet → Extensions → Apps Script
  2. Paste apps_script.gs contents
  3. Update SPREADSHEET_ID on line 13
  4. Save project (Ctrl+S), name it: TripFlyBD Attendance

  5. Run initializeSheets():
     a. Select "initializeSheets" from the function dropdown
     b. Click ▶ Run
     c. Review permissions dialog:
        - Click "Review permissions"
        - Select your Google account
        - Click "Advanced" → "Go to TripFlyBD Attendance (unsafe)"
        - Click "Allow"
     d. Verify: "Sheets initialized successfully" in logs

  6. Deploy as Web App:
     a. Click: Deploy → New deployment
     b. Click ⚙ gear → Select "Web app"
     c. Set:
          Description:   TripFlyBD v1.0
          Execute as:    Me
          Who has access: Anyone
     d. Click "Deploy"
     e. Copy and save the Web App URL

  IMPORTANT — The URL looks like:
  https://script.google.com/macros/s/AKfycby.../exec

RE-DEPLOYMENT (after code changes):
  1. Deploy → Manage deployments
  2. Click the pencil (edit) icon
  3. Change version to "New version"
  4. Click "Deploy"
  NOTE: The URL stays the same after re-deployment.

TRIGGER SETUP (optional — for 1-minute auto QR refresh):
  1. In Apps Script → Triggers (clock icon in left sidebar)
  2. Click "+ Add Trigger"
  3. Set:
       Function:      autoRefreshQR
       Event source:  Time-driven
       Type:          Minutes timer
       Interval:      Every minute
  4. Click "Save"
  NOTE: Apps Script minimum trigger interval is 1 minute.
  The frontend handles 30-second visual refresh automatically.

TEST YOUR DEPLOYMENT:
  Open in browser: YOUR_WEBAPP_URL?action=getDashboardStats
  
  Expected response:
  {"success":true,"data":{"totalEmployees":6,"presentToday":0,...}}

================================================================
06. FRONTEND CONFIGURATION
================================================================

THE ONLY FILE YOU NEED TO EDIT:
  assets/js/app.js — Line 19

  Change:
    const APPS_SCRIPT_URL = 'PASTE_YOUR_WEB_APP_URL_HERE';
  
  To:
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_ID/exec';

THAT'S IT. All 4 HTML pages use this single setting.

OPTIONAL CUSTOMIZATIONS:
  assets/css/style.css → :root variables
    --gold:          #D4AF37  ← brand gold color
    --bg-deepest:    #040406  ← background color
  
  admin.html → sidebar brand name:
    <span class="sidebar__company">Trip Fly BD</span>

FILE LOAD ORDER (automatic — no changes needed):
  index.html    → app.js
  admin.html    → app.js → qr-generator.js → dashboard.js
  employee.html → app.js → gps.js → qr-scanner.js
  reports.html  → app.js

================================================================
07. RUNNING LOCALLY (VS CODE / LIVE SERVER)
================================================================

METHOD A — VS Code Live Server (RECOMMENDED):
  1. Install VS Code: https://code.visualstudio.com
  2. Open the tripfly-attendance-system/ folder in VS Code
     File → Open Folder → select tripfly-attendance-system
  3. Install "Live Server" extension:
     Extensions panel (Ctrl+Shift+X) → search "Live Server"
     Install by Ritwick Dey
  4. Right-click index.html → "Open with Live Server"
  5. Browser opens at: http://127.0.0.1:5500/index.html

  ⚠ IMPORTANT FOR GPS:
  GPS/Geolocation requires HTTPS in production.
  For localhost testing, Chrome/Firefox allows http://127.0.0.1
  Safari requires HTTPS even for localhost.

METHOD B — Python HTTP Server:
  1. Open Terminal in the project folder
  2. Run: python3 -m http.server 8080
  3. Open browser: http://localhost:8080

METHOD C — Node.js http-server:
  1. npm install -g http-server
  2. cd tripfly-attendance-system
  3. http-server -p 8080
  4. Open: http://localhost:8080

METHOD D — Direct file open (LIMITED):
  Simply double-click index.html.
  ⚠ GPS will NOT work due to browser security restrictions.
  ⚠ API calls may be blocked by CORS policy.
  Only use for UI preview, not functional testing.

PRODUCTION DEPLOYMENT:
  Upload all files to any web host:
  - Shared hosting (cPanel file manager)
  - Netlify: drag-and-drop the folder at netlify.com/drop
  - Vercel: vercel.com (free tier)
  - GitHub Pages (free)
  Any static file host works — no server required.

================================================================
08. MOBILE QR SCANNING WORKFLOW
================================================================

COMPLETE STEP-BY-STEP WORKFLOW:

FOR ADMIN (office display computer):
  1. Open admin.html on desktop/laptop browser
  2. Log in: username=admin, password=admin123
  3. Click "QR Station" in sidebar
  4. The live QR code is displayed on screen
  5. The QR automatically refreshes every 30 seconds
  6. Keep this page open during attendance time (9:00 AM)

FOR EMPLOYEES (mobile phone):
  1. Connect to office WiFi or use mobile data
  2. Open employee.html URL in mobile browser
     (Admin should share this URL via WhatsApp/email)
  3. Log in with Employee ID (e.g. EMP001) and PIN (e.g. 1234)
  4. The "Scan QR" tab is shown automatically
  5. Allow GPS when browser asks for location permission
  6. Wait for GPS status bar to show "GPS Active" (green dot)
  7. Tap "Start Camera Scan" button
  8. Allow camera access when prompted
  9. Point camera at the QR code on the office screen
  10. Keep QR code fully visible in the camera frame
  11. The system automatically detects and processes it
  12. Green checkmark popup confirms attendance is marked
  13. Tap "Done" — attendance saved to Google Sheets!

WHAT HAPPENS ON THE SERVER (automatic):
  ✓ QR token is validated (30-second expiry check)
  ✓ Token is marked "Used" (prevents reuse)
  ✓ GPS coordinates are verified against office location
  ✓ Duplicate check (one attendance per employee per day)
  ✓ Server timestamp recorded (not device time)
  ✓ Status assigned: Present (≤ 9:00) or Late (> 9:00)
  ✓ Row saved to Attendance sheet instantly

FOR BEST QR SCANNING RESULTS:
  - Hold phone 20-40 cm from the screen
  - Ensure office screen is bright enough
  - Avoid reflections/glare on the screen
  - Use landscape orientation if QR is large
  - Good lighting in the room helps camera focus

================================================================
09. ADMIN PANEL GUIDE
================================================================

URL: admin.html

LOGIN: admin / admin123 (change in Settings → Admin Credentials)

SECTIONS (sidebar navigation):

📊 DASHBOARD
  - 4 stat cards: Total Employees, Present, Late, Absent
  - Attendance rate progress bar
  - Today's live attendance table
  - Export today's data as CSV

📱 QR STATION
  - Live QR code with 30-second countdown ring
  - "Generate New QR" button for manual refresh
  - Active token display
  - Scan statistics (Present/Late/Absent counts)
  - How-it-works instruction panel

📋 ATTENDANCE
  - Filter by date, employee ID, or status
  - Full paginated attendance table (25 per page)
  - GPS coordinate links (click → Google Maps)
  - Export filtered results as CSV

👥 EMPLOYEES
  - Employee cards grid with edit/deactivate buttons
  - Full employee directory table
  - Add employee (modal form)
  - Edit employee details
  - Deactivate employee (soft-delete, marks Inactive)
  - Search employees in real-time
  - Export employee list as CSV

📈 ANALYTICS
  - Monthly line chart: Present vs Late daily
  - Daily bar chart: breakdown by day
  - Today's doughnut chart with percentage
  - Monthly area chart: total trend
  - Month/Year picker for any historical period

⚙ SETTINGS
  - Office name and start time
  - QR expiry duration
  - GPS coordinates and radius
  - "Detect My Location" button (admin computer)
  - Admin username/password change
  - API connection test

================================================================
10. EMPLOYEE PANEL GUIDE
================================================================

URL: employee.html  (mobile-optimised)

LOGIN: Employee ID (e.g. EMP001) + 4-digit PIN (e.g. 1234)

TABS:

📷 SCAN QR
  - Instructions card
  - GPS status indicator (green = active, red = error)
  - "Already Marked Today" notice (if attendance done)
  - "Start Camera Scan" button → activates camera
  - Animated scan line inside camera viewfinder
  - Automatic QR detection → processes attendance
  - "Stop Scanner" to turn off camera
  - "Check-Out for Today" button (after check-in)

📅 HISTORY
  - Monthly filter selector
  - Summary stats: Present / Late / Absent / Rate
  - Daily attendance cards with times and GPS
  - Tap GPS coordinates to open Google Maps

👤 PROFILE
  - Employee photo (icon), name, department
  - Full contact information
  - This month's bar chart (daily check-ins)
  - Sign Out button

SUCCESS POPUP (after scanning):
  - Animated green checkmark SVG
  - Employee name, date, check-in time
  - Distance from office in metres
  - Status badge: Present or Late
  - "Done" button closes popup

================================================================
11. REPORTS & ANALYTICS GUIDE
================================================================

URL: reports.html

REPORT TYPES:

📅 DAILY REPORT
  - Select a specific date
  - Shows all employees who attended that day
  - Summary stats + bar chart + detailed table

📅 WEEKLY REPORT
  - Select any date within the week
  - System calculates Monday–Sunday range
  - Shows attendance across the full week

📅 MONTHLY REPORT
  - Select month and year
  - Bar chart of daily attendance
  - Employee-wise breakdown table with rate %
  - Colour-coded: ≥90% green, ≥70% amber, <70% red

🔍 CUSTOM RANGE
  - Select any start and end date
  - Useful for specific periods (e.g. Ramadan, festivals)

👤 BY EMPLOYEE
  - Select individual employee from dropdown
  - Filter by month
  - See that employee's full attendance record

EXPORT OPTIONS:
  📄 Export as CSV — downloads report data as CSV file
  🖨 Print — formatted print layout (black & white safe)
  (Both options available on every report type)

EMPLOYEE-WISE TABLE (Monthly/Employee reports):
  Shows per-employee breakdown:
  Present | Late | Absent | Attendance Rate | Last Check-In

================================================================
12. GPS VALIDATION GUIDE
================================================================

HOW GPS VALIDATION WORKS:
  1. Employee's browser requests GPS permission
  2. Device GPS provides coordinates (latitude, longitude)
  3. Coordinates sent to Apps Script with attendance request
  4. Server calculates distance using Haversine formula:
     distance = 2 × R × arcsin(√(sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)))
  5. If distance ≤ ALLOWED_RADIUS → attendance accepted
  6. If distance > ALLOWED_RADIUS → attendance rejected

SETTING UP YOUR OFFICE COORDINATES:
  Method 1 — Google Maps:
    a. Go to maps.google.com
    b. Find your office
    c. Right-click → copy coordinates
    d. Update Settings sheet or Admin → Settings → GPS

  Method 2 — Admin Panel Detect:
    a. Open admin.html on the office computer
    b. Go to Settings → GPS & Location
    c. Click "Detect My Location"
    d. Confirm → Save GPS

RECOMMENDED RADIUS SETTINGS:
  Small office (1 floor):     50–100 metres
  Medium office (building):   100–150 metres
  Large complex:              150–300 metres
  Flexible (trust-based):     500+ metres

GPS ACCURACY NOTE:
  - Indoor GPS is less accurate (±10-50m typical)
  - Set radius to at least 2× your building size
  - Mobile GPS indoors may need 30-60 seconds to acquire
  - WiFi/cell-tower location is used as fallback (less accurate)

DISABLE GPS VALIDATION (if not needed):
  Set ALLOWED_RADIUS to 999999 in Settings sheet.
  Attendance will be accepted from anywhere.

================================================================
13. SECURITY OVERVIEW
================================================================

SECURITY MECHANISMS:

1. DYNAMIC QR ROTATION
   - New token every 30 seconds
   - Tokens expire server-side (cannot be extended)
   - Token status: Active → Used (after scan) → Expired
   - Screenshot/photo of QR code is useless after 30s

2. SINGLE-USE TOKENS
   - Each QR token can only be used ONCE
   - Once scanned by any employee, token is marked "Used"
   - Admin manually generates a new token per attendance window

3. GPS LOCATION LOCK
   - Employee must be within office radius (default 100m)
   - GPS validated server-side using Haversine formula
   - Client cannot fake GPS (server validates independently)

4. SERVER-SIDE TIMESTAMPS
   - Apps Script uses Utilities.formatDate() with 'Asia/Dhaka'
   - Client device time is completely ignored
   - Status (Present/Late) calculated server-side only

5. DUPLICATE PREVENTION
   - Server checks for existing attendance before saving
   - One attendance record per employee per day maximum
   - Returns existing record details if duplicate attempted

6. SESSION-BASED AUTH
   - Login tokens stored in sessionStorage (not localStorage)
   - Session cleared on browser close
   - Role-based routing (admin vs employee)

7. INPUT VALIDATION
   - Employee PIN: must be exactly 4 digits
   - Employee ID: converted to uppercase for consistency
   - All QR tokens: validated against QR_Tokens sheet

IMPORTANT SECURITY NOTES:
  ⚠ Change admin password from 'admin123' immediately
  ⚠ Change employee PINs from defaults before going live
  ⚠ Use HTTPS in production (required for GPS on mobile)
  ⚠ The Apps Script Web App URL is publicly accessible —
    do not share it beyond the office network if sensitive

================================================================
14. DEFAULT LOGINS & SAMPLE DATA
================================================================

ADMIN LOGIN:
  Username: admin
  Password: admin123
  Page: index.html (Admin tab)

EMPLOYEE LOGINS:
  ┌──────────┬───────────────┬───────────────┬─────┐
  │ Emp ID   │ Name          │ Department    │ PIN │
  ├──────────┼───────────────┼───────────────┼─────┤
  │ EMP001   │ Rahim Uddin   │ Sales         │1234 │
  │ EMP002   │ Karim Hossain │ Operations    │2345 │
  │ EMP003   │ Nasrin Akter  │ Marketing     │3456 │
  │ EMP004   │ Sabbir Ahmed  │ Accounts      │4567 │
  │ EMP005   │ Mitu Begum    │ Customer Care │5678 │
  │ EMP006   │ Farhan Islam  │ IT            │6789 │
  └──────────┴───────────────┴───────────────┴─────┘
  Page: index.html (Employee tab)

CHANGING PASSWORDS:
  Admin: Admin Panel → Settings → Admin Credentials
  Employees: Admin Panel → Employees → Edit employee → change PIN

================================================================
15. TROUBLESHOOTING
================================================================

PROBLEM: "API URL not configured"
SOLUTION:
  Open assets/js/app.js, line 19
  Replace 'PASTE_YOUR_WEB_APP_URL_HERE' with your Web App URL

PROBLEM: "Connection error" when logging in
SOLUTION:
  a. Check if APPS_SCRIPT_URL is correct in app.js
  b. Test URL directly in browser: YOUR_URL?action=getDashboardStats
  c. Check that deployment access is set to "Anyone"
  d. Make sure you're serving over http:// not file://
  e. Try re-deploying the Apps Script (Manage Deployments)

PROBLEM: "Sheets initialized successfully" but tabs not appearing
SOLUTION:
  a. Verify SPREADSHEET_ID on line 13 of apps_script.gs
  b. Run initializeSheets() again
  c. Check Apps Script execution log for errors

PROBLEM: QR code not showing
SOLUTION:
  a. Check browser console for errors (F12 → Console)
  b. Verify QRCode.js CDN loaded: https://cdnjs.cloudflare.com
  c. Try "Generate New QR" button
  d. Check Apps Script API connection in Settings → Test API

PROBLEM: QR scan not working on phone
SOLUTION:
  a. Must serve over HTTPS or http://127.0.0.1 (localhost only)
  b. Allow camera permission when browser asks
  c. Ensure good lighting on QR code
  d. Try Chrome mobile (most reliable)
  e. Hold phone 20-40cm from the QR display
  f. Check if html5-qrcode CDN loaded in browser console

PROBLEM: GPS permission denied
SOLUTION:
  a. Employee must click "Allow" when browser asks for location
  b. If previously denied: browser Settings → Site permissions → Location
  c. In Chrome: Click lock icon in address bar → Location → Allow
  d. In Safari: Settings → Privacy → Location Services → Safari → Allow
  e. Ensure page served over HTTPS for mobile

PROBLEM: "Out of range" GPS error
SOLUTION:
  a. Employee must be physically inside the office
  b. Wait 30-60 seconds for GPS to stabilise indoors
  c. Check ALLOWED_RADIUS in Settings (increase if needed)
  d. Verify OFFICE_LATITUDE and OFFICE_LONGITUDE are correct
  e. Try Admin Panel → Settings → Detect My Location for accuracy

PROBLEM: "Attendance already recorded for today"
SOLUTION:
  This is expected — the system prevents duplicate attendance.
  If it was recorded in error, admin can manually edit the
  Google Sheet (Attendance tab) to remove the record.

PROBLEM: Check-out button not showing
SOLUTION:
  The check-out button appears after check-in is recorded.
  Refresh the employee page and check today's status banner.

PROBLEM: Charts not loading in admin analytics
SOLUTION:
  a. Verify Chart.js CDN loaded (check F12 → Network)
  b. Try selecting a different month/year and clicking Load Charts
  c. Ensure attendance records exist for the selected period

PROBLEM: Employee login fails
SOLUTION:
  a. Employee ID must match exactly (case-insensitive, e.g. EMP001)
  b. PIN must be exactly 4 digits
  c. Employee status must be "Active" in the Employees sheet
  d. Check Employees sheet for the correct PIN value

PROBLEM: "Script function not found" in Apps Script
SOLUTION:
  Save the script (Ctrl+S) before deploying.
  Ensure the entire apps_script.gs was pasted correctly.

PROBLEM: Apps Script "You do not have permission"
SOLUTION:
  Re-run initializeSheets() and go through the full
  permissions flow (Advanced → Unsafe → Allow).

================================================================
16. FREQUENTLY ASKED QUESTIONS
================================================================

Q: Can employees use their personal phones?
A: Yes. Any smartphone with a modern browser (Chrome, Safari,
   Firefox) and camera + GPS works fine.

Q: Does it work without internet?
A: No. Both the employee's device and the office computer
   must have internet to communicate with Apps Script.

Q: Can I add more than 6 employees?
A: Yes. Use Admin Panel → Employees → Add Employee.
   The system supports unlimited employees.

Q: What if an employee forgets to check out?
A: Admin can manually add the checkout time in the Google Sheet
   (Attendance tab, Check-Out Time column for that row).
   Or employees can use the Check-Out button in employee.html.

Q: Can multiple employees scan at the same time?
A: Yes! Each employee scans with their own account. The QR
   token is shared but each check-in record is per-employee.
   Note: After one scan, token is "Used" — admin must generate
   a new one for the next employee. Set QR_EXPIRY_SECONDS to
   a shorter value (e.g. 15) so tokens cycle faster.

   RECOMMENDATION: Use the following workflow:
   - Set QR_EXPIRY_SECONDS = 30
   - Display the QR on a projector for 5-10 minutes
   - All 6 employees scan within that window
   - Each employee gets their own attendance record

Q: Can I use this on iPad/tablets?
A: Yes. The admin dashboard works great on tablets.
   employee.html is optimised for mobile portrait mode.

Q: Does this replace a fingerprint machine?
A: It works differently — QR + GPS instead of biometrics.
   No hardware required, works from any smartphone.

Q: Can I export data to Excel?
A: Yes. Reports page → select report type → Export CSV.
   Opens in Excel with proper UTF-8 encoding (Bengali names
   supported with the BOM prefix in the CSV).

Q: How do I backup the data?
A: The data is in Google Sheets — Google automatically backs
   it up. You can also: File → Download → Excel (.xlsx)
   or export CSVs from the Reports section.

Q: Is the system free?
A: Yes. Google Sheets + Apps Script are free.
   The web host can also be free (GitHub Pages, Netlify).
   Total cost: $0.

================================================================
CDN LIBRARIES USED
================================================================

  Font Awesome 6.5.1
  https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css

  Chart.js 4.4.1
  https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js

  QRCode.js 1.0.0
  https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js

  html5-qrcode 2.3.8
  https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js

  Google Fonts — Cormorant Garamond + DM Sans
  https://fonts.googleapis.com

  All CDN libraries require internet connection.
  For offline use, download and host them locally.

================================================================
SUPPORT & MAINTENANCE
================================================================

  System:   Trip Fly BD Smart Attendance v1.0.0
  Stack:    HTML5 + CSS3 + Vanilla JS + Google Apps Script
  Database: Google Sheets (serverless, zero infrastructure)
  Hosting:  Any static file host (Netlify, GitHub Pages, etc.)
  Backend:  Google Apps Script (serverless, auto-scaling)

  To report issues or request features:
  Contact the IT department at Trip Fly BD.

================================================================
 Trip Fly BD Smart Attendance System — Production Ready v1.0.0
 All rights reserved © Trip Fly BD
================================================================
