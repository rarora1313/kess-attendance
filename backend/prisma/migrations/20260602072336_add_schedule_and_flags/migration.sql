-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "scheduledHours" REAL;
ALTER TABLE "Employee" ADD COLUMN "scheduledStartTime" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attendance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "branchId" INTEGER NOT NULL,
    "attendanceDate" TEXT NOT NULL,
    "clockIn" DATETIME NOT NULL,
    "clockOut" DATETIME,
    "totalHours" REAL,
    "totalBreakMinutes" INTEGER NOT NULL DEFAULT 0,
    "clockInPhoto" TEXT,
    "clockOutPhoto" TEXT,
    "flaggedMissingSignout" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attendance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attendance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Attendance" ("attendanceDate", "branchId", "clockIn", "clockInPhoto", "clockOut", "clockOutPhoto", "createdAt", "employeeId", "id", "totalBreakMinutes", "totalHours") SELECT "attendanceDate", "branchId", "clockIn", "clockInPhoto", "clockOut", "clockOutPhoto", "createdAt", "employeeId", "id", "totalBreakMinutes", "totalHours" FROM "Attendance";
DROP TABLE "Attendance";
ALTER TABLE "new_Attendance" RENAME TO "Attendance";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
