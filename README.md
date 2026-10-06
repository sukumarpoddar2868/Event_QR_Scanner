# 🎟️ Event QR Scanner

A simple, fast, and offline-capable **Event QR Ticket Generator & Check-in Scanner** built with React and Vite.

The application allows event organizers to:

- Generate unique event tickets
- Generate QR codes for tickets
- Import tickets in bulk using Excel
- Download QR codes individually or as a ZIP
- Scan QR codes using a device camera
- Validate tickets instantly
- Prevent duplicate check-ins
- Track check-in statistics
- Export the ticket list as Excel

---

## 🚀 Live Application

**Production:**  
Add your Vercel deployment URL here.

---

## ✨ Features

### 🎫 Ticket Generator

The generator allows event organizers to create tickets manually or import them in bulk.

Each ticket contains:

| Field | Description |
|---|---|
| `sl_no` | Serial number for reference |
| `ticket_id` | Unique ticket identifier |
| `name` | Attendee name |
| `number` | Attendee phone number |

Example:

| sl_no | ticket_id | name | number |
|---:|---|---|---|
| 1 | EVT001 | Rahul Kumar | 9876543210 |
| 2 | EVT002 | Amit Singh | 9876543211 |
| 3 | EVT003 | Priya Das | 9876543212 |

---

### 📱 QR Code Generation

Each ticket gets a unique QR code.

The QR code contains **only the `ticket_id`**.

For example:

```text
EVT001
```

No personal information is stored inside the QR code.

QR codes can be:

- Viewed individually
- Downloaded as PNG
- Downloaded together as a ZIP file

---

### 📊 Excel Import

Tickets can be imported in bulk using an Excel file.

Required columns:

```text
sl_no
ticket_id
name
number
```

The application validates:

- Empty Excel files
- Missing fields
- Duplicate ticket IDs
- Existing ticket IDs

Existing ticket IDs are skipped during import.

---

### 📷 QR Scanner

The scanner uses the device camera to scan attendee QR codes.

Scanner route:

```text
/scanner
```

The scanner checks the scanned `ticket_id` against the locally stored ticket database.

Possible results:

#### ✅ Entry Allowed

The ticket exists and has not been used.

```text
ENTRY ALLOWED
```

The ticket is marked as checked in.

---

#### ⚠️ Already Checked In

The ticket exists but was previously scanned.

```text
ALREADY CHECKED IN
```

The ticket cannot be used again.

---

#### ❌ Invalid Ticket

The scanned ticket ID does not exist in the imported ticket list.

```text
INVALID TICKET
```

---

## 🔊 Scanner Sounds

The scanner provides audio feedback for faster verification.

| Result | Sound |
|---|---|
| Valid ticket | Success sound |
| Already checked in | Warning sound |
| Invalid ticket | Error sound |

Sounds are generated using the **Web Audio API**, so no external audio files are required.

---

## 💾 Offline Support

The scanner stores ticket and check-in information locally using **IndexedDB**.

This means the scanner can continue working without a backend server after the application has been loaded.

The scanner stores:

```text
ticket_id
name
number
sl_no
checkedIn
checkedInAt
```

The Excel file itself does not contain check-in information.

---

## 🗄️ Data Storage

The application currently does not require a backend database.

### Generator

Ticket data is stored in:

```text
localStorage
```

### Scanner

Ticket and check-in data is stored in:

```text
IndexedDB
```

Database:

```text
event-checkin-db
```

Object store:

```text
tickets
```

The `ticket_id` is used as the primary key.

---

## 🛣️ Application Routes

| Route | Purpose |
|---|---|
| `/` | Ticket Generator |
| `/scanner` | Event QR Scanner |

---

## 🏗️ Project Structure

```text
event_check_in/
│
├── public/
│
├── src/
│   │
│   ├── components/
│   │   └── QRScanner.jsx
│   │
│   ├── db/
│   │   └── database.js
│   │
│   ├── pages/
│   │   ├── Generator.jsx
│   │   └── Scanner.jsx
│   │
│   ├── utils/
│   │   ├── excel.js
│   │   └── sound.js
│   │
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
│
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── vercel.json
└── README.md
```

