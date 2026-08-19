import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { ArrowLeft, Plus, XCircle, User, LogOut, KeyRound, Pencil, Trash2, ChevronLeft, ChevronRight, CheckCircle, ShieldX, Clock } from 'lucide-react';
import NotificationBell from '../../../components/NotificationBell';
import ChangePasswordModal from '../../../components/ChangePasswordModal';
import api from '../../../api/axios';
import logo from '../../../assets/logo.png';
import { ROLES, ROLE_DASHBOARDS } from '../../../constants/roles';

const initialHallForm = {
  name: '',
  location: '',
  status: 'Active',
};

const initialBookingForm = {
  hall_id: '',
  booked_by: '',
  booked_by_name: '',
  booked_by_email: '',
  purpose: '',
  start_datetime: '',
  end_datetime: '',
  remarks: '',
  status: 'PENDING',
};

const managementTabs = [
  { id: 'halls', label: 'Hall List' },
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

const isBookingOnDate = (booking, dateString) => {
  if (!dateString) return false;

  const startDate = toLocalDateString(booking.start_datetime);
  const endDate = toLocalDateString(booking.end_datetime || booking.start_datetime);

  if (!startDate) return false;
  if (!endDate) return startDate === dateString;

  return dateString >= startDate && dateString <= endDate;
};

const toDatetimeLocalValue = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (num) => String(num).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatTimeWithAmPm = (value) => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const amPm = hours >= 12 ? 'PM' : 'AM';
  hours %= 12;
  if (hours === 0) hours = 12;

  return `${String(hours).padStart(2, '0')}:${minutes} ${amPm}`;
};

