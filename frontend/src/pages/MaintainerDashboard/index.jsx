import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  User, Plus, Wrench, AlertCircle, Clock, CheckCircle, Search, Filter, LogOut, ShoppingCart
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import StatsCards from '../FacultyDashboard/StatsCards';
import MaintainerIndentTable from './MaintainerIndentTable';
import ComplaintDetails from '../../components/complaint/ComplaintDetails';
import NotificationBell from '../../components/NotificationBell';

const SUMMARY_CARDS = [
  { title: "In Progress", icon: Clock, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
  { title: "Pending Verification", icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  { title: "Completed", icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
];

export default function MaintainerDashboard() {
  const { user, logout } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [selectedComplaint, setSelectedComplaint] = useState(null);

  const refreshData = async () => {
    try {
      setIsLoadingData(true);
      const res = await api.get('/maintainer/dashboard');
      setComplaints(res.data.assignedIndents || []);
    } catch (err) {
      console.error("Failed to fetch secure dashboard data:", err);
      setComplaints([]); 
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const statsCounts = React.useMemo(() => {
    return {
      "In Progress": complaints.filter(c => !c.isMaintainerCompleted && c.status !== 'Completed').length,
      "Pending Verification": complaints.filter(c => c.isMaintainerCompleted && c.status !== 'Completed').length,
      "Completed": complaints.filter(c => c.status === 'Completed').length,
    };
  }, [complaints]);

  const filteredComplaints = complaints.filter(c => {
    const idMatch = c.indentNumber ? c.indentNumber.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const locMatch = c.location ? c.location.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const matchesSearch = idMatch || locMatch;
    
    let matchesFilter = true;
    if (filterStatus === 'In Progress') {
      matchesFilter = !c.isMaintainerCompleted && c.status !== 'Completed';
    } else if (filterStatus === 'Pending Verification') {
      matchesFilter = c.isMaintainerCompleted && c.status !== 'Completed';
    } else if (filterStatus === 'Completed') {
      matchesFilter = c.status === 'Completed';
    }
    
    return matchesSearch && matchesFilter;
  });

  const handleUpdateStatus = async (id, updates) => {
    try {
      await api.put(`/maintainer/complaints/${id}`, updates);
      if (updates.isMaintainerCompleted) {
        alert("Work marked as completed and pending verification by HOD!");
      }
      refreshData();
      setSelectedComplaint(null);
    } catch (err) {
      console.error(err);
      alert("Failed to update indent.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Wrench className="w-8 h-8 text-indigo-600" />
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 hidden sm:block">
                Maintainer Dashboard
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <NotificationBell />
              <Link to="/profile" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                <span className="text-sm font-medium text-slate-600">Welcome, {user?.name}</span>
                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200">
                  <User className="h-5 w-5 text-indigo-600" />
                </div>
              </Link>
              <button onClick={logout} className="ml-4 p-2 text-slate-400 hover:text-red-500 transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 no-print">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <h2 className="text-2xl font-semibold text-slate-800">Assigned Indents</h2>
          
          {/* E-Tendering Link button */}
          <a 
            href="https://officerp.git.edu" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            Order Items (E-Tendering)
          </a>
        </div>

        <StatsCards 
          statsCards={SUMMARY_CARDS} 
          statsCounts={statsCounts} 
          onCardClick={(title) => setFilterStatus(prev => prev === title ? 'All' : title)}
          activeFilter={filterStatus}
        />

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-slate-800">Your Tasks</h3>
            <div className="flex space-x-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search by ID, location..." 
                  className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select 
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="All">All Status</option>
                <option value="In Progress">In Progress</option>
                <option value="Pending Verification">Pending Verification</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          <MaintainerIndentTable 
            filteredComplaints={filteredComplaints} 
            setSelectedComplaint={setSelectedComplaint} 
          />
        </div>
      </main>

      {selectedComplaint && (
        <ComplaintDetails 
          complaint={selectedComplaint} 
          onClose={() => setSelectedComplaint(null)} 
          onUpdateStatus={handleUpdateStatus} 
        />
      )}
    </div>
  );
}
