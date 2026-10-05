import React from 'react';
import { ClipboardList, Clock, Users, Wrench, CheckCircle, Timer, XCircle } from 'lucide-react';
import { formatDuration } from '../../utils/completionTime';

const StatsCards = ({ stats, activeFilter, onCardClick, variant = 'hod' }) => {
  const activeLabel = variant === 'principal' ? 'Active Indents' : 'In Progress';
  const cards = [
    {
      title: 'Total Indents',
      value: stats.total,
      icon: ClipboardList,
      color: 'bg-indigo-500',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-700',
      filterValue: 'All',
    },
    {
      title: 'Pending Approval',
      value: stats.pending,
      icon: Clock,
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-700',
      filterValue: 'Indent Created',
    },

    {
      title: activeLabel,
      value: stats.inProgress ?? stats.active,
      icon: Wrench,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      filterValue: 'In Progress',
    },
    {
      title: 'Completed',
      value: stats.resolved,
      icon: CheckCircle,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      filterValue: 'Completed',
    },
    {
      title: 'Rejected Indents',
      value: stats.rejected,
      icon: XCircle,
      color: 'bg-rose-500',
      bgColor: 'bg-rose-50',
      textColor: 'text-rose-700',
      filterValue: 'Rejected',
    },
    {
      title: 'Avg Completion Time',
      value: formatDuration(stats.avgCompletionHours),
      subtitle: `based on ${stats.avgCompletionCount} completed indent${stats.avgCompletionCount !== 1 ? 's' : ''}`,
      icon: Timer,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
      filterValue: null, // info-only card, not a filter
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      {cards.map((card, index) => {
        const isClickable = card.filterValue !== null;
        const isActive = isClickable && activeFilter === card.filterValue;
        return (
          <div
            key={index}
            onClick={() => isClickable && onCardClick && onCardClick(card.filterValue)}
            className={`rounded-xl border ${isActive ? 'border-indigo-400 ring-2 ring-indigo-500 bg-indigo-50/10' : 'border-gray-100 bg-white'} shadow-sm p-6 flex flex-col hover:shadow-md transition-all ${isClickable ? 'cursor-pointer' : ''}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium mb-1">{card.title}</p>
                <h3 className={`text-3xl font-bold ${card.textColor}`}>{card.value}</h3>
                {card.subtitle && <p className="text-xs text-gray-400 mt-1">{card.subtitle}</p>}
              </div>
              <div className={`p-3 rounded-lg ${card.bgColor}`}>
                <card.icon className={`w-6 h-6 ${card.textColor}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default StatsCards;
