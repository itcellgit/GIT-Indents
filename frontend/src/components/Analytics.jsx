import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { BarChart3, PieChart as PieChartIcon, TrendingUp, ChevronDown, Check } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const DURATION_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_2_months', label: 'Last 2 Months' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'last_6_months', label: 'Last 6 Months' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_2_years', label: 'Last 2 Years' },
];

const isWithinDuration = (dateString, duration) => {
  if (duration === 'all') return true;
  if (!dateString) return false;
  
  const date = new Date(dateString);
  const now = new Date();
  
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfThisYear = new Date(now.getFullYear(), 0, 1);
  
  switch(duration) {
    case 'this_month':
      return date >= startOfThisMonth;
    case 'last_2_months':
      return date >= new Date(now.getFullYear(), now.getMonth() - 1, 1);
    case 'last_3_months':
      return date >= new Date(now.getFullYear(), now.getMonth() - 2, 1);
    case 'last_6_months':
      return date >= new Date(now.getFullYear(), now.getMonth() - 5, 1);
    case 'this_year':
      return date >= startOfThisYear;
    case 'last_2_years':
      return date >= new Date(now.getFullYear() - 1, 0, 1);
    default:
      return true;
  }
};

const MultiSelect = ({ options, selected, onChange, placeholder = "Select..." }) => {
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
    <div className="relative" ref={dropdownRef}>
      <div 
        className="w-full pl-3 pr-8 py-1.5 border border-slate-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white cursor-pointer relative min-w-[140px]"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate block font-medium text-slate-700">
          {selected.length === 0 ? placeholder : selected.length === options.length ? 'All Selected' : `${selected.length} Selected`}
        </span>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
      </div>
      
      {isOpen && (
        <div className="absolute z-50 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto right-0">
          <div className="p-1">
            <button 
               className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 rounded text-indigo-600 font-bold mb-1"
               onClick={(e) => { e.stopPropagation(); onChange(selected.length === options.length ? [] : options.map(o => o.value)); }}
            >
              {selected.length === options.length ? 'Deselect All' : 'Select All'}
            </button>
            {options.map(opt => (
              <div 
                key={opt.value} 
                className="flex items-center px-3 py-1.5 hover:bg-slate-50 cursor-pointer rounded"
                onClick={(e) => { e.stopPropagation(); toggleOption(opt.value); }}
              >
                <div className={`w-3.5 h-3.5 rounded border mr-2 flex items-center justify-center ${selected.includes(opt.value) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                  {selected.includes(opt.value) && <Check className="w-2.5 h-2.5" />}
                </div>
                <span className="text-xs text-slate-700 truncate">{opt.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function Analytics({ complaints }) {
  // Filters State
  const [deptDuration, setDeptDuration] = useState('this_month');
  
  const [statusDuration, setStatusDuration] = useState('all');
  const [statusDepartments, setStatusDepartments] = useState([]); // Init empty, will select all on mount
  
  const [trendDuration, setTrendDuration] = useState('all');

  // Extract unique departments for the dropdown
  const availableDepartments = useMemo(() => {
    if (!complaints) return [];
    const depts = new Set();
    complaints.forEach(c => {
      if (c.category && c.category.name) depts.add(c.category.name);
    });
    return Array.from(depts).map(d => ({ value: d, label: d }));
  }, [complaints]);

  // Select all departments by default if none are selected and options are available
  useEffect(() => {
    if (statusDepartments.length === 0 && availableDepartments.length > 0) {
      setStatusDepartments(availableDepartments.map(d => d.value));
    }
  }, [availableDepartments]);

  // Derived Data for Charts
  const departmentData = useMemo(() => {
    if (!complaints) return [];
    
    const filtered = complaints.filter(c => isWithinDuration(c.createdAt, deptDuration));
    
    const counts = filtered.reduce((acc, curr) => {
      const dept = curr.category?.name || 'Unassigned';
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {});
    return Object.keys(counts).map(key => ({ name: key, count: counts[key] }));
  }, [complaints, deptDuration]);

  const statusData = useMemo(() => {
    if (!complaints) return [];
    
    const filtered = complaints.filter(c => {
      const dept = c.category?.name || 'Unassigned';
      return isWithinDuration(c.createdAt, statusDuration) && 
             (statusDepartments.length === 0 || statusDepartments.includes(dept));
    });

    const counts = filtered.reduce((acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, {});
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [complaints, statusDuration, statusDepartments]);

  const monthlyTrendData = useMemo(() => {
    if (!complaints) return [];
    
    const filtered = complaints.filter(c => isWithinDuration(c.createdAt, trendDuration));
    const sortedComplaints = [...filtered].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    const counts = {};
    sortedComplaints.forEach(c => {
      if (c.createdAt) {
        const date = new Date(c.createdAt);
        const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
        counts[monthYear] = (counts[monthYear] || 0) + 1;
      }
    });
    return Object.keys(counts).map(key => ({ name: key, indents: counts[key] }));
  }, [complaints, trendDuration]);

  if (!complaints || complaints.length === 0) {
    return (
      <div className="bg-white p-8 mt-8 rounded-xl shadow-sm border border-slate-200 text-center">
        <p className="text-slate-500 font-medium">Not enough data to generate analytics visualizations.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      {/* Department Workload Bar Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
          <h3 className="text-lg font-bold text-slate-800 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-indigo-600" />
            Indents by Department
          </h3>
          <select 
            value={deptDuration}
            onChange={(e) => setDeptDuration(e.target.value)}
            className="text-xs border border-slate-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none bg-slate-50 font-medium text-slate-700"
          >
            {DURATION_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        
        <div className="h-64 w-full mt-auto">
          {departmentData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} allowDecimals={false} />
                <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">No data for selected period</div>
          )}
        </div>
      </div>

      {/* Status Distribution Pie Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
          <h3 className="text-lg font-bold text-slate-800 flex items-center">
            <PieChartIcon className="w-5 h-5 mr-2 text-indigo-600" />
            Status Distribution
          </h3>
          <div className="flex gap-2 w-full sm:w-auto">
            <MultiSelect 
              options={availableDepartments} 
              selected={statusDepartments} 
              onChange={setStatusDepartments}
              placeholder="Departments..."
            />
            <select 
              value={statusDuration}
              onChange={(e) => setStatusDuration(e.target.value)}
              className="text-xs border border-slate-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none bg-slate-50 font-medium text-slate-700"
            >
              {DURATION_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>
        
        <div className="h-64 w-full flex justify-center mt-auto">
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{fontSize: '12px'}} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">No data for selected criteria</div>
          )}
        </div>
      </div>

      {/* Monthly Trend Line Chart - Full Width */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-slate-800 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-indigo-600" />
            Monthly Volume Trend
          </h3>
          <select 
            value={trendDuration}
            onChange={(e) => setTrendDuration(e.target.value)}
            className="text-xs border border-slate-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none bg-slate-50 font-medium text-slate-700"
          >
            {DURATION_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div className="h-64 w-full mt-auto">
          {monthlyTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrendData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} allowDecimals={false} />
                <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Line type="monotone" dataKey="indents" stroke="#10b981" strokeWidth={3} dot={{r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">No data for selected period</div>
          )}
        </div>
      </div>
    </div>
  );
}
