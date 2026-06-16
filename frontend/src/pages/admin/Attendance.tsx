import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAttendance, correctAttendance, getBranches } from '../../api';
import { Card } from '../../components/ui/Card';

function PhotoThumb({ src, label }: { src?: string | null; label: string }) {
  const [enlarged, setEnlarged] = useState(false);
  if (!src) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <>
      <img src={src} alt={label} title={label} onClick={() => setEnlarged(true)}
        className="w-10 h-10 rounded object-cover cursor-pointer border border-gray-200 hover:opacity-80 transition-opacity" />
      {enlarged && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => setEnlarged(false)}>
          <div className="bg-white rounded-xl overflow-hidden shadow-2xl max-w-sm w-full">
            <img src={src} alt={label} className="w-full object-contain" />
            <p className="text-center text-sm text-gray-500 py-2">{label} · click to close</p>
          </div>
        </div>
      )}
    </>
  );
}

function Flag({ color, text }: { color: string; text: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mr-1 ${color}`}>
      {text}
    </span>
  );
}

export default function AdminAttendance() {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [branchId, setBranchId] = useState('');
  const [editing, setEditing] = useState<any>(null);

  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: getBranches });

  const { data: records = [] } = useQuery({
    queryKey: ['attendance', date, branchId],
    queryFn: () => getAttendance({ date, ...(branchId ? { branchId } : {}) }),
  });

  const correct = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => correctAttendance(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['attendance'] }); setEditing(null); },
  });

  const missingSignouts = records.filter((r: any) => r.isMissingSignout);

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Attendance</h2>

      {missingSignouts.length > 0 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-700 font-semibold text-sm">
            ⚠ {missingSignouts.length} employee{missingSignouts.length > 1 ? 's' : ''} did not sign out:
            {' '}{missingSignouts.map((r: any) => `${r.employee.firstName} ${r.employee.lastName}`).join(', ')}
          </p>
          <p className="text-red-500 text-xs mt-1">Use the Correct button to set their clock-out time manually.</p>
        </div>
      )}

      <div className="flex gap-3 items-center mb-6 flex-wrap">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <select value={branchId} onChange={e => setBranchId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Branches</option>
          {branches.map((b: any) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Employee', 'Branch', 'Sign In', 'In Photo', 'Sign Out', 'Out Photo', 'Break', 'Hours', 'Flags', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((a: any) => (
                <>
                  <tr key={a.id} className={`hover:bg-gray-50 ${a.isMissingSignout ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3 font-medium">{a.employee.firstName} {a.employee.lastName}</td>
                    <td className="px-4 py-3 text-gray-500">{a.branch.name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(a.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <PhotoThumb src={a.clockInPhoto} label={`${a.employee.firstName} — Sign In`} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {a.clockOut
                        ? new Date(a.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : <span className={a.isMissingSignout ? 'text-red-600 font-semibold' : 'text-green-600'}>
                            {a.isMissingSignout ? 'Missing!' : 'In progress'}
                          </span>}
                    </td>
                    <td className="px-4 py-3">
                      <PhotoThumb src={a.clockOutPhoto} label={`${a.employee.firstName} — Sign Out`} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">{a.totalBreakMinutes}m</td>
                    <td className="px-4 py-3 font-medium">
                      {a.totalHours != null ? `${a.totalHours.toFixed(2)}h` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {a.isLate && <Flag color="bg-amber-100 text-amber-700" text={`Late ${a.lateByMinutes}m`} />}
                      {a.isOvertime && <Flag color="bg-purple-100 text-purple-700" text={`OT +${a.overtimeHours.toFixed(1)}h`} />}
                      {a.isMissingSignout && <Flag color="bg-red-100 text-red-700" text="No sign-out" />}
                      {!a.isLate && !a.isOvertime && !a.isMissingSignout && (
                        <Flag color="bg-green-100 text-green-700" text="✓ OK" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setEditing(a)} className="text-xs text-blue-600 hover:underline">Correct</button>
                    </td>
                  </tr>

                  {editing?.id === a.id && (
                    <tr key={`edit-${a.id}`}>
                      <td colSpan={10} className="px-4 py-4 bg-blue-50">
                        <div className="flex gap-4 items-end flex-wrap">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Sign In</label>
                            <input type="datetime-local" defaultValue={a.clockIn?.slice(0, 16)}
                              id={`ci-${a.id}`} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Sign Out</label>
                            <input type="datetime-local" defaultValue={a.clockOut?.slice(0, 16)}
                              id={`co-${a.id}`} className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Total Hours</label>
                            <input type="number" step="0.25" defaultValue={a.totalHours}
                              id={`th-${a.id}`} className="border border-gray-300 rounded px-2 py-1.5 text-sm w-24" />
                          </div>
                          <button onClick={() => correct.mutate({
                            id: a.id,
                            data: {
                              clockIn:    (document.getElementById(`ci-${a.id}`) as HTMLInputElement)?.value,
                              clockOut:   (document.getElementById(`co-${a.id}`) as HTMLInputElement)?.value,
                              totalHours: (document.getElementById(`th-${a.id}`) as HTMLInputElement)?.value,
                            },
                          })} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">Save</button>
                          <button onClick={() => setEditing(null)} className="text-xs text-gray-500 hover:underline">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {records.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No records for this date.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
