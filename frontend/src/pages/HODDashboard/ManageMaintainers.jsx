import React, { useState, useEffect } from 'react';
import { UserPlus, Users, Search } from 'lucide-react';
import api from '../../api/axios';

const ManageMaintainers = () => {
  const [maintainers, setMaintainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
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

  useEffect(() => {
    fetchMaintainers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/hod/maintainers', formData);
      setSuccess('Maintainer added successfully');
      setFormData({ name: '', email: '', password: '' });
      fetchMaintainers();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to add maintainer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800 mb-6 pb-2 border-b border-slate-200">Manage Maintainers</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Add Maintainer Form */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
            <UserPlus className="w-5 h-5 mr-2 text-indigo-600" />
            Add Maintainer
          </h3>
          
          {error && <div className="p-3 mb-4 text-sm text-red-700 bg-red-50 rounded-lg">{error}</div>}
          {success && <div className="p-3 mb-4 text-sm text-green-700 bg-green-50 rounded-lg">{success}</div>}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Add Maintainer'}
            </button>
          </form>
          <p className="text-xs text-slate-500 mt-4">
            If the email already belongs to a user in your department, their role will be updated to Maintainer.
          </p>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={2} className="px-6 py-8 text-center text-slate-500">Loading...</td>
                  </tr>
                ) : maintainers.length > 0 ? (
                  maintainers.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-800">{m.name}</td>
                      <td className="px-6 py-4 text-slate-600">{m.email}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="px-6 py-12 text-center text-slate-500">
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
