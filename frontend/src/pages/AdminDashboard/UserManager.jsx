import React, { useState, useRef, useEffect } from 'react';
import { Users, ShieldBan, ShieldAlert, Plus, Loader2, Search, Filter, ChevronDown, ChevronLeft, ChevronRight, CheckSquare, Square, UploadCloud, Download, FileSpreadsheet, PencilLine } from 'lucide-react';
import api from '../../api/axios';
import * as XLSX from 'xlsx';

import { departments } from '../../utils/departments';

const getRoleSortOrder = (role) => {
  return role?.sortOrder ?? role?.id ?? Number.MAX_SAFE_INTEGER;
};

const getUserRoles = (user) => {
  if (Array.isArray(user.roles)) {
    return user.roles
      .map((role) => (typeof role === 'string' ? role : role?.roleName))
      .filter(Boolean);
  }

  if (Array.isArray(user.userRoles)) {
    return user.userRoles
      .map((role) => (typeof role === 'string' ? role : role?.roleName))
      .filter(Boolean);
  }

  return [];
};

const getUserRoleIds = (user) => {
  if (Array.isArray(user.roles)) {
    return user.roles
      .map((role) => (typeof role === 'object' && role !== null ? role.roleId : null))
      .filter((roleId) => roleId !== null && roleId !== undefined);
  }

  return [];
};

const getPrimaryRole = (user) => getUserRoles(user)[0] || '';

