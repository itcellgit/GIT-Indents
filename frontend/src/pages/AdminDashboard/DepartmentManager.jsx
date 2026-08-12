import React, { useState, useEffect, useRef } from 'react';
import { Building2, Edit2, UserX, UserCheck, Plus, Search, Loader2 } from 'lucide-react';
import api from '../../api/axios';
import { getRoleBadgeStyle } from '../../constants/roles';

const RoleBadge = ({ role }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeStyle(role)}`}>
    {role}
  </span>
);

export default function DepartmentManager({ departments, fetchDepartments }) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({ name: '', description: '', inchargeEmail: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Debounce search effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.length >= 3) {
        handleSearchUsers(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSearchUsers = async (email) => {
    try {
      setIsSearching(true);
      // We check if the email literally has characters, but our route handles it
      const res = await api.get(`/admin/users/search?email=${encodeURIComponent(email)}`);
      setSearchResults(res.data.users || []);
    } catch (err) {
      console.error("Error searching users:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectUser = (email) => {
    setFormData({ ...formData, inchargeEmail: email });
    setSearchQuery(email);
    setSearchResults([]);
  };

  const handleEditClick = (dept) => {
    const deptId = dept._id || dept.id;
    setFormData({
      name: dept.name,
      description: dept.description || '',
      inchargeEmail: dept.incharge?.email || ''
    });
    setEditingId(deptId);
    setIsEditing(true);
    setSearchQuery(dept.incharge?.email || '');
    setIsAddModalOpen(true);
  };

  const handleAddNew = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const resetForm = () => {
    setIsAddModalOpen(false);
    setIsEditing(false);
    setEditingId(null);
    setFormData({ name: '', description: '', inchargeEmail: '' });
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSubmit = async () => {
    if (!formData.name) return alert('Department name is required');
    // The search box is the source of truth for who the user typed/selected —
    // formData.inchargeEmail only updates on an explicit dropdown click, so a
    // typed-but-not-clicked email would otherwise be silently dropped here.
    const payload = { ...formData, inchargeEmail: searchQuery.trim() };
    try {
      setIsSubmitting(true);
      if (isEditing) {
        await api.put(`/admin/departments/${editingId}`, payload);
      } else {
        await api.post('/admin/departments', payload);
      }
      resetForm();
      if (fetchDepartments) fetchDepartments(); // trigger reload in parent
    } catch (err) {
      console.error("Failed to save department:", err);
      alert(err.response?.data?.message || "Failed to save department");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center">
            <Building2 className="w-5 h-5 mr-2 text-indigo-600" />
            Manage Facility Provider Departments
          </h2>
          <p className="text-sm text-slate-500 mt-1">Create operational departments and assign Facility Providers.</p>
        </div>
        <button
          onClick={handleAddNew}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center transition-colors"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Maintenance Department
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Department Name</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Facility Provider</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {departments && departments.length > 0 ? departments.map((dept) => (
              <tr key={dept.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-semibold text-slate-800">{dept.name}</span>
                  {dept.description && <p className="text-xs text-slate-500">{dept.description}</p>}
                </td>
                <td className="px-6 py-4">
                  {dept.incharge ? (
                    <div>
                      <p className="text-sm font-medium text-slate-800 flex items-center gap-2">
                        {dept.incharge.name}
                        <RoleBadge role={dept.incharge.role} />
                      </p>
                      <p className="text-xs text-slate-500">{dept.incharge.email}</p>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400 italic">Not Assigned</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button
                    onClick={() => handleEditClick(dept)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="3" className="px-6 py-4 text-center text-sm text-slate-500 italic">No departments configured yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Department Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-visible flex flex-col min-h-[450px]">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">
                {isEditing ? 'Edit Maintenance Department' : 'Add New Maintenance Department'}
              </h3>
            </div>
            <div className="p-6 space-y-4 flex-grow">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Maintenance Department Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 outline-none"
                  placeholder="e.g., Electrical"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 outline-none"
                  placeholder="e.g., Handles electrical repairs"
                />
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-1">Assign Facility Provider (Search by Email)</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 outline-none"
                    placeholder="Type at least 3 letters of email..."
                  />
                  {isSearching && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 text-indigo-500 animate-spin" />}
                </div>

                {/* Dropdown for search results */}
                {searchResults.length > 0 && searchQuery !== formData.inchargeEmail && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {searchResults.map(user => (
                      <button
                        key={user.id}
                        onClick={() => handleSelectUser(user.email)}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none border-b border-slate-100 last:border-0"
                      >
                        <div className="font-medium text-slate-800 flex items-center gap-2">
                          {user.name}
                          <RoleBadge role={user.role} />
                        </div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </button>
                    ))}
                  </div>
                )}
                {/* Visual indicator of assigned user if matched exactly */}
                {formData.inchargeEmail && searchQuery === formData.inchargeEmail && (
                  <p className="mt-1 text-xs text-emerald-600 flex items-center"><UserCheck className="w-3 h-3 mr-1" /> User selected</p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end space-x-3 rounded-b-xl mt-auto">
              <button
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? 'Update Maintenance Department' : 'Create Maintenance Department'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
