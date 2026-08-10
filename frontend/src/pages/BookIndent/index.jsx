import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, Plus, X, Loader2, AlertCircle, BookOpen, ChevronLeft, ChevronRight, KeyRound, LogOut, Pencil, Trash2 } from 'lucide-react';
import NotificationBell from '../../components/NotificationBell';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import api from '../../api/axios';
import logo from '../../assets/logo.png';
import { ROLE_DASHBOARDS } from '../../constants/roles';

const BOOKS_REQUIRED_FOR_OPTIONS = ['UG', 'PG', 'Doctoral', 'Common to all/General Reading'];
const SEMESTER_OPTIONS = ['1st', '2nd', '3rd', '5th', '6th', '7th', '8th', 'Common to all'];
const BOOK_TYPE_OPTIONS = ['Reference', 'Textbook', 'General'];

const initialForm = {
  libraryIdNo: '',
  branchId: '',
  booksRequiredFor: '',
  semester: '',
  bookAuthor: '',
  bookTitle: '',
  publisher: '',
  requiredQuantity: '',
  studentStrength: '',
  bookType: '',
  remarks: '',
};

const statusConfig = {
  Pending: 'text-amber-600 bg-amber-50 border border-amber-200',
  Approved: 'text-blue-600 bg-blue-50 border border-blue-200',
  Ordered: 'text-indigo-600 bg-indigo-50 border border-indigo-200',
  Received: 'text-green-600 bg-green-50 border border-green-200',
  Rejected: 'text-red-600 bg-red-50 border border-red-200',
};

const ITEMS_PER_PAGE = 10;

