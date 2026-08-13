import React, { useEffect, useState } from 'react';
import { GitBranch, Plus, Pencil, Trash2, Loader2, AlertCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api/axios';

const emptyForm = { branch_name: '', degree: '' };
const BRANCHES_PER_PAGE = 10;

export default function BranchManager() {
  const [branches, setBranches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [currentPage, setCurrentPage] = useState(1);

  const loadBranches = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/branches');
      setBranches(res.data.branches || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load branches');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const totalPages = Math.max(1, Math.ceil(branches.length / BRANCHES_PER_PAGE));
  const currentSafePage = Math.min(currentPage, totalPages);
  const paginatedBranches = branches.slice(
    (currentSafePage - 1) * BRANCHES_PER_PAGE,
    currentSafePage * BRANCHES_PER_PAGE
  );

  const openAdd = () => {
    setEditingBranch(null);
    setFormData(emptyForm);
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (branch) => {
    setEditingBranch(branch);
    setFormData({ branch_name: branch.branch_name || '', degree: branch.degree || '' });
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingBranch(null);
    setFormData(emptyForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.branch_name.trim()) {
      setError('Branch name is required');
      return;
    }
    if (!formData.degree.trim()) {
      setError('Degree is required');
      return;
    }

    try {
      setIsSaving(true);
      setError('');
      if (editingBranch) {
        await api.put(`/branches/${editingBranch.id}`, formData);
      } else {
        await api.post('/branches', formData);
      }
      await loadBranches();
      closeModal();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save branch');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (branch) => {
    const confirmed = window.confirm(`Delete branch ${branch.branch_name}?`);
    if (!confirmed) return;

    try {
      setIsSaving(true);
      await api.delete(`/branches/${branch.id}`);
      await loadBranches();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete branch');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center">
            <GitBranch className="w-5 h-5 mr-2 text-indigo-600" /> Branch Management
          </h2>
          <p className="text-sm text-slate-500 mt-1">Create, update, and delete branches.</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> Add Branch
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
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Branch Name</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Degree</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan="3" className="px-6 py-10 text-center text-slate-500">
                  <div className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading branches...
                  </div>
                </td>
              </tr>
            ) : paginatedBranches.length > 0 ? paginatedBranches.map((branch) => (
              <tr key={branch.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                      {String(branch.branch_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <span className="font-semibold text-slate-800">{branch.branch_name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-600">{branch.degree || '-'}</td>
                <td className="px-6 py-4 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      onClick={() => openEdit(branch)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(branch)}
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
                  No branches found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {branches.length > 0 && (
        <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Showing <span className="font-medium text-slate-700">{(currentSafePage - 1) * BRANCHES_PER_PAGE + 1}</span>
            {' '}-{' '}
            <span className="font-medium text-slate-700">{Math.min(currentSafePage * BRANCHES_PER_PAGE, branches.length)}</span>
            {' '}of{' '}
            <span className="font-medium text-slate-700">{branches.length}</span> branches
          </p>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentSafePage === 1}
              className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => page === 1 || page === totalPages || Math.abs(page - currentSafePage) <= 1)
              .reduce((acc, page, idx, arr) => {
                if (idx > 0 && page - arr[idx - 1] > 1) acc.push('ellipsis-' + page);
                acc.push(page);
                return acc;
              }, [])
              .map(page =>
                typeof page === 'number' ? (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-[2.25rem] h-9 px-2 rounded-lg text-sm font-medium transition-colors ${
                      page === currentSafePage
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:bg-slate-50 border border-slate-300'
                    }`}
                  >
                    {page}
                  </button>
                ) : (
                  <span key={page} className="px-1 text-slate-400 text-sm">…</span>
                )
              )}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentSafePage === totalPages}
              className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900">
                {editingBranch ? 'Edit Branch' : 'Add Branch'}
              </h3>
              <button onClick={closeModal} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Branch Name</label>
                <input
                  type="text"
                  value={formData.branch_name}
                  onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Branch name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Degree</label>
                <input
                  type="text"
                  value={formData.degree}
                  onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Degree"
                />
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
                  {editingBranch ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
