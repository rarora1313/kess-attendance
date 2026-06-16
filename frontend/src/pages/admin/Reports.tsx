import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAttendanceSummary, exportPayroll } from '../../api';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';

function todayStr() { return new Date().toISOString().slice(0, 10); }
function weekStart() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1);
  return d.toISOString().slice(0, 10);
}

export default function Reports() {
  const [start, setStart] = useState(weekStart());
  const [end, setEnd] = useState(todayStr());
  const [filter, setFilter] = useState({ start, end });

  const { data: summary = [] } = useQuery({
    queryKey: ['summary', filter],
    queryFn: () => getAttendanceSummary({ startDate: filter.start, endDate: filter.end }),
  });

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Reports</h2>

      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input type="date" value={start} onChange={e => setStart(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <button onClick={() => setFilter({ start, end })}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
              Apply
            </button>
            <button onClick={() => exportPayroll({ startDate: filter.start, endDate: filter.end })}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700">
              Export CSV
            </button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-800">Employee Summary — {filter.start} to {filter.end}</h3>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Employee', 'Employee #', 'Shifts', 'Total Hours'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">No records for this period.</td></tr>
              ) : summary.map((row: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">{row.name}</td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-400">{row.employeeNumber}</td>
                  <td className="px-6 py-4 text-gray-600">{row.shifts}</td>
                  <td className="px-6 py-4 font-semibold text-gray-800">{row.totalHours.toFixed(2)} hrs</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
