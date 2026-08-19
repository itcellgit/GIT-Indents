import React, { useState, useMemo } from 'react';
import { Eye, Clock, AlertCircle, Search, X } from 'lucide-react';

const ComplaintTable = ({ complaints, onOpenDetails, showStatusFilter = true }) => {
  const [statusFilter, setStatusFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, departmentFilter, dateFilter, searchTerm, complaints]);

  const uniqueDepartments = useMemo(() => {
    const deps = new Set();
    complaints.forEach(c => {
      const deptName = c.category?.name || c.category;
      if (deptName) deps.add(deptName);
    });
    return Array.from(deps).sort();
  }, [complaints]);

  const filteredComplaints = useMemo(() => {
    return complaints.filter(complaint => {
      // Status Filter
      const matchStatus = statusFilter === 'All' || complaint.status === statusFilter;
      
      // Department Filter
      const complaintDept = complaint.category?.name || complaint.category || '';
      const matchDepartment = departmentFilter === 'All' || complaintDept === departmentFilter;
      
      // Date Filter
      const complaintDate = new Date(complaint.createdAt).toISOString().split('T')[0];
      const matchDate = !dateFilter || complaintDate === dateFilter;

      // Search Filter (ID, Location, or Description)
      const searchStr = searchTerm.toLowerCase();
      const matchSearch = !searchTerm || 
        (complaint.indentNumber || '').toLowerCase().includes(searchStr) ||
        (complaint.location || '').toLowerCase().includes(searchStr) ||
        (complaint.natureOfWork || '').toLowerCase().includes(searchStr);

      return matchStatus && matchDepartment && matchDate && matchSearch;
    });
  }, [complaints, statusFilter, departmentFilter, dateFilter, searchTerm]);

  const getStatusColor = (status) => {
    const STATUS_COLORS = {
      "Indent Created": "bg-cyan-100 text-cyan-700",
      "Approved by Principal": "bg-blue-100 text-blue-700",
      "Approved by Dept HOD": "bg-yellow-100 text-yellow-700",
      "Approved by Maintenance HOD": "bg-teal-100 text-teal-700",
      "In Progress": "bg-indigo-100 text-indigo-700",
      "Completed": "bg-green-100 text-green-700",
      "Rejected by Maintenance HOD": "bg-red-100 text-red-700",
      "Rejected by Dept HOD": "bg-red-100 text-red-700",
      "Rejected by Principal": "bg-red-100 text-red-700",
      "Pending": "bg-yellow-100 text-yellow-700"
    };
    return STATUS_COLORS[status] || 'bg-gray-100 text-gray-700';
  };

  const sortedComplaints = [...filteredComplaints].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const totalPages = Math.ceil(sortedComplaints.length / ITEMS_PER_PAGE);
  const paginatedComplaints = sortedComplaints.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex flex-col lg:flex-row justify-between lg:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Indent Queue</h2>
          <p className="text-sm text-gray-500 mt-1">Showing {filteredComplaints.length} of {complaints.length} indents</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search by ID or location..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 w-full sm:w-64 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="border border-gray-200 text-gray-700 rounded-lg text-sm px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            >
              <option value="All">All Departments</option>
              {uniqueDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            {showStatusFilter && (
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-200 text-gray-700 rounded-lg text-sm px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
              >
                <option value="All">All Status</option>
                <option value="Indent Created">Indent Created</option>
                <option value="Approved by Principal">Approved by Principal</option>
                <option value="Approved by Maintenance HOD">Approved by Maint. HOD</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Rejected by Maintenance HOD">Rejected by Maintenance HOD</option>
                <option value="Rejected by Principal">Rejected by Principal</option>
              </select>
            )}
            <input 
              type="date" 
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="border border-gray-200 text-gray-700 rounded-lg text-sm px-3 py-2 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-sm font-semibold border-b border-gray-200">
              <th className="px-6 py-4">Indent No</th>
              <th className="px-6 py-4">ISR No</th>
              <th className="px-6 py-4">Raised By</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Location</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Assigned Dept</th>
              <th className="px-6 py-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedComplaints.length > 0 ? (
              paginatedComplaints.map((complaint) => (
                <tr 
                  key={complaint._id || complaint.id} 
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => onOpenDetails(complaint)}
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{complaint.indentNumber || complaint.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{complaint.isrNo || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{complaint.requester?.name || complaint.raisedBy || 'Faculty'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{complaint.natureOfWork || complaint.workType || 'Maintenance/Repair'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{complaint.location}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-md ${getStatusColor(complaint.status)}`}>
                      {complaint.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{complaint.category?.name || complaint.category}</td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetails(complaint);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors"
                    >
                      <Eye className="w-4 h-4" /> View
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                     <AlertCircle className="w-8 h-8 text-gray-300 mb-2" />
                     <p className="font-semibold text-gray-900">
                       {complaints.length === 0 ? 'No indents found' : 'No matching results'}
                     </p>
                     <p className="text-sm">
                       {complaints.length === 0 
                         ? 'There are no maintenance indents in this queue yet.' 
                         : 'Try adjusting your filters or search term to find what you are looking for.'}
                     </p>
                     {(statusFilter !== 'All' || departmentFilter !== 'All' || dateFilter !== '' || searchTerm !== '') && (
                       <button 
                         onClick={() => { setStatusFilter('All'); setDepartmentFilter('All'); setDateFilter(''); setSearchTerm(''); }}
                         className="mt-4 text-sm font-bold text-indigo-600 hover:text-indigo-700"
                       >
                         Clear all filters
                       </button>
                     )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-gray-100">
          <div className="text-sm text-gray-500">
            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredComplaints.length)} of {filteredComplaints.length} entries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700 font-medium px-2">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplaintTable;
