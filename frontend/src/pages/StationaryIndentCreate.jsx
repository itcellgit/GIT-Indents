import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, PlusCircle, MinusCircle, FileText, CheckCircle2, User, Wrench, LogOut, KeyRound, Pencil, Trash2, Eye, Printer, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import ChangePasswordModal from '../components/ChangePasswordModal';
import logo from '../assets/logo.png';
import api from '../api/axios';
import { ROLE_DASHBOARDS } from '../constants/roles';
import { formatDate as formatShortDate } from '../utils/formatDate';

export default function StationaryIndentCreate() {
  const { user, logout } = useAuth();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [editingRequestId, setEditingRequestId] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const dashboardPath = ROLE_DASHBOARDS[user?.role] || '/dashboard';
  const [formData, setFormData] = useState({
    department: user?.department || '',
    reason: ''
  });
  const [stationaries, setStationaries] = useState([]);
  const [indentItems, setIndentItems] = useState([
    { id: Date.now(), stationaryId: '', requestQuantity: '' }
  ]);
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createEmptyRow = () => ({ id: Date.now(), stationaryId: '', requestQuantity: '' });

  const normalizeRequest = (indent, stationariesList = stationaries) => ({
    id: Number(indent.id),
    department: indent.departmentId,
    departmentName: indent.departmentName || indent.department || '',
    reason: indent.reason,
    status: indent.status,
    createdAt: formatShortDate(indent.createdAt),
    updatedAt: formatShortDate(indent.updatedAt),
    items: (indent.items || []).map((item) => ({
      id: Number(item.id),
      stationaryId: String(item.stationaryId),
      itemName: stationariesList.find((stationary) => String(stationary.id) === String(item.stationaryId))?.name || '',
      requestQuantity: item.requestQuantity,
      grantQuantity: item.grantQuantity,
      requestDate: formatShortDate(item.requestDate)
    }))
  });
  
  const hasGrantedQuantity = (request) =>
    (request.items || []).some((item) => Number(item.grantQuantity || 0) > 0);

  const isReceivedRequest = (request) => String(request.status || '').trim().toLowerCase() === 'received';

  const buildPayload = (sourceFormData, sourceIndentItems) => ({
    departmentId: user?.id,
    reason: sourceFormData.reason,
    items: sourceIndentItems
      .filter((item) => item.stationaryId && item.requestQuantity)
      .map((item) => ({
        stationaryId: Number(item.stationaryId),
        requestQuantity: Number(item.requestQuantity)
      }))
  });

  const loadRequests = async (stationariesList = stationaries) => {
    const res = await api.get('/stationary-indents');
    const loaded = (res.data.indents || []).map((indent) => normalizeRequest(indent, stationariesList));
    setRequests(loaded);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await api.get('/admin/stationaries');
        const stationariesData = res.data.stationaries || [];
        setStationaries(stationariesData);
        await loadRequests(stationariesData);
      } catch (err) {
        console.error('Failed to load stationary requests or stationaries', err);
      }
    };

    loadData();
  }, []);

  const resetModal = () => {
    setFormData({
      department: user?.department || '',
      reason: ''
    });
    setIndentItems([createEmptyRow()]);
    setMessage('');
    setEditingRequestId(null);
    setSelectedRequest(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const addIndentRow = () => {
    setIndentItems(prev => [...prev, createEmptyRow()]);
  };

  const removeIndentRow = (rowId) => {
    setIndentItems(prev => prev.length === 1 ? prev : prev.filter(row => row.id !== rowId));
  };

  const updateIndentRow = (rowId, field, value) => {
    setIndentItems(prev => prev.map(row => (row.id === rowId ? { ...row, [field]: value } : row)));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validItems = indentItems.filter((item) => item.stationaryId && item.requestQuantity);

    if (validItems.length === 0) {
      setMessage('Please add at least one stationery item with quantity.');
      return;
    }

    const payload = buildPayload(formData, indentItems);
    setIsSubmitting(true);

    const requestPromise = editingRequestId
      ? api.put(`/stationary-indents/${editingRequestId}`, payload)
      : api.post('/stationary-indents', payload);

    requestPromise
      .then(async (response) => {
        const savedIndent = response.data.indent;
        setRequests((prev) => {
          const normalized = normalizeRequest(savedIndent, stationaries);
          return editingRequestId
            ? prev.map((request) => (request.id === editingRequestId ? normalized : request))
            : [normalized, ...prev.filter((request) => request.id !== normalized.id)];
        });

        setFormData({
          department: user?.department || '',
          reason: ''
        });
        setIndentItems([createEmptyRow()]);
        setMessage(editingRequestId ? 'Stationary indent updated successfully.' : 'Stationary indent created successfully.');
        setIsCreateModalOpen(false);
        setEditingRequestId(null);
      })
      .catch((err) => {
        setMessage(err.response?.data?.message || 'Failed to save stationary indent.');
      })
      .finally(() => setIsSubmitting(false));
  };

  const openCreateModal = () => {
    resetModal();
    setIsCreateModalOpen(true);
  };

  const openEditModal = (request) => {
    setEditingRequestId(request.id);
    setFormData({
      department: request.department || user?.department || '',
      reason: request.reason || ''
    });
    setIndentItems(
      request.items?.length
        ? request.items.map((item) => ({
            id: `${request.id}-${item.stationaryId}-${Math.random()}`,
            stationaryId: String(item.stationaryId),
            requestQuantity: String(item.requestQuantity)
          }))
        : [createEmptyRow()]
    );
    setMessage('');
    setIsCreateModalOpen(true);
  };

  const openViewModal = (request) => {
    setSelectedRequest(request);
    setIsViewModalOpen(true);
  };

  const markAsReceived = async (request) => {
    try {
      const payload = {
        reason: request.reason,
        status: 'Received',
        items: (request.items || []).map((item) => ({
          stationaryId: Number(item.stationaryId),
          requestQuantity: Number(item.requestQuantity),
          grantQuantity: Number(item.grantQuantity || 0)
        }))
      };

      const res = await api.put(`/stationary-indents/${request.id}`, payload);
      const updated = normalizeRequest(res.data.indent, stationaries);
      setRequests((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      setMessage('Stationary indent marked as received.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to mark stationary indent as received.');
    }
  };

  const printSelectedRequest = () => {
    window.print();
  };

  const confirmDelete = (requestId) => {
    setDeleteTargetId(requestId);
  };

  const deleteRequest = () => {
    if (!deleteTargetId) return;

    api.delete(`/stationary-indents/${deleteTargetId}`)
      .then(() => {
        setRequests((prev) => prev.filter((request) => request.id !== deleteTargetId));
        setDeleteTargetId(null);
        setMessage('Stationary indent deleted successfully.');
      })
      .catch((err) => {
        setMessage(err.response?.data?.message || 'Failed to delete stationary indent.');
      });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <img src={logo} alt="KLS GIT Logo" className="h-10 w-10 object-contain" />
              <Wrench className="w-8 h-8 text-indigo-600" />
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 hidden sm:block">
                Digital Maintenance System
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <NotificationBell />
              <Link to="/profile" className="flex items-center space-x-2 hover:opacity-80 transition-opacity" title="My Profile">
                <span className="text-sm font-medium text-slate-600">Welcome, {user?.name || 'Stationary Coordinator'}</span>
                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200 shadow-sm cursor-pointer">
                  <User className="h-5 w-5 text-indigo-600" />
                </div>
              </Link>
              <button onClick={() => setIsChangePasswordOpen(true)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Change Password">
                <KeyRound className="w-5 h-5" />
              </button>
              <button onClick={logout} className="ml-1 p-2 text-slate-400 hover:text-red-500 transition-colors" title="Logout">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 no-print">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h2 className="text-2xl font-semibold text-slate-800">Stationary Indent</h2>
            <p className="text-sm text-slate-500 mt-1">Create a stationery request for your department.</p>
          </div>
          <Link to={dashboardPath} className="inline-flex items-center px-4 py-2.5 border border-slate-200 bg-white text-slate-700 rounded-lg hover:bg-slate-50 shadow-sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-indigo-600" /> Recent Requests
              </h2>
              <p className="text-sm text-slate-500 mt-1">Create and review your stationery requests.</p>
            </div>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <PlusCircle className="w-4 h-4" />
              Create New Request
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4 font-medium">S.No</th>
                  <th className="px-6 py-4 font-medium">Reason</th>
                  <th className="px-6 py-4 font-medium">Items</th>
                  <th className="px-6 py-4 font-medium">Request Date</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.length > 0 ? requests.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-800">{index + 1}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-[420px] truncate">{item.reason || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.items?.length || 0} item(s)</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.createdAt || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {String(item.status || 'Pending').trim().toLowerCase() === 'received' ? (
                        <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
                          Received
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => openViewModal(item)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        title="View"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {hasGrantedQuantity(item) && !isReceivedRequest(item) && (
                        <button
                          type="button"
                          onClick={() => markAsReceived(item)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                          title="Mark as received"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!hasGrantedQuantity(item) && !isReceivedRequest(item) && (
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!hasGrantedQuantity(item) && !isReceivedRequest(item) && (
                        <button
                          type="button"
                          onClick={() => confirmDelete(item.id)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-slate-500">
                      No requests created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {isCreateModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
              <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center">
                      <PlusCircle className="w-5 h-5 mr-2 text-indigo-600" /> {editingRequestId ? 'Edit Stationary Indent' : 'Create Stationary Indent'}
                    </h2>
                  </div>
                  <button
                    onClick={() => setIsCreateModalOpen(false)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <ArrowLeft className="w-4 h-4 inline mr-2" /> Close
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                  {message && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{message}</span>
                    </div>
                  )}

                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Reason *</label>
                      <input
                        type="text"
                        name="reason"
                        value={formData.reason}
                        onChange={handleChange}
                        placeholder="Enter reason for this indent"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={addIndentRow}
                      className="inline-flex items-center justify-center rounded-full bg-indigo-600 text-white w-10 h-10 hover:bg-indigo-700 shrink-0"
                      title="Add row"
                    >
                      <PlusCircle className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                          <th className="px-4 py-3 font-medium">S.No</th>
                          <th className="px-4 py-3 font-medium">Item Name</th>
                          <th className="px-4 py-3 font-medium">Request Quantity</th>
                          <th className="px-4 py-3 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {indentItems.map((row, index) => (
                          <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">{index + 1}</td>
                            <td className="px-4 py-3 min-w-[220px]">
                              <select
                                value={row.stationaryId}
                                onChange={(e) => updateIndentRow(row.id, 'stationaryId', e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="">Select item</option>
                                {stationaries.map((stationary) => (
                                  <option key={stationary.id} value={stationary.id}>
                                    {stationary.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 min-w-[180px]">
                              <input
                                type="number"
                                min="1"
                                value={row.requestQuantity}
                                onChange={(e) => updateIndentRow(row.id, 'requestQuantity', e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Qty"
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              {index > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => removeIndentRow(row.id)}
                                  className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 hover:bg-red-100"
                                  title="Remove row"
                                >
                                  <MinusCircle className="w-4 h-4" />
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400">Default row</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        resetModal();
                        setIsCreateModalOpen(false);
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                      <PlusCircle className="w-4 h-4" />
                      {isSubmitting ? 'Saving...' : editingRequestId ? 'Update Stationary Indent' : 'Create Stationary Indent'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {isViewModalOpen && selectedRequest && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
              <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-white shadow-xl overflow-y-auto flex flex-col">
                <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 sticky top-0 bg-white z-10">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center">
                      <FileText className="w-5 h-5 mr-2 text-indigo-600" /> Request Details
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Review the full stationery request.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={printSelectedRequest}
                      className="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                      title="Print"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setIsViewModalOpen(false)}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-2 text-sm text-slate-700">
                    <div className="text-center space-y-1">
                      <h3 className="text-lg font-bold text-slate-900">KLS Gogte Institute of Technology, Belgaum</h3>
                      <p className="font-semibold text-slate-900">Indent</p>
                    </div>
                    <div className="space-y-1 leading-6 text-left">
                      <p>To,</p>
                      <p>The Principal</p>
                      <p>Gogte Institute Of Technology</p>
                      <p>Udyambag, Belgaum-590008</p>
                      <p>Please arrange to supply the following:</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="sm:col-span-2">
                      <p className="text-slate-500">Reason</p>
                      <p className="font-medium text-slate-800">{selectedRequest.reason || '-'}</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                          <th className="px-4 py-3 font-medium">S.No</th>
                          <th className="px-4 py-3 font-medium">Item</th>
                          <th className="px-4 py-3 font-medium">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(selectedRequest.items || []).map((item, index) => (
                          <tr key={`${item.stationaryId}-${index}`}>
                            <td className="px-4 py-3 text-sm text-slate-700">{index + 1}</td>
                            <td className="px-4 py-3 text-sm text-slate-700">{item.itemName || '-'}</td>
                            <td className="px-4 py-3 text-sm text-slate-700">{item.requestQuantity || '-'}</td>
                          </tr>
                        ))}
                        {(selectedRequest.items || []).length === 0 && (
                          <tr>
                            <td colSpan="3" className="px-4 py-6 text-center text-slate-500">
                              No items found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pt-2">
                    <div>
                      <p className="text-slate-500">Department</p>
                      <p className="font-medium text-slate-800">{selectedRequest.departmentName || selectedRequest.department || '-'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Date</p>
                      <p className="font-medium text-slate-800">{selectedRequest.createdAt || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {deleteTargetId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
              <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden p-6 space-y-4">
                <h2 className="text-xl font-bold text-slate-800">Delete Request</h2>
                <p className="text-sm text-slate-600">This will permanently remove the selected stationery indent from the table.</p>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteTargetId(null)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={deleteRequest}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {selectedRequest && (
        <div className="hidden print:block print:p-8 print:text-black">
          <div className="mx-auto max-w-4xl space-y-6">
            <div className="text-center space-y-1">
              <h3 className="text-xl font-bold">KLS Gogte Institute of Technology, Belgaum</h3>
              <p className="font-semibold">Indent</p>
            </div>

            <div className="space-y-1 leading-6 text-left text-sm">
              <p>To,</p>
              <p>The Principal</p>
              <p>Gogte Institute Of Technology</p>
              <p>Udyambag, Belgaum-590008</p>
              <p>Please arrange to supply the following:</p>
            </div>

            <div className="text-sm">
              <p className="text-gray-600">Reason</p>
              <p className="font-medium text-gray-900">{selectedRequest.reason || '-'}</p>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-300">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-gray-100 text-xs uppercase tracking-wider text-gray-700">
                    <th className="border border-gray-300 px-4 py-3 font-medium">S.No</th>
                    <th className="border border-gray-300 px-4 py-3 font-medium">Item</th>
                    <th className="border border-gray-300 px-4 py-3 font-medium">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedRequest.items || []).map((item, index) => (
                    <tr key={`${item.stationaryId}-${index}`}>
                      <td className="border border-gray-300 px-4 py-2">{index + 1}</td>
                      <td className="border border-gray-300 px-4 py-2">{item.itemName || '-'}</td>
                      <td className="border border-gray-300 px-4 py-2">{item.requestQuantity || '-'}</td>
                    </tr>
                  ))}
                  {(selectedRequest.items || []).length === 0 && (
                    <tr>
                      <td colSpan="3" className="border border-gray-300 px-4 py-6 text-center">
                        No items found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-6 text-sm pt-2">
              <div>
                <p className="text-gray-600">Department</p>
                <p className="font-medium text-gray-900">{selectedRequest.departmentName || selectedRequest.department || '-'}</p>
              </div>
              <div>
                <p className="text-gray-600">Date</p>
                <p className="font-medium text-gray-900">{selectedRequest.createdAt || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isChangePasswordOpen && (
        <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />
      )}
    </div>
  );
}
