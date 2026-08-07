import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  User, Plus, Wrench, AlertCircle, Clock, CheckCircle, XCircle, Search, Filter, LogOut, KeyRound, Building2
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import StatsCards from './StatsCards';
import IndentTable from './IndentTable';
import RaiseIndentModal from '../../components/RaiseIndentModal';
import IndentDetailsModal from './IndentDetailsModal';
import NotificationBell from '../../components/NotificationBell';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import logo from '../../assets/logo.png';

const SUMMARY_CARDS = [
  { title: "Indent Created", icon: AlertCircle, color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-200" },
  { title: "Approved by Dept HOD", icon: CheckCircle, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  { title: "In Progress", icon: Clock, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
];

export default function FacultyDashboard() {
  const { user, logout } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const isCoordinatorStaff = Boolean(user?.isCoordinatorStaff);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const statsCounts = React.useMemo(() => {
    return {
      "Indent Created": complaints.filter(c => c.status === 'Indent Created').length,
      "Approved by Dept HOD": complaints.filter(c => c.status === 'Approved by Dept HOD' || c.status === 'Approved by Principal').length,
      "In Progress": complaints.filter(c => c.status === 'In Progress').length,
    };
  }, [complaints]);

  // Fetch from secure backend
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoadingData(true);
        const res = await api.get('/faculty/dashboard');
        setComplaints(res.data.complaints || []);
      } catch (err) {
        console.error("Failed to fetch secure dashboard data:", err);
        setComplaints([]); 
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchDashboardData();
  }, []);

  // New Indent Form State
  const [formData, setFormData] = useState({
    department: '',
    nature: 'Maintenance/Repair',
    location: '',
    description: '',
    additionalDetails: '',
    image: null
  });

  const filteredComplaints = complaints.filter(c => {
    const idMatch = c.indentNumber ? c.indentNumber.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const locMatch = c.location ? c.location.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const descMatch = c.description ? c.description.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    
    const matchesSearch = idMatch || locMatch || descMatch;
    const matchesFilter = filterStatus === 'All' || (filterStatus === 'Approved by Dept HOD' ? (c.status === 'Approved by Dept HOD' || c.status === 'Approved by Principal') : c.status === filterStatus);
    return matchesSearch && matchesFilter;
  });

  const handleRaiseSubmit = async (e) => {
    e.preventDefault();
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('category', formData.department);
      formDataToSend.append('nature', formData.nature);
      formDataToSend.append('location', formData.location);
      formDataToSend.append('description', formData.description);
      
      if (formData.additionalDetails) {
        formDataToSend.append('additionalDetails', formData.additionalDetails);
      }
      if (formData.image) {
        formDataToSend.append('image', formData.image);
      }

      const res = await api.post('/faculty/complaints', formDataToSend, {
      });
      
      setComplaints([res.data.complaint, ...complaints]);
      setIsRaiseModalOpen(false);
      setFormData({ department: '', nature: 'Maintenance/Repair', location: '', description: '', additionalDetails: '', image: null });
    } catch (err) {
      console.error("Failed to raise indent:", err);
      alert("Failed to raise indent. Please try again.");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const indentIdParam = params.get('indentId');
    if (indentIdParam && complaints.length > 0) {
      const target = complaints.find(c => c._id === indentIdParam || c.id === indentIdParam);
      if (target) {
        setSelectedComplaint(target);
        // Remove param so it doesn't trigger again on refresh
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [complaints]);


  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* 1. Header Section */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <img src={logo} alt="KLS GIT Logo" className="h-10 w-10 object-contain" />
              {/* <Wrench className="w-8 h-8 text-indigo-600" /> */}
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 hidden sm:block">
                Digital Maintenance System
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <NotificationBell />
              <Link to="/profile" className="flex items-center space-x-2 hover:opacity-80 transition-opacity" title="My Profile">
                <span className="text-sm font-medium text-slate-600">Welcome, {user?.name || 'Faculty Member'}</span>
                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200 shadow-sm cursor-pointer">
                  <User className="h-5 w-5 text-indigo-600" />
                </div>
              </Link>
              <button onClick={() => setIsChangePasswordOpen(true)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="Change Password">
                <KeyRound className="w-5 h-5" />
              </button>
              <button onClick={logout} className="ml-1 p-2 text-slate-400 hover:text-red-500 transition-colors" title="Logout">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 no-print">
        
        {/* Top Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <h2 className="text-2xl font-semibold text-slate-800">Dashboard</h2>
          <div className="flex items-center space-x-3">
            {isCoordinatorStaff && (
              <Link
                to="/stationary-indent-create"
                className="flex items-center px-4 py-2.5 border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-medium rounded-lg shadow-sm transition-all"
              >
                <Wrench className="w-4 h-4 mr-2" />
                Stationary Indent
              </Link>
            )}
            <Link
              to="/hall-bookings"
              className="flex items-center px-4 py-2.5 border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-medium rounded-lg shadow-sm transition-all"
            >
              <Building2 className="w-4 h-4 mr-2" />
              Hall Booking
            </Link>
            <button 
              onClick={() => setIsRaiseModalOpen(true)}
              className="flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95"
            >
              <Plus className="w-5 h-5 mr-2" />
              Raise New Indent
            </button>
          </div>
        </div>

        {/* Dashboard Summary Cards */}
        <StatsCards 
          statsCards={SUMMARY_CARDS} 
          statsCounts={statsCounts} 
          onCardClick={(title) => setFilterStatus(prev => prev === title ? 'All' : title)}
          activeFilter={filterStatus}
        />

        {/* Active Complaints Table Section */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-200 flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
            <h3 className="text-lg font-semibold text-slate-800">Your Indents</h3>
            
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full lg:w-auto">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search by ID, location..." 
                  className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full lg:w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="relative">
                <Filter className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <select 
                  className="pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white w-full sm:w-auto"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="All">All Status</option>
                  <option value="Indent Created">Indent Created</option>
                  <option value="Approved by Dept HOD">Approved by Dept HOD</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Rejected by Dept HOD">Rejected by Dept HOD</option>
                  <option value="Rejected by Maintenance HOD">Rejected by Maintenance HOD</option>
                  <option value="Rejected by Principal">Rejected by Principal</option>
                </select>
              </div>
            </div>
          </div>

          <IndentTable 
            filteredComplaints={filteredComplaints} 
            setSelectedComplaint={setSelectedComplaint} 
          />
        </div>
      </main>

      {isRaiseModalOpen && (
        <RaiseIndentModal 
          setIsRaiseModalOpen={setIsRaiseModalOpen}
          handleRaiseSubmit={handleRaiseSubmit}
          formData={formData}
          setFormData={setFormData}
        />
      )}

      {selectedComplaint && (
        <IndentDetailsModal
          selectedComplaint={selectedComplaint}
          setSelectedComplaint={setSelectedComplaint}
        />
      )}

      {isChangePasswordOpen && (
        <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />
      )}
    </div>
  );
}
