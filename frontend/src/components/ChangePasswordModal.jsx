import React, { useState } from 'react';
import { XCircle, Lock, KeyRound, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import api from '../api/axios';

const initialForm = { currentPassword: '', newPassword: '', confirmPassword: '' };

const ChangePasswordModal = ({ onClose }) => {
  const [formData, setFormData] = useState(initialForm);
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (formData.newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await api.put('/auth/change-password', {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
      if (res.data.success) {
        setMessage('Password changed successfully!');
        setFormData(initialForm);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <KeyRound className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Change Password</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Current Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type={showPasswords ? 'text' : 'password'}
                name="currentPassword"
                required
                value={formData.currentPassword}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter current password"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">New Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type={showPasswords ? 'text' : 'password'}
                name="newPassword"
                required
                minLength={6}
                value={formData.newPassword}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter new password (min. 6 characters)"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Confirm New Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type={showPasswords ? 'text' : 'password'}
                name="confirmPassword"
                required
                minLength={6}
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Re-enter new password"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPasswords(!showPasswords)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors"
          >
            {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPasswords ? 'Hide passwords' : 'Show passwords'}
          </button>

          <div className="pt-2 flex justify-end space-x-3 border-t border-slate-200 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-indigo-600 rounded-lg text-white font-medium hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
