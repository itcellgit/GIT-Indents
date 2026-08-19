import React, { useState, useEffect } from 'react';
import { XCircle, Upload, CheckCircle } from 'lucide-react';
import api from '../api/axios';

const RaiseIndentModal = ({ setIsRaiseModalOpen, handleRaiseSubmit, formData, setFormData }) => {
  const [categories, setCategories] = useState([]);
  const normalizedNature = formData?.nature === 'Fault' ? 'Maintenance/Repair' : formData?.nature || 'Maintenance/Repair';

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await api.get('/categories');
        setCategories(res.data.categories || []);
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      }
    };
    fetchCategories();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 className="text-xl font-bold text-slate-800">Raise New Indent</h3>
          <button
            onClick={() => setIsRaiseModalOpen(false)}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleRaiseSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Maintenance Department <span className="text-red-500">*</span></label>
              <select
                required
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              >
                <option value="">Select Department...</option>
                {categories.map((cat) => (
                  <option key={cat.id || cat._id} value={cat.id || cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">Location <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                placeholder="e.g. Lab 3, 2nd Floor"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-slate-700">ISR No. <span className="text-slate-400 font-normal">(Optional)</span></label>
              <input
                type="text"
                placeholder="e.g. ISR/2026/045"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={formData.isrNo}
                onChange={(e) => setFormData({ ...formData, isrNo: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <label className="block text-sm font-semibold text-slate-700">Nature of Work <span className="text-red-500">*</span></label>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              {["Maintenance/Repair", "New Work"].map((nature) => (
                <label key={nature} className="flex items-center p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="radio"
                    name="nature"
                    value={nature}
                    checked={normalizedNature === nature}
                    onChange={(e) => setFormData({ ...formData, nature: e.target.value })}
                    className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-slate-700">{nature}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Description of Issue <span className="text-red-500">*</span></label>
            <textarea
              required
              rows={3}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Describe the complaint in detail..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            ></textarea>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Additional Details <span className="text-slate-400 font-normal">(Optional)</span></label>
            <textarea
              rows={2}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Any other helpful info..."
              value={formData.additionalDetails}
              onChange={(e) => setFormData({ ...formData, additionalDetails: e.target.value })}
            ></textarea>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Attach Image <span className="text-slate-400 font-normal">(Optional)</span></label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-xl hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors cursor-pointer bg-slate-50">
              <div className="space-y-1 text-center">
                <Upload className="mx-auto h-12 w-12 text-slate-400" />
                <div className="flex text-sm text-slate-600 justify-center">
                  <label className="relative cursor-pointer bg-transparent rounded-md font-medium text-indigo-600 hover:text-indigo-500">
                    <span>{formData.image ? 'Change file' : 'Upload a file'}</span>
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => setFormData({ ...formData, image: e.target.files[0] })} />
                  </label>
                  {!formData.image && <p className="pl-1">or drag and drop</p>}
                </div>
                {formData.image ? (
                  <p className="text-sm font-bold text-green-600 mt-2 flex items-center justify-center gap-1">
                    <CheckCircle className="w-4 h-4" /> {formData.image.name} attached
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">PNG, JPG, GIF up to 5MB</p>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end space-x-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsRaiseModalOpen(false)}
              className="px-5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 rounded-lg text-white font-medium hover:bg-indigo-700 shadow-sm transition-colors"
            >
              Submit Indent
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RaiseIndentModal;
