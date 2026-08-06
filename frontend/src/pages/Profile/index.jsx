import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { User, Mail, Briefcase, Building, Save, Edit2, ArrowLeft, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { departments } from '../../utils/departments';
import { ROLE_DASHBOARDS } from '../../constants/roles';

const Profile = () => {
  const { user, login, switchRole } = useAuth();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    department: user?.department || '',
  });

  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);

  const assignedRoles = useMemo(() => {
    if (Array.isArray(user?.roles) && user.roles.length > 0) {
      return user.roles;
    }
    return user?.role ? [user.role] : [];
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleBack = () => {
    if (user?.role === 'Admin') {
      navigate('/admin-dashboard');
    } else if (user?.role === 'HOD') {
      navigate('/hod-dashboard');
    } else if (user?.role === 'Principal') {
      navigate('/principal-dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  const handleRoleSwitch = async (event) => {
    const nextRole = event.target.value;
    if (!nextRole || nextRole === user?.role) return;

    setError(null);
    setMessage(null);
    setIsSwitchingRole(true);

    try {
      const updatedUser = await switchRole(nextRole);
      if (updatedUser?.role) {
        setMessage(`Role switched to ${updatedUser.role}`);
        navigate(ROLE_DASHBOARDS[updatedUser.role] || '/login', { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to switch role. Please try again.');
    } finally {
      setIsSwitchingRole(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setIsSaving(true);

    try {
      const res = await api.put('/auth/profile', formData);
      if (res.data.success) {
        login(res.data.user);
        setMessage('Profile updated successfully!');
        setIsEditing(false);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col animate-in fade-in duration-300">
        
        {/* Header */}
        <div className="px-8 py-6 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-500 p-2.5 rounded-xl">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white leading-tight">My Profile</h2>
              <p className="text-xs text-indigo-300">View and update your personal information</p>
            </div>
          </div>
          <button 
            onClick={handleBack}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-lg hover:bg-slate-700 transition-all text-sm font-semibold active:scale-95 border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          {/* Notifications */}
          {message && (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg text-sm font-medium animate-in fade-in duration-200">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-lg text-sm font-medium animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            
            {/* Name Field */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Full Name</label>
              <div className="relative">
                <User className="w-5 h-5 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  name="name"
                  required
                  readOnly={!isEditing}
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full pl-11 pr-4 py-3 border rounded-xl text-sm outline-none transition-all ${
                    isEditing 
                      ? 'border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white font-medium text-slate-800' 
                      : 'border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed font-semibold'
                  }`}
                  placeholder="Your Name"
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Email Address</label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input 
                  type="email" 
                  name="email"
                  required
                  readOnly={!isEditing}
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full pl-11 pr-4 py-3 border rounded-xl text-sm outline-none transition-all ${
                    isEditing 
                      ? 'border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white font-medium text-slate-800' 
                      : 'border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed font-semibold'
                  }`}
                  placeholder="Your Email"
                />
              </div>
            </div>

            {/* Department Field */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Department</label>
              <div className="relative">
                <Building className="w-5 h-5 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  list="profile-departments-list"
                  name="department"
                  readOnly={!isEditing || user?.role === 'Admin' || user?.role === 'Principal'}
                  value={formData.department}
                  onChange={handleChange}
                  className={`w-full pl-11 pr-4 py-3 border rounded-xl text-sm outline-none transition-all ${
                    isEditing && user?.role !== 'Admin' && user?.role !== 'Principal'
                      ? 'border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white font-medium text-slate-800' 
                      : 'border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed font-semibold'
                  }`}
                  placeholder="Your Department"
                />
                <datalist id="profile-departments-list">
                  {departments.map((dept) => (
                    <option key={dept.name} value={dept.name} />
                  ))}
                </datalist>
              </div>
              {isEditing && (user?.role === 'Admin' || user?.role === 'Principal') && (
                <p className="text-xs text-slate-400 mt-1 italic">Department cannot be changed for administrative roles.</p>
              )}
            </div>

            {/* Role Field (Read Only) */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Assigned Role</label>
              <div className="relative">
                <Briefcase className="w-5 h-5 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  readOnly
                  value={user?.role || 'User'}
                  className="w-full pl-11 pr-4 py-3 border border-slate-200 bg-slate-50 text-slate-500 rounded-xl text-sm font-bold cursor-not-allowed uppercase tracking-wider"
                />
              </div>
            </div>

            {assignedRoles.length >= 2 && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Role Switch</label>
                <div className="relative">
                  <RefreshCw className="w-5 h-5 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <select
                    value={user?.role || assignedRoles[0] || ''}
                    onChange={handleRoleSwitch}
                    disabled={isSwitchingRole}
                    className="w-full pl-11 pr-4 py-3 border border-slate-200 bg-white text-slate-700 rounded-xl text-sm font-semibold outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
                  >
                    {assignedRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-slate-400 mt-1 italic">Switching role updates your active dashboard and permissions.</p>
              </div>
            )}

          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
            {!isEditing ? (
              <button
                type="button"
                onClick={() => {
                  setMessage(null);
                  setError(null);
                  setIsEditing(true);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transform active:scale-95 transition-all"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      name: user?.name || '',
                      email: user?.email || '',
                      department: user?.department || '',
                    });
                    setIsEditing(false);
                    setError(null);
                  }}
                  className="px-5 py-3 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-bold transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md disabled:opacity-50 transform active:scale-95 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </>
            )}
          </div>

        </form>

      </div>
    </div>
  );
};

export default Profile;
