# GSS Billing Tool — FOFO Edition

**GSS Billing** is a full-stack billing and inventory management application built for **Peps Industries Pvt. Ltd.** (Mattress Manufacturing, Coimbatore). It runs as a web app (and optionally as a mobile app) and generates GST-compliant tax invoices.

---

## Features

| Module | What it does |
|---|---|
| **Home / Announcements** | Landing screen after login — post price changes, discounts, MRP updates visible to all users |
| **Dashboard** | Today's sales, monthly sales, outstanding, low-stock alerts, revenue trend chart, Top 10 customers/items |
| **Billing** | Create GST invoices with line items, payment modes (Cash/UPI/Card/Credit), credit limit warnings |
| **Invoices** | List, search, filter by status/date, download PDF, export to Excel |
| **PDF Invoice** | 5-copy GST tax invoice (Original, Transporter, Assessee, Extra, Gate) matching Peps Industries format |
| **Customers** | Add/edit customers, multiple addresses (Bill To / Ship To), credit limits, outstanding ledger, soft-delete & restore |
| **Items** | Product catalogue, HSN codes, GST rates, stock management, low-stock threshold alerts |
| **Stock Ledger** | Full movement history — Purchase In, Sale Out, Opening Stock, Damage Stock, Sample Issue, Adjustments |
| **Dispatch** | Track deliveries — PENDING → DISPATCHED → DELIVERED with vehicle/LR/driver details and POD capture |
| **Reports** | Daily Summary, GST Summary (CGST/SGST/IGST), Transaction Register, Outstanding Ageing |
| **Admin** | User management, custom roles, per-role tab access control |
| **Settings** | Business details (outlet name, GSTIN, address, bank), theme, font scale, language (11 languages) |
| **Audit Log** | Every create/update/delete recorded with user name and timestamp |

---

## Tech Stack

```
backend/    Express · Prisma ORM · SQLite · TypeScript · PDFKit · ExcelJS
mobile/     Expo Router · React Native · React Native Web · TypeScript
shared/     Shared TypeScript types · GST calculation engine · i18n (11 languages)
```

Runs as a **web app in any browser** (via React Native Web). The same codebase also builds native iOS and Android apps via Expo.

---

## Quick Start (Development)

### Prerequisites
- Node.js 18+
- npm 9+
- Git

### 1 — Clone the repo

```bash
git clone https://github.com/PEPSADMIN/GSS-FOFO-Billing-Tool.git
cd GSS-FOFO-Billing-Tool
```

### 2 — Install dependencies

```bash
cd backend && npm install
cd ../mobile && npm install
cd ..
```

### 3 — Configure the backend

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and set:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key-here"   # change this to any long random string
PORT=4000
```

### 4 — Set up the database

```bash
cd backend
npx prisma migrate deploy        # run all migrations
npx prisma db seed               # create the owner account
```

### 5 — Configure the mobile app

Create `mobile/.env`:

```env
# For web browser on the same machine:
EXPO_PUBLIC_API_URL=http://localhost:4000

# For a physical device on the same Wi-Fi:
# EXPO_PUBLIC_API_URL=http://<your-pc-ip>:4000
```

### 6 — Run

Open **two terminals**:

**Terminal 1 — Backend**
```bash
cd backend
npm run dev
# → GSS Billing backend listening on http://0.0.0.0:4000
```

**Terminal 2 — Web App**
```bash
cd mobile
npx expo start --web
# → Open http://localhost:8081 in your browser
```

### 7 — Login

| Field | Value |
|---|---|
| Username | `Hari` |
| Password | `Hari#2312` |

---

## Project Structure

