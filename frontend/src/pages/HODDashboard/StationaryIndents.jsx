import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Eye, Check, X, Loader2, FileText } from 'lucide-react';
import api from '../../api/axios';
import { formatDate as formatShortDate } from '../../utils/formatDate';

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

export default function StationaryIndents() {
  const [indents, setIndents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [remark, setRemark] = useState('');
  const [actionError, setActionError] = useState('');
  const [submittingAction, setSubmittingAction] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const loadIndents = async () => {
    try {
      setIsLoading(true);
      setError('');
      const indentRes = await api.get('/stationary-indents');
      setIndents((indentRes.data.indents || []).map(normalizeIndent));
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Stationary Indents</h2>
          <p className="text-sm text-slate-500">Approve or reject stationery requests raised by your department.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
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
                  <td className="px-6 py-4 text-sm text-slate-600">{indent.raisedByName}</td>
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
                      <p className="text-sm">Requests raised by your department's stationary coordinators appear here.</p>
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
                  <span className="font-medium text-slate-800">HOD remark: </span>{selected.hodRemark}
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
    </div>
  );
}
