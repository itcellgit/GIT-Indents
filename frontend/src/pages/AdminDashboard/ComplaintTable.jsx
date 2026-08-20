import React, { useState, useEffect } from 'react';
import { ClipboardList, Filter, Search, Eye } from 'lucide-react';

const STATUS_COLORS = {
  "Indent Created": "bg-cyan-100 text-cyan-800 border-cyan-200",
  "Approved by Dept HOD": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Approved by Principal": "bg-blue-100 text-blue-800 border-blue-200",
  "Approved by Maintenance HOD": "bg-teal-100 text-teal-800 border-teal-200",
  "In Progress": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Completed": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Rejected by Maintenance HOD": "bg-red-100 text-red-800 border-red-200",
  "Rejected by Dept HOD": "bg-red-100 text-red-800 border-red-200",
  "Rejected by Principal": "bg-rose-100 text-rose-800 border-rose-200",
  "Pending": "bg-yellow-100 text-yellow-800 border-yellow-200"
};

export default function ComplaintTable({ complaints, departments, onOpenDetails }) {
  const [filterDept, setFilterDept] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [filterDept, filterStatus, searchTerm, complaints]);

  const filtered = complaints.filter(c => {
    const matchDept = filterDept === 'All' || c.category?.name === filterDept;
    const matchStatus = filterStatus === 'All' || c.status === filterStatus;
    const matchSearch = !searchTerm || (c.indentNumber || c.id?.toString() || c._id?.toString() || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchDept && matchStatus && matchSearch;
  });

  const sortedComplaints = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const totalPages = Math.ceil(sortedComplaints.length / ITEMS_PER_PAGE);
  const paginatedComplaints = sortedComplaints.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200 flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
        <h2 className="text-xl font-bold text-slate-800 flex items-center">
          <ClipboardList className="w-5 h-5 mr-2 text-indigo-600" />
          Indent Monitoring
        </h2>
        
        <div className="flex flex-wrap gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by ID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-48"
            />
          </div>

          <select 
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="pl-3 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white flex-1 sm:flex-none"
          >
            <option value="All">All Departments</option>
            {departments && departments.map(dept => (
              <option key={dept._id || dept.id} value={dept.name}>{dept.name}</option>
            ))}
          </select>

          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="pl-3 pr-8 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white flex-1 sm:flex-none"
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
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Indent No</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">ISR No</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Raised By</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Location</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Assigned Dept</th>
              <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedComplaints.map((complaint) => (
              <tr 
                key={complaint._id || complaint.id} 
                className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                onClick={() => onOpenDetails(complaint)}
              >
                <td className="px-6 py-4">
                  <span className="font-semibold text-indigo-600 text-sm">{complaint.indentNumber || complaint.id?.substring(0,8) || complaint._id?.toString().substring(0,8)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-slate-600">{complaint.isrNo || '-'}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-slate-600 block">{complaint.requester?.name || 'Unknown'}</span>
                  <span className="text-xs text-slate-400 block">{complaint.requester?.staff_phone_no || '-'}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-600">{complaint.natureOfWork || complaint.workType || 'Maintenance/Repair'}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-slate-600">{complaint.location}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[complaint.status] || 'bg-gray-100 text-gray-800'}`}>
                    {complaint.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-medium text-slate-800">{complaint.category?.name || 'Unassigned'}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDetails(complaint);
                    }}
                    className="inline-flex items-center px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-slate-200">
          <div className="text-sm text-slate-500">
            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length} entries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700"
            >
              Previous
            </button>
            <span className="text-sm text-slate-700 font-medium px-2">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
