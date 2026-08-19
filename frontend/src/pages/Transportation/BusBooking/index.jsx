import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { ArrowLeft, Plus, XCircle, User, LogOut, KeyRound, Pencil, Trash2, ChevronLeft, ChevronRight, CheckCircle, ShieldX, Clock } from 'lucide-react';
import NotificationBell from '../../../components/NotificationBell';
import ChangePasswordModal from '../../../components/ChangePasswordModal';
import api from '../../../api/axios';
import logo from '../../../assets/logo.png';
import { ROLES, ROLE_DASHBOARDS } from '../../../constants/roles';
import { formatDate } from '../../../utils/formatDate';

const initialBusForm = {
  bus_number: '',
  bus_name: '',
  bus_type: '',
  status: 'Available',
};

const initialBookingForm = {
  bus_id: '',
  booked_by: '',
  booked_by_name: '',
  booked_by_email: '',
  purpose: '',
  destination: '',
  start_date: '',
  end_date: '',
  booking_period: 'FULL_DAY',
  start_time: '',
  end_time: '',
  passenger_count: '',
  remarks: '',
  status: 'PENDING',
};

const tabs = [
  { id: 'buses', label: 'Bus List' },
  { id: 'calendar', label: 'Calendar' },
];

const managementTabs = [
  { id: 'buses', label: 'Bus List' },
  { id: 'calendar', label: 'Calendar' },
];

const facultyTabs = [
  { id: 'calendar', label: 'Calendar' },
];

const statusConfig = {
  PENDING: { label: 'Pending', className: 'text-amber-600 bg-amber-50 border border-amber-200' },
  APPROVED: { label: 'Approved', className: 'text-green-600 bg-green-50 border border-green-200' },
  REJECTED: { label: 'Rejected', className: 'text-red-600 bg-red-50 border border-red-200' },
  CANCELLED: { label: 'Cancelled', className: 'text-slate-600 bg-slate-50 border border-slate-200' },
};

const facultyStatusOptions = ['PENDING', 'CANCELLED'];
const managementStatusOptions = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

const getStatusBadge = (status) => {
  const key = (status || 'PENDING').toUpperCase();
  return statusConfig[key] || statusConfig.PENDING;
};

