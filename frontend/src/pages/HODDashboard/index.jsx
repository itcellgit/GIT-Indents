import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, User as UserIcon, Plus } from 'lucide-react';
import StatsCards from './StatsCards';
import DeptStatsCards from './DeptStatsCards';
import ComplaintTable from './ComplaintTable';
import ComplaintDetails from '../../components/complaint/ComplaintDetails';
import RaiseIndentModal from '../../components/RaiseIndentModal';
import ManageMaintainers from './ManageMaintainers';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../../components/NotificationBell';

const HODDashboard = () => {
  const { user, logout } = useAuth();
  const [departmentIndents, setDepartmentIndents] = useState([]);
  const [approvalRequests, setApprovalRequests] = useState([]);
  const [myRaisedIndents, setMyRaisedIndents] = useState([]);
  const [deptTrackIndents, setDeptTrackIndents] = useState([]);
  
  const [activeTab, setActiveTab] = useState('approvals');

  const [filterStatus, setFilterStatus] = useState('All');
  const [deptFilterStatus, setDeptFilterStatus] = useState('All');
  const deptStatsRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (event.target.closest('.print-overlay') || event.target.closest('.print-modal-content')) {
        return;
      }
      if (deptStatsRef.current && !deptStatsRef.current.contains(event.target)) {
        setDeptFilterStatus('All');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const [isLoading, setIsLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  
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

  useEffect(() => {
    const fetchComplaints = async () => {
      try {
        setIsLoading(true);
        // Fetch complaints from backend endpoint
        const res = await api.get('/hod/complaints');
        setDepartmentIndents(res.data.departmentIndents || []);
        setApprovalRequests(res.data.approvalRequests || []);
        setMyRaisedIndents(res.data.myRaisedIndents || []);
        setDeptTrackIndents(res.data.deptTrackIndents || []);
      } catch (err) {
        console.error("Failed to fetch complaints:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchComplaints();
  }, []);

  const filteredDepartmentIndents = useMemo(() => {
    if (filterStatus === 'All') return departmentIndents;
    if (filterStatus === 'Approved by Dept HOD') {
      return departmentIndents.filter(c => c.status === 'Approved by Principal' || c.status === 'Approved by Dept HOD');
    }
    return departmentIndents.filter(c => c.status === filterStatus);
  }, [departmentIndents, filterStatus]);

  const activeMaintenanceCount = useMemo(() => {
    return departmentIndents.filter(c => 
      c.status === 'Approved by Dept HOD' || 
      c.status === 'Approved by Principal' || 
      c.status === 'Approved by Maintenance HOD' || 
      c.status === 'In Progress'
    ).length;
  }, [departmentIndents]);

  const stats = useMemo(() => {
    return {
      approvals: approvalRequests.length,
      pending: departmentIndents.filter(c => c.status === 'Approved by Principal' || c.status === 'Approved by Dept HOD').length,
      inProgress: departmentIndents.filter(c => c.status === 'In Progress').length,
      resolved: departmentIndents.filter(c => c.status === 'Completed').length,
    };
  }, [departmentIndents, approvalRequests]);

  const deptStats = useMemo(() => {
    return {
      total: deptTrackIndents.length,
      pendingApproval: deptTrackIndents.filter(c => c.status === 'Indent Created').length,
      active: deptTrackIndents.filter(c => c.status !== 'Completed' && c.status !== 'Indent Created' && !c.status.startsWith('Rejected')).length,
      completed: deptTrackIndents.filter(c => c.status === 'Completed').length,
    };
  }, [deptTrackIndents]);

  const filteredDeptTrackIndents = useMemo(() => {
    if (deptFilterStatus === 'All') return deptTrackIndents;
    if (deptFilterStatus === 'Pending Approval') {
      return deptTrackIndents.filter(c => c.status === 'Indent Created');
    }
    if (deptFilterStatus === 'Active') {
      return deptTrackIndents.filter(c => c.status !== 'Completed' && c.status !== 'Indent Created' && !c.status.startsWith('Rejected'));
    }
    if (deptFilterStatus === 'Completed') {
      return deptTrackIndents.filter(c => c.status === 'Completed');
    }
    return deptTrackIndents;
  }, [deptTrackIndents, deptFilterStatus]);

  const updateIndentList = (updatedComplaint) => {
    const targetId = updatedComplaint.id || updatedComplaint._id;
    if (!targetId) return;
    setDepartmentIndents(prev => prev.map(c => (c.id === targetId || c._id === targetId) ? updatedComplaint : c));
    setApprovalRequests(prev => prev.map(c => (c.id === targetId || c._id === targetId) ? updatedComplaint : c));
    setMyRaisedIndents(prev => prev.map(c => (c.id === targetId || c._id === targetId) ? updatedComplaint : c));
    setDeptTrackIndents(prev => prev.map(c => (c.id === targetId || c._id === targetId) ? updatedComplaint : c));
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
        headers: {
          'Content-Type': 'multipart/form-data',
        },
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
      const allComplaints = [...departmentIndents, ...approvalRequests, ...myRaisedIndents, ...deptTrackIndents];
      if (allComplaints.length > 0) {
        const target = allComplaints.find(c => c._id === indentIdParam || c.id === indentIdParam);
        if (target) {
          setSelectedComplaint(target);
          
          if (approvalRequests.some(c => c._id === indentIdParam || c.id === indentIdParam)) {
            setActiveTab('approvals');
          } else if (departmentIndents.some(c => c._id === indentIdParam || c.id === indentIdParam)) {
            setActiveTab('department');
          } else if (deptTrackIndents.some(c => c._id === indentIdParam || c.id === indentIdParam)) {
            setActiveTab('deptTrack');
          } else {
            setActiveTab('myRaised');
          }

          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    }
  }, [departmentIndents, approvalRequests, myRaisedIndents, deptTrackIndents]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      
      {/* Header Section */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex flex-col justify-center">
              <h1 className="text-xl font-bold text-gray-900 leading-tight">Maintenance Dashboard</h1>
              <p className="text-xs font-medium text-indigo-600">Department: Main Campus Operations</p>
            </div>
            
            <div className="flex items-center gap-4">
              <NotificationBell />
              <Link to="/profile" className="hidden md:flex items-center gap-2 pr-4 border-r border-gray-200 hover:opacity-80 transition-opacity" title="My Profile">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="text-sm text-left">
                  <p className="font-semibold text-gray-700">{user?.name || 'HOD User'}</p>
                  <p className="text-xs text-gray-500">{user?.department || 'Administrator'}</p>
                </div>
              </Link>
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
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 no-print">
        
        {/* Statistics and Action Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold text-gray-800">System Dashboard</h2>
            <p className="text-sm text-gray-500">Overview of all active operations and indents.</p>
          </div>
          <button 
            onClick={() => setIsRaiseModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>Raise New Indent</span>
          </button>
        </div>

        {/* Tab Switcher (Sticky) */}
        <div className="flex space-x-1 bg-gray-200/50 p-1 rounded-xl mb-8 w-full sm:w-fit sticky top-20 z-30">
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'approvals' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
            }`}
          >
            Approval Queue ({approvalRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('department')}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'department' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
            }`}
          >
            Maintenance Queue ({activeMaintenanceCount})
          </button>
          {user?.role === 'HOD' && (
            <button
              onClick={() => setActiveTab('deptTrack')}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'deptTrack' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
              }`}
            >
              Dept Track
            </button>
          )}
          <button
            onClick={() => setActiveTab('myRaised')}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'myRaised' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
            }`}
          >
            My Raised Indents
          </button>
          <button
            onClick={() => setActiveTab('maintainers')}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'maintainers' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
            }`}
          >
            Manage Maintainers
          </button>
        </div>

        {/* Dynamic Content Area */}
        <div className="pb-32">
          
          {activeTab === 'approvals' && (
            <div id="approvals" className="scroll-mt-32">
              <h2 className="text-xl font-bold text-slate-800 mb-6 pb-2 border-b border-slate-200">Approval Queue</h2>
              <ComplaintTable 
                complaints={approvalRequests}
                onOpenDetails={(complaint) => setSelectedComplaint(complaint)}
                showStatusFilter={false}
              />
            </div>
          )}

          {activeTab === 'department' && (
            <div id="department" className="scroll-mt-32">
              <h2 className="text-xl font-bold text-slate-800 mb-6 pb-2 border-b border-slate-200">Maintenance Queue</h2>
              <StatsCards 
                stats={stats} 
                activeFilter={filterStatus}
                onCardClick={(val) => {
                  setFilterStatus(prev => prev === val ? 'All' : val);
                  setActiveTab('department');
                }}
              />
              <div className="mt-8">
                <ComplaintTable 
                  complaints={filteredDepartmentIndents}
                  onOpenDetails={(complaint) => setSelectedComplaint(complaint)}
                  showStatusFilter={true}
                />
              </div>
            </div>
          )}

          {activeTab === 'deptTrack' && user?.role === 'HOD' && (
            <div id="deptTrack" className="scroll-mt-32">
              <h2 className="text-xl font-bold text-slate-800 mb-6 pb-2 border-b border-slate-200">Department Tracking</h2>
              <div ref={deptStatsRef}>
                <DeptStatsCards 
                  stats={deptStats}
                  activeFilter={deptFilterStatus}
                  onCardClick={(val) => setDeptFilterStatus(val)}
                />
              </div>
              <ComplaintTable 
                complaints={filteredDeptTrackIndents}
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

          {activeTab === 'maintainers' && (
            <div id="maintainers" className="scroll-mt-32">
              <ManageMaintainers />
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

    </div>
  );
};

export default HODDashboard;
