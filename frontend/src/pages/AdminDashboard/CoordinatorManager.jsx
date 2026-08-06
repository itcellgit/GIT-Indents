import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Pencil, Trash2, Loader2, AlertCircle, X, Eye } from 'lucide-react';
import api from '../../api/axios';
import { getPrimaryRole } from '../../utils/userRoles';

const EMPLOYEE_TYPES = ['', 'Teaching', 'Non-Teaching', 'Both'];
const emptyForm = { name: '', employee_type: '' };
const emptyAssignmentForm = {
  staff_id: '',
  department_id: '',
  start_date: '',
  end_date: '',
  level: '',
  status: 'Active'
};

export default function CoordinatorManager() {
  const navigate = useNavigate();
  const [coordinators, setCoordinators] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedCoordinator, setSelectedCoordinator] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [editingCoordinator, setEditingCoordinator] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [assignmentForm, setAssignmentForm] = useState(emptyAssignmentForm);

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
    setUsers(res.data.users || []);
  };

  const loadDepartments = async () => {
    const res = await api.get('/admin/departments');
    setDepartments(res.data.departments || []);
  };

  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        await Promise.all([loadCoordinators(), loadUsers(), loadDepartments()]);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const openAdd = () => {
    setEditingCoordinator(null);
    setFormData(emptyForm);
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (coordinator) => {
    setEditingCoordinator(coordinator);
    setFormData({
      name: coordinator.name || '',
      employee_type: coordinator.employee_type || ''
    });
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCoordinator(null);
    setFormData(emptyForm);
  };

  const openDetails = async (coordinator) => {
    setSelectedCoordinator(coordinator);
    setIsDetailsOpen(true);
    setAssignments([]);
    setDetailsError('');
    setAssignmentForm({ ...emptyAssignmentForm, start_date: new Date().toISOString().slice(0, 10) });
    setIsDetailsLoading(true);
    try {
      const res = await api.get(`/admin/coordinators/${coordinator.id}/assignments`);
      setAssignments(res.data.assignments || []);
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
    if (!assignmentForm.staff_id || !assignmentForm.department_id || !assignmentForm.start_date) {
      setDetailsError('Staff, department, and start date are required');
      return;
    }

    try {
      setIsAssigning(true);
      setDetailsError('');
      await api.post(`/admin/coordinators/${selectedCoordinator.id}/assignments`, assignmentForm);
      const res = await api.get(`/admin/coordinators/${selectedCoordinator.id}/assignments`);
      setAssignments(res.data.assignments || []);
      setAssignmentForm({ ...emptyAssignmentForm, start_date: new Date().toISOString().slice(0, 10) });
    } catch (err) {
      setDetailsError(err.response?.data?.message || 'Failed to assign user');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Coordinator name is required');
      return;
    }

    try {
      setIsSaving(true);
      setError('');
      if (editingCoordinator) {
        await api.put(`/admin/coordinators/${editingCoordinator.id}`, formData);
      } else {
        await api.post('/admin/coordinators', formData);
      }
      await loadCoordinators();
      closeModal();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save coordinator');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (coordinator) => {
    const confirmed = window.confirm(`Delete coordinator ${coordinator.name}?`);
    if (!confirmed) return;

    try {
      setIsSaving(true);
      await api.delete(`/admin/coordinators/${coordinator.id}`);
      await loadCoordinators();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete coordinator');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center">
            <Users className="w-5 h-5 mr-2 text-indigo-600" /> Coordinator MGT
          </h2>
          <p className="text-sm text-slate-500 mt-1">Create, update, and delete coordinators.</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Add Coordinator
        </button>
      </div>

      {error && (
        <div className="m-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Employee Type</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan="3" className="px-6 py-10 text-center text-slate-500">
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
                  <div className="inline-flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/admin-dashboard/coordinators/${coordinator.id}`)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                    >
                      <Eye className="w-3.5 h-3.5" /> 
                    </button>
                    <button
                      onClick={() => openEdit(coordinator)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil className="w-3.5 h-3.5" /> 
                    </button>
                    
                    <button
                      onClick={() => handleDelete(coordinator)}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> 
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="3" className="px-6 py-10 text-center text-slate-500">
                  No coordinators found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editingCoordinator ? 'Edit Coordinator' : 'Add Coordinator'}
              </h3>
              <button onClick={closeModal} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Coordinator name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Employee Type</label>
                <select
                  value={formData.employee_type}
                  onChange={(e) => setFormData({ ...formData, employee_type: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Select type...</option>
                  {EMPLOYEE_TYPES.map((type) =>
                    type ? <option key={type} value={type}>{type}</option> : null
                  )}
                </select>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingCoordinator ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDetailsOpen && selectedCoordinator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl max-h-[95vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Coordinator Details</h3>
                <p className="text-sm text-slate-500">{selectedCoordinator.name}</p>
              </div>
              <button onClick={closeDetails} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-600">Employee Type: {selectedCoordinator.employee_type || 'Teaching'}</p>
              </div>
              <form onSubmit={handleAssign} className="rounded-xl border border-slate-200 p-4 space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-900">Assign User</h4>
                  <p className="mt-1 text-sm text-slate-500">Pick a user, department, and start date.</p>
                </div>
                {detailsError && <p className="text-sm text-red-600">{detailsError}</p>}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">User</label>
                    <select
                      value={assignmentForm.staff_id}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, staff_id: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">Select a user...</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} - {user.email} ({getPrimaryRole(user) || 'User'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Department</label>
                    <select
                      value={assignmentForm.department_id}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, department_id: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="">Select department...</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>
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
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Level</label>
                    <input
                      type="text"
                      value={assignmentForm.level}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, level: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                    <select
                      value={assignmentForm.status}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, status: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isAssigning}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isAssigning && <Loader2 className="w-4 h-4 animate-spin" />}
                    Assign
                  </button>
                </div>
              </form>
              <div className="rounded-xl border border-slate-200 p-4">
                <h4 className="font-semibold text-slate-900">Current Assignments</h4>
                {isDetailsLoading ? (
                  <div className="mt-4 inline-flex items-center gap-2 text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading assignments...
                  </div>
                ) : assignments.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {assignments.map((assignment) => (
                      <div key={assignment.id} className="rounded-lg border border-slate-200 p-3">
                        <p className="font-medium text-slate-900">{assignment.staff_name || 'Staff'}</p>
                        <p className="text-sm text-slate-600">{assignment.staff_email || ''}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No assignments found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
