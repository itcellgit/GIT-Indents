import React from 'react';
import { Building2, Users, ClipboardList, AlertCircle, CheckCircle2, Timer, XCircle } from 'lucide-react';
import { formatDuration } from '../../utils/completionTime';

// avgCompletion ({ hours, count }) is optional; when passed, an info-only Avg Completion Time card is appended.
export default function StatsCards({ stats, activeFilter, onCardClick, avgCompletion }) {
  const cards = [
    {
      title: "Facility Providers",
      value: stats.totalDepartments,
      icon: Building2,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      borderColor: "border-indigo-100",
      filterValue: 'departmentsTab'
    },
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
      borderColor: "border-blue-100",
      filterValue: 'usersTab'
    },
    {
      title: "Total Indents",
      value: stats.totalIndents,
      icon: ClipboardList,
      color: "text-violet-600",
      bg: "bg-violet-50",
      borderColor: "border-violet-100",
      filterValue: 'All'
    },
    {
      title: "Active Indents",  
      value: stats.activeComplaints, 
      icon: AlertCircle, 
      color: "text-orange-600", 
      bg: "bg-orange-50", 
      borderColor: "border-orange-100",
      filterValue: 'Active'
    },
    { 
      title: "Completed Indents", 
      value: stats.resolvedComplaints, 
      icon: CheckCircle2, 
      color: "text-emerald-600", 
      bg: "bg-emerald-50", 
      borderColor: "border-emerald-100",
      filterValue: 'Completed'
    },
    {
      title: "Rejected Indents",
      value: stats.rejectedComplaints,
      icon: XCircle,
      color: "text-rose-600",
      bg: "bg-rose-50",
      borderColor: "border-rose-100",
      filterValue: 'Rejected'
    },
    ...(avgCompletion ? [{
      title: "Avg Completion Time",
      value: formatDuration(avgCompletion.hours),
      subtitle: `based on ${avgCompletion.count} completed indent${avgCompletion.count !== 1 ? 's' : ''}`,
      icon: Timer,
      color: "text-purple-600",
      bg: "bg-purple-50",
      borderColor: "border-purple-100",
      filterValue: null // info-only card, not a filter
    }] : [])
  ];

  const gridCols = cards.length > 5 ? 'lg:grid-cols-3' : 'lg:grid-cols-5';

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 ${gridCols} gap-6`}>
      {cards.map((card, idx) => {
        const Icon = card.icon;
        const isClickable = card.filterValue !== null;
        const isActive = isClickable && activeFilter === card.filterValue;
        return (
          <div
            key={idx}
            onClick={() => isClickable && onCardClick && onCardClick(card.filterValue)}
            className={`bg-white rounded-xl shadow-sm border ${isActive ? 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50/10' : card.borderColor} p-6 flex items-center justify-between transition-transform hover:-translate-y-1 hover:shadow-md ${isClickable ? 'cursor-pointer' : ''}`}
          >
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">{card.title}</p>
              <h3 className="text-3xl font-bold text-slate-800">{card.value}</h3>
              {card.subtitle && <p className="text-xs text-slate-400 mt-1">{card.subtitle}</p>}
            </div>
            <div className={`p-4 rounded-xl ${card.bg}`}>
              <Icon className={`w-7 h-7 ${card.color}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
