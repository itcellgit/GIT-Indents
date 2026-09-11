import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  BookOpen, Loader2, AlertCircle, ChevronLeft, ChevronRight,
  Pencil, X, Check, PackageCheck, Download, FileText,
} from 'lucide-react';
import api from '../api/axios';
import { formatDate, formatDateTime } from '../utils/formatDate';

const ITEMS_PER_PAGE = 10;

const STATUS_STYLES = {
  'pending': 'border-amber-200 bg-amber-50 text-amber-700',
  'in progress': 'border-indigo-200 bg-indigo-50 text-indigo-700',
  'rejected': 'border-red-200 bg-red-50 text-red-700',
  'books arrived': 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const StatusBadge = ({ status }) => {
  const label = String(status || 'Pending').trim() || 'Pending';
  const style = STATUS_STYLES[label.toLowerCase()] || 'border-slate-200 bg-slate-50 text-slate-600';
  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${style}`}>
      {label}
    </span>
  );
};

const monthKeyOf = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabelOf = (monthKey) => {
  const [year, month] = monthKey.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

export default function BookIndentManager() {
  const [bookIndents, setBookIndents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [branchFilter, setBranchFilter] = useState('All');
  const [degreeFilter, setDegreeFilter] = useState('All');
  const [monthFilter, setMonthFilter] = useState('All');
  const [branches, setBranches] = useState([]);

  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewQty, setReviewQty] = useState('');
  const [reviewRemark, setReviewRemark] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectRemark, setRejectRemark] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const [arrivingId, setArrivingId] = useState(null);

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

  const degreeOptions = useMemo(
    () => Array.from(new Set(branches.map((branch) => branch.degree).filter(Boolean))).sort(),
    [branches]
  );

  const monthOptions = useMemo(() => {
    const keys = Array.from(new Set(bookIndents.map((item) => monthKeyOf(item.createdAt)).filter(Boolean)));
    return keys.sort().reverse();
  }, [bookIndents]);

  const filteredBookIndents = useMemo(
    () => bookIndents.filter((item) => {
      const matchesBranch = branchFilter === 'All' || item.branchName === branchFilter;
      const branchDegree = branches.find((branch) => branch.branch_name === item.branchName)?.degree || '';
      const matchesDegree = degreeFilter === 'All' || branchDegree === degreeFilter;
      const matchesMonth = monthFilter === 'All' || monthKeyOf(item.createdAt) === monthFilter;
      return matchesBranch && matchesDegree && matchesMonth;
    }),
    [bookIndents, branchFilter, degreeFilter, monthFilter, branches]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [branchFilter, degreeFilter, monthFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredBookIndents.length / ITEMS_PER_PAGE));
  const currentSafePage = Math.min(currentPage, totalPages);
  const paginatedIndents = useMemo(
    () => filteredBookIndents.slice((currentSafePage - 1) * ITEMS_PER_PAGE, currentSafePage * ITEMS_PER_PAGE),
    [filteredBookIndents, currentSafePage]
  );

  const applyUpdatedIndent = (updated) => {
    setBookIndents((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  const openReview = (item) => {
    setReviewTarget(item);
    setReviewQty(String(item.requiredQuantity));
    setReviewRemark('');
    setReviewError('');
  };

  const closeReview = () => {
    setReviewTarget(null);
    setReviewQty('');
    setReviewRemark('');
    setReviewError('');
    setReviewSubmitting(false);
  };

  const submitApprove = async () => {
    if (!reviewTarget) return;
    const quantity = Number(reviewQty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setReviewError('Please enter a valid number of copies.');
      return;
    }
    try {
      setReviewSubmitting(true);
      setReviewError('');
      const res = await api.put(`/faculty-book-indents/${reviewTarget.id}/review`, {
        action: 'approve',
        requiredQuantity: quantity,
        remark: reviewRemark.trim(),
      });
      applyUpdatedIndent(res.data.bookIndent);
      closeReview();
    } catch (err) {
      setReviewError(err.response?.data?.message || 'Failed to approve the book indent.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const openReject = (item) => {
    setRejectTarget(item);
    setRejectRemark('');
    setRejectError('');
  };

  const closeReject = () => {
    setRejectTarget(null);
    setRejectRemark('');
    setRejectError('');
    setRejectSubmitting(false);
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    if (!rejectRemark.trim()) {
      setRejectError('Please enter a remark before rejecting.');
      return;
    }
    try {
      setRejectSubmitting(true);
      setRejectError('');
      const res = await api.put(`/faculty-book-indents/${rejectTarget.id}/review`, {
        action: 'reject',
        remark: rejectRemark.trim(),
      });
      applyUpdatedIndent(res.data.bookIndent);
      closeReject();
    } catch (err) {
      setRejectError(err.response?.data?.message || 'Failed to reject the book indent.');
    } finally {
      setRejectSubmitting(false);
    }
  };

  const markArrived = async (item) => {
    try {
      setArrivingId(item.id);
      const res = await api.put(`/faculty-book-indents/${item.id}/arrived`, {});
      applyUpdatedIndent(res.data.bookIndent);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to mark the book indent as arrived.');
    } finally {
      setArrivingId(null);
    }
  };

  const exportToExcel = () => {
    if (filteredBookIndents.length === 0) return;

    const worksheet = XLSX.utils.json_to_sheet(filteredBookIndents.map((item) => ({
      'Sl. No.': item.serialNo || item.id,
      'Date Raised': formatDate(item.createdAt),
      'Book Title': item.bookTitle,
      'Author': item.bookAuthor,
      'Edition': item.bookEdition,
      'ISBN': item.isbn,
      'Publisher': item.publisher,
      'Faculty': item.facultyName,
      'Faculty Email': item.requestedByEmail,
      'Branch': item.branchName,
      'For': item.booksRequiredFor,
      'Semester': item.semester,
      'Type': item.bookType,
      'Qty': item.requiredQuantity,
      'Status': item.status,
      'HOD Remark': item.hodRemark,
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Book Indents');

    const suffix = monthFilter === 'All' ? 'All' : monthLabelOf(monthFilter).replace(' ', '_');
    XLSX.writeFile(workbook, `Book_Indents_${suffix}.xlsx`);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center">
            <BookOpen className="w-5 h-5 mr-2 text-indigo-600" /> Faculty Book Indents
          </h2>
          <p className="text-sm text-slate-500 mt-1">Review faculty book requests.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end flex-wrap">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Filter by Month</label>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white"
            >
              <option value="All">All Months</option>
              {monthOptions.map((key) => (
                <option key={key} value={key}>{monthLabelOf(key)}</option>
              ))}
            </select>
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

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Filter by Degree</label>
            <select
              value={degreeFilter}
              onChange={(e) => setDegreeFilter(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white"
            >
              <option value="All">All Degrees</option>
              {degreeOptions.map((degree) => (
                <option key={degree} value={degree}>{degree}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={exportToExcel}
            disabled={filteredBookIndents.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" /> Export to Excel
          </button>
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
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Sl. No.</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Date Raised</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Title / Author</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Faculty</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Branch</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">For</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Qty</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan="10" className="px-6 py-10 text-center text-slate-500">
                  <div className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading book indents...
                  </div>
                </td>
              </tr>
            ) : paginatedIndents.length > 0 ? paginatedIndents.map((item) => {
              const statusKey = String(item.status || 'Pending').trim().toLowerCase();
              return (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-slate-700 whitespace-nowrap">{item.serialNo || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{formatDate(item.createdAt)}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-900">{item.bookTitle}</div>
                    <div className="text-xs text-slate-500">{item.bookAuthor} &bull; {item.publisher}</div>
                    <div className="text-xs text-slate-400">Edition: {item.bookEdition || '-'} &bull; ISBN: {item.isbn || '-'}</div>
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
                    <StatusBadge status={item.status} />
                    {item.hodRemark && (
                      <div className="mt-1 text-xs text-slate-500 max-w-[180px]" title={item.hodRemark}>
                        {item.hodRemark}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      {statusKey === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => openReview(item)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => openReject(item)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        </>
                      )}
                      {statusKey === 'in progress' && (
                        <button
                          type="button"
                          onClick={() => markArrived(item)}
                          disabled={arrivingId === item.id}
                          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          {arrivingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PackageCheck className="w-3.5 h-3.5" />}
                          Mark Books Arrived
                        </button>
                      )}
                      {(statusKey === 'rejected' || statusKey === 'books arrived') && (
                        <span className="text-xs text-slate-400">
                          {item.hodReviewedAt ? formatDateTime(item.hodReviewedAt) : '-'}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan="10" className="px-6 py-10 text-center text-slate-500">
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

      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="p-6 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-indigo-600" /> Review Book Indent
                </h2>
                <p className="text-sm text-slate-500 mt-1">{reviewTarget.bookTitle}</p>
              </div>
              <button
                onClick={closeReview}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Author</p>
                  <p className="font-medium text-slate-800">{reviewTarget.bookAuthor}</p>
                </div>
                <div>
                  <p className="text-slate-500">Requested by</p>
                  <p className="font-medium text-slate-800">{reviewTarget.facultyName}</p>
                </div>
                <div>
                  <p className="text-slate-500">Edition</p>
                  <p className="font-medium text-slate-800">{reviewTarget.bookEdition}</p>
                </div>
                <div>
                  <p className="text-slate-500">ISBN</p>
                  <p className="font-medium text-slate-800">{reviewTarget.isbn}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">No. of Copies</label>
                <input
                  type="number"
                  min="1"
                  value={reviewQty}
                  onChange={(e) => setReviewQty(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Remark <span className="text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={reviewRemark}
                  onChange={(e) => setReviewRemark(e.target.value)}
                  rows={3}
                  placeholder="Add a note for the requester"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {reviewError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{reviewError}</div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-slate-200">
              <button
                type="button"
                onClick={closeReview}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitApprove}
                disabled={reviewSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {reviewSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save &amp; Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="p-6 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center">
                  <X className="w-5 h-5 mr-2 text-red-600" /> Reject Book Indent
                </h2>
                <p className="text-sm text-slate-500 mt-1">{rejectTarget.bookTitle}</p>
              </div>
              <button
                onClick={closeReject}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Remark <span className="text-slate-400">(required — emailed to the requester)</span>
                </label>
                <textarea
                  value={rejectRemark}
                  onChange={(e) => setRejectRemark(e.target.value)}
                  rows={4}
                  placeholder="Reason for rejecting this request"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {rejectError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{rejectError}</div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-slate-200">
              <button
                type="button"
                onClick={closeReject}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReject}
                disabled={rejectSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {rejectSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
