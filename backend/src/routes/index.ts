import { Router } from 'express';
import { login, getMe } from '../controllers/authController';
import { listBranches, getBranch, createBranch, updateBranch } from '../controllers/branchController';
import {
  listEmployees, getEmployee, createEmployee, updateEmployee,
  transferEmployee, createManager, listManagers,
} from '../controllers/employeeController';
import { kioskAction, getEmployeeStatus, listAttendance, correctAttendance } from '../controllers/attendanceController';
import { listTimesheets, createTimesheet, updateTimesheetStatus, kioskSubmitTimesheet } from '../controllers/timesheetController';
import { getAttendanceSummary, exportPayroll, getDashboardStats } from '../controllers/reportController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Public
router.post('/auth/login', login);

// Kiosk (public — secured by employee PIN)
router.post('/kiosk/action', kioskAction);
router.get('/kiosk/status', getEmployeeStatus);
router.post('/kiosk/timesheet', kioskSubmitTimesheet);

// Authenticated
router.use(authenticate);

router.get('/auth/me', getMe);

// Branches (admin only for write)
router.get('/branches', listBranches);
router.get('/branches/:id', getBranch);
router.post('/branches', requireRole('admin'), createBranch);
router.patch('/branches/:id', requireRole('admin'), updateBranch);

// Employees
router.get('/employees', listEmployees);
router.get('/employees/:id', getEmployee);
router.post('/employees', requireRole('admin'), createEmployee);
router.patch('/employees/:id', requireRole('admin', 'manager'), updateEmployee);
router.post('/employees/:id/transfer', requireRole('admin'), transferEmployee);

// Managers
router.get('/managers', requireRole('admin'), listManagers);
router.post('/managers', requireRole('admin'), createManager);

// Attendance
router.get('/attendance', listAttendance);
router.patch('/attendance/:id', requireRole('admin', 'manager'), correctAttendance);

// Timesheets
router.get('/timesheets', listTimesheets);
router.post('/timesheets', createTimesheet);
router.patch('/timesheets/:id/status', requireRole('admin', 'manager'), updateTimesheetStatus);

// Reports
router.get('/reports/summary', getAttendanceSummary);
router.get('/reports/export', exportPayroll);
router.get('/reports/dashboard', getDashboardStats);

export default router;
