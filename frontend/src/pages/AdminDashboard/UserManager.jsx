import React, { useState } from 'react';
import { Users, ShieldBan, ShieldAlert, Plus, Loader2, Search } from 'lucide-react';
import api from '../../api/axios';

const ROLE_HIERARCHY = {
  'Admin': 1,
  'Principal': 2,
  'HOD': 3,
  'Faculty': 4
};

export default function UserManager({ users, onUserUpdate }) {
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [loadingActionId, setLoadingActionId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Sort users by role hierarchy
  const sortedUsers = [...users].sort((a, b) => {
    const roleA = ROLE_HIERARCHY[a.role] || 99;
    const roleB = ROLE_HIERARCHY[b.role] || 99;
    return roleA - roleB;
  });

  const filteredUsers = sortedUsers.filter(user => {
    const term = searchTerm.toLowerCase();
    return user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term);
  });

  const handleToggleStatus = async (user) => {
    try {
      setLoadingActionId(user.id);
      const res = await api.put(`/admin/users/${user.id}/status`);
      if (res.data.success) {
        if (onUserUpdate) onUserUpdate(); // Refresh the list
      }
    } catch (err) {
      console.error("Failed to toggle user status:", err);
      alert(err.response?.data?.message || "Failed to update user status");
    } finally {
      setLoadingActionId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center">
            <Users className="w-5 h-5 mr-2 text-indigo-600" />
            User Management
          </h2>
        </div>
        
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search name or email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
            />
          </div>
          <button 
            onClick={() => setIsAddUserOpen(true)}
            className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-lg font-medium text-sm flex items-center transition-colors border border-indigo-200 justify-center"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add User
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Name & Email</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Department</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.length > 0 ? filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs uppercase mr-3">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full 
                    ${user.role === 'Admin' ? 'bg-purple-100 text-purple-800' : 
                      user.role === 'Principal' ? 'bg-indigo-100 text-indigo-800' :
                      user.role === 'HOD' ? 'bg-blue-100 text-blue-800' : 
                      'bg-slate-100 text-slate-800'}`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-600">{user.department || '-'}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {user.isActive ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button 
                    onClick={() => handleToggleStatus(user)}
                    disabled={loadingActionId === user.id}
                    className="p-1.5 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50" 
                    title={user.isActive ? 'Disable User' : 'Enable User'}
                  >
                    {loadingActionId === user.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : user.isActive ? (
                      <ShieldBan className="w-4 h-4" />
                    ) : (
                      <ShieldAlert className="w-4 h-4" />
                    )}
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-slate-500 italic">No users found matching your search.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

       {isAddUserOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">Register New User</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 bg-white">
                    <option>Faculty</option>
                    <option>HOD</option>
                    <option>Principal</option>
                    <option>Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                  <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 bg-white">
                    <option value="">-- None --</option>
                    <option>Electrical</option>
                    <option>Civil</option>
                    <option>Computer Center</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end space-x-3">
              <button onClick={() => setIsAddUserOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Close</button>
              <button onClick={() => setIsAddUserOpen(false)} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700">Add User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
