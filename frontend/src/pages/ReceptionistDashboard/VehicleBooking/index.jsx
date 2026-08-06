import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { ArrowLeft, Plus, XCircle, User, LogOut, KeyRound, Pencil, Trash2 } from 'lucide-react';
import NotificationBell from '../../../components/NotificationBell';
import ChangePasswordModal from '../../../components/ChangePasswordModal';
import api from '../../../api/axios';
import logo from '../../../assets/logo.png';

const initialForm = {
  vehicle_number: '',
  vehicle_name: '',
  vehicle_type: '',
  status: 'Available',
};

export default function VehicleBookingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadVehicles = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/vehicles');
      setVehicles(response.data?.vehicles || []);
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      if (editingVehicleId) {
        await api.put(`/vehicles/${editingVehicleId}`, form);
      } else {
        await api.post('/vehicles', form);
      }

      setForm(initialForm);
      setEditingVehicleId(null);
      setIsModalOpen(false);
      await loadVehicles();
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to save vehicle');
    }
  };

  const handleAddVehicle = () => {
    setForm(initialForm);
    setEditingVehicleId(null);
    setIsModalOpen(true);
  };

  const handleEditVehicle = (vehicle) => {
    setForm({
      vehicle_number: vehicle.vehicle_number,
      vehicle_name: vehicle.vehicle_name,
      vehicle_type: vehicle.vehicle_type,
      status: vehicle.status || 'Available',
    });
    setEditingVehicleId(vehicle.id);
    setIsModalOpen(true);
  };

  const handleDeleteVehicle = async (vehicleId) => {
    try {
      await api.delete(`/vehicles/${vehicleId}`);
      await loadVehicles();
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to delete vehicle');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img src={logo} alt="KLS GIT Logo" className="h-10 w-10 object-contain bg-white rounded-full p-0.5" />
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">Vehicle Bookings</h1>
                <p className="text-xs text-indigo-600">Reception desk vehicle management</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <NotificationBell />
              <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity" title="My Profile">
                <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200">
                  <User className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-slate-700">{user?.name || 'Receptionist'}</p>
                  <p className="text-xs text-slate-500">{user?.department || 'Reception Desk'}</p>
                </div>
              </Link>
              <button onClick={() => setIsChangePasswordOpen(true)} className="text-slate-400 hover:text-indigo-600 transition-colors bg-slate-100 p-2 rounded-lg border border-slate-200" title="Change Password">
                <KeyRound className="w-4 h-4" />
              </button>
              <button onClick={logout} className="text-slate-400 hover:text-red-500 transition-colors bg-slate-100 p-2 rounded-lg border border-slate-200" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <button
              type="button"
              onClick={() => navigate('/receptionist-dashboard')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Receptionist Dashboard
            </button>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Reception Operations</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900">Vehicle Booking</h2>
          </div>

          <button
            type="button"
            onClick={handleAddVehicle}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Vehicle
          </button>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{editingVehicleId ? 'Edit Vehicle' : 'Add Vehicle'}</h3>
                </div>
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 grid gap-4 md:grid-cols-2">
                <input value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} placeholder="Vehicle Number" required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
                <input value={form.vehicle_name} onChange={(e) => setForm({ ...form, vehicle_name: e.target.value })} placeholder="Vehicle Name" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
                <input value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} placeholder="Vehicle Type" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm bg-white">
                  <option value="Available">Available</option>
                  <option value="Unavailable">Unavailable</option>
                </select>
                <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50">Cancel</button>
                  <button type="submit" className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700">{editingVehicleId ? 'Update Vehicle' : 'Save Vehicle'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {error && <div className="px-6 py-4 text-sm text-red-700 bg-red-50 border-b border-red-100">{error}</div>}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">S.No</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Vehicle Number</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Vehicle Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Vehicle Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">Loading vehicles...</td>
                  </tr>
                ) : vehicles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">No vehicles yet. Add one above to get started.</td>
                  </tr>
                ) : (
                  vehicles.map((vehicle, index) => (
                    <tr key={vehicle.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm text-slate-700">{index + 1}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{vehicle.vehicle_number}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{vehicle.vehicle_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{vehicle.vehicle_type}</td>
                      <td className="px-6 py-4 text-sm text-indigo-600 font-semibold">{vehicle.status}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditVehicle(vehicle)}
                            className="inline-flex items-center justify-center rounded-md p-2 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteVehicle(vehicle.id)}
                            className="inline-flex items-center justify-center rounded-md p-2 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {isChangePasswordOpen && <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />}
    </div>
  );
}