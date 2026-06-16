import api from './client';

// Auth
export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password }).then(r => r.data);

export const getMe = () => api.get('/auth/me').then(r => r.data);

// Branches
export const getBranches = () => api.get('/branches').then(r => r.data);
export const createBranch = (data: object) => api.post('/branches', data).then(r => r.data);
export const updateBranch = (id: number, data: object) => api.patch(`/branches/${id}`, data).then(r => r.data);

// Employees
export const getEmployees = () => api.get('/employees').then(r => r.data);
export const createEmployee = (data: object) => api.post('/employees', data).then(r => r.data);
export const updateEmployee = (id: number, data: object) => api.patch(`/employees/${id}`, data).then(r => r.data);
export const transferEmployee = (id: number, branchId: number) =>
  api.post(`/employees/${id}/transfer`, { branchId }).then(r => r.data);

// Managers
export const getManagers = () => api.get('/managers').then(r => r.data);
export const createManager = (data: object) => api.post('/managers', data).then(r => r.data);

// Attendance
export const getAttendance = (params?: object) => api.get('/attendance', { params }).then(r => r.data);
export const correctAttendance = (id: number, data: object) => api.patch(`/attendance/${id}`, data).then(r => r.data);

// Kiosk
export const kioskAction = (pin: string, action: string, branchId?: number, photo?: string | null) =>
  api.post('/kiosk/action', { pin, action, branchId, photo }).then(r => r.data);
export const getEmployeeStatus = (pin: string) =>
  api.get('/kiosk/status', { params: { pin } }).then(r => r.data);

export const kioskSubmitTimesheet = (data: object) =>
  api.post('/kiosk/timesheet', data).then(r => r.data);

// Timesheets
export const getTimesheets = (params?: object) => api.get('/timesheets', { params }).then(r => r.data);
export const createTimesheet = (data: object) => api.post('/timesheets', data).then(r => r.data);
export const updateTimesheetStatus = (id: number, status: string) =>
  api.patch(`/timesheets/${id}/status`, { status }).then(r => r.data);

// Reports
export const getDashboardStats = (params?: object) => api.get('/reports/dashboard', { params }).then(r => r.data);
export const getAttendanceSummary = (params: object) => api.get('/reports/summary', { params }).then(r => r.data);
export const exportPayroll = (params: object) => {
  const token = localStorage.getItem('token');
  const q = new URLSearchParams(params as Record<string, string>).toString();
  window.open(`/api/reports/export?${q}&token=${token}`);
};
