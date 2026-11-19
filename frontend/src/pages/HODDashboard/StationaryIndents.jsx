import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Eye, Check, X, Loader2, FileText, Plus, Minus, PlusCircle } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { formatDate as formatShortDate } from '../../utils/formatDate';

const createEmptyRow = () => ({ id: `${Date.now()}-${Math.random()}`, stationaryId: '', requestQuantity: '' });

const STATUS_STYLES = {
  'pending': 'border-amber-200 bg-amber-50 text-amber-700',
  'hod approved': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'hod rejected': 'border-red-200 bg-red-50 text-red-700',
  'received': 'border-indigo-200 bg-indigo-50 text-indigo-700'
};

const statusLabel = (status) => {
  const normalized = String(status || 'Pending').trim();
  return normalized || 'Pending';
};

const StatusBadge = ({ status }) => {
  const key = String(status || 'Pending').trim().toLowerCase();
  const style = STATUS_STYLES[key] || 'border-slate-200 bg-slate-50 text-slate-600';
  return (
    <span className={`inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium ${style}`}>
      {statusLabel(status)}
    </span>
  );
};

const normalizeIndent = (indent) => ({
  id: Number(indent.id),
  ownerId: indent.departmentId,
  reason: indent.reason || '',
  status: indent.status || 'Pending',
  hodRemark: indent.hodRemark || '',
  departmentName: indent.departmentName || indent.departmentId || '-',
  raisedByName: indent.raisedByName || indent.departmentName || '-',
  createdAt: formatShortDate(indent.createdAt),
  items: (indent.items || []).map((item) => ({
    id: Number(item.id),
    stationaryId: Number(item.stationaryId),
    itemName: item.stationaryName || `Item #${item.stationaryId}`,
    requestQuantity: Number(item.requestQuantity || 0),
    givenQuantity: Number(item.grantQuantity || item.givenQuantity || 0)
  }))
});

