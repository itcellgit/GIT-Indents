import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, User as UserIcon, Plus, KeyRound } from 'lucide-react';
import StatsCards from '../HODDashboard/StatsCards';
import ComplaintTable from '../HODDashboard/ComplaintTable';
import ComplaintDetails from '../../components/complaint/ComplaintDetails';
import RaiseIndentModal from '../../components/RaiseIndentModal';
import ReportManager from '../AdminDashboard/ReportManager';
import UserManager from '../AdminDashboard/UserManager';
import Analytics from '../../components/Analytics';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../../components/NotificationBell';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import logo from '../../assets/logo.png';

const PrincipalDashboard = () => {
  const { user, logout } = useAuth();
  const [departmentIndents, setDepartmentIndents] = useState([]);
  const [myRaisedIndents, setMyRaisedIndents] = useState([]);
  const [usersList, setUsersList] = useState([]);

  const [activeTab, setActiveTab] = useState('department');
  
  const [filterStatus, setFilterStatus] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  
  // New Indent Modal State
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    department: '',
    nature: 'Maintenance/Repair',
    location: '',
    description: '',
    additionalDetails: '',
    image: null
  });

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsersList(res.data.users || []);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        setIsLoading(true);
        // Fetch complaints from backend endpoint (same as HOD but backend handles Principal role)
        const res = await api.get('/hod/complaints');
        setDepartmentIndents(res.data.departmentIndents || []);
        setMyRaisedIndents(res.data.myRaisedIndents || []);
      } catch (err) {
        console.error("Failed to fetch complaints:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchComplaints();
    fetchUsers();
  }, []);

  const filteredDepartmentIndents = useMemo(() => {
    if (filterStatus === 'All') return departmentIndents;
    if (filterStatus === 'Approved by Dept HOD') {
      return departmentIndents.filter(c => c.status === 'Approved by Principal' || c.status === 'Approved by Dept HOD');
    }
    return departmentIndents.filter(c => c.status === filterStatus);
  }, [departmentIndents, filterStatus]);

  const stats = useMemo(() => {
    return {
      pending: departmentIndents.filter(c => c.status === 'Approved by Principal' || c.status === 'Approved by Dept HOD').length,
      inProgress: departmentIndents.filter(c => c.status === 'In Progress').length,
      resolved: departmentIndents.filter(c => c.status === 'Completed').length,
    };
  }, [departmentIndents]);

  const updateIndentList = (updatedComplaint) => {
    const targetId = updatedComplaint.id || updatedComplaint._id;
    if (!targetId) return;
    setDepartmentIndents(prev => prev.map(c => (c.id === targetId || c._id === targetId) ? updatedComplaint : c));
    setMyRaisedIndents(prev => prev.map(c => (c.id === targetId || c._id === targetId) ? updatedComplaint : c));
    if (selectedComplaint && (selectedComplaint.id === targetId || selectedComplaint._id === targetId)) {
      setSelectedComplaint(updatedComplaint);
    }
  };

  const handleUpdateStatus = async (id, updateData) => {
    try {
      const payload = { ...updateData };
      if (payload.worker) {
        payload.assignedWorkerNames = payload.worker.split(',').map(n => n.trim());
        delete payload.worker;
      }
      
      const res = await api.put(`/hod/complaints/${id}/status`, payload);
      updateIndentList(res.data.complaint);
    } catch (error) {
      console.error("Failed to update status:", error);
      alert(error.response?.data?.message || "Error updating status");
    }
  };

  const handleResolve = async (id, resolveData) => {
    try {
      const payload = {
        status: 'Completed',
        materialsUsed: resolveData.materials,
        remarksByHOD: resolveData.remarks,
        remarksByIncharge: resolveData.remarksByIncharge,
        remarksByCoordinator: resolveData.remarksByCoordinator,
        durationRequiredHours: resolveData.duration,
        reasonForDelayedWork: resolveData.delayReason,
        reasonForIncompleteWork: resolveData.resolvedDetails ? 'Completed' : ''
      };

      const res = await api.put(`/hod/complaints/${id}/status`, payload);
      updateIndentList(res.data.complaint);
    } catch (error) {
      console.error("Failed to resolve complaint:", error);
      alert(error.response?.data?.message || "Error resolving complaint");
    }
  };

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

      const res = await api.post('/hod/complaints', formDataToSend, {
      });
      
      setMyRaisedIndents([res.data.complaint, ...myRaisedIndents]);
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
    if (indentIdParam) {
      const allComplaints = [...departmentIndents, ...myRaisedIndents];
      if (allComplaints.length > 0) {
        const target = allComplaints.find(c => c._id === indentIdParam || c.id === indentIdParam);
        if (target) {
          setSelectedComplaint(target);

          if (departmentIndents.some(c => c._id === indentIdParam || c.id === indentIdParam)) {
            setActiveTab('department');
          } else {
            setActiveTab('myRaised');
          }

          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    }
  }, [departmentIndents, myRaisedIndents]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      
      {/* Header Section */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm no-print flex flex-col">
        {/* Top Tier: Branding & Profile */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full border-b border-gray-100">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img src={logo} alt="KLS GIT Logo" className="h-10 w-10 object-contain" />
              <div className="flex flex-col justify-center">
                <h1 className="text-xl font-bold text-gray-900 leading-tight">Principal Dashboard</h1>
                <p className="text-xs font-medium text-indigo-600">Administrative Oversight</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <NotificationBell />
              <Link to="/profile" className="hidden md:flex items-center gap-2 pr-4 border-r border-gray-200 hover:opacity-80 transition-opacity" title="My Profile">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="text-sm text-left">
                  <p className="font-semibold text-gray-700">{user?.name || 'Principal'}</p>
                  <p className="text-xs text-gray-500">{user?.department || 'Administration'}</p>
                </div>
              </Link>
              <button
                onClick={() => setIsChangePasswordOpen(true)}
                className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors"
                title="Change Password"
              >
                <KeyRound className="w-4 h-4" />
                <span className="hidden sm:inline">Change Password</span>
              </button>
              <button
                onClick={logout}
                className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Bottom Tier: Navigation Tabs & Actions */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="flex justify-between items-center h-14">
            {/* Tabs */}
            <div className="flex space-x-8 overflow-x-auto no-scrollbar h-full w-full sm:w-auto">
             
              <button
                onClick={() => setActiveTab('department')}
                className={`whitespace-nowrap h-full border-b-2 px-1 flex items-center font-medium text-sm transition-colors ${
                  activeTab === 'department' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Global Queue
              </button>
              <button
                onClick={() => setActiveTab('myRaised')}
                className={`whitespace-nowrap h-full border-b-2 px-1 flex items-center font-medium text-sm transition-colors ${
                  activeTab === 'myRaised' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                My Raised Indents
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`whitespace-nowrap h-full border-b-2 px-1 flex items-center font-medium text-sm transition-colors ${
                  activeTab === 'reports' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                System Reports
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`whitespace-nowrap h-full border-b-2 px-1 flex items-center font-medium text-sm transition-colors ${
                  activeTab === 'users' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                User Management
              </button>
            </div>

            {/* Action */}
            <button 
              onClick={() => setIsRaiseModalOpen(true)}
              className="hidden sm:flex flex-shrink-0 items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-sm text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>Raise Indent</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 no-print">

        {/* Dynamic Content Area */}
        <div className="pb-32">
          
          {activeTab === 'department' && (
            <div id="department" className="scroll-mt-32">
              <div className="mb-6 pb-2 border-b border-slate-200">
                <h2 className="text-xl font-bold text-slate-800">Global Queue</h2>
                <p className="text-sm text-gray-500 mt-1">A read-only view of every indent in the system. Approval and rejection are handled by the Facility Provider for each category.</p>
              </div>
              <StatsCards
                stats={stats} 
                activeFilter={filterStatus}
                onCardClick={(val) => {
                  setFilterStatus(prev => prev === val ? 'All' : val);
                  setActiveTab('department');
                }}
              />
              <div className="my-8">
                <h3 className="text-lg font-bold text-gray-800 mb-4">System Analytics</h3>
                <Analytics complaints={departmentIndents} />
              </div>
              <ComplaintTable 
                complaints={filteredDepartmentIndents}
                onOpenDetails={(complaint) => setSelectedComplaint(complaint)}
                showStatusFilter={true}
              />
            </div>
          )}

          {activeTab === 'myRaised' && (
            <div id="myRaised" className="scroll-mt-32">
              <h2 className="text-xl font-bold text-slate-800 mb-6 pb-2 border-b border-slate-200">My Raised Indents</h2>
              <ComplaintTable 
                complaints={myRaisedIndents}
                onOpenDetails={(complaint) => setSelectedComplaint(complaint)}
                showStatusFilter={true}
              />
            </div>
          )}

          {activeTab === 'reports' && (
            <div id="reports" className="scroll-mt-32">
              <h2 className="text-xl font-bold text-slate-800 mb-6 pb-2 border-b border-slate-200">System Reports</h2>
              <ReportManager />
            </div>
          )}

          {activeTab === 'users' && (
            <div id="users" className="scroll-mt-32">
              <h2 className="text-xl font-bold text-slate-800 mb-6 pb-2 border-b border-slate-200">User Management</h2>
              <UserManager users={usersList} onUserUpdate={fetchUsers} />
            </div>
          )}

        </div>

      </main>

      {/* Details Modal */}
      {selectedComplaint && (
        <ComplaintDetails 
          complaint={selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
          onUpdateStatus={handleUpdateStatus}
          onResolve={handleResolve}
        />
      )}

      {/* Raise Indent Modal */}
      {isRaiseModalOpen && (
        <RaiseIndentModal
          setIsRaiseModalOpen={setIsRaiseModalOpen}
          handleRaiseSubmit={handleRaiseSubmit}
          formData={formData}
          setFormData={setFormData}
        />
      )}

      {isChangePasswordOpen && (
        <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />
      )}

    </div>
  );
};

export default PrincipalDashboard;
