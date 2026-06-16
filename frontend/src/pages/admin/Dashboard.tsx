import { useQuery } from '@tanstack/react-query';
import { getDashboardStats } from '../../api';
import { StatCard } from '../../components/ui/StatCard';
import { Users, Building2, UserCheck, Coffee, ClipboardList, UserX } from 'lucide-react';

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardStats,
    refetchInterval: 30000,
  });

  if (isLoading) return <div className="p-8 text-gray-400">Loading…</div>;

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total Branches" value={stats?.totalBranches ?? 0} icon={<Building2 size={22} />} color="bg-blue-600" />
        <StatCard label="Total Employees" value={stats?.totalEmployees ?? 0} icon={<Users size={22} />} color="bg-indigo-600" />
        <StatCard label="Present Today" value={stats?.presentToday ?? 0} icon={<UserCheck size={22} />} color="bg-green-600" />
        <StatCard label="Absent Today" value={stats?.absentToday ?? 0} icon={<UserX size={22} />} color="bg-red-500" />
        <StatCard label="On Break" value={stats?.onBreakToday ?? 0} icon={<Coffee size={22} />} color="bg-yellow-500" />
        <StatCard label="Pending Timesheets" value={stats?.pendingTimesheets ?? 0} icon={<ClipboardList size={22} />} color="bg-purple-600" />
      </div>
    </div>
  );
}
