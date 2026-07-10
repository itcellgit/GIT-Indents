import React from 'react';
import { XCircle, Clock, CheckCircle } from 'lucide-react';
import api from '../../api/axios';

const IndentDetailsModal = ({ selectedComplaint, setSelectedComplaint }) => {
  if (!selectedComplaint) return null;

  // Determine the base URL for images
  const baseUrl = api.defaults.baseURL ? api.defaults.baseURL.replace(/\/api\/?$/, '') : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-xl font-bold text-slate-800 flex items-center">
            Indent Details 
            <span className="ml-3 text-sm font-medium text-indigo-600 bg-indigo-100 px-2.5 py-1 rounded-md">
              {selectedComplaint.indentNumber || selectedComplaint.id}
            </span>
          </h3>
          <button 
            onClick={() => setSelectedComplaint(null)}
            className="text-slate-400 hover:text-slate-600 transition-colors bg-white rounded-full p-1 shadow-sm border border-slate-200"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto w-full grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left Column: Details */}
          <div className="lg:col-span-3 space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</h4>
              <p className="text-slate-800 bg-slate-50 p-4 rounded-lg border border-slate-100">{selectedComplaint.description}</p>
              {selectedComplaint.imagePath && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Attached Image</h4>
                  <img 
                    src={`${baseUrl}${selectedComplaint.imagePath}`} 
                    alt="Complaint Attachment" 
                    className="max-w-full h-auto rounded-lg border border-slate-200 shadow-sm"
                    style={{ maxHeight: '300px', objectFit: 'contain' }}
                  />
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="block text-xs font-semibold text-slate-400 uppercase">Raised By</span>
                <span className="block mt-1 font-medium text-slate-800">{selectedComplaint.requester?.name || 'Unknown'}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="block text-xs font-semibold text-slate-400 uppercase">Nature of Work</span>
                <span className="block mt-1 font-medium text-slate-800">{selectedComplaint.natureOfWork || selectedComplaint.category}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="block text-xs font-semibold text-slate-400 uppercase">Location</span>
                <span className="block mt-1 font-medium text-slate-800">{selectedComplaint.location}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="block text-xs font-semibold text-slate-400 uppercase">Assigned Worker</span>
                <span className="block mt-1 font-medium text-slate-800 text-sm">
                  {selectedComplaint.assignedWorkerNames?.length > 0 ? selectedComplaint.assignedWorkerNames.join(', ') : (selectedComplaint.workerName || "Not Assigned Yet")}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="block text-xs font-semibold text-slate-400 uppercase">Est. Duration</span>
                <span className="block mt-1 font-medium text-slate-800">
                  {selectedComplaint.durationRequiredHours ? `${selectedComplaint.durationRequiredHours} Days` : "Not Specified"}
                </span>
              </div>
              {selectedComplaint.status === 'Completed' && (
                <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                  <span className="block text-xs font-semibold text-green-600 uppercase">Actual Duration</span>
                  <span className="block mt-1 font-medium text-green-800">
                    {(() => {
                      const start = new Date(selectedComplaint.createdAt);
                      const end = selectedComplaint.resolvedDetails?.resolvedAt ? new Date(selectedComplaint.resolvedDetails.resolvedAt) : new Date(selectedComplaint.updatedAt);
                      const diffTime = Math.abs(end - start);
                      const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
                      return `${diffDays} Day${diffDays !== 1 ? 's' : ''}`;
                    })()}
                  </span>
                </div>
              )}
            </div>

            {selectedComplaint.remarksByIncharge && (
              <div className="bg-indigo-50/30 p-4 rounded-lg border border-indigo-100/50">
                <h4 className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-2">Initial Action / Incharge Remarks</h4>
                <p className="text-slate-700 text-sm">{selectedComplaint.remarksByIncharge}</p>
              </div>
            )}

            {selectedComplaint.reasonForDelayedWork && (
              <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-100">
                <h4 className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">Reason for Delay</h4>
                <p className="text-slate-700 text-sm italic">{selectedComplaint.reasonForDelayedWork}</p>
              </div>
            )}

            {(selectedComplaint.status === 'Rejected by HOD' || selectedComplaint.status === 'Rejected by Dept HOD') && selectedComplaint.rejectionReason && (
              <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                <h4 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">Reason for Rejection</h4>
                <p className="text-red-700 text-sm italic">"{selectedComplaint.rejectionReason}"</p>
              </div>
            )}

            {((selectedComplaint.materialsUsed && selectedComplaint.materialsUsed.length > 0) || (selectedComplaint.materials && selectedComplaint.materials.length > 0)) && (
              <div>
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Materials Used</h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-slate-600">Item</th>
                        <th className="px-4 py-2 text-right font-medium text-slate-600">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(selectedComplaint.materialsUsed || selectedComplaint.materials).map((m, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 text-slate-800">{m.itemName || m.item}</td>
                          <td className="px-4 py-2 text-right text-slate-600 bg-slate-50 font-medium">{m.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {selectedComplaint.remarksByCoordinator && (
                <div className="border-l-4 border-slate-300 pl-4 py-1">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Coordinator Remark</h4>
                  <p className="text-slate-700 text-sm">{selectedComplaint.remarksByCoordinator}</p>
                </div>
              )}
              {(selectedComplaint.remarksByHOD || selectedComplaint.remarks) && (
                <div className="border-l-4 border-indigo-500 pl-4 py-1">
                  <h4 className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-1">Final HOD Remark</h4>
                  <p className="text-slate-800 text-sm font-medium italic">
                    {selectedComplaint.remarksByHOD || selectedComplaint.remarks}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Timeline & Actions */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
              <h4 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4 flex items-center">
                <Clock className="w-4 h-4 mr-2 text-slate-400" />
                Status Timeline
              </h4>
              <div className="relative border-l-2 border-indigo-100 ml-3 space-y-6">
                {(selectedComplaint.statusHistory && selectedComplaint.statusHistory.length > 0
                  ? selectedComplaint.statusHistory.map(item => ({ status: item.status, date: new Date(item.timestamp).toLocaleString() }))
                  : [{ status: 'Indent Created', date: new Date(selectedComplaint.createdAt).toLocaleString() }, { status: selectedComplaint.status, date: new Date(selectedComplaint.updatedAt || selectedComplaint.createdAt).toLocaleString() }]
                ).map((event, idx, arr) => {
                  const isLast = idx === arr.length - 1;
                  const isRejected = event.status.includes('Rejected');
                  return (
                    <div key={idx} className="relative pl-6">
                      <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${isLast ? (isRejected ? 'bg-red-600' : 'bg-indigo-600') : 'bg-slate-300'}`}></div>
                      <div>
                        <p className={`text-sm font-bold ${isLast ? (isRejected ? 'text-red-600' : 'text-indigo-600') : 'text-slate-600'}`}>{event.status}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{event.date}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedComplaint.status === "Resolved" && (
              <div className="bg-green-50 border border-green-100 p-4 rounded-xl flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-sm text-green-800 font-medium">Issue Resolved and Closed</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IndentDetailsModal;