export default function BookIndentPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const backPath = ROLE_DASHBOARDS[user?.role] || '/dashboard';

  const [bookIndents, setBookIndents] = useState([]);
  const [branches, setBranches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [indentsRes, branchesRes] = await Promise.all([
        api.get('/faculty-book-indents/mine'),
        api.get('/branches'),
      ]);
      setBookIndents(indentsRes.data.bookIndents || []);
      setBranches(branchesRes.data.branches || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load book indents');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setFormData(initialForm);
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      libraryIdNo: item.libraryIdNo || '',
      branchId: item.branchId || '',
      booksRequiredFor: item.booksRequiredFor || '',
      semester: item.semester || '',
      bookAuthor: item.bookAuthor || '',
      bookTitle: item.bookTitle || '',
      publisher: item.publisher || '',
      requiredQuantity: item.requiredQuantity || '',
      studentStrength: item.studentStrength || '',
      bookType: item.bookType || '',
      remarks: item.remarks || '',
    });
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(initialForm);
  };

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const validateForm = () => {
    if (!formData.libraryIdNo.trim()) return 'Library ID No. is required';
    if (!formData.branchId) return 'Branch is required';
    if (!formData.booksRequiredFor) return '"Books required for" is required';
    if (!formData.semester) return '"Books required for the sem" is required';
    if (!formData.bookAuthor.trim()) return 'Book Author/s is required';
    if (!formData.bookTitle.trim()) return 'Book Title is required';
    if (!formData.publisher.trim()) return 'Publisher is required';
    if (!formData.requiredQuantity || Number(formData.requiredQuantity) <= 0) return 'Required Quantity must be a positive number';
    if (!formData.studentStrength || Number(formData.studentStrength) <= 0) return 'Student Strength must be a positive number';
    if (!formData.bookType) return 'Type of Book is required';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      setIsSaving(true);
      setError('');
      if (editingId) {
        await api.put(`/faculty-book-indents/${editingId}`, formData);
      } else {
        await api.post('/faculty-book-indents', formData);
      }
      await loadData();
      setCurrentPage(1);
      closeModal();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit book indent');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const confirmed = window.confirm(`Delete book indent "${item.bookTitle}"?`);
    if (!confirmed) return;

    try {
      setDeletingId(item.id);
      await api.delete(`/faculty-book-indents/${item.id}`);
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete book indent');
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(bookIndents.length / ITEMS_PER_PAGE));
  const currentSafePage = Math.min(currentPage, totalPages);
  const paginatedIndents = useMemo(
    () => bookIndents.slice((currentSafePage - 1) * ITEMS_PER_PAGE, currentSafePage * ITEMS_PER_PAGE),
    [bookIndents, currentSafePage]
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img src={logo} alt="KLS GIT Logo" className="h-10 w-10 object-contain bg-white rounded-full p-0.5" />
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">Book Indent</h1>
                <p className="text-xs text-indigo-600">Faculty Book Indent Form</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <NotificationBell />
              <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity" title="My Profile">
                <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200">
                  <BookOpen className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-slate-700">{user?.name}</p>
                  <p className="text-xs text-slate-500">{user?.department}</p>
                </div>
              </Link>
              <button onClick={() => setIsChangePasswordOpen(true)} className="text-slate-400 hover:text-indigo-600 transition-colors bg-slate-100 p-2 rounded-lg border border-slate-200" title="Change Password">
                <KeyRound className="w-4 h-4" />
              </button>
              <button onClick={logout} className="text-slate-400 hover:text-red-500 transition-colors bg-slate-100 p-2 rounded-lg border border-slate-200" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <button
              type="button"
              onClick={() => navigate(backPath)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </button>
            <h2 className="text-3xl font-bold text-slate-900">My Book Indents</h2>
          </div>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Book Indent
          </button>
        </div>

        {error && !isModalOpen && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5" /> <span>{error}</span>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Author</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Branch</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Qty</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Submitted</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-10 text-center text-slate-500">
                      <div className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading book indents...
                      </div>
                    </td>
                  </tr>
                ) : paginatedIndents.length > 0 ? paginatedIndents.map((item) => {
                  const isEditable = item.status === 'Pending';
                  return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{item.bookTitle}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{item.bookAuthor}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{item.branchName}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{item.bookType}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{item.requiredQuantity}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusConfig[item.status] || statusConfig.Pending}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openEdit(item)}
                          disabled={!isEditable}
                          title={isEditable ? 'Edit' : 'Only pending indents can be edited'}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          disabled={!isEditable || deletingId === item.id}
                          title={isEditable ? 'Delete' : 'Only pending indents can be deleted'}
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan="8" className="px-6 py-10 text-center text-slate-500">
                      No book indents submitted yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {bookIndents.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                Showing <span className="font-medium text-slate-700">{(currentSafePage - 1) * ITEMS_PER_PAGE + 1}</span>
                {' '}-{' '}
                <span className="font-medium text-slate-700">{Math.min(currentSafePage * ITEMS_PER_PAGE, bookIndents.length)}</span>
                {' '}of{' '}
                <span className="font-medium text-slate-700">{bookIndents.length}</span> indents
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
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900">{editingId ? 'Edit Book Indent' : 'New Book Indent'}</h3>
              <button onClick={closeModal} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5" /> <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Library ID No. <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formData.libraryIdNo}
                    onChange={handleChange('libraryIdNo')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Branch <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={formData.branchId}
                    onChange={handleChange('branchId')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white"
                  >
                    <option value="">Select branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.branch_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Books required for <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={formData.booksRequiredFor}
                    onChange={handleChange('booksRequiredFor')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white"
                  >
                    <option value="">Select</option>
                    {BOOKS_REQUIRED_FOR_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Books required for the sem <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={formData.semester}
                    onChange={handleChange('semester')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white"
                  >
                    <option value="">Select</option>
                    {SEMESTER_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Book Author/s <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.bookAuthor}
                  onChange={handleChange('bookAuthor')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Book Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.bookTitle}
                  onChange={handleChange('bookTitle')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Publisher <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.publisher}
                  onChange={handleChange('publisher')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Required Quantity <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.requiredQuantity}
                    onChange={handleChange('requiredQuantity')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Student Strength <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.studentStrength}
                    onChange={handleChange('studentStrength')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Type of Book <span className="text-red-500">*</span></label>
                <select
                  required
                  value={formData.bookType}
                  onChange={handleChange('bookType')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white"
                >
                  <option value="">Select</option>
                  {BOOK_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Any remarks/Note</label>
                <textarea
                  rows={3}
                  value={formData.remarks}
                  onChange={handleChange('remarks')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
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
                  {editingId ? 'Update' : 'Submit'}
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
