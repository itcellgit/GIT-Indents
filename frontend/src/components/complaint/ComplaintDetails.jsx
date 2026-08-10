import React, { useState, useEffect } from 'react';
import { X, MapPin, Tag, User, AlignLeft, Calendar, Wrench, Check, Printer, Building, Image as ImageIcon } from 'lucide-react';
import Timeline from './Timeline';
import MaterialForm from './MaterialForm';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
const ComplaintDetails = ({ complaint, onClose, onUpdateStatus, onResolve }) => {
  const { user } = useAuth();
  const [workerList, setWorkerList] = useState(complaint.assignedWorkerNames || []);
  
  const [isMaterialLogOpen, setIsMaterialLogOpen] = useState(false);
  const [isMaintainerModalOpen, setIsMaintainerModalOpen] = useState(false);
  const [maintainers, setMaintainers] = useState([]);
  const [selectedMaintainerId, setSelectedMaintainerId] = useState('');
  
  // Approval Flow States
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    location: complaint.location,
    natureOfWork: complaint.natureOfWork || complaint.workType,
    description: complaint.description
  });
  const [rejectionReason, setRejectionReason] = useState(complaint.rejectionReason || '');
  const [showRejectionInput, setShowRejectionInput] = useState(false);

  // Restore Missing State Hooks
  const [newWorker, setNewWorker] = useState('');
  const [materials, setMaterials] = useState(complaint.materialsUsed || complaint.materials || []);
  const [remarks, setRemarks] = useState(complaint.remarksByHOD || complaint.remarks || '');
  const [inchargeRemarks, setInchargeRemarks] = useState(complaint.remarksByIncharge || '');
  const [coordinatorRemarks, setCoordinatorRemarks] = useState(complaint.remarksByCoordinator || '');
  const [duration, setDuration] = useState(complaint.durationRequiredHours || 0);
  const [delayReason, setDelayReason] = useState(complaint.reasonForDelayedWork || '');

  // Check if current user is the incharge of the Category (Maintenance HOD)
  const isIncharge = user &&
    user.role === 'HOD' &&
    complaint.category && (
      (complaint.category.incharge && (
        (complaint.category.incharge.id && user.id === complaint.category.incharge.id) ||
        (typeof complaint.category.incharge === 'string' && user.id === complaint.category.incharge)
      )) ||
      (complaint.category.inchargeId && user.id === complaint.category.inchargeId)
    );
  
  // Check if current user is the HOD of the Requester's Department
  const isDeptHOD = user && user.role === 'HOD' && (complaint.requester || complaint.requesterId) && (user.department === (complaint.requester?.department || complaint.requesterId?.department));

  // Check if current user is the Principal
  const isPrincipal = user && user.role === 'Principal';

  // Check if current user is the Maintainer
  const isMaintainer = user && user.role === 'Maintainer' && complaint.maintainerId === user.id;

  // Check if current user is any Maintainer acting on the Approval Queue (not necessarily assigned to this indent)
  const isMaintainerRole = user && user.role === 'Maintainer';
  const APPROVAL_QUEUE_STATUSES = ['Indent Created', 'Approved by Dept HOD', 'Rejected by Maintenance HOD', 'Rejected by Dept HOD', 'Approved by Principal', 'Rejected by Principal'];


  // Reset local state if complaint changes
  useEffect(() => {
    if (complaint) {
      setWorkerList(complaint.assignedWorkerNames || []);
      setMaterials(complaint.materialsUsed || complaint.materials || []);
      setRemarks(complaint.remarksByHOD || complaint.remarks || '');
      setInchargeRemarks(complaint.remarksByIncharge || '');
      setCoordinatorRemarks(complaint.remarksByCoordinator || '');
      setDuration(complaint.durationRequiredHours || 0);
      setDelayReason(complaint.reasonForDelayedWork || '');
      setEditFormData({
        location: complaint.location,
        natureOfWork: complaint.natureOfWork || complaint.workType,
        description: complaint.description
      });
      setRejectionReason(complaint.rejectionReason || '');
    }
  }, [complaint]);

  useEffect(() => {
    if (isIncharge) {
      api.get('/hod/maintainers')
        .then(res => setMaintainers(res.data.maintainers || []))
        .catch(err => console.error("Failed to fetch maintainers", err));
    }
  }, [isIncharge]);

  if (!complaint) return null;

  const handleAddWorker = () => {
    if (!newWorker.trim()) return;
    if (workerList.includes(newWorker.trim())) return;
    setWorkerList([...workerList, newWorker.trim()]);
    setNewWorker('');
  };

  const handleRemoveWorker = (idx) => {
    setWorkerList(workerList.filter((_, i) => i !== idx));
  };

  const handleAssign = () => {
    // Making worker list optional as per user request
    onUpdateStatus(complaint._id || complaint.id, {
      status: 'In Progress',
      assignedWorkerNames: workerList,
      durationRequiredHours: duration ? parseFloat(duration) : null,
      remarksByIncharge: inchargeRemarks
    });
  };

  const handleMarkInProgress = () => {
    onUpdateStatus(complaint._id || complaint.id, { status: 'In Progress' });
  };

  const handleSaveDetails = () => {
    const updates = {
      assignedWorkerNames: workerList,
      durationRequiredHours: duration ? parseFloat(duration) : null,
      reasonForDelayedWork: delayReason,
      remarksByIncharge: inchargeRemarks,
      remarksByCoordinator: coordinatorRemarks,
      remarksByHOD: remarks,
      materialsUsed: materials
        .filter(m => (m.itemName && m.itemName.trim() !== '') || (m.quantity && m.quantity.toString().trim() !== ''))
        .map(m => ({ ...m, quantity: parseFloat(m.quantity) || 0 }))
    };

    if (complaint.status === 'Approved by Maintenance HOD' && isIncharge) {
      updates.status = 'In Progress';
    }

    onUpdateStatus(complaint._id || complaint.id, updates);
    alert('Maintenance logs and progress saved to indent successfully!');
    if (isMaterialLogOpen) setIsMaterialLogOpen(false);
  };

  const handleResolve = () => {
    // Official remark is now optional per user request
    if (materials.length > 0 && materials.some(m => (m.itemName || m.quantity) && (!m.itemName || !m.quantity))) {
      return alert('Please fill complete details for added materials or remove empty rows.');
    }

    onResolve(complaint._id || complaint.id, {
      materials: materials
        .filter(m => (m.itemName && m.itemName.trim() !== '') || (m.quantity && m.quantity.toString().trim() !== ''))
        .map(m => ({ ...m, quantity: parseFloat(m.quantity) || 0 })),
      remarks,
      remarksByIncharge: inchargeRemarks,
      remarksByCoordinator: coordinatorRemarks,
      duration: duration ? parseFloat(duration) : null,
      delayReason,
      resolvedDetails: {
        resolvedBy: 'System HOD',
        resolvedAt: new Date().toISOString()
      }
    });
  };

  const handleApprove = () => {
    let newStatus = 'Approved by Dept HOD';
    if (isMaintainerRole) {
      newStatus = 'Approved by Maintenance HOD';
    } else if (isPrincipal) {
      newStatus = 'Approved by Principal';
    } else if (isIncharge && (complaint.status === 'Approved by Dept HOD' || complaint.status === 'Approved by Principal')) {
      newStatus = 'Approved by Maintenance HOD';
    } else if (isDeptHOD) {
      newStatus = 'Approved by Dept HOD';
    }
    
    onUpdateStatus(complaint._id || complaint.id, {
      status: newStatus,
      ...editFormData
    });
    setIsEditing(false);
    alert('Indent Approved Successfully');
  };

  const handleReject = () => {
    const trimmedReason = rejectionReason.trim();
    if (!trimmedReason) {
      alert('Please enter rejection remarks before rejecting the indent.');
      return;
    }

    const rejecterInfo = isMaintainerRole ? `${user.name} (Maintainer)` : `${user.name} (${user.department})`;

    let newStatus = 'Rejected by Maintenance HOD';
    if (isMaintainerRole) {
      newStatus = 'Rejected by Maintenance HOD';
    } else if (isPrincipal) {
      newStatus = 'Rejected by Principal';
    } else if (isDeptHOD && !isIncharge) {
      newStatus = 'Rejected by Dept HOD';
    } else {
      newStatus = 'Rejected by Maintenance HOD';
    }

    onUpdateStatus(complaint._id || complaint.id, {
      status: newStatus,
      rejectionReason: trimmedReason,
      rejectedBy: rejecterInfo,
      remarksByHOD: trimmedReason
    });
    setShowRejectionInput(false);
  };

  const handleAssignToMaintainer = async () => {
    if (maintainers.length === 0) {
      alert("Please add a maintainer first in the Manage Maintainers tab.");
      return;
    }
    if (maintainers.length === 1) {
      submitMaintainerAssignment(maintainers[0].id);
    } else {
      setIsMaintainerModalOpen(true);
    }
  };

  const submitMaintainerAssignment = async (mId) => {
    try {
      const res = await api.put(`/hod/complaints/${complaint._id || complaint.id}/assign`, { maintainerId: mId });
      alert("Indent assigned to maintainer successfully!");
      setIsMaintainerModalOpen(false);
      onUpdateStatus(complaint._id || complaint.id, res.data.complaint); // Using this to trigger parent update
      onClose(); // Close the modal since it's now handled by someone else
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to assign maintainer");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm overflow-y-auto print-overlay"
      onClick={onClose}
    >
      {/* Modal Container */}
      <div 
        className="bg-white w-full max-w-5xl rounded-2xl shadow-xl flex flex-col max-h-[95vh] relative animate-in fade-in zoom-in duration-200 print-modal-content"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-800">Indent Details</h2>
            <span className="bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded text-sm font-semibold">
              {complaint.indentNumber || complaint.id}
            </span>
            <span className={`px-2.5 py-0.5 text-sm font-semibold rounded-md 
              ${complaint.status === 'Completed' ? 'bg-green-100 text-green-700' :
                complaint.status === 'In Progress' ? 'bg-indigo-100 text-indigo-700' :
                complaint.status.includes('Approved') || complaint.status.includes('Assigned') ? 'bg-blue-100 text-blue-700' :
                (complaint.status === 'Rejected by Maintenance HOD' || complaint.status === 'Rejected by Dept HOD') ? 'bg-red-100 text-red-700' :
                complaint.status === 'Rejected by Principal' ? 'bg-rose-100 text-rose-700' :
                'bg-cyan-100 text-cyan-700'}`
            }>
              {complaint.status}
            </span>
          </div>
          <div className="flex items-center gap-2 no-print">
            <button
              onClick={handlePrint}
              className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-full transition-colors"
              title="Print Indent Report"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body - Scrollable */}
        <div className="p-6 overflow-y-auto custom-scrollbar">

          {/* Top Section: Basic Info & Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-8">

            {/* Basic Info */}
            <div className="space-y-4 lg:col-span-3">
              <h3 className="text-lg font-semibold text-gray-800 mb-2 border-b pb-2">Information</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Raised By */}
                <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex items-center gap-4 transition-all hover:shadow-md">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 border border-blue-100">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">Raised By</p>
                    <p className="text-base font-bold text-gray-900 leading-tight truncate">{complaint.requester?.name || complaint.raisedBy}</p>
                  </div>
                </div>

                {/* 2. Work Type */}
                <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex items-center gap-4 transition-all hover:shadow-md">
                  <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0 border border-purple-100">
                    <Tag className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">Work Type</p>
                    {isEditing ? (
                      <select 
                        className="text-sm font-semibold text-gray-900 border-b-2 border-purple-200 focus:border-purple-600 outline-none w-full bg-transparent pb-1" 
                        value={editFormData.natureOfWork}
                        onChange={(e) => setEditFormData({...editFormData, natureOfWork: e.target.value})}
                      >
                        <option value="Maintenance/Repair">Maintenance/Repair</option>
                        <option value="New Work">New Work</option>
                      </select>
                    ) : (
                      <p className="text-base font-bold text-gray-900 leading-tight truncate">{complaint.natureOfWork || complaint.workType}</p>
                    )}
                  </div>
                </div>

                {/* 3. Location */}
                <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex items-center gap-4 transition-all hover:shadow-md">
                  <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center flex-shrink-0 border border-rose-100">
                    <MapPin className="w-6 h-6 text-rose-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">Location</p>
                    {isEditing ? (
                      <input 
                        className="text-sm font-semibold text-gray-900 border-b-2 border-rose-200 focus:border-rose-600 outline-none w-full bg-transparent pb-1" 
                        value={editFormData.location} 
                        onChange={(e) => setEditFormData({...editFormData, location: e.target.value})}
                      />
                    ) : (
                      <p className="text-base font-bold text-gray-900 leading-tight truncate">{complaint.location}</p>
                    )}
                  </div>
                </div>

                {/* 4. Created Date */}
                <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex items-center gap-4 transition-all hover:shadow-md">
                  <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0 border border-orange-100">
                    <Calendar className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">Created Date</p>
                    <p className="text-base font-bold text-gray-900 leading-tight">{new Date(complaint.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* 5. Assigned Maintenance Dept */}
                <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex items-center gap-4 sm:col-span-2 transition-all hover:shadow-md">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 border border-emerald-100">
                    <Building className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">Assigned Dept.</p>
                    <p className="text-lg font-bold text-gray-900 leading-tight">{complaint.category?.name || 'Unassigned'}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-inner">
                <div className="flex items-center gap-2 mb-3 border-b border-slate-200 pb-2">
                  <AlignLeft className="w-5 h-5 text-indigo-500" />
                  <p className="text-sm text-indigo-900 uppercase tracking-widest font-bold">Description</p>
                </div>
                {isEditing ? (
                  <textarea 
                    className="text-base font-medium text-gray-900 border border-slate-300 rounded-lg p-3 w-full min-h-[120px] focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                  />
                ) : (
                  <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap font-medium">
                    {complaint.description}
                  </p>
                )}
              </div>

              {complaint.imagePath && (
                <div className="mt-6 bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-inner print:hidden">
                  <div className="flex items-center gap-2 mb-3 border-b border-slate-200 pb-2">
                    <ImageIcon className="w-5 h-5 text-indigo-500" />
                    <p className="text-sm text-indigo-900 uppercase tracking-widest font-bold">Attachment</p>
                  </div>
                  <div className="mt-2">
                    <a href={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}${complaint.imagePath}`} target="_blank" rel="noopener noreferrer" className="block max-w-sm rounded-lg overflow-hidden border border-slate-300 hover:border-indigo-500 hover:shadow-md transition-all">
                      <img src={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}${complaint.imagePath}`} alt="Indent Attachment" className="w-full h-auto object-cover" />
                    </a>
                    <p className="text-xs text-slate-500 mt-2 italic">Click image to view full size.</p>
                  </div>
                </div>
              )}
              
              {(complaint.status === 'Rejected by HOD' || complaint.status === 'Rejected by Dept HOD' || complaint.status === 'Rejected by Principal') && (
                <div className="mt-4 bg-red-50 p-4 rounded-lg border border-red-100">
                  <p className="text-xs text-red-500 uppercase tracking-wider font-bold mb-1">
                    {complaint.rejectedBy ? `Rejected by ${complaint.rejectedBy}` : `Rejected by ${complaint.status === 'Rejected by Principal' ? 'Principal' : (complaint.status === 'Rejected by Dept HOD' ? 'Dept HOD' : 'Maintenance HOD')}`}
                  </p>
                  {complaint.rejectionReason && (
                     <p className="text-sm text-red-700 italic mt-1">"{complaint.rejectionReason}"</p>
                  )}
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="bg-gray-50/50 p-6 rounded-xl border border-gray-100 shadow-sm no-print lg:col-span-2">
              <Timeline 
                currentStatus={complaint.status} 
                history={complaint.statusHistory}
                createdAt={complaint.createdAt}
                updatedAt={complaint.updatedAt}
              />
            </div>
          </div>

          {/* Resolved Materials View (Always show if resolved, for Admin/HOD on screen) */}
          <div className="no-print">
            {complaint.status === 'Completed' && materials.length > 0 && (
              <div className="mb-8 p-5 bg-emerald-50/30 rounded-xl border border-emerald-100 shadow-sm">
                 <h3 className="text-lg font-bold text-emerald-800 mb-4 flex items-center gap-2">
                  <Wrench className="w-5 h-5" />
                  Material Usage Details
                </h3>
                <div className="overflow-hidden border border-emerald-100 rounded-xl bg-white shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-emerald-50 text-emerald-800 font-bold border-b border-emerald-100">
                      <tr>
                        <th className="px-6 py-3">Item Name</th>
                        <th className="px-6 py-3">Quantity Used</th>
                        <th className="px-6 py-3">Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-50">
                      {materials.map((m, i) => (
                        <tr key={i} className="hover:bg-emerald-50/20 transition-colors">
                          <td className="px-6 py-3 text-gray-800 font-medium">{m.itemName}</td>
                          <td className="px-6 py-3 text-gray-600 font-semibold">{m.quantity}</td>
                          <td className="px-6 py-3 text-gray-600 font-semibold">{m.unit || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Print-Only Assignment & Materials Summary */}
          <div className="hidden print:block mb-8 break-inside-avoid">
            <h3 className="text-lg font-bold text-gray-800 mb-2 border-b pb-2">Work Assignment & Materials</h3>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Assigned Workers</p>
                <p className="text-gray-800">{workerList.length > 0 ? workerList.join(', ') : 'None assigned'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Estimated Duration</p>
                <p className="text-gray-800">{duration ? `${duration} Days` : 'Not specified'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Action Taken / Remarks by Incharge</p>
                <p className="text-gray-800">{inchargeRemarks || 'None'}</p>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2 mt-4">Material Usage Log</p>
            {materials.length > 0 ? (
              <table className="w-full text-left text-sm border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-2 border-r border-gray-200 text-gray-600 font-semibold">Item Name</th>
                    <th className="px-4 py-2 border-r border-gray-200 text-gray-600 font-semibold">Quantity Used</th>
                    <th className="px-4 py-2 text-gray-600 font-semibold">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m, i) => (
                    <tr key={i} className="border-b border-gray-200">
                      <td className="px-4 py-2 border-r border-gray-200 text-gray-800">{m.itemName}</td>
                      <td className="px-4 py-2 border-r border-gray-200 text-gray-800">{m.quantity}</td>
                      <td className="px-4 py-2 text-gray-800">{m.unit || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="border border-gray-200 rounded p-3 text-center">
                <p className="text-sm text-gray-500 italic">No materials used</p>
              </div>
            )}
          </div>

          {/* Assignment Section (Show if Pending or Assigned AND User is Incharge or Maintainer) */}
          {(isIncharge || isMaintainer) && complaint.status !== 'Completed' && (complaint.status === 'Approved by Maintenance HOD' || complaint.status === 'In Progress' || complaint.isMaintainerCompleted) && (
            <div className="mb-8 p-5 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-4 shadow-sm no-print">
              <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                Work Planning & Assignment
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign Worker(s) One by One</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newWorker}
                      onChange={(e) => setNewWorker(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddWorker()}
                      placeholder="e.g. Ramesh - Electrician"
                      className="flex-1 border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2 border outline-none bg-white"
                    />
                    <button
                      onClick={handleAddWorker}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>

                  {/* Worker Chips */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {workerList.length > 0 ? workerList.map((w, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-full text-xs font-semibold shadow-sm">
                        {w}
                        <button onClick={() => handleRemoveWorker(idx)} className="text-indigo-400 hover:text-indigo-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    )) : (
                      <span className="text-xs text-slate-400 italic">No workers assigned yet.</span>
                    )}
                  </div>
                </div>

                <div className="w-full"> 
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Duration (Days)</label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 2"
                    className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-4 py-2 border outline-none bg-white font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action Taken / Remarks by Incharge</label>
                <textarea
                  rows={2}
                  value={inchargeRemarks}
                  onChange={(e) => setInchargeRemarks(e.target.value)}
                  placeholder="Details of initial action taken..."
                  className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border outline-none bg-white font-medium italic"
                />
              </div>

              <div className="flex justify-between items-center bg-white/50 p-4 rounded-lg border border-indigo-100 shadow-inner">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Material Usage Log</span>
                  <span className="text-sm font-bold text-indigo-700">{materials.filter(m => (m.itemName && m.itemName.trim() !== '') || (m.quantity && m.quantity.toString().trim() !== '')).length} Items Recorded</span>
                </div>
                <button
                  onClick={() => setIsMaterialLogOpen(true)}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all border border-indigo-500 shadow-md shadow-indigo-100"
                >
                  <Wrench className="w-4 h-4" />
                  Open Material Log
                </button>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleSaveDetails}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-md transform active:scale-95"
                >
                  {(isIncharge && complaint.status === 'Approved by Maintenance HOD') ? 'Finalize Assignment & Save' : 'Save All Progress'}
                </button>
                {isMaintainer && (complaint.status === 'In Progress' || complaint.status === 'Approved by Maintenance HOD') && !complaint.isMaintainerCompleted && (
                  <button
                    onClick={() => {
                      if (materials.length > 0 && materials.some(m => (m.itemName || m.quantity) && (!m.itemName || !m.quantity))) {
                        return alert('Please fill complete details for added materials or remove empty rows.');
                      }
                      onUpdateStatus(complaint._id || complaint.id, {
                        isMaintainerCompleted: true,
                        assignedWorkerNames: workerList,
                        durationRequiredHours: duration ? parseFloat(duration) : null,
                        materialsUsed: materials.filter(m => m.itemName && m.quantity).map(m => ({ ...m, quantity: parseFloat(m.quantity) || 0 }))
                      });
                    }}
                    className="bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-green-700 transition-colors shadow-md transform active:scale-95"
                  >
                    Complete Work
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Read-Only Assignment Section for Non-Incharge Users */}
          {((!isIncharge && !isMaintainer) || complaint.status === 'Completed') && (complaint.status === 'Approved by Maintenance HOD' || complaint.status === 'In Progress' || complaint.status === 'Completed' || complaint.isMaintainerCompleted) && (
            <div className="mb-8 p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4 shadow-sm no-print">
              <h3 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-600" />
                Work Assignment & Planning Info
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Assigned Workers</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {workerList.length > 0 ? workerList.map((w, idx) => (
                      <span key={idx} className="inline-flex items-center px-3 py-1 bg-white border border-slate-200 text-slate-700 rounded-full text-xs font-semibold shadow-sm">
                        {w}
                      </span>
                    )) : (
                      <span className="text-xs text-slate-400 italic">No workers assigned yet.</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Estimated Duration</span>
                  <p className="text-sm font-semibold text-slate-800 mt-1">{duration ? `${duration} Days` : "Not Specified"}</p>
                  
                  {complaint.status === 'Completed' && (
                    <div className="mt-3">
                      <span className="block text-xs font-bold text-green-500 uppercase tracking-widest mb-1">Actual Completion Time</span>
                      <p className="text-sm font-semibold text-slate-800 mt-1">
                        {(() => {
                          const start = new Date(complaint.createdAt);
                          const end = complaint.resolvedDetails?.resolvedAt ? new Date(complaint.resolvedDetails.resolvedAt) : new Date(complaint.updatedAt);
                          const diffTime = Math.abs(end - start);
                          const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
                          return `${diffDays} Day${diffDays !== 1 ? 's' : ''}`;
                        })()}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {inchargeRemarks && (
                <div className="pt-2">
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Action Taken / Remarks by Incharge</span>
                  <p className="text-sm text-gray-700 italic mt-1 bg-white p-3 rounded-lg border border-slate-100">"{inchargeRemarks}"</p>
                </div>
              )}
            </div>
          )}

          {/* Remarks Section */}
          {((isIncharge || isMaintainer || (delayReason && delayReason.trim() !== '')) || 
            (isIncharge || isMaintainer || (coordinatorRemarks && coordinatorRemarks.trim() !== '')) || 
            (isIncharge || isPrincipal || (remarks && remarks.trim() !== ''))) && (
            <div className="border-t border-gray-100 pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {((isIncharge || isMaintainer) && complaint.status !== 'Completed' || (delayReason && delayReason.trim() !== '')) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 font-semibold">Reason for Delayed Work (if any)</label>
                    <textarea
                      rows={1}
                      readOnly={!(isIncharge || isMaintainer) || complaint.status === 'Completed'}
                      value={delayReason}
                      onChange={(e) => setDelayReason(e.target.value)}
                      placeholder={(isIncharge || isMaintainer) ? "Explain reasons for any delays..." : "No delay reason provided."}
                      className={`w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border outline-none bg-white font-medium ${(!(isIncharge || isMaintainer) || complaint.status === 'Completed') && 'bg-gray-50 text-gray-500'}`}
                    />
                  </div>
                )}
                {((isIncharge || isMaintainer) && complaint.status !== 'Completed' || (coordinatorRemarks && coordinatorRemarks.trim() !== '')) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 font-semibold">Remark from Technical Coordinator</label>
                    <textarea
                      rows={1}
                      readOnly={!(isIncharge || isMaintainer) || complaint.status === 'Completed'}
                      value={coordinatorRemarks}
                      onChange={(e) => setCoordinatorRemarks(e.target.value)}
                      placeholder={(isIncharge || isMaintainer) ? "Notes from the coordinator..." : "No coordinator remarks."}
                      className={`w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border outline-none bg-white font-medium ${(!(isIncharge || isMaintainer) || complaint.status === 'Completed') && 'bg-gray-50 text-gray-500'}`}
                    />
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex flex-wrap justify-between items-center gap-3 no-print">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            Close Window
          </button>

          <div className="flex gap-3">
            {((isDeptHOD && (complaint.status === 'Indent Created' || complaint.status === 'Rejected by Maintenance HOD' || complaint.status === 'Rejected by Dept HOD')) ||
               (isIncharge && (complaint.status === 'Indent Created' || complaint.status === 'Approved by Principal' || complaint.status === 'Rejected by Maintenance HOD' || complaint.status === 'Rejected by Principal')) ||
               (isPrincipal && (complaint.status === 'Rejected by Maintenance HOD' || complaint.status === 'Rejected by Principal' || complaint.status === 'Indent Created')) ||
               (isMaintainerRole && APPROVAL_QUEUE_STATUSES.includes(complaint.status))) && (
              <>
                {!isEditing ? (
                  <>
                    {(isDeptHOD || isPrincipal || isMaintainerRole) && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="px-5 py-2 text-sm font-semibold text-indigo-600 bg-white border border-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors shadow-sm"
                      >
                        Edit Indent
                      </button>
                    )}
                    {isMaintainerRole && (
                      <>
                        {!complaint.status.includes('Rejected') && (
                          !showRejectionInput ? (
                            <button
                              onClick={() => setShowRejectionInput(true)}
                              className="px-5 py-2 text-sm font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors shadow-sm"
                            >
                              Reject Indent
                            </button>
                          ) : (
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                              <textarea 
                                rows={2}
                                placeholder="Enter rejection remarks..." 
                                className="text-sm border rounded px-3 py-2 w-full sm:w-72"
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                              />
                              <div className="flex gap-2">
                                <button onClick={handleReject} className="px-3 py-2 bg-red-600 text-white rounded text-sm font-bold">Confirm Reject</button>
                                <button onClick={() => setShowRejectionInput(false)} className="px-3 py-2 bg-gray-200 text-gray-700 rounded text-sm">Cancel</button>
                              </div>
                            </div>
                          )
                        )}
                        <button
                          onClick={handleApprove}
                          className="px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-md"
                        >
                          Approve Indent
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => {
                      onUpdateStatus(complaint._id || complaint.id, {
                        ...editFormData,
                        status: complaint.status
                      });
                      setIsEditing(false);
                    }} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold shadow-md">Save</button>
                    <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm">Cancel Edit</button>
                  </div>
                )}
              </>
            )}

            {isIncharge && (
              <>
                {complaint.status === 'Approved by Maintenance HOD' && (
                  <button
                    onClick={handleAssign}
                    className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
                  >
                    Start Assignment
                  </button>
                )}

                {(complaint.status === 'Approved by Maintenance HOD' || complaint.status === 'In Progress') && !complaint.maintainerId && (
                  <button
                    onClick={handleAssignToMaintainer}
                    className="px-6 py-2 text-sm font-bold text-indigo-700 bg-indigo-100 border border-indigo-300 rounded-lg hover:bg-indigo-200 transition-colors shadow-sm"
                  >
                    Assign to Maintainer
                  </button>
                )}

                {complaint.maintainerId && !complaint.isMaintainerCompleted && (
                  <span className="px-4 py-2 text-sm font-semibold text-amber-700 bg-amber-50 rounded-lg border border-amber-200">
                    Currently with Maintainer
                  </span>
                )}

                {(complaint.status === 'In Progress' || (complaint.isMaintainerCompleted && complaint.status !== 'Completed')) && (
                  <button
                    onClick={handleResolve}
                    className="px-6 py-2 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-md shadow-green-100"
                  >
                    {complaint.isMaintainerCompleted ? 'Verify & Complete' : 'Complete & Resolve'}
                  </button>
                )}
              </>
            )}

            {complaint.status === 'Completed' && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg border border-green-200 animate-pulse">
                <Check className="w-5 h-5" />
                <span className="text-sm font-bold">Completed Logs Saved</span>
              </div>
            )}
          </div>
        </div>

        {/* Material Log Modal Overlay */}
        {isMaterialLogOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in zoom-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 relative">
              <button onClick={() => setIsMaterialLogOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-800">Material Usage Log</h2>
                <p className="text-sm text-slate-500">Add or edit materials consumed for this maintenance work.</p>
              </div>
              <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <MaterialForm materials={materials} setMaterials={setMaterials} />
              </div>
              <div className="mt-6 flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button onClick={() => setIsMaterialLogOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">Cancel</button>
                <button onClick={handleSaveDetails} className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">Save Materials to Indent</button>
              </div>
            </div>
          </div>
        )}

        {/* Maintainer Selection Modal */}
        {isMaintainerModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in zoom-in duration-200">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
              <button onClick={() => setIsMaintainerModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-800">Select Maintainer</h2>
                <p className="text-sm text-slate-500 mt-1">Choose a maintainer to assign this indent to.</p>
              </div>
              
              <div className="space-y-3 max-h-[40vh] overflow-y-auto">
                {maintainers.map(m => (
                  <label key={m.id} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${selectedMaintainerId === m.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input 
                      type="radio" 
                      name="maintainer" 
                      className="mr-3 text-indigo-600 focus:ring-indigo-500" 
                      value={m.id}
                      checked={selectedMaintainerId === m.id}
                      onChange={() => setSelectedMaintainerId(m.id)}
                    />
                    <div>
                      <p className="font-semibold text-slate-800">{m.name}</p>
                      <p className="text-xs text-slate-500">{m.email}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button onClick={() => setIsMaintainerModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">Cancel</button>
                <button 
                  onClick={() => submitMaintainerAssignment(selectedMaintainerId)} 
                  disabled={!selectedMaintainerId}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  Confirm Assignment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComplaintDetails;
