import React, { useState, useEffect } from 'react';
import { UserPlus, Users, Trash2 } from 'lucide-react';
import api from '../../api/axios';

const ManageMaintainers = () => {
  const [maintainers, setMaintainers] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchMaintainers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/hod/maintainers');
      setMaintainers(res.data.maintainers || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load maintainers');
    } finally {
      setLoading(false);
    }
  };

  const fetchFaculty = async () => {
    try {
      const res = await api.get('/hod/faculty');
      setFaculty(res.data.faculty || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMaintainers();
    fetchFaculty();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/hod/maintainers', { userId: selectedUserId });
      setSuccess('Maintainer added successfully');
      setSelectedUserId('');
      fetchMaintainers();
      fetchFaculty();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to Assign maintainer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (id) => {
    if (!window.confirm('Are you sure you want to remove this maintainer? They will be restored to their original role.')) return;
    
    setError('');
    setSuccess('');
    
    try {
      await api.delete(`/hod/maintainers/${id}`);
      setMaintainers(maintainers.filter(m => m.id !== id));
      setSuccess('Maintainer removed successfully');
      fetchFaculty();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to remove maintainer');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800 mb-6 pb-2 border-b border-slate-200">Manage Maintainers</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Assign Maintainer Form */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
            <UserPlus className="w-5 h-5 mr-2 text-indigo-600" />
            Assign Maintainer
          </h3>
          
          {error && <div className="p-3 mb-4 text-sm text-red-700 bg-red-50 rounded-lg">{error}</div>}
          {success && <div className="p-3 mb-4 text-sm text-green-700 bg-green-50 rounded-lg">{success}</div>}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Staff Member</label>
              <select
                required
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="" disabled>Select a staff member</option>
                {faculty.map((f) => (
                  <option key={f.id} value={f.id}>{f.name} ({f.role})</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !selectedUserId}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Assign Maintainer'}
            </button>
          </form>
          {faculty.length === 0 && (
            <p className="text-xs text-slate-500 mt-4">
              No Faculty or Non-Teaching staff available in your department to promote.
            </p>
          )}
        </div>

        {/* List of Maintainers */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center">
              <Users className="w-5 h-5 mr-2 text-indigo-600" />
              Department Maintainers
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-slate-500">Loading...</td>
                  </tr>
                ) : maintainers.length > 0 ? (
                  maintainers.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-800">{m.name}</td>
                      <td className="px-6 py-4 text-slate-600">{m.email}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleRemove(m.id)}
                          className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-colors"
                          title="Remove Maintainer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                      No maintainers added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageMaintainers;
