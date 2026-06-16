import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, Building2, ClipboardList,
  BarChart3, LogOut, Monitor, CalendarCheck
} from 'lucide-react';

const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/branches', label: 'Branches', icon: Building2 },
  { to: '/admin/employees', label: 'Employees', icon: Users },
  { to: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/admin/timesheets', label: 'Timesheets', icon: ClipboardList },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
];

const managerNav = [
  { to: '/manager', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/manager/attendance', label: 'Attendance', icon: Users },
  { to: '/manager/timesheets', label: 'Timesheets', icon: ClipboardList },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const nav = user?.role === 'admin' ? adminNav : managerNav;

  function handleSignOut() {
    signOut();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="px-6 py-5 border-b border-gray-700">
          <h1 className="text-lg font-bold">Timesheet System</h1>
          <p className="text-xs text-gray-400 mt-0.5 capitalize">{user?.role} Panel</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to || (to !== '/admin' && to !== '/manager' && location.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}

          <Link
            to="/kiosk"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <Monitor size={18} />
            Kiosk Mode
          </Link>
        </nav>

        <div className="px-3 py-4 border-t border-gray-700">
          <div className="px-3 py-2 text-xs text-gray-400">
            {user?.firstName} {user?.lastName}
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors w-full"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
