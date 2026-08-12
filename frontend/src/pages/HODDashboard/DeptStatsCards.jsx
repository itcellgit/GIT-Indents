import React from 'react';
import { ClipboardList, Clock, Wrench, CheckCircle } from 'lucide-react';

const DeptStatsCards = ({ stats, activeFilter, onCardClick }) => {
  const cards = [
    {
      title: 'Total Dept Indents',
      value: stats.total,
      icon: ClipboardList,
      color: 'bg-indigo-500',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-700',
      filterValue: 'All',
    },
    {
      title: 'Pending Facility Providers Approval',
      value: stats.pendingApproval,
      icon: Clock,
      color: 'bg-amber-500',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-700',
      filterValue: 'Pending Approval',
    },
    {
      title: 'In Progress / Active',
      value: stats.active,
      icon: Wrench,
      color: 'bg-sky-500',
      bgColor: 'bg-sky-50',
      textColor: 'text-sky-700',
      filterValue: 'Active',
    },
    {
      title: 'Completed & Closed',
      value: stats.completed,
      icon: CheckCircle,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-700',
      filterValue: 'Completed',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, index) => {
        const isActive = activeFilter === card.filterValue;
        return (
          <div 
            key={index} 
            onClick={() => onCardClick && onCardClick(card.filterValue)}
            className={`rounded-xl border ${isActive ? 'border-indigo-400 ring-2 ring-indigo-500 bg-indigo-50/10' : 'border-gray-100 bg-white'} shadow-sm p-5 flex flex-col hover:shadow-md transition-all cursor-pointer`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">{card.title}</p>
                <h3 className={`text-3xl font-extrabold ${card.textColor}`}>{card.value}</h3>
              </div>
              <div className={`p-3 rounded-xl ${card.bgColor}`}>
                <card.icon className={`w-6 h-6 ${card.textColor}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DeptStatsCards;
