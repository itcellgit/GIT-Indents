import React, { useState, useEffect } from 'react';
import { Eye, FileText } from 'lucide-react';

const STATUS_COLORS = {
  "Indent Created": "bg-cyan-100 text-cyan-800 border-cyan-200",
  "Approved by Principal": "bg-blue-100 text-blue-800 border-blue-200",
  "Approved by Dept HOD": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Approved by Maintenance HOD": "bg-teal-100 text-teal-800 border-teal-200",
  "In Progress": "bg-indigo-100 text-indigo-800 border-indigo-200",
  "Completed": "bg-green-100 text-green-800 border-green-200",
  "Rejected by Maintenance HOD": "bg-red-100 text-red-800 border-red-200",
  "Rejected by Dept HOD": "bg-red-100 text-red-800 border-red-200",
  "Rejected by Principal": "bg-rose-100 text-rose-800 border-rose-200",
  "Pending": "bg-yellow-100 text-yellow-800 border-yellow-200"
};

const IndentTable = ({ filteredComplaints, setSelectedComplaint }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [filteredComplaints]);

  const sortedComplaints = [...filteredComplaints].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const totalPages = Math.ceil(sortedComplaints.length / ITEMS_PER_PAGE);
  const paginatedComplaints = sortedComplaints.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            <th className="px-6 py-4 font-medium">Indent No</th>
            <th className="px-6 py-4 font-medium">ISR No</th>
            <th className="px-6 py-4 font-medium">Raised By</th>
            <th className="px-6 py-4 font-medium">Type</th>
            <th className="px-6 py-4 font-medium">Location</th>
            <th className="px-6 py-4 font-medium max-w-[200px]">Status</th>
            <th className="px-6 py-4 font-medium">Assigned Dept</th>
            <th className="px-6 py-4 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {paginatedComplaints.length > 0 ? paginatedComplaints.map((complaint) => (
            <tr 
              key={complaint._id || complaint.id} 
              className="hover:bg-slate-50/50 transition-colors cursor-pointer"
              onClick={() => setSelectedComplaint(complaint)}
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="font-medium text-indigo-600 block">{complaint.indentNumber || complaint.id}</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                {complaint.isrNo || '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                {complaint.requester?.name || complaint.raisedBy || 'Non-Teaching Staff'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                {complaint.natureOfWork || complaint.workType || 'Maintenance/Repair'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{complaint.location}</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[complaint.status] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                  {complaint.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                {complaint.category?.name || complaint.category}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedComplaint(complaint);
                  }}
                  className="inline-flex items-center px-3 py-1.5 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-300 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Eye className="w-4 h-4 mr-1.5" />
                  View
                </button>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                <div className="flex flex-col items-center justify-center">
                  <FileText className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="text-base font-medium text-slate-600">No indents found</p>
                  <p className="text-sm">Try adjusting your filters or search terms.</p>
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

export default IndentTable;