```
GSS-FOFO-Billing-Tool/
│
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Database models
│   │   ├── migrations/            # All DB migrations (committed)
│   │   └── seed.ts                # Creates owner account on first run
│   └── src/
│       ├── routes/                # API endpoints
│       │   ├── auth.ts            # Login / JWT
│       │   ├── invoices.ts        # Invoice CRUD + PDF + Excel
│       │   ├── customers.ts       # Customer + addresses + credit
│       │   ├── items.ts           # Items + stock adjustments
│       │   ├── stock.ts           # Stock ledger
│       │   ├── dispatch.ts        # Dispatch tracking
│       │   ├── dashboard.ts       # Dashboard aggregates
│       │   ├── reports.ts         # Daily/GST/Outstanding reports
│       │   ├── announcements.ts   # Home screen posts
│       │   ├── outlet.ts          # Business settings
│       │   ├── users.ts           # User management
│       │   └── roles.ts           # Custom role management
│       └── lib/
│           ├── invoicePdf.ts      # PDFKit GST invoice layout
│           └── numberToWords.ts   # Indian rupees in words
│
├── mobile/
│   ├── app/
│   │   ├── (tabs)/                # All main screens
│   │   │   ├── index.tsx          # Home / Announcements
│   │   │   ├── dashboard.tsx      # Dashboard + charts
│   │   │   ├── billing.tsx        # Create invoice
│   │   │   ├── invoices.tsx       # Invoice list
│   │   │   ├── customers.tsx      # Customer management
│   │   │   ├── items.tsx          # Item management
│   │   │   ├── reports.tsx        # Reports (4 tabs)
│   │   │   ├── admin.tsx          # User & role admin
│   │   │   └── settings.tsx       # App + business settings
│   │   ├── invoice/[id].tsx       # Invoice detail + dispatch
│   │   ├── stock-ledger.tsx       # Stock movement history
│   │   └── dispatch/index.tsx     # Dispatch tracking list
│   ├── components/
│   │   ├── ui.tsx                 # Button, Card, Input, Badge, etc.
│   │   ├── NavMenu.tsx            # Side-drawer navigation
│   │   └── Calendar.tsx           # Custom month-grid date picker
│   └── lib/
│       ├── api.ts                 # All API client calls
│       ├── theme.ts               # Colors, typography, spacing
│       └── auth-context.tsx       # Auth state + role helpers
│
└── shared/
    └── src/
        ├── types.ts               # All shared TypeScript types + DTOs
        ├── gst.ts                 # GST calculation engine
        └── i18n.ts                # Translations (EN/HI/TA/TE/BN/MR/GU/KN/OR/ML/PA)
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/dashboard` | Dashboard stats |
| GET/POST | `/api/invoices` | List / create invoice |
| GET | `/api/invoices/:id/pdf` | Download PDF |
| GET | `/api/invoices/:id/excel` | Export Excel |
| GET/POST/PUT/DELETE | `/api/customers` | Customer CRUD |
| GET/POST | `/api/customers/:id/addresses` | Multiple addresses |
| GET | `/api/customers/:id/credit-status` | Credit + outstanding |
| GET/POST/PUT/DELETE | `/api/items` | Item CRUD + stock adjust |
| GET | `/api/stock/ledger` | Stock movement history |
| GET/POST | `/api/dispatch/:invoiceId` | Dispatch info |
| POST | `/api/dispatch/:invoiceId/pod` | Mark delivered |
| GET | `/api/reports/daily-summary` | Daily sales summary |
| GET | `/api/reports/gst-summary` | GST breakdown |
| GET | `/api/reports/outstanding` | Outstanding ageing |
| GET/POST/DELETE | `/api/announcements` | Home screen posts |
| GET/PUT | `/api/outlet` | Business details |
| GET/POST/PUT | `/api/users` | User management |
| GET/POST/PUT/DELETE | `/api/roles` | Custom roles |

---

## GST Invoice

The PDF invoice is generated server-side with **PDFKit** and follows the standard GST format:

- **Intra-state**: CGST + SGST (split equally)
- **Inter-state**: IGST (full rate)
- 5 copies per invoice: Original for Buyer, Duplicate for Transporter, Triplicate for Assessee, Extra Copy, Gate Copy
- Amount in words (Indian numbering — Lakh / Crore)
- Bill To / Ship To address snapshot (frozen at invoice creation — safe to edit addresses later)

---

## User Roles

| Role | Default Access |
|---|---|
| **OWNER** | Full access — all tabs including Admin and Settings |
| **ADMIN** | All tabs except Admin user management |
| **CASHIER** | Home, Billing, Invoices, Customers only |
| **Custom Role** | Owner can create roles with any combination of tabs |

---

## Languages Supported

English · Hindi · Tamil · Telugu · Bengali · Marathi · Gujarati · Kannada · Odia · Malayalam · Punjabi

---

## Important Notes

- **`.env` files are not committed** — you must create `backend/.env` manually on each machine
- **Database is not committed** — run `prisma migrate deploy` + `prisma db seed` on first setup
- **`node_modules/` are not committed** — run `npm install` in `backend/` and `mobile/`
- The app uses **SQLite** by default. For production, swap the Prisma datasource to PostgreSQL/MySQL

---

## License

Private — Peps Industries Pvt. Ltd. All rights reserved.
