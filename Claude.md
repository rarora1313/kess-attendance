# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

Open two terminals (or run the two `.bat` launchers):

```bat
# Terminal 1 — backend (http://localhost:4000)
cd backend
npx ts-node-dev --transpile-only src/index.ts

# Terminal 2 — frontend (http://localhost:3000)
cd frontend
npm run dev
```

One-click Windows launchers: `start-backend.bat` and `start-frontend.bat`.

**Seed / reset database:**
```bat
cd backend
npx prisma migrate dev --name <migration_name>  # schema changes
npx ts-node-dev --transpile-only prisma/seed.ts  # seed default admin + sample data
```

Default admin credentials: `admin@company.com` / `admin123`  
Default employee PIN: `1234` (Jane Smith, Main Branch)

## Architecture

**Stack:** React 18 + TypeScript + Tailwind CSS (frontend) · Node.js + Express + TypeScript (backend) · Prisma ORM + SQLite (dev) / PostgreSQL (prod)

```
frontend/src/
  api/           axios client + all API call functions
  context/       AuthContext — JWT stored in localStorage, injected via axios interceptor
  components/    Layout (sidebar nav), UI primitives (Card, StatCard)
  pages/
    Login.tsx         Shared login page (admin + manager)
    kiosk/Kiosk.tsx   Kiosk touchscreen interface (public, no auth required)
    admin/            Dashboard, Branches, Employees (+ Managers tab), Timesheets, Reports
    manager/          Dashboard, Attendance, Timesheets

backend/src/
  index.ts         Express entry point, CORS, JSON middleware
  middleware/auth.ts  JWT verification + requireRole() RBAC guard
  routes/index.ts  All routes mounted here
  controllers/     One file per domain (auth, branch, employee, attendance, timesheet, report)
  prisma/schema.prisma  Data model

backend/prisma/
  dev.db           SQLite database (local only, not committed)
  seed.ts          Creates admin user + Main Branch + employee EMP001/PIN 1234
```

## Key design decisions

**Kiosk is public** — `/api/kiosk/action` and `/api/kiosk/status` require no auth token. Employees are identified by PIN. The kiosk page (`/kiosk`) has no login requirement.

**Role-based access** — `requireRole('admin')` or `requireRole('admin','manager')` is applied per-route in `routes/index.ts`. Managers are scoped to their branch via `branchId` in the JWT payload (set at login from `user.managedBranch.id`).

**Attendance flow** — each clock-in creates an `Attendance` row with `clockOut: null`. Breaks create `Break` rows under that attendance. Clock-out sets `clockOut` and calculates `totalHours = shiftDuration - totalBreakMinutes`. Open rows (no clock-out) = currently signed in.

**Hours calculation** — done server-side in `attendanceController.ts` at clock-out: `(now - clockIn) / 3600000 - totalBreakMinutes / 60`.

**Switching to PostgreSQL** — in `backend/prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`, update `DATABASE_URL` in `.env`, then run `npx prisma migrate dev`.

## Data model summary

| Table | Key fields |
|---|---|
| `User` | admin/manager logins; `role` = "admin"\|"manager" |
| `Branch` | `code` unique; `managerId` → `User` (1:1) |
| `Employee` | `pin` unique (kiosk auth); `employeeNumber` unique; belongs to one `Branch` |
| `Attendance` | one row per clock-in; `clockOut: null` = active session |
| `Break` | child of `Attendance`; `breakEnd: null` = active break |
| `Timesheet` | manually submitted task log; `status` = draft → submitted → approved/rejected |

## Future phases (from spec)

Phase 2: Face recognition, QR code, RFID, GPS, mobile app  
Phase 3: Payroll integration, AI analytics, shift scheduling, leave management
