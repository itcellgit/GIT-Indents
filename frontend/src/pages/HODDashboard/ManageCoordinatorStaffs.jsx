import React, { useEffect, useState } from 'react';
import { Eye, Plus, Users, X, Trash2, Loader2 } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { getPrimaryRole } from '../../utils/userRoles';

const emptyAssignmentForm = {
  staff_id: '',
  start_date: '',
  end_date: '',
  level: '',
};

const levelOptions = ['', 'Departmental', 'Central'];

export default function ManageCoordinatorStaffs() {
  const { user } = useAuth();
  const [coordinators, setCoordinators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedCoordinator, setSelectedCoordinator] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState(emptyAssignmentForm);
  const [availableUsers, setAvailableUsers] = useState([]);

  const isSameDepartment = (departmentValue) =>
    String(departmentValue || '').trim() === String(user?.department || '').trim();

  const filterAssignmentsForDepartment = (rows = []) =>
    rows.filter((row) => isSameDepartment(row.department_name || row.departmentName || row.department_id || row.departmentId));

  const loadCoordinators = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/admin/coordinators');
      setCoordinators(res.data.coordinators || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load coordinators');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    const res = await api.get('/admin/users');
    setAvailableUsers(res.data.users || []);
  };

  useEffect(() => {
    const init = async () => {
      await Promise.all([loadCoordinators(), loadUsers()]);
    };

    init();
  }, []);

  const openDetails = async (coordinator) => {
    setSelectedCoordinator(coordinator);
    setIsDetailsOpen(true);
    setAssignments([]);
    setDetailsError('');
    setAssignmentForm({ ...emptyAssignmentForm, start_date: new Date().toISOString().slice(0, 10) });
    setIsDetailsLoading(true);

    try {
      const res = await api.get(`/admin/coordinators/${coordinator.id}/assignments`);
      setAssignments(filterAssignmentsForDepartment(res.data.assignments || []));
    } catch (err) {
      setDetailsError(err.response?.data?.message || 'Failed to load coordinator details');
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setIsDetailsOpen(false);
    setSelectedCoordinator(null);
    setAssignments([]);
    setDetailsError('');
    setAssignmentForm(emptyAssignmentForm);
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!selectedCoordinator) return;

    if (!assignmentForm.staff_id || !assignmentForm.start_date) {
      setDetailsError('Staff and start date are required');
      return;
    }

    try {
      setIsAssigning(true);
      setDetailsError('');
      await api.post(`/admin/coordinators/${selectedCoordinator.id}/assignments`, {
        ...assignmentForm,
        department_id: user?.department || ''
      });
      const res = await api.get(`/admin/coordinators/${selectedCoordinator.id}/assignments`);
      setAssignments(filterAssignmentsForDepartment(res.data.assignments || []));
      setAssignmentForm({ ...emptyAssignmentForm, start_date: new Date().toISOString().slice(0, 10) });
    } catch (err) {
      setDetailsError(err.response?.data?.message || 'Failed to add coordinator staff');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId) => {
    if (!window.confirm('Remove this coordinator staff?')) return;

    try {
      await api.delete(`/admin/coordinators/assignments/${assignmentId}`);
      setAssignments((prev) => prev.filter((item) => item.id !== assignmentId && isSameDepartment(item.department_name || item.departmentName || item.department_id || item.departmentId)));
    } catch (err) {
      setDetailsError(err.response?.data?.message || 'Failed to remove coordinator staff');
    }
  };

  const staffOptions = availableUsers.filter((staff) => {
    const belongsToDepartment = String(staff.department || '').trim() === String(user?.department || '').trim();
    const primaryRole = getPrimaryRole(staff);
    const isEligibleRole = primaryRole === 'Faculty' || primaryRole === 'Non-Teaching';
    return belongsToDepartment && isEligibleRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <h2 className="text-xl font-bold text-slate-800">Coordinator Staff</h2>
        <span className="text-sm text-slate-500">Select a coordinator to manage staff</span>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-slate-800">Coordinators</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4 font-medium">Coordinator</th>
                <th className="px-6 py-4 font-medium">Employee Type</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-slate-500">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading coordinators...
                    </div>
                  </td>
                </tr>
              ) : coordinators.length > 0 ? coordinators.map((coordinator) => (
                <tr key={coordinator.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                        {String(coordinator.name || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-slate-800">{coordinator.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{coordinator.employee_type || 'Teaching'}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openDetails(coordinator)}
                      className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-slate-500">No coordinators found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isDetailsOpen && selectedCoordinator && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 p-4 flex items-center justify-center">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedCoordinator.name}</h3>
                <p className="text-sm text-slate-500">Add staff assignment for this coordinator</p>
              </div>
              <button onClick={closeDetails} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 flex-1 overflow-hidden">
              <div className="lg:col-span-1 border-r border-slate-200 p-6 overflow-y-auto">
                <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-indigo-600" />
                  Add Coordinator Staff
                </h4>

                {detailsError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{detailsError}</div>}

                <form onSubmit={handleAssign} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Staff</label>
                    <select
                      value={assignmentForm.staff_id}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, staff_id: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">Select staff...</option>
                      {staffOptions.map((staff) => (
                        <option key={staff.id} value={staff.id}>{staff.name} ({staff.email})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Start Date</label>
                      <input
                        type="date"
                        value={assignmentForm.start_date}
                        onChange={(e) => setAssignmentForm({ ...assignmentForm, start_date: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">End Date</label>
                      <input
                        type="date"
                        value={assignmentForm.end_date}
                        onChange={(e) => setAssignmentForm({ ...assignmentForm, end_date: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Level</label>
                    <select
                      value={assignmentForm.level}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, level: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">Select level...</option>
                      {levelOptions.filter(Boolean).map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isAssigning}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isAssigning && <Loader2 className="w-4 h-4 animate-spin" />}
                    Add Coordinator Staff
                  </button>
                </form>
              </div>

              <div className="lg:col-span-2 p-6 overflow-y-auto">
                <h4 className="text-base font-semibold text-slate-800 mb-4">Assigned Staff</h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Level</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isDetailsLoading ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                            <div className="inline-flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" /> Loading staff...
                            </div>
                          </td>
                        </tr>
                      ) : assignments.length > 0 ? assignments.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 text-sm font-medium text-slate-800">{item.staff_name || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{item.staff_email || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{item.level || '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{item.status || '-'}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleRemoveAssignment(item.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-slate-500">No coordinator staff added yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