const formatDateLabel = (value) => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatBookingDateRange = (startValue, endValue) => {
  const startLabel = formatDateLabel(startValue);
  const endLabel = formatDateLabel(endValue);

  if (!startValue) return '-';
  if (!endValue || startLabel === endLabel) return startLabel;

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
    const period = getTimeOfDay(booking.start_datetime);
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
      if (a.hall_id !== b.hall_id) continue;

      const startA = new Date(a.start_datetime);
      const endA = new Date(a.end_datetime);
      const startB = new Date(b.start_datetime);
      const endB = new Date(b.end_datetime);

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
                        <span className="font-medium text-slate-800 text-sm truncate">{booking.hall_name || 'Hall'}</span>
                        <span className="text-xs text-slate-500 truncate">
                          {formatTimeWithAmPm(booking.start_datetime)} – {formatTimeWithAmPm(booking.end_datetime)}
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

export default function HallBookingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const userRole = user?.role;
  const isAdminOrReceptionist = userRole === ROLES.ADMIN || userRole === ROLES.RECEPTIONIST;

  const visibleTabs = isAdminOrReceptionist ? managementTabs : facultyTabs;
  const defaultActiveTab = isAdminOrReceptionist ? 'halls' : 'calendar';

  const backPath = ROLE_DASHBOARDS[userRole] || '/';
  const backLabel = 'Back to Dashboard';
  const sectionLabel = isAdminOrReceptionist ? 'Reception Operations' : 'Hall Booking';
  const roleDefaultName = isAdminOrReceptionist ? (user?.name || 'Receptionist') : (user?.name || 'Staff Member');
  const roleDefaultDept = isAdminOrReceptionist ? (user?.department || 'Reception Desk') : (user?.department || 'Staff');
  const statusOptions = isAdminOrReceptionist ? managementStatusOptions : facultyStatusOptions;

  const isActionDisabledForApproved = (status) => !isAdminOrReceptionist && (status || '').toUpperCase() === 'APPROVED';

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isDayListOpen, setIsDayListOpen] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [hallBookings, setHallBookings] = useState([]);
  const [form, setForm] = useState(initialHallForm);
  const [bookingForm, setBookingForm] = useState(initialBookingForm);
  const [loading, setLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(defaultActiveTab);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedDayBookings, setSelectedDayBookings] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [editingHallBookingId, setEditingHallBookingId] = useState(null);

  const loadHalls = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/halls');
      setBookings(response.data?.halls || []);
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to load halls');
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
    const todayBookings = hallBookings.filter((b) => isBookingOnDate(b, today));
    const tomorrowBookings = hallBookings.filter((b) => isBookingOnDate(b, tomorrow));
    return {
      today: todayBookings,
      todayConflicts: detectConflicts(todayBookings),
      tomorrow: tomorrowBookings,
      tomorrowConflicts: detectConflicts(tomorrowBookings),
    };
  }, [hallBookings, today, tomorrow]);

  const loadHallBookings = async () => {
    setCalendarLoading(true);
    setError('');

    try {
      const response = await api.get('/hall-bookings');
      setHallBookings(response.data?.bookings || []);
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to load hall bookings');
    } finally {
      setCalendarLoading(false);
    }
  };

  const openBookingModal = (dateString) => {
    setSelectedDate(dateString);
    setBookingForm({
      ...initialBookingForm,
      booked_by: user?.id || '',
      booked_by_name: user?.name || '',
      booked_by_email: user?.email || '',
      hall_id: '',
      start_datetime: `${dateString}T09:00`,
      end_datetime: `${dateString}T10:00`,
    });
    setEditingHallBookingId(null);
    setIsBookingModalOpen(true);
  };

  const openDayList = (dateString, dayBookings) => {
    setSelectedDate(dateString);
    setSelectedDayBookings(dayBookings);
    setIsDayListOpen(true);
  };

  useEffect(() => {
    loadHalls();
  }, []);

  useEffect(() => {
    if (activeTab === 'calendar' && hallBookings.length === 0) {
      loadHallBookings();
    }
  }, [activeTab]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      if (editingBookingId) {
        await api.put(`/halls/${editingBookingId}`, form);
      } else {
        await api.post('/halls', form);
      }

      setForm(initialHallForm);
      setEditingBookingId(null);
      setIsModalOpen(false);
      await loadHalls();
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to save hall');
    }
  };

  const filteredHallBookings = selectedDate
    ? hallBookings.filter((booking) => isBookingOnDate(booking, selectedDate))
    : hallBookings;

  const groupedHallBookings = filteredHallBookings.reduce((groups, booking) => {
    const day = String(booking.start_datetime || '').slice(0, 10) || 'Unknown date';
    if (!groups[day]) {
      groups[day] = [];
    }
    groups[day].push(booking);
    return groups;
  }, {});

  const handleAddHall = () => {
    setForm(initialHallForm);
    setEditingBookingId(null);
    setIsModalOpen(true);
  };

  const handleEditBooking = (booking) => {
    setForm({
      name: booking.name,
      location: booking.location,
      status: booking.status || 'Active',
    });
    setEditingBookingId(booking.id);
    setIsModalOpen(true);
  };

  const handleDeleteHall = async (hallId) => {
    try {
      await api.delete(`/halls/${hallId}`);
      await loadHalls();
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to delete hall');
    }
  };

  const handleBookingSubmit = async (event) => {
    event.preventDefault();

    try {
      if (editingHallBookingId) {
        await api.put(`/hall-bookings/${editingHallBookingId}`, bookingForm);
      } else {
        await api.post('/hall-bookings', bookingForm);
      }

      setIsBookingModalOpen(false);
      setBookingForm(initialBookingForm);
      setEditingHallBookingId(null);
      await loadHallBookings();
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to save booking');
    }
  };

  const openEditHallBooking = (booking) => {
    setBookingForm({
      hall_id: String(booking.hall_id || ''),
      booked_by: String(booking.booked_by || ''),
      booked_by_name: String(booking.booked_by_name || booking.booked_by || ''),
      booked_by_email: String(booking.booked_by_email || ''),
      purpose: booking.purpose || '',
      start_datetime: toDatetimeLocalValue(booking.start_datetime),
      end_datetime: toDatetimeLocalValue(booking.end_datetime),
      remarks: booking.remarks || '',
      status: booking.status || 'PENDING',
    });
    setEditingHallBookingId(booking.id);
    setIsBookingModalOpen(true);
  };

  const handleDeleteHallBooking = async (bookingId) => {
    try {
      await api.delete(`/hall-bookings/${bookingId}`);
      setIsBookingModalOpen(false);
      setIsDayListOpen(false);
      setEditingHallBookingId(null);
      setBookingForm(initialBookingForm);
      await loadHallBookings();
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to delete booking');
    }
  };

  const handleApproveBooking = async (booking) => {
    try {
      await api.put(`/hall-bookings/${booking.id}/approve`);
      setIsDayListOpen(false);
      await loadHallBookings();
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to approve booking');
    }
  };

  const handleRejectBooking = async (booking) => {
    try {
      await api.put(`/hall-bookings/${booking.id}/reject`, { remarks: booking.remarks || '' });
      setIsDayListOpen(false);
      await loadHallBookings();
    } catch (apiError) {
      setError(apiError.response?.data?.message || 'Failed to reject booking');
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
                 <h1 className="text-lg font-bold text-slate-900 leading-tight">Hall Bookings</h1>
                 <p className="text-xs text-indigo-600">{isAdminOrReceptionist ? 'Reception desk booking management' : 'Book and view hall reservations'}</p>
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
            {/* <h2 className="mt-2 text-3xl font-bold text-slate-900">Hall Booking</h2> */}
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

        {activeTab === 'halls' && (
          <>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddHall}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Hall
              </button>
            </div>

            {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{editingBookingId ? 'Edit Hall' : 'Add Hall'}</h3>
                </div>
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 grid gap-4 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  <span>Hall Name</span>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  <span>Location</span>
                  <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location" required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
                </label>
                {editingBookingId && (
                  <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">
                    <span>Status</span>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm bg-white">
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </label>
                )}
                <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50">Cancel</button>
                  <button type="submit" className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700">{editingBookingId ? 'Update Hall' : 'Save Hall'}</button>
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
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Location</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">Loading halls...</td>
                      </tr>
                    ) : bookings.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">No halls yet. Add one above to get started.</td>
                      </tr>
                    ) : (
                      bookings.map((booking, index) => (
                        <tr key={booking.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 text-sm text-slate-700">{index + 1}</td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">{booking.name}</td>
                          <td className="px-6 py-4 text-sm text-slate-700">{booking.location}</td>
                          <td className="px-6 py-4 text-sm text-indigo-600 font-semibold">{booking.status}</td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditBooking(booking)}
                                className="inline-flex items-center justify-center rounded-md p-2 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteHall(booking.id)}
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

            {/* Today & Tomorrow Summary */}
            {!calendarLoading && (
              <div className="grid gap-4 md:grid-cols-2">
                {((upcomingBookings.today.length > 0 && upcomingBookings.todayConflicts.size > 0) ||
                  (upcomingBookings.tomorrow.length > 0 && upcomingBookings.tomorrowConflicts.size > 0)) && (
                  <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                    <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.097a4.5 4.5 0 0 1 7.706 3.103v3.747a2 2 0 0 1-.614 1.414l-5.5 5a2 2 0 0 1-2.878-1.553V9.355a2 2 0 0 1 .614-1.414l3.654-3.654a.75.75 0 0 0-1.06-1.06L7.5 5.5v9.5a.5.5 0 0 0 .776.416l4.5-3a.5.5 0 0 0-.025-.845V6.1a4.5 4.5 0 0 1-.019-.003z" clipRule="evenodd" /></svg>
                    <span>
                      <strong>Conflict alert:</strong> Overlapping bookings detected for the same hall on today or tomorrow. Please review and adjust timings.
                    </span>
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Today<span className="text-xs text-slate-400 font-normal">({formatDateLabel(today)})</span>
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
                    Tomorrow<span className="text-xs text-slate-400 font-normal">({formatDateLabel(tomorrow)})</span>
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

            {calendarLoading ? (
              <div className="py-10 text-center text-sm text-slate-500">Loading hall bookings...</div>
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
                    const dayBookings = hallBookings.filter((booking) => isBookingOnDate(booking, dateString));

                    return (
                      <button
                        key={dateString}
                        type="button"
                        onClick={() => openBookingModal(dateString)}
                        className={`min-h-28 rounded-xl border p-3 text-left transition-colors ${selectedDate === dateString ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'}`}
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
                            {/* <div className="text-[11px] text-slate-500">{dayBookings.length} booking{dayBookings.length > 1 ? 's' : ''}</div> */}
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
                      </button>
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
                <h3 className="text-lg font-semibold text-slate-900">{editingHallBookingId ? 'Edit Hall Booking' : 'Create Hall Booking'}</h3>
                <p className="text-sm text-slate-500">
                  For {bookingForm.start_datetime ? bookingForm.start_datetime.slice(0, 10) : 'selected date'}
                </p>
                {editingHallBookingId && (() => {
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
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>Hall</span>
                <select value={bookingForm.hall_id} onChange={(e) => setBookingForm({ ...bookingForm, hall_id: e.target.value })} required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm bg-white">
                  <option value="">Select Hall</option>
                  {bookings.map((hall) => (
                    <option key={hall.id} value={hall.id}>{hall.name}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>Booked By</span>
                <input value={bookingForm.booked_by_name} onChange={(e) => setBookingForm({ ...bookingForm, booked_by_name: e.target.value })} placeholder="Enter name" required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>Booked By Email</span>
                <input type="email" value={bookingForm.booked_by_email} onChange={(e) => setBookingForm({ ...bookingForm, booked_by_email: e.target.value })} placeholder="name@example.com" required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              {editingHallBookingId && (
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
              <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">
                <span>Purpose</span>
                <input value={bookingForm.purpose} onChange={(e) => setBookingForm({ ...bookingForm, purpose: e.target.value })} placeholder="Purpose" className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>Start Date & Time</span>
                <input type="datetime-local" value={bookingForm.start_datetime} onChange={(e) => setBookingForm({ ...bookingForm, start_datetime: e.target.value })} required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                <span>End Date & Time</span>
                <input type="datetime-local" value={bookingForm.end_datetime} onChange={(e) => setBookingForm({ ...bookingForm, end_datetime: e.target.value })} required className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">
                <span>Remarks</span>
                <textarea value={bookingForm.remarks} onChange={(e) => setBookingForm({ ...bookingForm, remarks: e.target.value })} placeholder="Remarks" rows={3} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
              </label>
              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                {editingHallBookingId && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isActionDisabledForApproved(bookingForm.status)) return;
                      handleDeleteHallBooking(editingHallBookingId);
                    }}
                    disabled={isActionDisabledForApproved(bookingForm.status)}
                    className={`px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 inline-flex items-center gap-2 ${isActionDisabledForApproved(bookingForm.status) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Booking
                  </button>
                )}
                <button type="button" onClick={() => setIsBookingModalOpen(false)} className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700">{editingHallBookingId ? 'Update Booking' : 'Save Booking'}</button>
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
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Hall</th>
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
                        <td className="px-4 py-4 text-sm font-medium text-slate-900">{booking.hall_name || booking.hall?.name || 'Hall'}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{booking.booked_by_name || '-'}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{booking.booked_by_email || '-'}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">{booking.purpose || '-'}</td>
                         <td className="px-4 py-4 text-sm">
                           {(() => {
                             const badge = getStatusBadge(booking.status);
                             return (
                               <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}>
                                 {badge.label}
                               </span>
                             );
                           })()}
                         </td>
                        <td className="px-4 py-4 text-sm text-slate-700">{formatBookingDateRange(booking.start_datetime, booking.end_datetime)}</td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {formatTimeWithAmPm(booking.start_datetime)} to {formatTimeWithAmPm(booking.end_datetime)}
                        </td>
                         <td className="px-4 py-4 text-sm text-slate-700">
                           <div className="flex items-center gap-2">
                              {isAdminOrReceptionist && (
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
                                  if (isActionDisabledForApproved(booking.status)) return;
                                  setIsDayListOpen(false);
                                  openEditHallBooking(booking);
                                }}
                                disabled={isActionDisabledForApproved(booking.status)}
                                className={`inline-flex items-center justify-center rounded-md p-2 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors ${isActionDisabledForApproved(booking.status) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title={isActionDisabledForApproved(booking.status) ? 'Cannot edit an approved booking' : 'Edit'}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isActionDisabledForApproved(booking.status)) return;
                                  handleDeleteHallBooking(booking.id);
                                }}
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