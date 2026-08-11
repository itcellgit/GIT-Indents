import React, { useState, useEffect, useRef } from 'react';
import { FileText, Download, Table as TableIcon, Calendar, Loader2, ChevronDown, Check, Building, Tag } from 'lucide-react';
import api from '../../api/axios';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const MONTHS = [
  { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
  { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
  { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" }
];

const YEARS = [
  { value: 2024, label: "2024" }, { value: 2025, label: "2025" }, { value: 2026, label: "2026" }
];

const STATUSES = [
  { value: "Pending", label: "Pending" },
  { value: "Assigned", label: "Assigned" },
  { value: "In Progress", label: "In Progress" },
  { value: "Resolved", label: "Resolved" },
  { value: "Completed", label: "Completed" },
  { value: "Rejected by Maintenance HOD", label: "Rejected by Maintenance HOD" },
  { value: "Rejected by Principal", label: "Rejected by Principal" }
];

const MultiSelect = ({ label, options, selected, onChange, icon: Icon }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter(i => i !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  return (
    <div className="relative flex-1" ref={dropdownRef}>
      <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-indigo-500" />}
        {label}
      </label>
      <div 
        className="w-full pl-3 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium cursor-pointer relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate block pr-6">
          {selected.length === 0 ? 'Select...' : selected.length === options.length ? 'All Selected' : `${selected.length} Selected`}
        </span>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      </div>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          <div className="p-1">
            <button 
               className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 rounded text-indigo-600 font-medium"
               onClick={(e) => { e.stopPropagation(); onChange(selected.length === options.length ? [] : options.map(o => o.value)); }}
            >
              {selected.length === options.length ? 'Deselect All' : 'Select All'}
            </button>
            {options.map(opt => (
              <div 
                key={opt.value} 
                className="flex items-center px-3 py-2 hover:bg-slate-50 cursor-pointer rounded"
                onClick={(e) => { e.stopPropagation(); toggleOption(opt.value); }}
              >
                <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center ${selected.includes(opt.value) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                  {selected.includes(opt.value) && <Check className="w-3 h-3" />}
                </div>
                <span className="text-sm text-slate-700 truncate">{opt.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function ReportManager() {
  const [selectedMonths, setSelectedMonths] = useState([new Date().getMonth() + 1]);
  const [selectedYears, setSelectedYears] = useState([new Date().getFullYear()]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  useEffect(() => {
    // Fetch departments on load
    const fetchDepartments = async () => {
      try {
        const res = await api.get('/admin/departments');
        if (res.data.departments) {
          const formattedDepts = res.data.departments.map(d => ({
            value: d.id,
            label: d.name
          }));
          setAvailableDepartments(formattedDepts);
        }
      } catch (err) {
        console.error("Failed to fetch departments", err);
      }
    };
    fetchDepartments();
  }, []);

  const fetchReportData = async () => {
    if (selectedMonths.length === 0 || selectedYears.length === 0) {
      alert("Please select at least one month and year.");
      return;
    }

    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.append('months', selectedMonths.join(','));
      params.append('years', selectedYears.join(','));
      if (selectedStatuses.length > 0) params.append('statuses', selectedStatuses.join(','));
      if (selectedDepartments.length > 0) params.append('departments', selectedDepartments.join(','));

      const res = await api.get(`/admin/reports?${params.toString()}`);
      if (res.data.success) {
        setReportData(res.data.reportData);
        setHasGenerated(true);
      }
    } catch (err) {
      console.error("Failed to fetch report data:", err);
      alert("Failed to load report data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const exportToExcel = () => {
    if (reportData.length === 0) return;
    
    const worksheet = XLSX.utils.json_to_sheet(reportData.map(item => ({
      "Indent ID": item.indentNumber,
      "Date": item.date,
      "Generated By": item.generatedBy,
      "Assigned Department": item.assignedToDept,
      "Status": item.status,
      "Description": item.description
    })));
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Maintenance Report");
    
    const fileName = `Maintenance_Report_${new Date().getTime()}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const exportToPDF = () => {
    if (reportData.length === 0) return;

    const doc = new jsPDF('l', 'mm', 'a4'); 
    const title = `GIT Maintenance Report - Generated ${new Date().toLocaleDateString()}`;
    
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`${reportData.length} total records`, 14, 30);

    const tableColumn = ["Indent ID", "Date", "Generated By", "Assigned Department", "Status", "Description"];
    const tableRows = reportData.map(item => [
      item.indentNumber,
      item.date,
      item.generatedBy,
      item.assignedToDept,
      item.status,
      item.description
    ]);

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      columnStyles: {
        5: { cellWidth: 80 }
      }
    });

    const fileName = `Maintenance_Report_${new Date().getTime()}.pdf`;
    doc.save(fileName);
  };

  return (
    <div className="space-y-6">
      {/* Controls Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-end gap-4 flex-wrap">
          
          <MultiSelect 
            label="Select Month(s)" 
            icon={Calendar} 
            options={MONTHS} 
            selected={selectedMonths} 
            onChange={setSelectedMonths} 
          />
          <MultiSelect 
            label="Select Year(s)" 
            options={YEARS} 
            selected={selectedYears} 
            onChange={setSelectedYears} 
          />
          <MultiSelect 
            label="Department(s)" 
            icon={Building}
            options={availableDepartments} 
            selected={selectedDepartments} 
            onChange={setSelectedDepartments} 
          />
          <MultiSelect 
            label="Status(es)" 
            icon={Tag}
            options={STATUSES} 
            selected={selectedStatuses} 
            onChange={setSelectedStatuses} 
          />

          <button 
            onClick={fetchReportData}
            disabled={isLoading || selectedMonths.length === 0 || selectedYears.length === 0}
            className="w-full md:w-auto bg-indigo-600 text-white px-8 py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-70"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TableIcon className="w-4 h-4" />}
            Generate Preview
          </button>
        </div>
      </div>

      {/* Preview Table */}
      {hasGenerated && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Report Preview</h2>
              <p className="text-sm text-slate-500">{reportData.length} records found</p>
            </div>
            
            <div className="flex gap-3 w-full sm:w-auto">
              <button 
                onClick={exportToExcel}
                disabled={reportData.length === 0}
                className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-bold hover:bg-emerald-100 transition-colors gap-2"
              >
                <Download className="w-4 h-4" /> Excel
              </button>
              <button 
                onClick={exportToPDF}
                disabled={reportData.length === 0}
                className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 border border-rose-200 bg-rose-50 text-rose-700 rounded-lg text-sm font-bold hover:bg-rose-100 transition-colors gap-2"
              >
                <FileText className="w-4 h-4" /> PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Indent ID</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Date</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Generated By</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Assigned Department</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-6 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.length > 0 ? reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-bold text-indigo-600 text-sm">{row.indentNumber}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">{row.date}</td>
                    <td className="px-6 py-4 text-sm text-slate-700 font-medium whitespace-nowrap">{row.generatedBy}</td>
                    <td className="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">{row.assignedToDept}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                        row.status === 'Resolved' || row.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                        row.status === 'In Progress' ? 'bg-blue-100 text-blue-700 border-blue-200' : 
                        row.status.startsWith('Rejected') ? 'bg-rose-100 text-rose-700 border-rose-200' :
                        'bg-amber-100 text-amber-700 border-amber-200'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate" title={row.description}>
                      {row.description}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-slate-500 italic">
                      No indents found for the selected criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
