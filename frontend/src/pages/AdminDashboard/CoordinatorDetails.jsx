import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Users, AlertCircle, Eye, CalendarDays, Mail, Building2, Shield, User, LogOut, KeyRound, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import StatsCards from './StatsCards';
import NotificationBell from '../../components/NotificationBell';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import logo from '../../assets/logo.png';
import api from '../../api/axios';
import { departments as departmentList } from '../../utils/departments';
import { getPrimaryRole } from '../../utils/userRoles';

const emptyAssignmentForm = {
  staff_id: '',
  start_date: '',
  end_date: '',
  level: ''
};

export default function CoordinatorDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [coordinator, setCoordinator] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState({ totalDepartments: 0, totalUsers: 0, activeComplaints: 0, resolvedComplaints: 0 });
  const [assignmentForm, setAssignmentForm] = useState(emptyAssignmentForm);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const resolveDepartmentName = (value) => {
    if (!value) return 'No Department';

    const normalized = String(value).trim().toLowerCase();
    const department = departmentList.find((entry) => {
      const nameMatches = String(entry.name || '').trim().toLowerCase() === normalized;
      const shortNameMatches = String(entry.shortName || '').trim().toLowerCase() === normalized;
      return nameMatches || shortNameMatches;
    });

    return department ? department.name : String(value).trim();
  };

  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        const [coordinatorRes, assignmentsRes, usersRes, departmentsRes, statsRes] = await Promise.allSettled([
          api.get(`/admin/coordinators/${id}`),
          api.get(`/admin/coordinators/${id}/assignments`),
          api.get('/admin/users'),
          api.get('/admin/departments'),
          api.get('/admin/stats')
        ]);

        if (coordinatorRes.status === 'fulfilled') {
          setCoordinator(coordinatorRes.value.data.coordinator || null);
        }
        if (assignmentsRes.status === 'fulfilled') {
          setAssignments(assignmentsRes.value.data.assignments || []);
        }
        if (usersRes.status === 'fulfilled') {
          setUsers(usersRes.value.data.users || []);
        }
        if (departmentsRes.status === 'fulfilled') {
          setDepartments(departmentsRes.value.data.departments || []);
        }
        if (statsRes.status === 'fulfilled') {
          setStats(statsRes.value.data.stats || { totalDepartments: 0, totalUsers: 0, activeComplaints: 0, resolvedComplaints: 0 });
        }
        setAssignmentForm({ ...emptyAssignmentForm, start_date: new Date().toISOString().slice(0, 10) });
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load coordinator details');
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [id]);

  const handleAssign = async (e) => {
    e.preventDefault();

    if (!assignmentForm.staff_id || !assignmentForm.start_date) {
      setError('Staff and start date are required');
      return;
    }

    try {
      setIsAssigning(true);
      setError('');
      if (editingAssignment) {
        await api.put(`/admin/coordinators/assignments/${editingAssignment.id}`, assignmentForm);
      } else {
        await api.post(`/admin/coordinators/${id}/assignments`, {
          ...assignmentForm,
          status: 'Active'
        });
      }
      const res = await api.get(`/admin/coordinators/${id}/assignments`);
      setAssignments(res.data.assignments || []);
      setAssignmentForm({ ...emptyAssignmentForm, start_date: new Date().toISOString().slice(0, 10) });
      setIsAssignmentModalOpen(false);
      setEditingAssignment(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign user');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDeleteAssignment = async (assignment) => {
    const confirmed = window.confirm('Delete this staff assignment?');
    if (!confirmed) return;

    try {
      setIsAssigning(true);
      setError('');
      await api.delete(`/admin/coordinators/assignments/${assignment.id}`);
      const res = await api.get(`/admin/coordinators/${id}/assignments`);
      setAssignments(res.data.assignments || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete assignment');
    } finally {
      setIsAssigning(false);
    }
  };

  const openAssignmentModal = () => {
    setError('');
    setEditingAssignment(null);
    setAssignmentForm({ ...emptyAssignmentForm, start_date: new Date().toISOString().slice(0, 10) });
    setIsAssignmentModalOpen(true);
  };

  const openEditAssignmentModal = (assignment) => {
    setError('');
    setEditingAssignment(assignment);
    setAssignmentForm({
      staff_id: String(assignment.staff_id || ''),
      start_date: assignment.start_date || '',
      end_date: assignment.end_date || '',
      level: assignment.level || '',
      status: assignment.status || 'Active'
    });
    setIsAssignmentModalOpen(true);
  };

  const closeAssignmentModal = () => {
    setIsAssignmentModalOpen(false);
    setAssignmentForm(emptyAssignmentForm);
    setEditingAssignment(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="inline-flex items-center gap-2 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading coordinator details...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-20 shadow-sm no-print flex flex-col">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 w-full border-b border-slate-800/60">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img src={logo} alt="KLS GIT Logo" className="h-10 w-10 object-contain bg-white rounded-full p-0.5" />
              <div className="bg-indigo-500 p-2 rounded-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-white leading-tight">Admin Dashboard</h1>
                <p className="text-xs text-indigo-300">System Control Panel</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <NotificationBell />
              <Link to="/profile" className="flex items-center space-x-2 hover:opacity-80 transition-opacity animate-in" title="My Profile">
                <span className="text-sm font-medium text-slate-300">{user?.name || 'Administrator'}</span>
                <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 cursor-pointer">
                  <User className="h-4 w-4 text-slate-300" />
                </div>
              </Link>
              <button
                onClick={() => setIsChangePasswordOpen(true)}
                className="text-slate-400 hover:text-indigo-300 transition-colors bg-slate-800 p-2 rounded-lg"
                title="Change Password"
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <button
                onClick={logout}
                className="text-slate-400 hover:text-red-400 transition-colors bg-slate-800 p-2 rounded-lg"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex justify-between items-center h-14">
            <div className="flex space-x-8 overflow-x-auto no-scrollbar h-full w-full">
              <button onClick={() => navigate('/admin-dashboard?tab=departments')} className="whitespace-nowrap h-full border-b-2 px-1 flex items-center font-medium text-sm transition-colors border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600">Departments</button>
              <button onClick={() => navigate('/admin-dashboard?tab=complaints')} className="whitespace-nowrap h-full border-b-2 px-1 flex items-center font-medium text-sm transition-colors border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600">Indents</button>
              <button onClick={() => navigate('/admin-dashboard?tab=reports')} className="whitespace-nowrap h-full border-b-2 px-1 flex items-center font-medium text-sm transition-colors border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600">Reports</button>
              <button onClick={() => navigate('/admin-dashboard?tab=users')} className="whitespace-nowrap h-full border-b-2 px-1 flex items-center font-medium text-sm transition-colors border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600">Users</button>
              <button className="whitespace-nowrap h-full border-b-2 px-1 flex items-center font-medium text-sm transition-colors border-indigo-400 text-indigo-300">Stationary Coordinator</button>
              <button onClick={() => navigate('/admin-dashboard?tab=roles')} className="whitespace-nowrap h-full border-b-2 px-1 flex items-center font-medium text-sm transition-colors border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600">Role MGT</button>
              <button onClick={() => navigate('/admin-dashboard?tab=branches')} className="whitespace-nowrap h-full border-b-2 px-1 flex items-center font-medium text-sm transition-colors border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600">Branch MGT</button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 no-print">

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5" /> <span>{error}</span>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">System Overview</h2>
          <StatsCards
            stats={stats}
            activeFilter={''}
            onCardClick={() => {}}
          />
        </div>

        <div className="w-full">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-indigo-600" />Stationary Coordinator
                </h2>
                <p className="text-sm text-slate-500 mt-1">Assignment details and staff mapping.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate('/admin-dashboard')}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </button>
                <button
                  onClick={openAssignmentModal}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <Eye className="w-4 h-4" /> Create a new staff assignment
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg">
                  {String(coordinator?.name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{coordinator?.name}</h1>
                  <p className="text-sm text-slate-500">{coordinator?.employee_type || 'Teaching'}</p>
                </div>
              </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">S.no</th>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Staff</th>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Department</th>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Level</th>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Start Date</th>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">End Date</th>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {assignments.length > 0 ? assignments.map((assignment, index) => (
                        <tr key={assignment.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm text-slate-600">{index + 1}</td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-800">{assignment.staff_name || 'Staff'}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {resolveDepartmentName(assignment.department_name || assignment.departmentName || assignment.department_id || assignment.departmentId)}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">{assignment.level || '-'}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{assignment.start_date || '-'}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{assignment.end_date || '-'}</td>
                          <td className="px-6 py-4">
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                              {assignment.status || 'Active'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => openEditAssignmentModal(assignment)}
                                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                <Pencil className="w-3.5 h-3.5" /> 
                              </button>
                              <button
                                onClick={() => handleDeleteAssignment(assignment)}
                                disabled={isAssigning}
                                className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> 
                              </button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="7" className="px-6 py-10 text-center text-slate-500">No assignments found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
            </div>
          </div>
        </div>
      </main>

      {isAssignmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center">
                  <Eye className="w-5 h-5 mr-2 text-indigo-600" />
                  {editingAssignment ? 'Edit staff assignment' : 'Create a new staff assignment'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {editingAssignment ? 'Update user, dates and status.' : ''}
                </p>
              </div>
              <button
                onClick={closeAssignmentModal}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="w-4 h-4 inline mr-2" /> Close
              </button>
            </div>

            <form onSubmit={handleAssign} className="p-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">User</label>
                <select
                  value={assignmentForm.staff_id}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, staff_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Select a user...</option>
                  {users
                    .filter((user) => ['Faculty', 'Non-Teaching'].includes(getPrimaryRole(user)))
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} - {user.department || 'No Department'} ({getPrimaryRole(user) || 'User'})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
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

              <div className="grid gap-4 md:grid-cols-1">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Level</label>
                  <select
                    value={assignmentForm.level}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, level: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">Select level...</option>
                    <option value="Departmental">Departmental</option>
                    <option value="Central Level">Central</option>
                  </select>
                </div>
              </div>

              {editingAssignment && (
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
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAssignmentModal}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigning}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isAssigning && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingAssignment ? 'Update' : 'Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isChangePasswordOpen && (
        <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />
      )}
    </div>
  );
}