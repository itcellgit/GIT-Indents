import React from 'react';
import { Building2, Users, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function StatsCards({ stats, activeFilter, onCardClick }) {
  const cards = [
    { 
      title: "Total Departments", 
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
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        const isActive = activeFilter === card.filterValue;
        return (
          <div 
            key={idx} 
            onClick={() => onCardClick && onCardClick(card.filterValue)}
            className={`bg-white rounded-xl shadow-sm border ${isActive ? 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50/10' : card.borderColor} p-6 flex items-center justify-between transition-transform hover:-translate-y-1 hover:shadow-md cursor-pointer`}
          >
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">{card.title}</p>
              <h3 className="text-3xl font-bold text-slate-800">{card.value}</h3>
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
