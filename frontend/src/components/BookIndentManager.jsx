import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api/axios';

const STATUS_OPTIONS = ['Pending', 'Approved', 'Ordered', 'Received', 'Rejected'];

const statusConfig = {
  Pending: 'text-amber-600 bg-amber-50 border border-amber-200',
  Approved: 'text-blue-600 bg-blue-50 border border-blue-200',
  Ordered: 'text-indigo-600 bg-indigo-50 border border-indigo-200',
  Received: 'text-green-600 bg-green-50 border border-green-200',
  Rejected: 'text-red-600 bg-red-50 border border-red-200',
};

const ITEMS_PER_PAGE = 10;

export default function BookIndentManager() {
  const [bookIndents, setBookIndents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [branchFilter, setBranchFilter] = useState('All');
  const [branches, setBranches] = useState([]);

  const loadBookIndents = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/faculty-book-indents');
      setBookIndents(res.data.bookIndents || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load book indents');
    } finally {
      setIsLoading(false);
    }
  };

  const loadBranches = async () => {
    try {
      const res = await api.get('/branches');
      setBranches(res.data.branches || []);
    } catch (err) {
      // Branch list is only used to populate the filter; ignore failures silently.
    }
  };

  useEffect(() => {
    loadBookIndents();
    loadBranches();
  }, []);

  const branchOptions = useMemo(
    () => Array.from(new Set(branches.map((branch) => branch.branch_name).filter(Boolean))).sort(),
    [branches]
  );

  const filteredBookIndents = useMemo(
    () => (branchFilter === 'All' ? bookIndents : bookIndents.filter((item) => item.branchName === branchFilter)),
    [bookIndents, branchFilter]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [branchFilter]);

  const handleStatusChange = async (item, status) => {
    if (status === item.status) return;
    try {
      setUpdatingId(item.id);
      await api.put(`/faculty-book-indents/${item.id}/status`, { status });
      setBookIndents((prev) => prev.map((b) => (b.id === item.id ? { ...b, status } : b)));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(filteredBookIndents.length / ITEMS_PER_PAGE));
  const currentSafePage = Math.min(currentPage, totalPages);
  const paginatedIndents = useMemo(
    () => filteredBookIndents.slice((currentSafePage - 1) * ITEMS_PER_PAGE, currentSafePage * ITEMS_PER_PAGE),
    [filteredBookIndents, currentSafePage]
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center">
            <BookOpen className="w-5 h-5 mr-2 text-indigo-600" /> Faculty Book Indents
          </h2>
          <p className="text-sm text-slate-500 mt-1">Review and update the status of faculty book requests.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Filter by Branch</label>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white"
          >
            <option value="All">All Branches</option>
            {branchOptions.map((branch) => (
              <option key={branch} value={branch}>{branch}</option>
            ))}
          </select>
        </div>
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
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Title / Author</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Faculty</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Branch</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">For</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Qty</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan="7" className="px-6 py-10 text-center text-slate-500">
                  <div className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading book indents...
                  </div>
                </td>
              </tr>
            ) : paginatedIndents.length > 0 ? paginatedIndents.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-slate-900">{item.bookTitle}</div>
                  <div className="text-xs text-slate-500">{item.bookAuthor} &bull; {item.publisher}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-slate-700">{item.facultyName}</div>
                  <div className="text-xs text-slate-500">{item.requestedByEmail}</div>
                  <div className="text-xs text-slate-400">Library ID: {item.libraryIdNo}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">{item.branchName}</td>
                <td className="px-6 py-4 text-sm text-slate-700">
                  <div>{item.booksRequiredFor}</div>
                  <div className="text-xs text-slate-500">Sem: {item.semester} &bull; Strength: {item.studentStrength}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-700">{item.bookType}</td>
                <td className="px-6 py-4 text-sm text-slate-700">{item.requiredQuantity}</td>
                <td className="px-6 py-4">
                  <select
                    value={item.status}
                    disabled={updatingId === item.id}
                    onChange={(e) => handleStatusChange(item, e.target.value)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold outline-none disabled:opacity-50 ${statusConfig[item.status] || statusConfig.Pending}`}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="7" className="px-6 py-10 text-center text-slate-500">
                  No book indents found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredBookIndents.length > 0 && (
        <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Showing <span className="font-medium text-slate-700">{(currentSafePage - 1) * ITEMS_PER_PAGE + 1}</span>
            {' '}-{' '}
            <span className="font-medium text-slate-700">{Math.min(currentSafePage * ITEMS_PER_PAGE, filteredBookIndents.length)}</span>
            {' '}of{' '}
            <span className="font-medium text-slate-700">{filteredBookIndents.length}</span> indents
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
    </div>
  );
}
