import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEmployees, createEmployee, updateEmployee, getBranches, createManager, getManagers } from '../../api';
import { Card } from '../../components/ui/Card';

type Tab = 'employees' | 'managers';

export default function Employees() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('employees');
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [showMgrForm, setShowMgrForm] = useState(false);
  const [empForm, setEmpForm] = useState({
    employeeNumber: '', firstName: '', lastName: '',
    email: '', phone: '', pin: '', branchId: '',
    scheduledStartTime: '', scheduledHours: '',
  });
  const [mgrForm, setMgrForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [editingSchedule, setEditingSchedule] = useState<any>(null);

  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: getEmployees });
  const { data: managers = [] }  = useQuery({ queryKey: ['managers'],  queryFn: getManagers });
  const { data: branches = [] }  = useQuery({ queryKey: ['branches'],  queryFn: getBranches });

  const createEmp = useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      setShowEmpForm(false);
      setEmpForm({ employeeNumber: '', firstName: '', lastName: '', email: '', phone: '', pin: '', branchId: '', scheduledStartTime: '', scheduledHours: '' });
      setError('');
    },
    onError: () => setError('Employee number or PIN already exists.'),
  });

  const toggleEmp = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => updateEmployee(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });

  const saveSchedule = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => updateEmployee(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); setEditingSchedule(null); },
  });

  const createMgr = useMutation({
    mutationFn: createManager,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['managers'] });
      setShowMgrForm(false);
      setMgrForm({ firstName: '', lastName: '', email: '', password: '' });
      setError('');
    },
    onError: () => setError('Email already exists.'),
  });

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['employees', 'managers'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${tab === t ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={() => tab === 'employees' ? setShowEmpForm(true) : setShowMgrForm(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          + Add {tab === 'employees' ? 'Employee' : 'Manager'}
        </button>
      </div>

      {/* Add employee form */}
      {showEmpForm && tab === 'employees' && (
        <Card className="mb-6 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">New Employee</h3>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-3 gap-4">
            {[['Employee Number *', 'employeeNumber'], ['First Name *', 'firstName'], ['Last Name *', 'lastName'],
              ['Email', 'email'], ['Phone', 'phone'], ['PIN *', 'pin']].map(([label, key]) => (
              <div key={key}>
                <label className={labelCls}>{label}</label>
                <input className={inputCls} value={(empForm as any)[key]}
                  onChange={e => setEmpForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label className={labelCls}>Branch *</label>
              <select className={inputCls} value={empForm.branchId}
                onChange={e => setEmpForm(f => ({ ...f, branchId: e.target.value }))}>
                <option value="">Select branch</option>
                {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Scheduled Start</label>
              <input type="time" className={inputCls} value={empForm.scheduledStartTime}
                onChange={e => setEmpForm(f => ({ ...f, scheduledStartTime: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Scheduled Hours / Day</label>
              <input type="number" step="0.5" min="0" max="24" placeholder="e.g. 8"
                className={inputCls} value={empForm.scheduledHours}
                onChange={e => setEmpForm(f => ({ ...f, scheduledHours: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => createEmp.mutate(empForm)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Add</button>
            <button onClick={() => { setShowEmpForm(false); setError(''); }}
              className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </Card>
      )}

      {/* Add manager form */}
      {showMgrForm && tab === 'managers' && (
        <Card className="mb-6 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">New Manager</h3>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            {[['First Name *', 'firstName'], ['Last Name *', 'lastName'], ['Email *', 'email'], ['Password *', 'password']].map(([label, key]) => (
              <div key={key}>
                <label className={labelCls}>{label}</label>
                <input className={inputCls} type={key === 'password' ? 'password' : 'text'}
                  value={(mgrForm as any)[key]}
                  onChange={e => setMgrForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => createMgr.mutate(mgrForm)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Add</button>
            <button onClick={() => { setShowMgrForm(false); setError(''); }}
              className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {tab === 'employees'
                  ? ['#', 'Name', 'Branch', 'PIN', 'Start Time', 'Hrs/Day', 'Status', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))
                  : ['Name', 'Email', 'Branch', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tab === 'employees' ? employees.map((e: any) => (
                <>
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{e.employeeNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{e.firstName} {e.lastName}</div>
                      {e.email && <div className="text-xs text-gray-400">{e.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{e.branch?.name ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-gray-400">{e.pin}</td>
                    <td className="px-4 py-3 text-gray-600">{e.scheduledStartTime ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600">{e.scheduledHours != null ? `${e.scheduledHours}h` : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${e.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button onClick={() => setEditingSchedule(e)}
                          className="text-xs text-blue-600 hover:underline">Edit schedule</button>
                        <button onClick={() => toggleEmp.mutate({ id: e.id, status: e.status === 'active' ? 'inactive' : 'active' })}
                          className="text-xs text-gray-400 hover:text-gray-600 hover:underline">
                          {e.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Inline schedule edit row */}
                  {editingSchedule?.id === e.id && (
                    <tr key={`sched-${e.id}`}>
                      <td colSpan={8} className="px-4 py-4 bg-blue-50">
                        <div className="flex gap-4 items-end flex-wrap">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Scheduled Start Time</label>
                            <input type="time" defaultValue={e.scheduledStartTime ?? ''}
                              id={`st-${e.id}`}
                              className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Scheduled Hours / Day</label>
                            <input type="number" step="0.5" min="0" max="24"
                              defaultValue={e.scheduledHours ?? ''}
                              id={`sh-${e.id}`}
                              className="border border-gray-300 rounded px-2 py-1.5 text-sm w-24" />
                          </div>
                          <button
                            onClick={() => saveSchedule.mutate({
                              id: e.id,
                              data: {
                                scheduledStartTime: (document.getElementById(`st-${e.id}`) as HTMLInputElement)?.value || null,
                                scheduledHours:     (document.getElementById(`sh-${e.id}`) as HTMLInputElement)?.value || null,
                              },
                            })}
                            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                            Save
                          </button>
                          <button onClick={() => setEditingSchedule(null)}
                            className="text-xs text-gray-500 hover:underline">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )) : managers.map((m: any) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{m.firstName} {m.lastName}</td>
                  <td className="px-4 py-3 text-gray-500">{m.email}</td>
                  <td className="px-4 py-3 text-gray-500">{m.managedBranch?.name ?? <span className="text-amber-600 text-xs">Unassigned</span>}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
