import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export interface AttendanceRow {
  employeeName: string;
  clockIn: string;
  clockOut: string | null;
  totalHours: number | null;
  totalBreakMinutes: number;
  isLate: boolean;
  lateByMinutes: number;
  isOvertime: boolean;
  overtimeHours: number;
  isMissingSignout: boolean;
}

export async function sendDailySummary(
  to: string,
  branchName: string,
  date: string,
  rows: AttendanceRow[],
  absentCount: number,
) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('[email] SMTP not configured — skipping daily summary.');
    return;
  }

  const present    = rows.length;
  const late       = rows.filter(r => r.isLate).length;
  const overtime   = rows.filter(r => r.isOvertime).length;
  const missing    = rows.filter(r => r.isMissingSignout).length;

  const rowsHtml = rows.map(r => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${r.employeeName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${r.clockIn}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${r.clockOut ?? '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${r.totalHours != null ? r.totalHours.toFixed(2) + 'h' : '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">
        ${r.isLate        ? `<span style="color:#d97706">⚠ Late ${r.lateByMinutes}m</span> ` : ''}
        ${r.isOvertime    ? `<span style="color:#7c3aed">⚠ OT +${r.overtimeHours.toFixed(1)}h</span> ` : ''}
        ${r.isMissingSignout ? `<span style="color:#dc2626">⚠ Missing sign-out</span>` : ''}
        ${!r.isLate && !r.isOvertime && !r.isMissingSignout ? '<span style="color:#16a34a">✓</span>' : ''}
      </td>
    </tr>
  `).join('');

  const html = `
  <div style="font-family:system-ui,sans-serif;max-width:680px;margin:0 auto;background:#fff">
    <div style="background:#1e3a5f;color:#fff;padding:24px 32px;border-radius:8px 8px 0 0">
      <h1 style="margin:0;font-size:22px">Daily Attendance Summary</h1>
      <p style="margin:4px 0 0;opacity:.8">${branchName} &nbsp;·&nbsp; ${date}</p>
    </div>

    <div style="padding:24px 32px;background:#f8fafc;display:flex;gap:16px;flex-wrap:wrap">
      ${stat('Present',  present,  '#16a34a')}
      ${stat('Absent',   absentCount, '#dc2626')}
      ${stat('Late',     late,     '#d97706')}
      ${stat('Overtime', overtime, '#7c3aed')}
      ${stat('Missing sign-out', missing, '#ef4444')}
    </div>

    <div style="padding:24px 32px">
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600">Employee</th>
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600">Sign In</th>
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600">Sign Out</th>
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600">Hours</th>
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600">Notes</th>
          </tr>
        </thead>
        <tbody>${rowsHtml || '<tr><td colspan="5" style="padding:16px;color:#94a3b8;text-align:center">No attendance recorded today.</td></tr>'}</tbody>
      </table>
    </div>

    <div style="padding:16px 32px;background:#f8fafc;border-radius:0 0 8px 8px;color:#94a3b8;font-size:12px">
      This summary was generated automatically by the Timesheet System.
    </div>
  </div>`;

  await transporter.sendMail({
    from: `"Timesheet System" <${process.env.SMTP_USER}>`,
    to,
    subject: `Daily Summary — ${branchName} — ${date}`,
    html,
  });

  console.log(`[email] Daily summary sent to ${to} for ${branchName}`);
}

function stat(label: string, value: number, color: string) {
  return `<div style="background:#fff;border-radius:8px;padding:12px 20px;min-width:100px;border-left:4px solid ${color}">
    <div style="font-size:24px;font-weight:700;color:${color}">${value}</div>
    <div style="font-size:12px;color:#64748b">${label}</div>
  </div>`;
}
