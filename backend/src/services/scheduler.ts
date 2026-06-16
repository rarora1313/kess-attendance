import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { sendDailySummary, AttendanceRow } from './email';

const prisma = new PrismaClient();

function todayStr() { return new Date().toISOString().slice(0, 10); }
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ── Job 1: flag open sessions from previous days (runs at midnight) ───────────
async function flagMissingSignouts() {
  const today = todayStr();
  const result = await prisma.attendance.updateMany({
    where: { clockOut: null, attendanceDate: { lt: today }, flaggedMissingSignout: false },
    data: { flaggedMissingSignout: true },
  });
  if (result.count > 0) {
    console.log(`[scheduler] Flagged ${result.count} missing sign-out(s).`);
  }
}

// ── Job 2: daily summary email (runs at configurable hour, default 18:00) ────
async function sendDailySummaries() {
  const today = todayStr();

  const branches = await prisma.branch.findMany({
    where: { active: true },
    include: {
      manager: true,
      employees: { where: { status: 'active' } },
    },
  });

  for (const branch of branches) {
    if (!branch.manager?.email) continue;

    const records = await prisma.attendance.findMany({
      where: { branchId: branch.id, attendanceDate: today },
      include: {
        employee: { select: { firstName: true, lastName: true, scheduledStartTime: true, scheduledHours: true } },
        breaks: true,
      },
    });

    const totalActive = branch.employees.length;
    const presentCount = records.length;
    const absentCount = Math.max(0, totalActive - presentCount);

    const rows: AttendanceRow[] = records.map(r => {
      const clockInTime  = new Date(r.clockIn).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
      const clockOutTime = r.clockOut ? new Date(r.clockOut).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : null;

      // Late detection
      let isLate = false;
      let lateByMinutes = 0;
      if (r.employee.scheduledStartTime) {
        const [sh, sm] = r.employee.scheduledStartTime.split(':').map(Number);
        const scheduledMs = sh * 60 + sm;
        const clockInMs   = new Date(r.clockIn).getHours() * 60 + new Date(r.clockIn).getMinutes();
        lateByMinutes = clockInMs - scheduledMs;
        isLate = lateByMinutes > 14; // > 14 min grace period
      }

      // Overtime detection
      let isOvertime = false;
      let overtimeHours = 0;
      if (r.totalHours != null && r.employee.scheduledHours != null) {
        overtimeHours = r.totalHours - r.employee.scheduledHours;
        isOvertime = overtimeHours > 0.5; // > 30 min grace
      }

      return {
        employeeName:       `${r.employee.firstName} ${r.employee.lastName}`,
        clockIn:            clockInTime,
        clockOut:           clockOutTime,
        totalHours:         r.totalHours,
        totalBreakMinutes:  r.totalBreakMinutes,
        isLate,
        lateByMinutes,
        isOvertime,
        overtimeHours,
        isMissingSignout:   !r.clockOut,
      };
    });

    const dateLabel = new Date().toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    try {
      await sendDailySummary(branch.manager.email, branch.name, dateLabel, rows, absentCount);
    } catch (err) {
      console.error(`[scheduler] Failed to email ${branch.manager.email}:`, err);
    }
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
export function startScheduler() {
  // Midnight: flag missing sign-outs
  cron.schedule('0 0 * * *', flagMissingSignouts);

  // Configurable hour (default 18 = 6 PM): daily summary
  const summaryHour = process.env.SUMMARY_HOUR ?? '18';
  cron.schedule(`0 ${summaryHour} * * *`, sendDailySummaries);

  console.log(`[scheduler] Started — missing sign-out check at 00:00, summary email at ${summaryHour}:00`);
}
