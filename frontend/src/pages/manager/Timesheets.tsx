import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTimesheets, updateTimesheetStatus, createTimesheet, getEmployees } from '../../api';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';

const statusColors: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-500',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-600',
};

const emptyForm = { employeeId: '', date: new Date().toISOString().slice(0, 10), taskName: '', description: '', hoursWorked: '' };

export default function ManagerTimesheets() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  const { data: timesheets = [] } = useQuery({ queryKey: ['timesheets'], queryFn: getTimesheets });
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: getEmployees });

  const submit = useMutation({
    mutationFn: createTimesheet,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timesheets'] });
      setShowForm(false);
      setForm(emptyForm);
      setError('');
    },
    onError: () => setError('Failed to submit. Please check all fields.'),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateTimesheetStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheets'] }),
  });

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Timesheets</h2>
        <button onClick={() => setShowForm(v => !v)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          + New Timesheet
        </button>
      </div>

      {/* Submission form */}
      {showForm && (
        <Card className="mb-6">
          <CardHeader><h3 className="font-semibold text-gray-800">Submit Timesheet</h3></CardHeader>
          <CardBody>
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Employee *</label>
                <select className={inputCls} value={form.employeeId}
                  onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}>
                  <option value="">Select employee</option>
                  {employees.filter((e: any) => e.status === 'active').map((e: any) => (
                    <option key={e.id} value={e.id}>
                      {e.firstName} {e.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Date *</label>
                <input type="date" className={inputCls} value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Task Name *</label>
                <input className={inputCls} placeholder="e.g. Store restocking"
                  value={form.taskName}
                  onChange={e => setForm(f => ({ ...f, taskName: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Hours Worked *</label>
                <input type="number" step="0.25" min="0" max="24" className={inputCls}
                  placeholder="e.g. 4.5" value={form.hoursWorked}
                  onChange={e => setForm(f => ({ ...f, hoursWorked: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Description</label>
                <textarea className={inputCls} rows={2} placeholder="Optional details..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => submit.mutate({ ...form, status: 'submitted' })}
                disabled={!form.employeeId || !form.taskName || !form.hoursWorked}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40">
                Submit for Approval
              </button>
              <button
                onClick={() => submit.mutate({ ...form, status: 'draft' })}
                disabled={!form.employeeId || !form.taskName || !form.hoursWorked}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-40">
                Save as Draft
              </button>
              <button onClick={() => { setShowForm(false); setError(''); }}
                className="px-4 py-2 text-gray-400 text-sm hover:text-gray-600">
                Cancel
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Timesheets table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Employee', 'Date', 'Task', 'Description', 'Hours', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {timesheets.map((t: any) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 font-medium">{t.employee.firstName} {t.employee.lastName}</td>
                  <td className="px-4 py-4 text-gray-500">{t.date}</td>
                  <td className="px-4 py-4 text-gray-700">{t.taskName}</td>
                  <td className="px-4 py-4 text-gray-400 text-xs max-w-xs truncate">{t.description || '—'}</td>
                  <td className="px-4 py-4 font-medium">{t.hoursWorked}h</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[t.status]}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {t.status === 'submitted' && (
                      <div className="flex gap-2">
                        <button onClick={() => updateStatus.mutate({ id: t.id, status: 'approved' })}
                          className="text-xs text-green-600 hover:underline font-medium">Approve</button>
                        <button onClick={() => updateStatus.mutate({ id: t.id, status: 'rejected' })}
                          className="text-xs text-red-500 hover:underline font-medium">Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {timesheets.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400">No timesheets yet. Click "+ New Timesheet" to add one.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
