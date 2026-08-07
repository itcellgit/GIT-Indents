import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { ArrowLeft, Plus, XCircle, User, LogOut, KeyRound, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import NotificationBell from '../../../components/NotificationBell';
import ChangePasswordModal from '../../../components/ChangePasswordModal';
import api from '../../../api/axios';
import logo from '../../../assets/logo.png';

const initialVehicleForm = {
  vehicle_number: '',
  vehicle_name: '',
  vehicle_type: '',
  status: 'Available',
};

const initialBookingForm = {
  vehicle_id: '',
  booked_by: '',
  purpose: '',
  destination: '',
  travel_date: '',
  start_time: '',
  expected_return_time: '',
  passenger_count: '',
  remarks: '',
};

const tabs = [
  { id: 'vehicles', label: 'Vehicle List' },
  { id: 'calendar', label: 'Calendar' },
];

const toLocalDateString = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const toTimeLocalValue = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (num) => String(num).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const isBookingOnDate = (booking, dateString) => {
  if (!dateString) return false;

  const bookingDate = toLocalDateString(booking.travel_date);
  return bookingDate === dateString;
};

export default function VehicleBookingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isDayListOpen, setIsDayListOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [editingVehicleBookingId, setEditingVehicleBookingId] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleBookings, setVehicleBookings] = useState([]);
  const [form, setForm] = useState(initialVehicleForm);
  const [bookingForm, setBookingForm] = useState(initialBookingForm);
  const [loading, setLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('vehicles');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedDayBookings, setSelectedDayBookings] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));

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

  const selectedMonthDate = useMemo(() => new Date(`${calendarMonth}-01T00:00:00`), [calendarMonth]);

  const calendarDays = useMemo(() => {
    const year = selectedMonthDate.getFullYear();
    const month = selectedMonthDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const cells = [];

    for (let i = 0; i < firstDay; i += 1) cells.push(null);
    for (let day = 1; day <= totalDays; day += 1) {
      cells.push(new Date(year, month, day));
    }
    return cells;
  }, [selectedMonthDate]);

  const loadVehicleBookings = async () => {
    setCalendarLoading(true);
    setError('');

    try {
      const response = await api.get('/vehicle-bookings');
      setVehicleBookings(response.data?.bookings || []);
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to load vehicle bookings');
    } finally {
      setCalendarLoading(false);
    }
  };

  const openBookingModal = (dateString) => {
    setSelectedDate(dateString);
    setIsDayListOpen(false);
    setBookingForm({
      ...initialBookingForm,
      vehicle_id: '',
      booked_by: '',
      travel_date: dateString,
      start_time: '09:00',
      expected_return_time: '10:00',
      passenger_count: '',
    });
    setEditingVehicleBookingId(null);
    setIsBookingModalOpen(true);
  };

  const openDayList = (dateString, dayBookings) => {
    setSelectedDate(dateString);
    setSelectedDayBookings(dayBookings);
    setIsDayListOpen(true);
  };

  useEffect(() => {
    loadVehicles();
  }, []);

  useEffect(() => {
    if (activeTab === 'calendar' && vehicleBookings.length === 0) {
      loadVehicleBookings();
    }
  }, [activeTab]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      if (editingVehicleId) {
        await api.put(`/vehicles/${editingVehicleId}`, form);
      } else {
        await api.post('/vehicles', form);
      }

      setForm(initialVehicleForm);
      setEditingVehicleId(null);
      setIsModalOpen(false);
      await loadVehicles();
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to save vehicle');
    }
  };

  const handleAddVehicle = () => {
    setForm(initialVehicleForm);
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

  const handleBookingSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      vehicle_id: bookingForm.vehicle_id,
      booked_by: bookingForm.booked_by,
      purpose: bookingForm.purpose,
      destination: bookingForm.destination,
      travel_date: bookingForm.travel_date,
      start_time: bookingForm.start_time || null,
      expected_return_time: bookingForm.expected_return_time || null,
      passenger_count: bookingForm.passenger_count || null,
      remarks: bookingForm.remarks,
    };

    try {
      if (editingVehicleBookingId) {
        await api.put(`/vehicle-bookings/${editingVehicleBookingId}`, payload);
      } else {
        await api.post('/vehicle-bookings', payload);
      }

      setIsBookingModalOpen(false);
      setBookingForm(initialBookingForm);
      setEditingVehicleBookingId(null);
      await loadVehicleBookings();
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to save vehicle booking');
    }
  };

  const openEditVehicleBooking = (booking) => {
    setBookingForm({
      vehicle_id: String(booking.vehicle_id || ''),
      booked_by: String(booking.booked_by || ''),
      purpose: booking.purpose || '',
      destination: booking.destination || '',
      travel_date: toLocalDateString(booking.travel_date),
      start_time: toTimeLocalValue(booking.start_time),
      expected_return_time: toTimeLocalValue(booking.expected_return_time),
      passenger_count: booking.passenger_count ? String(booking.passenger_count) : '',
      remarks: booking.remarks || '',
    });
    setEditingVehicleBookingId(booking.id);
    setIsBookingModalOpen(true);
  };

  const handleDeleteVehicleBooking = async (bookingId) => {
    try {
      await api.delete(`/vehicle-bookings/${bookingId}`);
      setIsBookingModalOpen(false);
      setIsDayListOpen(false);
      setEditingVehicleBookingId(null);
      setBookingForm(initialBookingForm);
      await loadVehicleBookings();
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to delete vehicle booking');
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
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'vehicles' && (
          <>
            <div className="flex justify-end">
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
                    <label className="grid gap-1 text-sm font-medium text-slate-700">
                      <span>Vehicle Number</span>
                      <input value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} placeholder="Vehicle Number" required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-slate-700">
                      <span>Vehicle Name</span>
                      <input value={form.vehicle_name} onChange={(e) => setForm({ ...form, vehicle_name: e.target.value })} placeholder="Vehicle Name" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-slate-700">
                      <span>Vehicle Type</span>
                      <input value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })} placeholder="Vehicle Type" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-slate-700">
                      <span>Status</span>
                      <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm bg-white">
                        <option value="Available">Available</option>
                        <option value="Unavailable">Unavailable</option>
                      </select>
                    </label>
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
          </>
        )}

        {activeTab === 'calendar' && (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Booking Calendar</h3>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => {
                    const previous = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() - 1, 1);
                    setCalendarMonth(previous.toISOString().slice(0, 7));
                  }}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <div className="min-w-36 px-3 py-2 text-center text-sm font-semibold text-slate-900">
                  {selectedMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 1);
                    setCalendarMonth(next.toISOString().slice(0, 7));
                  }}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {calendarLoading ? (
              <div className="py-10 text-center text-sm text-slate-500">Loading vehicle bookings...</div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="py-2">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day, index) => {
                    if (!day) {
                      return <div key={`blank-${index}`} className="min-h-28 rounded-xl border border-dashed border-slate-200 bg-slate-50/50" />;
                    }

                    const dateString = toLocalDateString(day);
                    const dayBookings = vehicleBookings.filter((booking) => isBookingOnDate(booking, dateString));

                    return (
                      <div
                        key={dateString}
                        role="button"
                        tabIndex={0}
                        onClick={() => openBookingModal(dateString)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openBookingModal(dateString);
                          }
                        }}
                        className={`min-h-28 rounded-xl border p-3 text-left transition-colors cursor-pointer ${selectedDate === dateString ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">{day.getDate()}</span>
                          {dayBookings.length > 0 && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-semibold text-white">{dayBookings.length}</span>}
                        </div>
                        {dayBookings.length > 0 && (
                          <div className="mt-3 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openDayList(dateString, dayBookings);
                              }}
                              className="rounded-md bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700"
                            >
                              List
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}
      </main>

      {isBookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{editingVehicleBookingId ? 'Edit Vehicle Booking' : 'Create Vehicle Booking'}</h3>
                <p className="text-sm text-slate-500">For {bookingForm.travel_date || 'selected date'}</p>
              </div>
              <button type="button" onClick={() => setIsBookingModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleBookingSubmit} className="p-6 grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>Vehicle</span>
                <select value={bookingForm.vehicle_id} onChange={(e) => setBookingForm({ ...bookingForm, vehicle_id: e.target.value })} required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm bg-white">
                  <option value="">Select Vehicle</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_number} - {vehicle.vehicle_name}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>Booked By</span>
                <input value={bookingForm.booked_by} onChange={(e) => setBookingForm({ ...bookingForm, booked_by: e.target.value })} placeholder="Enter name" required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>Destination</span>
                <input value={bookingForm.destination} onChange={(e) => setBookingForm({ ...bookingForm, destination: e.target.value })} placeholder="Destination" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>Passenger Count</span>
                <input type="number" value={bookingForm.passenger_count} onChange={(e) => setBookingForm({ ...bookingForm, passenger_count: e.target.value })} placeholder="Passenger Count" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>Travel Date</span>
                <input type="date" value={bookingForm.travel_date} onChange={(e) => setBookingForm({ ...bookingForm, travel_date: e.target.value })} required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>Start Time</span>
                <input type="time" value={bookingForm.start_time} onChange={(e) => setBookingForm({ ...bookingForm, start_time: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>Expected Return Time</span>
                <input type="time" value={bookingForm.expected_return_time} onChange={(e) => setBookingForm({ ...bookingForm, expected_return_time: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">
                <span>Purpose</span>
                <input value={bookingForm.purpose} onChange={(e) => setBookingForm({ ...bookingForm, purpose: e.target.value })} placeholder="Purpose" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">
                <span>Remarks</span>
                <textarea value={bookingForm.remarks} onChange={(e) => setBookingForm({ ...bookingForm, remarks: e.target.value })} placeholder="Remarks" rows={3} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                {editingVehicleBookingId && (
                  <button type="button" onClick={() => handleDeleteVehicleBooking(editingVehicleBookingId)} className="px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 inline-flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete Booking
                  </button>
                )}
                <button type="button" onClick={() => setIsBookingModalOpen(false)} className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700">{editingVehicleBookingId ? 'Update Booking' : 'Save Booking'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDayListOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Booking List</h3>
                <p className="text-sm text-slate-500">{selectedDate || 'Selected date'}</p>
              </div>
              <button type="button" onClick={() => setIsDayListOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">S.No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Vehicle</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Booked By</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Destination</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Purpose</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {selectedDayBookings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">No bookings for this date.</td>
                    </tr>
                  ) : (
                    selectedDayBookings.map((booking, index) => (
                      <tr key={booking.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4 text-sm text-slate-700">{index + 1}</td>
                        <td className="px-4 py-4 text-sm font-medium text-slate-900">{booking.vehicle_number || booking.vehicle_name || 'Vehicle'}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{booking.booked_by || '-'}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{booking.destination || '-'}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{booking.purpose || '-'}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{booking.status || '-'}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{booking.start_time || '-'} to {booking.expected_return_time || '-'}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setIsDayListOpen(false);
                                openEditVehicleBooking(booking);
                              }}
                              className="inline-flex items-center justify-center rounded-md p-2 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteVehicleBooking(booking.id)}
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
          </div>
        </div>
      )}

      {isChangePasswordOpen && <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />}
    </div>
  );
}