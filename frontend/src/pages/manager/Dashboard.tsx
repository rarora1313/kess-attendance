import { useQuery } from '@tanstack/react-query';
import { getDashboardStats, getAttendance } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { StatCard } from '../../components/ui/StatCard';
import { Users, UserCheck, Coffee, ClipboardList, UserX } from 'lucide-react';

export default function ManagerDashboard() {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  const { data: stats } = useQuery({
    queryKey: ['dashboard', user?.branchId],
    queryFn: () => getDashboardStats({ branchId: user?.branchId }),
    refetchInterval: 30000,
  });

  const { data: todayAttendance = [] } = useQuery({
    queryKey: ['attendance', 'today', user?.branchId],
    queryFn: () => getAttendance({ branchId: user?.branchId, date: today }),
    refetchInterval: 30000,
  });

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Branch Dashboard</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Employees" value={stats?.totalEmployees ?? 0} icon={<Users size={22} />} color="bg-indigo-600" />
        <StatCard label="Present Today" value={stats?.presentToday ?? 0} icon={<UserCheck size={22} />} color="bg-green-600" />
        <StatCard label="Absent Today" value={stats?.absentToday ?? 0} icon={<UserX size={22} />} color="bg-red-500" />
        <StatCard label="On Break" value={stats?.onBreakToday ?? 0} icon={<Coffee size={22} />} color="bg-yellow-500" />
        <StatCard label="Pending Timesheets" value={stats?.pendingTimesheets ?? 0} icon={<ClipboardList size={22} />} color="bg-purple-600" />
      </div>

      <h3 className="text-lg font-semibold text-gray-700 mb-4">Today's Attendance</h3>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Employee', 'Clock In', 'Clock Out', 'Break (min)', 'Hours'].map(h => (
                <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {todayAttendance.map((a: any) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{a.employee.firstName} {a.employee.lastName}</td>
                <td className="px-6 py-4 text-gray-600">{new Date(a.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td className="px-6 py-4 text-gray-600">{a.clockOut ? new Date(a.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span className="text-green-600 font-medium">In</span>}</td>
                <td className="px-6 py-4 text-gray-500">{a.totalBreakMinutes}</td>
                <td className="px-6 py-4">{a.totalHours != null ? `${a.totalHours.toFixed(2)}h` : '—'}</td>
              </tr>
            ))}
            {todayAttendance.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No attendance records for today.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