// Used by the HOD dashboard (default props) and by the Admin dashboard, where
// Admin reviews and raises IT Cell indents (departmentFilter="IT Cell", approverLabel="Admin").
export default function StationaryIndents({
  departmentFilter = '',
  allowCreate = true,
  approverLabel = 'HOD',
  description = 'Approve or reject stationery requests raised by your department, or raise your own (auto-approved).',
  emptyHint = "Requests raised by your department's stationary coordinators, and your own requests, appear here."
} = {}) {
  const { user } = useAuth();
  const [indents, setIndents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [remark, setRemark] = useState('');
  const [actionError, setActionError] = useState('');
  const [submittingAction, setSubmittingAction] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // HOD's own request form. Indents a HOD raises are auto-approved by the backend.
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [newReason, setNewReason] = useState('');
  const [newRows, setNewRows] = useState([createEmptyRow()]);
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const isOwnIndent = (indent) => Boolean(user?.id) && String(indent?.ownerId) === String(user.id);

  const openCreate = async () => {
    setNewReason('');
    setNewRows([createEmptyRow()]);
    setCreateError('');
    setSuccessMessage('');
    setIsCreateOpen(true);
    if (catalog.length) return;
    try {
      setIsCatalogLoading(true);
      const res = await api.get('/admin/stationaries');
      setCatalog(res.data.stationaries || []);
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Failed to load the stationery catalog.');
    } finally {
      setIsCatalogLoading(false);
    }
  };

  const closeCreate = () => {
    if (isCreating) return;
    setIsCreateOpen(false);
  };

  const updateRow = (rowId, field, value) => {
    setNewRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, [field]: value } : row)));
  };

  const buildCreateItems = () => newRows
    .filter((row) => row.stationaryId && Number(row.requestQuantity) > 0)
    .map((row) => ({ stationaryId: Number(row.stationaryId), requestQuantity: Number(row.requestQuantity) }));

  // Validate, then ask for confirmation: a HOD's indent is approved the moment
  // it is saved and can't be edited or deleted afterwards.
  const submitCreate = (e) => {
    e.preventDefault();
    if (!newReason.trim()) {
      setCreateError('Please enter a reason for the request.');
      return;
    }
    if (!buildCreateItems().length) {
      setCreateError('Add at least one item with a quantity greater than 0.');
      return;
    }
    setCreateError('');
    setIsConfirmOpen(true);
  };

  const confirmCreate = async () => {
    const items = buildCreateItems();
    try {
      setIsCreating(true);
      setCreateError('');
      const res = await api.post('/stationary-indents', { reason: newReason.trim(), items });
      const created = normalizeIndent(res.data.indent);
      setIndents((prev) => [created, ...prev]);
      setIsConfirmOpen(false);
      setIsCreateOpen(false);
      setSuccessMessage(`Stationary indent #${created.id} submitted and approved. It has been sent to Office Stationary.`);
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Failed to submit the stationary indent.');
      setIsConfirmOpen(false);
    } finally {
      setIsCreating(false);
    }
  };

  const markAsReceived = async () => {
    if (!selected) return;
    try {
      setSubmittingAction('received');
      setActionError('');
      const res = await api.put(`/stationary-indents/${selected.id}`, { status: 'Received' });
      const updated = normalizeIndent(res.data.indent);
      setIndents((prev) => prev.map((indent) => (indent.id === updated.id ? updated : indent)));
      closeDetails();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to mark the indent as received.');
    } finally {
      setSubmittingAction('');
    }
  };

  const loadIndents = async () => {
    try {
      setIsLoading(true);
      setError('');
      const indentRes = await api.get('/stationary-indents');
      const all = (indentRes.data.indents || []).map(normalizeIndent);
      setIndents(departmentFilter
        ? all.filter((indent) => String(indent.departmentName).trim() === departmentFilter)
        : all);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load stationary indents');
      setIndents([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadIndents();
  }, []);

  const openDetails = (indent) => {
    setSelected(indent);
    setRemark('');
    setActionError('');
  };

  const closeDetails = () => {
    setSelected(null);
    setRemark('');
    setActionError('');
    setSubmittingAction('');
  };

  const submitReview = async (action) => {
    if (!selected) return;
    if (action === 'reject' && !remark.trim()) {
      setActionError('Please enter a reason before rejecting.');
      return;
    }

    try {
      setSubmittingAction(action);
      setActionError('');
      const res = await api.put(`/stationary-indents/${selected.id}/approval`, {
        action,
        remark: remark.trim()
      });
      const updated = normalizeIndent(res.data.indent);
      setIndents((prev) => prev.map((indent) => (indent.id === updated.id ? updated : indent)));
      closeDetails();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update the indent.');
    } finally {
      setSubmittingAction('');
    }
  };

  const pendingCount = indents.filter((indent) => String(indent.status).trim().toLowerCase() === 'pending').length;

  const filteredIndents = useMemo(() => {
    if (statusFilter === 'All') return indents;
    return indents.filter((indent) => statusLabel(indent.status) === statusFilter);
  }, [indents, statusFilter]);

  const isPending = selected && String(selected.status).trim().toLowerCase() === 'pending';
  const canMarkReceived = selected
    && isOwnIndent(selected)
    && String(selected.status).trim().toLowerCase() === 'hod approved'
    && selected.items.some((item) => item.givenQuantity > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-800">
            {departmentFilter ? `${departmentFilter} Stationary Indents` : 'Stationary Indents'}
          </h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:shrink-0">
          {allowCreate && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" /> New Request
            </button>
          )}
          <span className="whitespace-nowrap rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
            {pendingCount} awaiting approval
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {['All', 'Pending', 'HOD Approved', 'HOD Rejected', 'Received'].map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4 font-medium">S.No</th>
                <th className="px-6 py-4 font-medium">Raised By</th>
                <th className="px-6 py-4 font-medium">Reason</th>
                <th className="px-6 py-4 font-medium">Items</th>
                <th className="px-6 py-4 font-medium">Request Date</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading stationary indents...</span>
                  </td>
                </tr>
              ) : filteredIndents.length > 0 ? filteredIndents.map((indent, index) => (
                <tr key={indent.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-slate-800">{index + 1}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {indent.raisedByName}
                    {isOwnIndent(indent) && (
                      <span className="ml-2 rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">You</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 max-w-[320px] truncate">{indent.reason || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{indent.items.length} item(s)</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{indent.createdAt || '-'}</td>
                  <td className="px-6 py-4"><StatusBadge status={indent.status} /></td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => openDetails(indent)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {String(indent.status).trim().toLowerCase() === 'pending' ? 'Review' : 'View'}
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <ClipboardList className="w-12 h-12 text-slate-300 mb-3" />
                      <p className="text-base font-medium text-slate-600">No stationary indents found</p>
                      <p className="text-sm">{emptyHint}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-white shadow-xl overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-200 flex items-start justify-between gap-4 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-indigo-600" /> Stationary Indent #{selected.id}
                </h2>
                <p className="text-sm text-slate-500 mt-1">Raised by {selected.raisedByName}</p>
              </div>
              <button
                onClick={closeDetails}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Reason</p>
                  <p className="font-medium text-slate-800">{selected.reason || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Request Date</p>
                  <p className="font-medium text-slate-800">{selected.createdAt || '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Status</p>
                  <StatusBadge status={selected.status} />
                </div>
              </div>

              {selected.hodRemark && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <span className="font-medium text-slate-800">{approverLabel} remark: </span>{selected.hodRemark}
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3 font-medium">S.No</th>
                      <th className="px-4 py-3 font-medium">Item</th>
                      <th className="px-4 py-3 font-medium">Requested Quantity</th>
                      <th className="px-4 py-3 font-medium">Given Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selected.items.length > 0 ? selected.items.map((item, index) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-sm text-slate-700">{index + 1}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{item.itemName || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{item.requestQuantity || '-'}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{item.givenQuantity || '-'}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-slate-500">No items found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {isPending && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Remark <span className="text-slate-400">(required to reject)</span>
                  </label>
                  <textarea
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    rows={3}
                    placeholder="Add a note for the coordinator (mandatory when rejecting)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {actionError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>
              )}
            </div>

            {canMarkReceived && (
              <div className="flex justify-end gap-3 p-6 border-t border-slate-200 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={markAsReceived}
                  disabled={Boolean(submittingAction)}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submittingAction === 'received' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Mark as received
                </button>
              </div>
            )}

            {isPending && (
              <div className="flex justify-end gap-3 p-6 border-t border-slate-200 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => submitReview('reject')}
                  disabled={Boolean(submittingAction)}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  {submittingAction === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => submitReview('approve')}
                  disabled={Boolean(submittingAction)}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submittingAction === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Approve
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {allowCreate && isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <form
            onSubmit={submitCreate}
            className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-white shadow-xl overflow-y-auto flex flex-col"
          >
            <div className="p-6 border-b border-slate-200 flex items-start justify-between gap-4 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center">
                  <PlusCircle className="w-5 h-5 mr-2 text-indigo-600" /> New Stationary Indent
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  As {approverLabel}, your request is approved on submission and goes straight to Office Stationary.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreate}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
                <textarea
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  rows={2}
                  placeholder="Why is this stationery needed?"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Items</span>
                  <button
                    type="button"
                    onClick={() => setNewRows((prev) => [...prev, createEmptyRow()])}
                    className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add item
                  </button>
                </div>

                {isCatalogLoading ? (
                  <p className="inline-flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading catalog...
                  </p>
                ) : newRows.map((row, index) => (
                  <div key={row.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      value={row.stationaryId}
                      onChange={(e) => updateRow(row.id, 'stationaryId', e.target.value)}
                      className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select item</option>
                      {catalog.map((stationary) => (
                        <option key={stationary.id} value={stationary.id}>
                          {stationary.name}{stationary.specification ? ` (${stationary.specification})` : ''}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={row.requestQuantity}
                        onChange={(e) => updateRow(row.id, 'requestQuantity', e.target.value)}
                        placeholder="Qty"
                        className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => setNewRows((prev) => prev.filter((entry) => entry.id !== row.id))}
                          className="rounded-md border border-red-200 bg-red-50 p-2 text-red-700 hover:bg-red-100"
                          title="Remove item"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {createError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{createError}</div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-slate-200 sticky bottom-0 bg-white">
              <button
                type="submit"
                disabled={isCreating || isCatalogLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Submit Request
              </button>
            </div>
          </form>
        </div>
      )}

      {isCreateOpen && isConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-hod-indent-title"
            className="w-full max-w-md rounded-2xl bg-white shadow-xl"
          >
            <div className="p-6 space-y-3">
              <h3 id="confirm-hod-indent-title" className="text-lg font-bold text-slate-800">
                Submit this stationary indent?
              </h3>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                As {approverLabel}, your request will be <span className="font-semibold">approved immediately</span> and sent
                to Office Stationary. It <span className="font-semibold">cannot be edited or deleted</span> after submission.
              </div>
              <div className="text-sm text-slate-700">
                <p><span className="text-slate-500">Reason:</span> {newReason.trim()}</p>
                <ul className="mt-2 list-disc pl-5 space-y-0.5">
                  {buildCreateItems().map((item, index) => {
                    const stationary = catalog.find((entry) => Number(entry.id) === item.stationaryId);
                    return (
                      <li key={index}>
                        {stationary?.name || `Item #${item.stationaryId}`} × {item.requestQuantity}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isCreating}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={confirmCreate}
                disabled={isCreating}
                autoFocus
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Yes, submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
