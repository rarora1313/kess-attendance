import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Kiosk from './pages/kiosk/Kiosk';
import AdminDashboard from './pages/admin/Dashboard';
import Branches from './pages/admin/Branches';
import Employees from './pages/admin/Employees';
import AdminAttendance from './pages/admin/Attendance';
import AdminTimesheets from './pages/admin/Timesheets';
import Reports from './pages/admin/Reports';
import ManagerDashboard from './pages/manager/Dashboard';
import ManagerAttendance from './pages/manager/Attendance';
import ManagerTimesheets from './pages/manager/Timesheets';

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

function PrivateRoute({ children, role }: { children: JSX.Element; role?: string }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/manager'} replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/kiosk" element={<Kiosk />} />

      <Route path="/admin" element={<PrivateRoute role="admin"><Layout><AdminDashboard /></Layout></PrivateRoute>} />
      <Route path="/admin/branches" element={<PrivateRoute role="admin"><Layout><Branches /></Layout></PrivateRoute>} />
      <Route path="/admin/employees" element={<PrivateRoute role="admin"><Layout><Employees /></Layout></PrivateRoute>} />
      <Route path="/admin/attendance" element={<PrivateRoute role="admin"><Layout><AdminAttendance /></Layout></PrivateRoute>} />
      <Route path="/admin/timesheets" element={<PrivateRoute role="admin"><Layout><AdminTimesheets /></Layout></PrivateRoute>} />
      <Route path="/admin/reports" element={<PrivateRoute role="admin"><Layout><Reports /></Layout></PrivateRoute>} />

      <Route path="/manager" element={<PrivateRoute role="manager"><Layout><ManagerDashboard /></Layout></PrivateRoute>} />
      <Route path="/manager/attendance" element={<PrivateRoute role="manager"><Layout><ManagerAttendance /></Layout></PrivateRoute>} />
      <Route path="/manager/timesheets" element={<PrivateRoute role="manager"><Layout><ManagerTimesheets /></Layout></PrivateRoute>} />

      <Route path="/" element={
        user ? <Navigate to={user.role === 'admin' ? '/admin' : '/manager'} replace /> : <Navigate to="/login" replace />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
