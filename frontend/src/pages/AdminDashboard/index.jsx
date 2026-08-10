import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Shield, User, LogOut, KeyRound } from 'lucide-react';
import StatsCards from './StatsCards';
import DepartmentManager from './DepartmentManager';
import CoordinatorManager from './CoordinatorManager';
import RoleManager from './RoleManager';
import UserManager from './UserManager';
import ComplaintTable from './ComplaintTable';
import Analytics from '../../components/Analytics';
import ReportManager from './ReportManager';
import ComplaintDetails from '../../components/complaint/ComplaintDetails';
import api from '../../api/axios';
import NotificationBell from '../../components/NotificationBell';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import logo from '../../assets/logo.png';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  
  // State toggles for main view
  const [activeTab, setActiveTab] = useState('departments');
  const [filterStatus, setFilterStatus] = useState('All');

  const [stats, setStats] = useState({ totalDepartments: 0, totalUsers: 0, activeComplaints: 0, resolvedComplaints: 0 });
  const [departments, setDepartments] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const fetchAdminData = async () => {
    try {
      setIsLoading(true);
      console.log("Admin Dashboard: Fetching data...");
      const [statsRes, deptsRes, usersRes, compRes] = await Promise.allSettled([
         api.get('/admin/stats'),
         api.get('/admin/departments'),
         api.get('/admin/users'),
         api.get('/admin/complaints')
      ]);
      
      console.log("Stats Response:", statsRes);
      console.log("Depts Response:", deptsRes);
      console.log("Users Response:", usersRes);
      console.log("Complaints Response:", compRes);
      
      if(statsRes.status === 'fulfilled' && statsRes.value?.data?.stats) setStats(statsRes.value.data.stats);
      if(deptsRes.status === 'fulfilled' && deptsRes.value?.data?.departments) setDepartments(deptsRes.value.data.departments);
      if(usersRes.status === 'fulfilled' && usersRes.value?.data?.users) setUsersList(usersRes.value.data.users);
      if(compRes.status === 'fulfilled' && compRes.value?.data?.complaints) setComplaints(compRes.value.data.complaints);
    } catch (err) {
      console.error("Failed to fetch admin data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const indentIdParam = params.get('indentId');
    if (indentIdParam && complaints.length > 0) {
      const target = complaints.find(c => c._id === indentIdParam || c.id === indentIdParam);
      if (target) {
        setSelectedComplaint(target);
        setActiveTab('complaints');
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [complaints]);

  const handleStatsClick = (filterValue) => {
    if (filterValue === 'departmentsTab') {
      setActiveTab('departments');
      setFilterStatus('All');
    } else if (filterValue === 'usersTab') {
      setActiveTab('users');
      setFilterStatus('All');
    } else {
      setActiveTab('complaints');
      setFilterStatus(prev => prev === filterValue ? 'All' : filterValue);
    }
  };

  const displayedComplaints = React.useMemo(() => {
    if (filterStatus === 'All') return complaints;
    if (filterStatus === 'Active') {
      return complaints.filter(c => c.status !== 'Completed' && !c.status.startsWith('Rejected'));
    }
    if (filterStatus === 'Completed') {
      return complaints.filter(c => c.status === 'Completed');
    }
    return complaints;
  }, [complaints, filterStatus]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {/* 1. Header Section */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-20 shadow-sm no-print flex flex-col">
        {/* Top Tier: Branding & Profile */}
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 w-full border-b border-slate-800/60">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img src={logo} alt="KLS GIT Logo" className="h-10 w-10 object-contain bg-white rounded-full p-0.5" />
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-white leading-tight">Admin Dashboard</h1>
                <p className="text-xs text-indigo-300">System Control Panel</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <NotificationBell />
              <Link to="/profile" className="flex items-center space-x-2 hover:opacity-80 transition-opacity animate-in" title="My Profile">
                <span className="text-sm font-medium text-slate-300">
                  {user?.name || 'Administrator'}
                </span>
                <div className="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 cursor-pointer">
                  <User className="h-4 w-4 text-slate-300" />
                </div>
              </Link>
              <button
                onClick={() => setIsChangePasswordOpen(true)}
                className="text-slate-400 hover:text-indigo-300 transition-colors bg-slate-800 p-2 rounded-lg"
                title="Change Password"
              >
                <KeyRound className="w-4 h-4" />
              </button>
              <button
                onClick={logout}
                className="text-slate-400 hover:text-red-400 transition-colors bg-slate-800 p-2 rounded-lg"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Tier: Navigation Tabs & Actions */}
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex justify-between items-center h-14">
            {/* Tabs */}
            <div className="flex space-x-8 overflow-x-auto no-scrollbar h-full w-full">
              <button 
                onClick={() => setActiveTab('departments')}
                className={`whitespace-nowrap h-full border-b-2 px-1 flex items-center font-medium text-sm transition-colors ${
                  activeTab === 'departments' 
                    ? 'border-indigo-400 text-indigo-300' 
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                Departments
              </button>
              <button 
                onClick={() => setActiveTab('complaints')}
                className={`whitespace-nowrap h-full border-b-2 px-1 flex items-center font-medium text-sm transition-colors ${
                  activeTab === 'complaints' 
                    ? 'border-indigo-400 text-indigo-300' 
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                Indents
              </button>
              <button 
                onClick={() => setActiveTab('reports')}
                className={`whitespace-nowrap h-full border-b-2 px-1 flex items-center font-medium text-sm transition-colors ${
                  activeTab === 'reports' 
                    ? 'border-indigo-400 text-indigo-300' 
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                Reports
              </button>
              <button 
                onClick={() => setActiveTab('users')}
                className={`whitespace-nowrap h-full border-b-2 px-1 flex items-center font-medium text-sm transition-colors ${
                  activeTab === 'users' 
                    ? 'border-indigo-400 text-indigo-300' 
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                Users
              </button>
              <button 
                onClick={() => setActiveTab('coordinators')}
                className={`whitespace-nowrap h-full border-b-2 px-1 flex items-center font-medium text-sm transition-colors ${
                  activeTab === 'coordinators' 
                    ? 'border-indigo-400 text-indigo-300' 
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                Coordinator MGT
              </button>
              <button
                onClick={() => setActiveTab('roles')}
                className={`whitespace-nowrap h-full border-b-2 px-1 flex items-center font-medium text-sm transition-colors ${
                  activeTab === 'roles'
                    ? 'border-indigo-400 text-indigo-300'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                Role MGT
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 no-print">
        
        {/* 2. Stats Section */}
        <div className="mb-8">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">System Overview</h2>
          <StatsCards 
            stats={stats} 
            activeFilter={filterStatus}
            onCardClick={handleStatsClick}
          />
        </div>


        {/* Dynamic Content Area */}
        <div className="pb-32">
          
          {activeTab === 'departments' && (
            <div id="departments" className="scroll-mt-32">
              <DepartmentManager departments={departments} fetchDepartments={fetchAdminData} />
            </div>
          )}
          
          {activeTab === 'complaints' && (
            <div id="complaints" className="scroll-mt-32">
              <div className="mb-8">
                <Analytics complaints={displayedComplaints} />
              </div>
              <ComplaintTable 
                complaints={displayedComplaints}
                departments={departments}
                onOpenDetails={(complaint) => setSelectedComplaint(complaint)} 
              />
            </div>
          )}

          {activeTab === 'reports' && (
            <div id="reports" className="scroll-mt-32">
              <ReportManager />
            </div>
          )}

          {activeTab === 'users' && (
            <div id="users" className="scroll-mt-32">
              <UserManager users={usersList} onUserUpdate={fetchAdminData} />
            </div>
          )}

          {activeTab === 'coordinators' && (
            <div id="coordinators" className="scroll-mt-32">
              <CoordinatorManager />
            </div>
          )}

          {activeTab === 'roles' && (
            <div id="roles" className="scroll-mt-32">
              <RoleManager />
            </div>
          )}

        </div>
      </main>

      {/* Details Modal */}
      {selectedComplaint && (
        <ComplaintDetails
          complaint={selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
          // Admin view is strictly read-only, so we pass empty handlers for status/resolve
          onUpdateStatus={() => {}}
          onResolve={() => {}}
        />
      )}

      {isChangePasswordOpen && (
        <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />
      )}
    </div>
  );
}
