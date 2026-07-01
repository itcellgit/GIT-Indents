import React, { useState } from 'react';
import { XCircle, Clock, CheckCircle, Save, Plus, Trash2, Wrench } from 'lucide-react';
import api from '../../api/axios';

const MaintainerIndentDetailsModal = ({ selectedComplaint, setSelectedComplaint, refreshData }) => {
  const [workers, setWorkers] = useState(
    selectedComplaint?.assignedWorkerNames?.length > 0 
      ? selectedComplaint.assignedWorkerNames.join(', ') 
      : ''
  );
  const [duration, setDuration] = useState(selectedComplaint?.durationRequiredHours || '');
  const [materials, setMaterials] = useState(
    selectedComplaint?.materialsUsed?.length > 0
      ? selectedComplaint.materialsUsed.map(m => ({ itemName: m.itemName, quantity: m.quantity }))
      : []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!selectedComplaint) return null;
  const baseUrl = api.defaults.baseURL ? api.defaults.baseURL.replace(/\/api\/?$/, '') : '';

  const handleAddMaterial = () => {
    setMaterials([...materials, { itemName: '', quantity: '' }]);
  };

  const handleRemoveMaterial = (index) => {
    const newMaterials = [...materials];
    newMaterials.splice(index, 1);
    setMaterials(newMaterials);
  };

  const handleMaterialChange = (index, field, value) => {
    const newMaterials = [...materials];
    newMaterials[index][field] = value;
    setMaterials(newMaterials);
  };

  const handleSubmit = async (markComplete) => {
    setIsSubmitting(true);
    try {
      const payload = {
        assignedWorkerNames: workers.split(',').map(w => w.trim()).filter(Boolean),
        durationRequiredHours: duration ? parseFloat(duration) : undefined,
        materialsUsed: materials.filter(m => m.itemName && m.quantity).map(m => ({ ...m, quantity: parseFloat(m.quantity) })),
        isMaintainerCompleted: markComplete ? true : undefined
      };

      await api.put(`/maintainer/complaints/${selectedComplaint.id}`, payload);
      alert(markComplete ? "Indent marked as pending verification!" : "Indent updated successfully!");
      refreshData();
      setSelectedComplaint(null);
    } catch (err) {
      console.error(err);
      alert("Failed to update indent.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCompleted = selectedComplaint.status === 'Completed' || selectedComplaint.isMaintainerCompleted;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-xl font-bold text-slate-800 flex items-center">
            Manage Indent 
            <span className="ml-3 text-sm font-medium text-indigo-600 bg-indigo-100 px-2.5 py-1 rounded-md">
              {selectedComplaint.indentNumber || selectedComplaint.id.substring(0, 8)}
            </span>
          </h3>
          <button 
            onClick={() => setSelectedComplaint(null)}
            className="text-slate-400 hover:text-slate-600 transition-colors bg-white rounded-full p-1 shadow-sm border border-slate-200"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Details */}
          <div className="space-y-6">
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
                    style={{ maxHeight: '200px', objectFit: 'contain' }}
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
                <span className="block text-xs font-semibold text-slate-400 uppercase">Location</span>
                <span className="block mt-1 font-medium text-slate-800">{selectedComplaint.location}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Maintainer Actions */}
          <div className="space-y-6">
            {!isCompleted ? (
              <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100 space-y-4">
                <h4 className="text-sm font-semibold text-indigo-800 uppercase tracking-wider mb-2 flex items-center">
                  <Wrench className="w-4 h-4 mr-2" />
                  Work Details
                </h4>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Assigned Workers (comma separated)</label>
                  <input
                    type="text"
                    value={workers}
                    onChange={(e) => setWorkers(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="e.g. John Doe, Jane Smith"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Duration Required (Hours)</label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="e.g. 2.5"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-slate-700">Materials Used</label>
                    <button 
                      onClick={handleAddMaterial}
                      className="text-xs flex items-center text-indigo-600 hover:text-indigo-800 font-medium bg-indigo-50 px-2 py-1 rounded"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Item
                    </button>
                  </div>
                  {materials.map((material, index) => (
                    <div key={index} className="flex space-x-2 mb-2 items-center">
                      <input
                        type="text"
                        placeholder="Item Name"
                        value={material.itemName}
                        onChange={(e) => handleMaterialChange(index, 'itemName', e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-slate-300 rounded-md shadow-sm text-sm"
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        value={material.quantity}
                        onChange={(e) => handleMaterialChange(index, 'quantity', e.target.value)}
                        className="w-20 px-3 py-1.5 border border-slate-300 rounded-md shadow-sm text-sm"
                      />
                      <button onClick={() => handleRemoveMaterial(index)} className="text-red-500 hover:text-red-700 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-indigo-200 mt-4">
                  <button
                    onClick={() => handleSubmit(false)}
                    disabled={isSubmitting}
                    className="flex items-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Progress
                  </button>
                  <button
                    onClick={() => handleSubmit(true)}
                    disabled={isSubmitting}
                    className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Complete Work
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <h4 className="text-lg font-semibold text-slate-800">Work Completed</h4>
                <p className="text-slate-500 mt-1">This indent has been marked as completed and is {selectedComplaint.status === 'Completed' ? 'fully resolved' : 'awaiting final verification from the HOD'}.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintainerIndentDetailsModal;