export default function UserManager({ users, onUserUpdate }) {
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [loadingActionId, setLoadingActionId] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for Add User form
  const [addUserData, setAddUserData] = useState({
    name: '', email: '', roles: [], department: '', password: ''
  });
  
  const [addUserError, setAddUserError] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editUserData, setEditUserData] = useState({
    name: '', email: '', roles: [], roleIds: [], department: '', password: ''
  });
  const [editUserError, setEditUserError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // State for Bulk Upload
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkSuccess, setBulkSuccess] = useState('');
  
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef(null);

  const [selectedRoles, setSelectedRoles] = useState([]);
  const [isRoleFilterOpen, setIsRoleFilterOpen] = useState(false);
  const roleFilterRef = useRef(null);

  const [dbRoles, setDbRoles] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;

  useEffect(() => {
    let isMounted = true;

    const loadRoles = async () => {
      try {
        const response = await api.get('/admin/roles');
        if (!isMounted) return;
        setDbRoles(Array.isArray(response.data.roles) ? response.data.roles : []);
      } catch (error) {
        if (!isMounted) return;
        setDbRoles([]);
      }
    };

    loadRoles();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
      if (roleFilterRef.current && !roleFilterRef.current.contains(event.target)) {
        setIsRoleFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterRef, roleFilterRef]);

  const toggleDepartmentFilter = (deptName) => {
    setSelectedDepartments(prev => 
      prev.includes(deptName) 
        ? prev.filter(d => d !== deptName)
        : [...prev, deptName]
    );
  };

  const toggleRoleFilter = (roleName) => {
    setSelectedRoles(prev => 
      prev.includes(roleName) 
        ? prev.filter(r => r !== roleName)
        : [...prev, roleName]
    );
  };

  const availableRoles = [...dbRoles]
    .filter((role) => role.name)
    .sort((a, b) => getRoleSortOrder(a) - getRoleSortOrder(b));

  const sortedUsers = [...users].sort((a, b) => {
    const roleA = availableRoles.find((role) => role.name === getPrimaryRole(a));
    const roleB = availableRoles.find((role) => role.name === getPrimaryRole(b));
    return getRoleSortOrder(roleA) - getRoleSortOrder(roleB);
  });

  const filteredUsers = sortedUsers.filter(user => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term);
    const matchesDept = selectedDepartments.length === 0 || selectedDepartments.includes(user.department);
    const userRoles = getUserRoles(user);
    const matchesRole = selectedRoles.length === 0 || userRoles.some((role) => selectedRoles.includes(role));
    return matchesSearch && matchesDept && matchesRole;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDepartments, selectedRoles]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / usersPerPage));
  const currentSafePage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice(
    (currentSafePage - 1) * usersPerPage,
    currentSafePage * usersPerPage
  );

  const handleToggleStatus = async (user) => {
    try {
      setLoadingActionId(user.id);
      const res = await api.put(`/admin/users/${user.id}/status`);
      if (res.data.success) {
        if (onUserUpdate) onUserUpdate(); // Refresh the list
      }
    } catch (err) {
      console.error("Failed to toggle user status:", err);
      alert(err.response?.data?.message || "Failed to update user status");
    } finally {
      setLoadingActionId(null);
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditUserData({ 
      name: user.name || '',
      email: user.email || '',
      roles: getUserRoles(user),
      roleIds: getUserRoleIds(user),
      department: user.department || '',
      password: ''
    });
    setEditUserError('');
    setIsEditUserOpen(true);
  };

  const handleAddUserChange = (e) => {
    const { name, value } = e.target;
    setAddUserData(prev => ({ ...prev, [name]: value }));
    if (addUserError) setAddUserError('');
  };

  const handleEditUserChange = (e) => {
    const { name, value } = e.target;
    setEditUserData(prev => ({ ...prev, [name]: value }));
    if (editUserError) setEditUserError('');
  };

  const toggleAddUserRole = (role) => {
    setAddUserData(prev => {
      const nextRoles = prev.roles.includes(role)
        ? prev.roles.filter((item) => item !== role)
        : [...prev.roles, role];

      return {
        ...prev,
        roles: nextRoles
      };
    });

    if (addUserError) setAddUserError('');
  };

  const toggleEditUserRole = (role) => {
    setEditUserData(prev => {
      const nextRoles = prev.roles.includes(role)
        ? prev.roles.filter((item) => item !== role)
        : [...prev.roles, role];

      const nextRoleIds = dbRoles
        .filter((dbRole) => nextRoles.includes(dbRole.name))
        .map((dbRole) => dbRole.id);

      return {
        ...prev,
        roles: nextRoles,
        roleIds: nextRoleIds
      };
    });

    if (editUserError) setEditUserError('');
  };

  const handleAddUserSubmit = async () => {
    if (!addUserData.name || !addUserData.email || !addUserData.password) {
      setAddUserError('Name, email and password are required');
      return;
    }

    if (addUserData.roles.length === 0) {
      setAddUserError('Select at least one role');
      return;
    }
    try {
      setIsAdding(true);
      await api.post('/admin/users', addUserData);
      setIsAddUserOpen(false);
      setAddUserData({ name: '', email: '', roles: [], department: '', password: '' });
      if (onUserUpdate) onUserUpdate();
    } catch (err) {
      console.error("Failed to add user:", err);
      setAddUserError(err.response?.data?.message || "Failed to add user");
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditUserSubmit = async () => {
    if (!editingUser) return;
    if (!editUserData.name || !editUserData.email) {
      setEditUserError('Name and email are required');
      return;
    }

    try {
      setIsSaving(true);
      await api.put(`/admin/users/${editingUser.id}`, {
        ...editUserData,
        roles: editUserData.roles,
        roleIds: editUserData.roleIds
      });
      setIsEditUserOpen(false);
      setEditingUser(null);
      setEditUserData({ name: '', email: '', roles: [], roleIds: [], department: '', password: '' });
      if (onUserUpdate) onUserUpdate();
    } catch (err) {
      console.error('Failed to update user:', err);
      setEditUserError(err.response?.data?.message || 'Failed to update user');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkUploadSubmit = async () => {
    if (!bulkFile) {
      setBulkError('Please select a file to upload');
      return;
    }

    try {
      setIsUploading(true);
      setBulkError('');
      setBulkSuccess('');

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet);

          if (json.length === 0) {
            setBulkError('The file appears to be empty or improperly formatted.');
            setIsUploading(false);
            return;
          }

          const res = await api.post('/admin/users/bulk', { users: json });
          setBulkSuccess(res.data.message || 'Users uploaded successfully');
          setBulkFile(null);
          if (onUserUpdate) onUserUpdate();
          setTimeout(() => setIsBulkUploadOpen(false), 2500);
        } catch (err) {
          console.error("Bulk process error:", err);
          setBulkError(err.response?.data?.message || 'Error processing the file. Please check the format.');
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsArrayBuffer(bulkFile);
    } catch (err) {
      setIsUploading(false);
      setBulkError('Error reading the file');
    }
  };

  const downloadTemplate = () => {
    const templateRole = availableRoles[0]?.name || 'Role';
    const ws = XLSX.utils.json_to_sheet([{ Name: 'John Doe', Email: 'john@git.edu', Department: 'Computer Science', Role: templateRole }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(wb, "bulk_user_template.xlsx");
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center">
            <Users className="w-5 h-5 mr-2 text-indigo-600" />
            User Management
          </h2>
        </div>
        
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
          
          <div className="relative" ref={filterRef}>
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="w-full sm:w-auto bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-between transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <div className="flex items-center">
                <Filter className="w-4 h-4 mr-2 text-slate-400" />
                <span className="truncate max-w-[120px]">
                  {selectedDepartments.length === 0 ? 'All Departments' : `${selectedDepartments.length} Selected`}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 ml-2 text-slate-400" />
            </button>
            
            {isFilterOpen && (
              <div className="absolute right-0 sm:right-auto sm:left-0 mt-2 w-64 bg-white border border-slate-200 shadow-lg rounded-xl z-10 max-h-80 overflow-y-auto custom-scrollbar">
                <div className="p-2">
                  <div 
                    className="flex items-center px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer mb-1 transition-colors"
                    onClick={() => setSelectedDepartments([])}
                  >
                    {selectedDepartments.length === 0 ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600 mr-3 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 mr-3 shrink-0" />
                    )}
                    <span className="text-sm font-medium text-slate-700">All Departments</span>
                  </div>
                  <div className="h-px bg-slate-100 my-1 mx-2"></div>
                  {departments.map((dept) => {
                    const isSelected = selectedDepartments.includes(dept.name);
                    return (
                      <div 
                        key={dept.name}
                        className="flex items-center px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                        onClick={() => toggleDepartmentFilter(dept.name)}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600 mr-3 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 mr-3 shrink-0" />
                        )}
                        <span className="text-sm text-slate-600 truncate" title={dept.name}>{dept.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={roleFilterRef}>
            <button 
              onClick={() => setIsRoleFilterOpen(!isRoleFilterOpen)}
              className="w-full sm:w-auto bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium text-sm flex items-center justify-between transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-2 text-slate-400" />
                <span className="truncate max-w-[120px]">
                  {selectedRoles.length === 0 ? 'All Roles' : `${selectedRoles.length} Selected`}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 ml-2 text-slate-400" />
            </button>
            
            {isRoleFilterOpen && (
              <div className="absolute right-0 sm:right-auto sm:left-0 mt-2 w-64 bg-white border border-slate-200 shadow-lg rounded-xl z-10 max-h-80 overflow-y-auto custom-scrollbar">
                <div className="p-2">
                  <div 
                    className="flex items-center px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer mb-1 transition-colors"
                    onClick={() => setSelectedRoles([])}
                  >
                    {selectedRoles.length === 0 ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600 mr-3 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 mr-3 shrink-0" />
                    )}
                    <span className="text-sm font-medium text-slate-700">All Roles</span>
                  </div>
                  <div className="h-px bg-slate-100 my-1 mx-2"></div>
                  {availableRoles.map((role) => {
                    const isSelected = selectedRoles.includes(role.name);
                    return (
                      <div 
                        key={role.id}
                        className="flex items-center px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                        onClick={() => toggleRoleFilter(role.name)}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600 mr-3 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 mr-3 shrink-0" />
                        )}
                        <span className="text-sm text-slate-600 truncate" title={role.name}>{role.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search name or email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
            />
          </div>
          <button 
            onClick={() => {setIsBulkUploadOpen(true); setBulkSuccess(''); setBulkError(''); setBulkFile(null);}}
            className="bg-white text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-lg font-medium text-sm flex items-center transition-colors border border-indigo-200 justify-center"
          >
            <UploadCloud className="w-4 h-4 mr-1.5" />
            Bulk Upload
          </button>
          <button 
            onClick={() => setIsAddUserOpen(true)}
            className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-lg font-medium text-sm flex items-center transition-colors border border-indigo-200 justify-center"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add User
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Name & Email</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Department</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedUsers.length > 0 ? paginatedUsers.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs uppercase mr-3">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {(() => {
                    const roles = getUserRoles(user);
                    const displayRole = roles.join(', ') || '-';
                    const primaryRole = roles[0] || '';
                    const roleIds = getUserRoleIds(user);

                    return (
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full 
                    ${primaryRole === 'Admin' ? 'bg-purple-100 text-purple-800' : 
                      primaryRole === 'Principal' ? 'bg-indigo-100 text-indigo-800' :
                      primaryRole === 'HOD' ? 'bg-blue-100 text-blue-800' : 
                      primaryRole === 'Non-Teaching' ? 'bg-orange-100 text-orange-800' :
                      'bg-slate-100 text-slate-800'}`}
                    title={roleIds.length > 0 ? `Role IDs: ${roleIds.join(', ')}` : undefined}
                  >
                    {displayRole}
                  </span>
                    );
                  })()}
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-600">{user.department || '-'}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${user.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {user.isActive ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button
                    onClick={() => openEditModal(user)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                    title="Edit User"
                  >
                    <PencilLine className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleToggleStatus(user)}
                    disabled={loadingActionId === user.id}
                    className="p-1.5 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50" 
                    title={user.isActive ? 'Disable User' : 'Enable User'}
                  >
                    {loadingActionId === user.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : user.isActive ? (
                      <ShieldBan className="w-4 h-4" />
                    ) : (
                      <ShieldAlert className="w-4 h-4" />
                    )}
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" className="px-6 py-8 text-center text-slate-500 italic">No users found matching your search.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredUsers.length > 0 && (
        <div className="px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Showing <span className="font-medium text-slate-700">{(currentSafePage - 1) * usersPerPage + 1}</span>
            {' '}-{' '}
            <span className="font-medium text-slate-700">{Math.min(currentSafePage * usersPerPage, filteredUsers.length)}</span>
            {' '}of{' '}
            <span className="font-medium text-slate-700">{filteredUsers.length}</span> users
          </p>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentSafePage === 1}
              className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => page === 1 || page === totalPages || Math.abs(page - currentSafePage) <= 1)
              .reduce((acc, page, idx, arr) => {
                if (idx > 0 && page - arr[idx - 1] > 1) acc.push('ellipsis-' + page);
                acc.push(page);
                return acc;
              }, [])
              .map(page =>
                typeof page === 'number' ? (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-[2.25rem] h-9 px-2 rounded-lg text-sm font-medium transition-colors ${
                      page === currentSafePage
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:bg-slate-50 border border-slate-300'
                    }`}
                  >
                    {page}
                  </button>
                ) : (
                  <span key={page} className="px-1 text-slate-400 text-sm">…</span>
                )
              )}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentSafePage === totalPages}
              className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

       {isAddUserOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">Register New User</h3>
            </div>
            <div className="p-6 space-y-4">
              {addUserError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{addUserError}</p>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input name="name" value={addUserData.name} onChange={handleAddUserChange} type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input name="email" value={addUserData.email} onChange={handleAddUserChange} type="email" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <input name="password" value={addUserData.password} onChange={handleAddUserChange} type="password" placeholder="••••••••" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <div className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white max-h-48 overflow-y-auto space-y-2">
                    {availableRoles.map((role) => {
                      const isChecked = addUserData.roles.includes(role.name);
                      return (
                        <label key={role.id} className="flex items-center gap-2 cursor-pointer text-slate-700">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleAddUserRole(role.name)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                          />
                          <span>{role.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Selected: {addUserData.roles.join(', ')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                  <input
                    list="admin-departments-list"
                    name="department"
                    value={addUserData.department}
                    onChange={handleAddUserChange}
                    placeholder="Type to search..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 bg-white"
                  />
                  <datalist id="admin-departments-list">
                    {departments.map((dept) => (
                      <option key={dept.name} value={dept.name} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end space-x-3">
              <button onClick={() => setIsAddUserOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Close</button>
              <button disabled={isAdding} onClick={handleAddUserSubmit} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {isAdding ? 'Adding...' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isBulkUploadOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 flex items-center">
                <UploadCloud className="w-5 h-5 mr-2 text-indigo-600" />
                Bulk Upload Users
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 text-sm text-indigo-800">
                <p className="mb-2 font-medium">Instructions:</p>
                <ul className="list-disc pl-5 space-y-1 opacity-90">
                  <li>Upload a valid <strong>Excel (.xlsx, .xls)</strong> or <strong>CSV</strong> file.</li>
                  <li>Required headers: <strong>Name, Department, Email, Role</strong>.</li>
                  <li>Default password will be set to <code className="bg-white px-1 py-0.5 rounded text-indigo-900">password@123</code>.</li>
                  <li>Users with emails already in the system will be skipped.</li>
                </ul>
              </div>

              <div className="flex justify-center">
                <button 
                  onClick={downloadTemplate}
                  className="flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download Sample Template
                </button>
              </div>

              {bulkError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{bulkError}</p>}
              {bulkSuccess && <p className="text-sm text-emerald-600 bg-emerald-50 p-2 rounded">{bulkSuccess}</p>}
              
              <div className="mt-4">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <FileSpreadsheet className="w-8 h-8 mb-3 text-slate-400" />
                    <p className="mb-2 text-sm text-slate-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-slate-400">CSV or Excel (MAX. 5MB)</p>
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setBulkFile(e.target.files[0]);
                        setBulkError('');
                        setBulkSuccess('');
                      }
                    }}
                  />
                </label>
                {bulkFile && (
                  <p className="mt-2 text-sm text-slate-600 font-medium truncate text-center">
                    Selected: {bulkFile.name}
                  </p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end space-x-3">
              <button 
                onClick={() => setIsBulkUploadOpen(false)} 
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Close
              </button>
              <button 
                disabled={isUploading || !bulkFile} 
                onClick={handleBulkUploadSubmit} 
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...
                  </>
                ) : 'Upload Users'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditUserOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">Edit User</h3>
            </div>
            <div className="p-6 space-y-4">
              {editUserError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{editUserError}</p>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input name="name" value={editUserData.name} onChange={handleEditUserChange} type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input name="email" value={editUserData.email} onChange={handleEditUserChange} type="email" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <div className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white max-h-48 overflow-y-auto space-y-2">
                    {availableRoles.map((role) => {
                      const isChecked = editUserData.roles.includes(role.name);
                      return (
                        <label key={role.id} className="flex items-center gap-2 cursor-pointer text-slate-700">
                          <input type="checkbox" checked={isChecked} onChange={() => toggleEditUserRole(role.name)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600" />
                          <span>{role.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                  <input name="department" value={editUserData.department} onChange={handleEditUserChange} placeholder="Type to search..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-600 bg-white" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end space-x-3">
              <button onClick={() => setIsEditUserOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Close</button>
              <button disabled={isSaving} onClick={handleEditUserSubmit} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
