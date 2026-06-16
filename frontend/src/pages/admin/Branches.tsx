import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBranches, createBranch, updateBranch, getManagers } from '../../api';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';

export default function Branches() {
  const qc = useQueryClient();
  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: getBranches });
  const { data: managers = [] } = useQuery({ queryKey: ['managers'], queryFn: getManagers });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', address: '', managerId: '' });
  const [error, setError] = useState('');

  const create = useMutation({
    mutationFn: createBranch,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); setShowForm(false); setForm({ name: '', code: '', address: '', managerId: '' }); },
    onError: () => setError('Branch code already exists or manager already assigned.'),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => updateBranch(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Branches</h2>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          + Add Branch
        </button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader><h3 className="font-semibold">New Branch</h3></CardHeader>
          <CardBody>
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name *</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Code *</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manager</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.managerId} onChange={e => setForm(f => ({ ...f, managerId: e.target.value }))}>
                  <option value="">None</option>
                  {managers.filter((m: any) => !m.managedBranch).map((m: any) => (
                    <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => create.mutate(form)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                Create
              </button>
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Code', 'Address', 'Manager', 'Status', ''].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {branches.map((b: any) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">{b.name}</td>
                  <td className="px-6 py-4 font-mono text-gray-500">{b.code}</td>
                  <td className="px-6 py-4 text-gray-500">{b.address || '—'}</td>
                  <td className="px-6 py-4 text-gray-500">
                    {b.manager ? `${b.manager.firstName} ${b.manager.lastName}` : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${b.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {b.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button onClick={() => toggle.mutate({ id: b.id, active: !b.active })}
                      className="text-xs text-blue-600 hover:underline">
                      {b.active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