const toLocalDateString = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const toTimeLocalValue = (value) => {
  if (!value) return '';

  const timeString = String(value).trim();
  const timeMatch = timeString.match(/(?:^|T|\s)(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!timeMatch) return '';

  const hours = String(Number(timeMatch[1])).padStart(2, '0');
  const minutes = timeMatch[2];

  return `${hours}:${minutes}`;
};

const isBookingOnDate = (booking, dateString) => {
  if (!dateString) return false;

  const bookingDate = toLocalDateString(booking.start_date);
  return bookingDate === dateString;
};

const formatTimeWithAmPm = (value) => {
  const normalizedTime = toTimeLocalValue(value);
  if (!normalizedTime) return '-';

  const [hourPart, minutePart] = normalizedTime.split(':');
  let hours = Number(hourPart);
  const minutes = minutePart;
  const amPm = hours >= 12 ? 'PM' : 'AM';
  hours %= 12;
  if (hours === 0) hours = 12;

  return `${String(hours).padStart(2, '0')}:${minutes} ${amPm}`;
};

const getBusLabel = (booking) => {
  if (!booking) return 'Bus';
  const number = booking.bus_number || '';
  const name = booking.bus_name || '';
  if (number && name) return `${number} - ${name}`;
  return number || name || 'Bus';
};

const formatBookingDateRange = (startDate, endDate) => {
  const startLabel = formatDate(startDate);
  const endLabel = formatDate(endDate);

  if (!startDate) return '-';
  if (!endDate || startLabel === endLabel) return startLabel;

  return `${startLabel} - ${endLabel}`;
};

const getTimeOfDay = (datetime) => {
  if (!datetime) return 'Unknown';

  const date = new Date(datetime);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  const hours = date.getHours();
  if (hours >= 5 && hours < 12) return 'Morning';
  if (hours >= 12 && hours < 17) return 'Afternoon';
  if (hours >= 17 && hours < 21) return 'Evening';
  return 'Night';
};

const TIME_PERIODS = ['Morning', 'Afternoon', 'Evening', 'Night'];

const groupByTimeOfDay = (bookings) => {
  const groups = {};
  TIME_PERIODS.forEach((period) => { groups[period] = []; });

  bookings.forEach((booking) => {
    const normalizedStartTime = toTimeLocalValue(booking.start_time) || '00:00';
    const period = getTimeOfDay(booking.start_datetime || `${toLocalDateString(booking.start_date)}T${normalizedStartTime}`);
    if (!groups[period]) groups[period] = [];
    groups[period].push(booking);
  });

  return groups;
};

const detectConflicts = (bookings) => {
  const conflicts = new Set();
  for (let i = 0; i < bookings.length; i += 1) {
    for (let j = i + 1; j < bookings.length; j += 1) {
      const a = bookings[i];
      const b = bookings[j];
      if (a.bus_id !== b.bus_id) continue;

      const startA = new Date(`${a.start_date}T${toTimeLocalValue(a.start_time) || '00:00'}`);
      const endA = new Date(`${a.start_date}T${toTimeLocalValue(a.end_time) || '23:59'}`);
      const startB = new Date(`${b.start_date}T${toTimeLocalValue(b.start_time) || '00:00'}`);
      const endB = new Date(`${b.start_date}T${toTimeLocalValue(b.end_time) || '23:59'}`);

      if (startA < endB && startB < endA && a.id !== b.id) {
        conflicts.add(a.id);
        conflicts.add(b.id);
      }
    }
  }
  return conflicts;
};

const SummaryBookingList = ({ bookings, conflicts, dateString, onOpenDayList }) => {
  const timeGroups = useMemo(() => groupByTimeOfDay(bookings), [bookings]);

  return (
    <div className="space-y-1.5">
      {TIME_PERIODS.map((period) => {
        const periodBookings = timeGroups[period] || [];
        if (periodBookings.length === 0) return null;

        return (
          <div key={period}>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              {period}
            </div>
            <div className="space-y-1">
              {periodBookings.map((booking) => {
                const badge = getStatusBadge(booking.status);
                const isConflict = conflicts?.has(booking.id);
                return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => onOpenDayList(dateString, bookings)}
                    className={`w-full flex items-center justify-between gap-2 rounded-lg border p-2 text-left transition-colors ${isConflict ? 'border-amber-300 bg-amber-50 hover:bg-amber-100' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium text-slate-800 text-sm truncate">{getBusLabel(booking)}</span>
                        <span className="text-xs text-slate-500 truncate">
                          {formatTimeWithAmPm(booking.start_time)} – {formatTimeWithAmPm(booking.end_time)}
                          {booking.purpose ? ` • ${booking.purpose}` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isConflict && (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-600" title="Time conflict">
                          <span className="text-[9px] font-bold">!</span>
                        </span>
                      )}
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function BusBookingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const userRole = user?.role;
  const isAdminOrTransport = userRole === ROLES.ADMIN || userRole === ROLES.TRANSPORT;

  const visibleTabs = isAdminOrTransport ? managementTabs : facultyTabs;
  const defaultActiveTab = isAdminOrTransport ? 'buses' : 'calendar';

  const backPath = ROLE_DASHBOARDS[userRole] || '/';
  const backLabel = 'Back to Dashboard';
  const sectionLabel = isAdminOrTransport ? 'Transportation Operations' : 'Bus Booking';
  const roleDefaultName = isAdminOrTransport ? (user?.name || 'Transport Coordinator') : (user?.name || 'Staff Member');
  const roleDefaultDept = isAdminOrTransport ? (user?.department || 'Transportation') : (user?.department || 'Staff');
  const statusOptions = isAdminOrTransport ? managementStatusOptions : facultyStatusOptions;

  const isActionDisabledForApproved = (status) => !isAdminOrTransport && (status || '').toUpperCase() === 'APPROVED';

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isDayListOpen, setIsDayListOpen] = useState(false);
  const [editingBusId, setEditingBusId] = useState(null);
  const [editingBusBookingId, setEditingBusBookingId] = useState(null);
  const [buses, setBuses] = useState([]);
  const [busBookings, setBusBookings] = useState([]);
  const [form, setForm] = useState(initialBusForm);
  const [bookingForm, setBookingForm] = useState(initialBookingForm);
  const [loading, setLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(defaultActiveTab);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedDayBookings, setSelectedDayBookings] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const loadBuses = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/buses');
      setBuses(response.data?.buses || []);
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to load buses');
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

  const today = useMemo(() => toLocalDateString(new Date()), []);
  const tomorrow = useMemo(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return toLocalDateString(t);
  }, []);

  const upcomingBookings = useMemo(() => {
    const todayBookings = busBookings.filter((b) => isBookingOnDate(b, today));
    const tomorrowBookings = busBookings.filter((b) => isBookingOnDate(b, tomorrow));
    return {
      today: todayBookings,
      todayConflicts: detectConflicts(todayBookings),
      tomorrow: tomorrowBookings,
      tomorrowConflicts: detectConflicts(tomorrowBookings),
    };
  }, [busBookings, today, tomorrow]);

  const loadBusBookings = async () => {
    setCalendarLoading(true);
    setError('');

    try {
      const response = await api.get('/bus-bookings');
      setBusBookings(response.data?.bookings || []);
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to load bus bookings');
    } finally {
      setCalendarLoading(false);
    }
  };

  const openBookingModal = (dateString) => {
    setSelectedDate(dateString);
    setIsDayListOpen(false);
    setBookingForm({
      ...initialBookingForm,
      bus_id: '',
      booked_by: user?.id || '',
      booked_by_name: user?.name || '',
      booked_by_email: user?.email || '',
      start_date: dateString,
      end_date: dateString,
      booking_period: 'FULL_DAY',
      start_time: '09:00',
      end_time: '10:00',
      passenger_count: '',
    });
    setEditingBusBookingId(null);
    setIsBookingModalOpen(true);
  };

  const openDayList = (dateString, dayBookings) => {
    setSelectedDate(dateString);
    setSelectedDayBookings(dayBookings);
    setIsDayListOpen(true);
  };

  useEffect(() => {
    loadBuses();
  }, []);

  useEffect(() => {
    if (activeTab === 'calendar' && busBookings.length === 0) {
      loadBusBookings();
    }
  }, [activeTab]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      if (editingBusId) {
        await api.put(`/buses/${editingBusId}`, form);
      } else {
        await api.post('/buses', form);
      }

      setForm(initialBusForm);
      setEditingBusId(null);
      setIsModalOpen(false);
      await loadBuses();
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to save bus');
    }
  };

  const handleAddBus = () => {
    setForm(initialBusForm);
    setEditingBusId(null);
    setIsModalOpen(true);
  };

  const handleEditBus = (bus) => {
    setForm({
      bus_number: bus.bus_number,
      bus_name: bus.bus_name,
      bus_type: bus.bus_type,
      status: bus.status || 'Available',
    });
    setEditingBusId(bus.id);
    setIsModalOpen(true);
  };

  const handleDeleteBus = async (busId) => {
    try {
      await api.delete(`/buses/${busId}`);
      await loadBuses();
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to delete bus');
    }
  };

  const handleBookingSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      bus_id: bookingForm.bus_id,
      booked_by: bookingForm.booked_by,
      booked_by_email: bookingForm.booked_by_email,
      purpose: bookingForm.purpose,
      destination: bookingForm.destination,
      start_date: bookingForm.start_date,
      end_date: bookingForm.end_date,
      booking_period: bookingForm.booking_period,
      start_time: bookingForm.start_time || null,
      end_time: bookingForm.end_time || null,
      passenger_count: bookingForm.passenger_count || null,
      remarks: bookingForm.remarks,
      status: bookingForm.status,
    };

    try {
      if (editingBusBookingId) {
        await api.put(`/bus-bookings/${editingBusBookingId}`, payload);
      } else {
        await api.post('/bus-bookings', payload);
      }

      setIsBookingModalOpen(false);
      setBookingForm(initialBookingForm);
      setEditingBusBookingId(null);
      await loadBusBookings();
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to save bus booking');
    }
  };

  const openEditBusBooking = (booking) => {
    setBookingForm({
      bus_id: String(booking.bus_id || ''),
      booked_by: String(booking.booked_by || ''),
      booked_by_name: String(booking.booked_by_name || booking.booked_by || ''),
      booked_by_email: String(booking.booked_by_email || ''),
      purpose: booking.purpose || '',
      destination: booking.destination || '',
      start_date: toLocalDateString(booking.start_date),
      end_date: toLocalDateString(booking.end_date),
      booking_period: booking.booking_period || 'FULL_DAY',
      start_time: toTimeLocalValue(booking.start_time),
      end_time: toTimeLocalValue(booking.end_time),
      passenger_count: booking.passenger_count ? String(booking.passenger_count) : '',
      remarks: booking.remarks || '',
      status: booking.status || 'PENDING',
    });
    setEditingBusBookingId(booking.id);
    setIsBookingModalOpen(true);
  };

  const handleDeleteBusBooking = async (bookingId) => {
    try {
      await api.delete(`/bus-bookings/${bookingId}`);
      setIsBookingModalOpen(false);
      setIsDayListOpen(false);
      setEditingBusBookingId(null);
      setBookingForm(initialBookingForm);
      await loadBusBookings();
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to delete booking');
    }
  };

  const handleApproveBooking = async (booking) => {
    try {
      await api.put(`/bus-bookings/${booking.id}/approve`);
      await loadBusBookings();
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to approve booking');
    }
  };

  const handleRejectBooking = async (booking) => {
    try {
      await api.put(`/bus-bookings/${booking.id}/reject`, { remarks: booking.remarks || '' });
      await loadBusBookings();
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to reject booking');
    }
  };

  const canSelectBus = isAdminOrTransport;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img src={logo} alt="KLS GIT Logo" className="h-10 w-10 object-contain bg-white rounded-full p-0.5" />
              <div>
                <h1 className="text-lg font-bold text-slate-900 leading-tight">Bus Bookings</h1>
                <p className="text-xs text-indigo-600">Transportation bus management</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <NotificationBell />
              <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity" title="My Profile">
                <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200">
                  <User className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-slate-700">{roleDefaultName}</p>
                  <p className="text-xs text-slate-500">{roleDefaultDept}</p>
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
              onClick={() => navigate(backPath)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors mb-3"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </button>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">{sectionLabel}</p>
            {/* <h2 className="mt-2 text-3xl font-bold text-slate-900">Bus Booking</h2> */}
          </div>
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {visibleTabs.map((tab) => (
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

        {activeTab === 'buses' && (
          <>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddBus}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Bus
              </button>
            </div>

            {isModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{editingBusId ? 'Edit Bus' : 'Add Bus'}</h3>
                    </div>
                    <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="p-6 grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium text-slate-700">
                      <span>Bus Number</span>
                      <input value={form.bus_number} onChange={(e) => setForm({ ...form, bus_number: e.target.value })} placeholder="Bus Number" required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-slate-700">
                      <span>Bus Name</span>
                      <input value={form.bus_name} onChange={(e) => setForm({ ...form, bus_name: e.target.value })} placeholder="Bus Name" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-slate-700">
                      <span>Bus Type</span>
                      <input value={form.bus_type} onChange={(e) => setForm({ ...form, bus_type: e.target.value })} placeholder="Bus Type" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
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
                      <button type="submit" className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700">{editingBusId ? 'Update Bus' : 'Save Bus'}</button>
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
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Bus Number</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Bus Name</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Bus Type</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">Loading buses...</td>
                      </tr>
                    ) : buses.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">No buses yet. Add one above to get started.</td>
                      </tr>
                    ) : (
                      buses.map((bus, index) => (
                        <tr key={bus.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-sm text-slate-700">{index + 1}</td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">{bus.bus_number}</td>
                          <td className="px-6 py-4 text-sm text-slate-700">{bus.bus_name}</td>
                          <td className="px-6 py-4 text-sm text-slate-700">{bus.bus_type}</td>
                          <td className="px-6 py-4 text-sm text-indigo-600 font-semibold">{bus.status}</td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditBus(bus)}
                                className="inline-flex items-center justify-center rounded-md p-2 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBus(bus.id)}
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

            {!calendarLoading && (
              <div className="grid gap-4 md:grid-cols-2">
                {((upcomingBookings.today.length > 0 && upcomingBookings.todayConflicts.size > 0) ||
                  (upcomingBookings.tomorrow.length > 0 && upcomingBookings.tomorrowConflicts.size > 0)) && (
                  <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                    <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.097a4.5 4.5 0 0 1 7.706 3.103v3.747a2 2 0 0 1-.614 1.414l-5.5 5a2 2 0 0 1-2.878-1.553V9.355a2 2 0 0 1 .614-1.414l3.654-3.654a.75.75 0 0 0-1.06-1.06L7.5 5.5v9.5a.5.5 0 0 0 .776.416l4.5-3a.5.5 0 0 0-.025-.845V6.1a4.5 4.5 0 0 1-.019-.003z" clipRule="evenodd" /></svg>
                    <span>
                      <strong>Conflict alert:</strong> Overlapping bookings detected for the same bus on today or tomorrow. Please review and adjust timings.
                    </span>
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Today<span className="text-xs text-slate-400 font-normal">({formatDate(today)})</span>
                  </h4>
                  {upcomingBookings.today.length === 0 ? (
                    <p className="text-sm text-slate-400">No bookings for today.</p>
                  ) : (
                    <SummaryBookingList
                      bookings={upcomingBookings.today}
                      conflicts={upcomingBookings.todayConflicts}
                      dateString={today}
                      onOpenDayList={openDayList}
                    />
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    Tomorrow<span className="text-xs text-slate-400 font-normal">({formatDate(tomorrow)})</span>
                  </h4>
                  {upcomingBookings.tomorrow.length === 0 ? (
                    <p className="text-sm text-slate-400">No bookings for tomorrow.</p>
                  ) : (
                    <SummaryBookingList
                      bookings={upcomingBookings.tomorrow}
                      conflicts={upcomingBookings.tomorrowConflicts}
                      dateString={tomorrow}
                      onOpenDayList={openDayList}
                    />
                  )}
                </div>
              </div>
            )}
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
                  const dayBookings = busBookings.filter((booking) => isBookingOnDate(booking, dateString));

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
                        {dayBookings.length > 0 && (() => {
                         const hasPending = dayBookings.some((b) => (b.status || 'PENDING').toUpperCase() === 'PENDING');
                         const hasRejected = dayBookings.some((b) => (b.status || '').toUpperCase() === 'REJECTED');
                         const badgeBg = hasPending ? 'bg-amber-500' : (hasRejected ? 'bg-red-500' : 'bg-green-500');
                         return (
                           <span className={`rounded-full ${badgeBg} px-2 py-0.5 text-[11px] font-semibold text-white`}>{dayBookings.length}</span>
                         );
                       })()}
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
          </section>
        )}
      </main>

      {isBookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{editingBusBookingId ? 'Edit Bus Booking' : 'Create Bus Booking'}</h3>
                <p className="text-sm text-slate-500">For {bookingForm.start_date || 'selected date'}</p>
                {editingBusBookingId && (() => {
                   const badge = getStatusBadge(bookingForm.status);
                   return (
                     <span className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}>
                       {badge.label}
                     </span>
                   );
                 })()}
              </div>
              <button type="button" onClick={() => setIsBookingModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleBookingSubmit} className="p-6 grid gap-4 md:grid-cols-2">
              {canSelectBus ? (
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  <span>Bus</span>
                  <select value={bookingForm.bus_id} onChange={(e) => setBookingForm({ ...bookingForm, bus_id: e.target.value })} required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm bg-white">
                    <option value="">Select Bus</option>
                    {buses.map((bus) => (
                      <option key={bus.id} value={bus.id}>{bus.bus_number} - {bus.bus_name}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="grid gap-1 text-sm font-medium text-slate-700">
                  <span>Bus</span>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
                    Bus will be assigned by Transportation
                  </div>
                </div>
              )}
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>Booked By</span>
                <input value={bookingForm.booked_by_name} onChange={(e) => setBookingForm({ ...bookingForm, booked_by_name: e.target.value })} placeholder="Enter name" required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>Booked By Email</span>
                <input type="email" value={bookingForm.booked_by_email} onChange={(e) => setBookingForm({ ...bookingForm, booked_by_email: e.target.value })} placeholder="name@example.com" required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              {editingBusBookingId && (
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  <span>Status</span>
                  <select
                    value={bookingForm.status || 'PENDING'}
                    onChange={(e) => setBookingForm({ ...bookingForm, status: e.target.value })}
                    className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm bg-white"
                  >
                    {statusOptions.map((option) => {
                      const badge = getStatusBadge(option);
                      return (
                        <option key={option} value={option}>{badge.label}</option>
                      );
                    })}
                  </select>
                </label>
              )}
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>Passenger Count</span>
                <input type="number" value={bookingForm.passenger_count} onChange={(e) => setBookingForm({ ...bookingForm, passenger_count: e.target.value })} placeholder="Passenger Count" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>Start Date</span>
                <input type="date" value={bookingForm.start_date} onChange={(e) => setBookingForm({ ...bookingForm, start_date: e.target.value })} required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>End Date</span>
                <input type="date" value={bookingForm.end_date} onChange={(e) => setBookingForm({ ...bookingForm, end_date: e.target.value })} required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>Booking Period</span>
                <select value={bookingForm.booking_period} onChange={(e) => setBookingForm({ ...bookingForm, booking_period: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm bg-white">
                  <option value="MORNING">Morning</option>
                  <option value="SECOND_HALF">Second Half</option>
                  <option value="FULL_DAY">Full Day</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>Start Time</span>
                <input type="time" value={bookingForm.start_time} onChange={(e) => setBookingForm({ ...bookingForm, start_time: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>End Time</span>
                <input type="time" value={bookingForm.end_time} onChange={(e) => setBookingForm({ ...bookingForm, end_time: e.target.value })} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>Destination</span>
                <input value={bookingForm.destination} onChange={(e) => setBookingForm({ ...bookingForm, destination: e.target.value })} placeholder="Destination" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
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
                {editingBusBookingId && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isActionDisabledForApproved(bookingForm.status)) return;
                      handleDeleteBusBooking(editingBusBookingId);
                    }}
                    disabled={isActionDisabledForApproved(bookingForm.status)}
                    className={`px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 inline-flex items-center gap-2 ${isActionDisabledForApproved(bookingForm.status) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Booking
                  </button>
                )}
                <button type="button" onClick={() => setIsBookingModalOpen(false)} className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700">{editingBusBookingId ? 'Update Booking' : 'Save Booking'}</button>
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
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Bus</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Booked By</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Booked By Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Purpose</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {selectedDayBookings.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">No bookings for this date.</td>
                    </tr>
                  ) : (
                    selectedDayBookings.map((booking, index) => (
                      <tr key={booking.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4 text-sm text-slate-700">{index + 1}</td>
                        <td className="px-4 py-4 text-sm font-medium text-slate-900">{getBusLabel(booking)}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{booking.booked_by_name || '-'}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{booking.booked_by_email || '-'}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{booking.purpose || '-'}</td>
                         <td className="px-4 py-4 text-sm text-slate-700">
                           {(() => {
                             const badge = getStatusBadge(booking.status);
                             return (
                               <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}>
                                 {badge.label}
                               </span>
                             );
                           })()}
                         </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{formatBookingDateRange(booking.start_date, booking.end_date)}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {formatTimeWithAmPm(booking.start_time)} to {formatTimeWithAmPm(booking.end_time)}
                        </td>
                         <td className="px-4 py-4 text-sm text-slate-700">
                            <div className="flex items-center gap-2">
                              {isAdminOrTransport && (
                                <>
                                  {booking.status !== 'APPROVED' && booking.status !== 'CANCELLED' && (
                                    <button
                                      type="button"
                                      onClick={() => handleApproveBooking(booking)}
                                      className="inline-flex items-center justify-center rounded-md p-2 text-green-600 hover:bg-green-50 hover:text-green-700 transition-colors"
                                      title="Approve"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {booking.status !== 'REJECTED' && booking.status !== 'CANCELLED' && (
                                    <button
                                      type="button"
                                      onClick={() => handleRejectBooking(booking)}
                                      className="inline-flex items-center justify-center rounded-md p-2 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
                                      title="Reject"
                                    >
                                      <ShieldX className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                               <button
                                 type="button"
                                 onClick={() => {
                                   setIsDayListOpen(false);
                                   openEditBusBooking(booking);
                                 }}
                                 disabled={isActionDisabledForApproved(booking.status)}
                                 className={`inline-flex items-center justify-center rounded-md p-2 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors ${isActionDisabledForApproved(booking.status) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                 title={isActionDisabledForApproved(booking.status) ? 'Cannot edit an approved booking' : 'Edit'}
                               >
                                 <Pencil className="w-3.5 h-3.5" />
                               </button>
                               <button
                                 type="button"
                                 onClick={() => handleDeleteBusBooking(booking.id)}
                                 disabled={isActionDisabledForApproved(booking.status)}
                                 className={`inline-flex items-center justify-center rounded-md p-2 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors ${isActionDisabledForApproved(booking.status) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                 title={isActionDisabledForApproved(booking.status) ? 'Cannot delete an approved booking' : 'Delete'}
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
