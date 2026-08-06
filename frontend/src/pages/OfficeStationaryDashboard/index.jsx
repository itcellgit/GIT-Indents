import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Shield, User, LogOut, KeyRound, Search, Filter, Plus, ClipboardList, Package2, Pencil, Trash2, Eye } from 'lucide-react';
import api from '../../api/axios';
import NotificationBell from '../../components/NotificationBell';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import logo from '../../assets/logo.png';

const sectionTabs = ['Stationery master', 'Processing requests'];

const STATUS_COLORS = {
  'Pending Requests': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'In Progress': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'Completed': 'bg-green-100 text-green-800 border-green-200'
};

export default function OfficeStationaryDashboard() {
  const { user, logout } = useAuth();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = React.useState(false);
  const [activeTab, setActiveTab] = useState('Stationery master');
  const [stationeryItems, setStationeryItems] = useState([]);
  const [processingRequests, setProcessingRequests] = useState([]);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [itemForm, setItemForm] = useState({ itemName: '', specification: '' });
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [itemError, setItemError] = useState('');
  const [requestError, setRequestError] = useState('');
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [sharedGrantDate, setSharedGrantDate] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const formatShortDate = (value) => {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const normalizeRequest = (indent, stationariesList = stationeryItems) => ({
    id: Number(indent.id),
    reason: indent.reason,
    requestDate: formatShortDate(indent.createdAt),
    departmentName: indent.departmentName || indent.departmentId,
    status: indent.status,
    items: (indent.items || []).map((item) => ({
      id: Number(item.id),
      stationaryId: Number(item.stationaryId),
      itemName: stationariesList.find((stationary) => String(stationary.id) === String(item.stationaryId))?.name || '-',
      requestQuantity: Number(item.requestQuantity),
      grantQuantity: Number(item.grantQuantity || 0),
      grantDate: item.grantDate ? item.grantDate.slice(0, 10) : ''
    }))
  });

  const fetchStationaries = async () => {
    try {
      setIsLoadingItems(true);
      const res = await api.get('/admin/stationaries');
      const stationariesData = res.data.stationaries || [];
      setStationeryItems(stationariesData);
      await fetchProcessingRequests(stationariesData);
    } catch (err) {
      setItemError(err.response?.data?.message || 'Failed to load stationery items');
      setStationeryItems([]);
      await fetchProcessingRequests([]);
    } finally {
      setIsLoadingItems(false);
    }
  };

  const fetchProcessingRequests = async (stationariesList = stationeryItems) => {
    try {
      setIsLoadingRequests(true);
      setRequestError('');
      const res = await api.get('/stationary-indents');
      const indents = res.data.indents || [];
      setProcessingRequests(indents.map((indent) => normalizeRequest(indent, stationariesList)));
    } catch (err) {
      setRequestError(err.response?.data?.message || 'Failed to load processing requests');
      setProcessingRequests([]);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  useEffect(() => {
    fetchStationaries();
  }, []);

  const openAddItemModal = () => {
    setEditingItem(null);
    setItemError('');
    setItemForm({ itemName: '', specification: '' });
    setIsAddItemOpen(true);
  };

  const openEditItemModal = (item) => {
    setEditingItem(item);
    setItemError('');
    setItemForm({ itemName: item.name || '', specification: item.specification || '' });
    setIsAddItemOpen(true);
  };

  const closeAddItemModal = () => {
    setIsAddItemOpen(false);
    setItemForm({ itemName: '', specification: '' });
    setEditingItem(null);
    setItemError('');
  };

  const handleAddItemSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSavingItem(true);
      setItemError('');

      const payload = {
        name: itemForm.itemName,
        specification: itemForm.specification
      };

      if (editingItem) {
        await api.put(`/admin/stationaries/${editingItem.id}`, payload);
      } else {
        await api.post('/admin/stationaries', payload);
      }

      await fetchStationaries();
      closeAddItemModal();
    } catch (err) {
      setItemError(err.response?.data?.message || 'Failed to save stationery item');
    } finally {
      setIsSavingItem(false);
    }
  };

  const handleDeleteItem = async (item) => {
    const confirmed = window.confirm(`Delete stationery item ${item.name}?`);
    if (!confirmed) return;

    try {
      setItemError('');
      await api.delete(`/admin/stationaries/${item.id}`);
      await fetchStationaries();
    } catch (err) {
      setItemError(err.response?.data?.message || 'Failed to delete stationery item');
    }
  };

  const openReviewModal = (request) => {
    const existingGrantDate = (request.items || []).find((item) => item.grantDate)?.grantDate || '';
    setSelectedRequest({
      ...request,
      items: (request.items || []).map((item) => ({
        ...item,
        grantQuantity: item.grantQuantity || 0,
        grantDate: item.grantDate || ''
      }))
    });
    setSharedGrantDate(existingGrantDate);
    setIsReviewOpen(true);
  };

  const updateReviewItem = (itemId, field, value) => {
    setSelectedRequest((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((item) => (
          item.id === itemId ? { ...item, [field]: value } : item
        ))
      };
    });
  };

  const saveReview = async () => {
    if (!selectedRequest) return;

    try {
      setReviewSaving(true);
      const payload = {
        reason: selectedRequest.reason,
        items: selectedRequest.items.map((item) => ({
          stationaryId: item.stationaryId,
          requestQuantity: item.requestQuantity,
          grantQuantity: Number(item.grantQuantity || 0),
          grantDate: sharedGrantDate || item.grantDate || null
        }))
      };

      const res = await api.put(`/stationary-indents/${selectedRequest.id}`, payload);
      const updated = normalizeRequest(res.data.indent, stationeryItems);
      setProcessingRequests((prev) => prev.map((request) => (request.id === updated.id ? updated : request)));
      setIsReviewOpen(false);
      setSelectedRequest(null);
    } catch (err) {
      setRequestError(err.response?.data?.message || 'Failed to save review');
    } finally {
      setReviewSaving(false);
    }
  };

  const filteredStationeryItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return stationeryItems;
    return stationeryItems.filter((item) =>
      [item.name, item.specification].some((value) => String(value || '').toLowerCase().includes(query))
    );
  }, [stationeryItems, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredStationeryItems.length / itemsPerPage));
  const paginatedStationeryItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredStationeryItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredStationeryItems, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
                <h1 className="text-lg font-bold text-white leading-tight">Office Stationary Dashboard</h1>
                <p className="text-xs text-indigo-300">Stationary request control panel</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <NotificationBell />
              <Link to="/profile" className="flex items-center space-x-2 hover:opacity-80 transition-opacity animate-in" title="My Profile">
                <span className="text-sm font-medium text-slate-300">{user?.name || 'Office Stationary'}</span>
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
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 no-print space-y-8">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
          <h2 className="text-2xl font-bold text-slate-900">Welcome, {user?.name || 'Office Stationary'}</h2>
          <p className="mt-2 text-sm text-slate-500">
            Manage stationery requests, monitor progress, and keep track of office supply tasks from one place.
          </p>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex space-x-1 bg-gray-200/50 p-1 rounded-xl w-full sm:w-fit sticky top-20 z-30">
            {sectionTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  activeTab === tab
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

          {activeTab === 'Stationery master' && (
            <div className="p-6 space-y-5">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Stationery master</h3>
                  <p className="text-sm text-slate-500 mt-1">Manage stationery items and stock levels.</p>
                </div>
                <button
                  onClick={openAddItemModal}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                >
                  <Plus className="w-5 h-5" />
                  <span>{editingItem ? 'Edit Item' : 'Add Item'}</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search stationery..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
                  />
                </div>
              </div>

              {itemError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {itemError}
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-6 py-4 font-medium">S.no</th>
                      <th className="px-6 py-4 font-medium">Itemname</th>
                      <th className="px-6 py-4 font-medium">Specification</th>
                      <th className="px-6 py-4 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {!isLoadingItems && paginatedStationeryItems.length > 0 ? paginatedStationeryItems.map((item, index) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-600">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                        <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{item.specification || '-'}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => openEditItemModal(item)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center">
                            <Package2 className="w-12 h-12 text-slate-300 mb-3" />
                            <p className="text-base font-medium text-slate-600">{isLoadingItems ? 'Loading stationery items...' : 'No stationery items found'}</p>
                            <p className="text-sm">Add items to populate the Stationery master section.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {!isLoadingItems && filteredStationeryItems.length > 0 && (
                <div className="flex items-center justify-between gap-4 pt-2">
                  <p className="text-sm text-slate-500">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredStationeryItems.length)} of {filteredStationeryItems.length} entries
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                        <button
                          key={page}
                          type="button"
                          onClick={() => setCurrentPage(page)}
                          className={`min-w-9 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                            currentPage === page
                              ? 'bg-indigo-600 text-white'
                              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={currentPage === totalPages}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Processing requests' && (
            <div className="p-6 space-y-5">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Processing requests</h3>
                  <p className="text-sm text-slate-500 mt-1">Track stationery requests from pending to completed.</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-6 py-4 font-medium">S.no</th>
                      <th className="px-6 py-4 font-medium">Reason</th>
                      <th className="px-6 py-4 font-medium">Request date</th>
                      <th className="px-6 py-4 font-medium">Department name</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {requestError && (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-sm text-red-700 bg-red-50 border-b border-red-100">
                          {requestError}
                        </td>
                      </tr>
                    )}
                    {!requestError && !isLoadingRequests && processingRequests.length > 0 ? processingRequests.map((request, index) => (
                      <tr key={request.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-600">{request.sno || index + 1}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{request.reason || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{request.requestDate || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{request.departmentName || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {String(request.status || 'Pending').trim().toLowerCase() === 'received' ? (
                            <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                              Received
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => openReviewModal(request)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            title="Review"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                          <div className="flex flex-col items-center justify-center">
                            <ClipboardList className="w-12 h-12 text-slate-300 mb-3" />
                            <p className="text-base font-medium text-slate-600">{isLoadingRequests ? 'Loading processing requests...' : 'No processing requests found'}</p>
                            <p className="text-sm">Requests will appear here once they are submitted.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      {isAddItemOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{editingItem ? 'Edit stationery item' : 'Add stationery item'}</h2>
                <p className="text-sm text-slate-500 mt-1">Enter the item name and specification.</p>
              </div>
              <button
                onClick={closeAddItemModal}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleAddItemSubmit} className="p-6 space-y-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Item Name</label>
                <input
                  type="text"
                  value={itemForm.itemName}
                  onChange={(e) => setItemForm({ ...itemForm, itemName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Enter item name"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Specification</label>
                <input
                  type="text"
                  value={itemForm.specification}
                  onChange={(e) => setItemForm({ ...itemForm, specification: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Enter specification"
                />
              </div>

              {itemError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {itemError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAddItemModal}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingItem}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                  {isSavingItem ? 'Saving...' : (editingItem ? 'Update Item' : 'Add Item')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isChangePasswordOpen && (
        <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />
      )}

      {isReviewOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Processing Request</h2>
              </div>
              <button
                onClick={() => setIsReviewOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm items-end">
                <div className="md:col-span-1">
                  <p className="text-slate-500">Reason</p>
                  <p className="font-medium text-slate-800">{selectedRequest.reason || '-'}</p>
                </div>
                <div className="md:col-span-1">
                  <p className="text-slate-500">Request Date</p>
                  <p className="font-medium text-slate-800">{selectedRequest.requestDate || '-'}</p>
                </div>
                <div className="md:col-span-1">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Given Date</label>
                  <input
                    type="date"
                    value={sharedGrantDate}
                    onChange={(e) => setSharedGrantDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-6 py-4 font-medium">S.No</th>
                      <th className="px-6 py-4 font-medium">Item Name</th>
                      <th className="px-6 py-4 font-medium">Request Quantity</th>
                      <th className="px-6 py-4 font-medium">Given Quantity</th>
                      {String(selectedRequest.status || 'Pending').trim().toLowerCase() === 'pending' && (
                        <th className="px-6 py-4 font-medium">Grant Quantity</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(selectedRequest.items || []).map((item, index) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-600">{index + 1}</td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{item.itemName || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{item.requestQuantity || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{Number(item.grantQuantity || 0)}</td>
                        {String(selectedRequest.status || 'Pending').trim().toLowerCase() === 'pending' && (
                          <td className="px-6 py-4 text-sm text-slate-600 min-w-[160px]">
                            <input
                              type="number"
                              min="0"
                              value={item.grantQuantity}
                              onChange={(e) => updateReviewItem(item.id, 'grantQuantity', e.target.value)}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="Grant qty"
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReviewOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveReview}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {reviewSaving ? 'Saving...' : 'Grant Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