---

## 🛠️ Technology Stack

### Frontend

- React
- Vite
- JavaScript
- CSS

### QR Code

- `qrcode`
- `html5-qrcode`

### Data Storage

- IndexedDB
- `idb`
- Browser `localStorage`

### Excel

- `xlsx`

### ZIP Generation

- `jszip`

### Routing

- `react-router-dom`

### Deployment

- Vercel

---

## 📦 Installation

Clone the repository:

```bash
git clone https://github.com/sukumarpoddar2868/Event_QR_Scanner.git
```

Go into the project:

```bash
cd Event_QR_Scanner
```

Install dependencies:

```bash
npm install
```

---

## ▶️ Run Locally

Start the development server:

```bash
npm run dev
```

The application will normally be available at:

```text
http://localhost:5173
```

Open the scanner at:

```text
http://localhost:5173/scanner
```

---

## 🏭 Production Build

To create a production build:

```bash
npm run build
```

To preview the production build:

```bash
npm run preview
```

---

## 📱 Scanner Setup

For an event:

### 1. Generate Tickets

Open:

```text
/
```

Create tickets manually or import an Excel file.

### 2. Generate QR Codes

Generate the QR codes for the tickets.

Each QR code represents one unique ticket ID.

### 3. Import Master Excel on Scanner

Open:

```text
/scanner
```

Import the same master Excel file.

### 4. Start Scanning

Use the device camera to scan attendee QR codes.

The scanner will immediately display:

```text
ENTRY ALLOWED
```

or

```text
ALREADY CHECKED IN
```

or

```text
INVALID TICKET
```

---

## ⚠️ Important Notes

### One Scanner Device

The current MVP is designed around a **single scanner device**.

Check-in information is stored locally in that device's IndexedDB.

If multiple devices are used simultaneously, their check-in states will not automatically synchronize.

---

### Browser Storage

Clearing the browser's site data can remove locally stored tickets and check-in information.

For an actual event, avoid clearing browser storage during the event.

---

### Camera Permission

The scanner requires camera permission.

On production deployments, the application should be accessed through HTTPS so that browser camera APIs work correctly.

---

## 🔐 QR Code Security

The QR code contains only:

```text
ticket_id
```

Example:

```text
EVT001
```

Personal information such as:

- Name
- Phone number

is not encoded inside the QR code.

The scanner uses the ticket ID to find the corresponding attendee in its locally stored ticket list.

---

## 🔄 Check-in Flow

```text
Attendee
   │
   ▼
QR Code
   │
   ▼
Camera Scanner
   │
   ▼
Extract ticket_id
   │
   ▼
Search IndexedDB
   │
   ├── Ticket Not Found
   │       │
   │       ▼
   │   INVALID TICKET
   │
   └── Ticket Found
           │
           ▼
       Already Checked In?
           │
      ┌────┴────┐
      │         │
     Yes        No
      │         │
      ▼         ▼
 ALREADY     ENTRY
 CHECKED IN   ALLOWED
                │
                ▼
          Save Check-in
```

---

## 📈 Check-in Statistics

The scanner displays:

```text
Total Tickets
Checked In
Remaining
```

For example:

```text
Total Tickets: 500
Checked In: 327
Remaining: 173
```

---

## 🌐 Deployment

The application can be deployed using Vercel.

The project includes:

```text
vercel.json
```

with SPA routing configuration so that routes such as:

```text
/scanner
```

work correctly when opened directly.

---

## 🔮 Future Improvements

Possible future versions could include:

- Backend database
- Multi-device synchronization
- Real-time check-in dashboard
- Admin authentication
- Event management
- Multiple events
- Cloud ticket storage
- Check-in history
- Attendee search
- Manual ticket verification
- QR code printing
- Check-in analytics
- Role-based access control
- Automatic Excel check-in export
- Cloud backup
- Multi-scanner support

---

## 📄 License

This project is currently developed as an MVP for event ticket generation and check-in management.

---

## 👨‍💻 Author

**Sukumar Poddar**

GitHub:

`https://github.com/sukumarpoddar2868`
