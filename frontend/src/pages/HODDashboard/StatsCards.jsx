import React from 'react';
import { Clock, Users, Wrench, CheckCircle } from 'lucide-react';

const StatsCards = ({ stats, activeFilter, onCardClick }) => {
  const cards = [
    {
      title: 'Pending Assignment',
      value: stats.pending,
      icon: Clock,
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-700',
      filterValue: 'Approved by Maintenance HOD',
    },

    {
      title: 'In Progress',
      value: stats.inProgress,
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
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {cards.map((card, index) => {
        const isActive = activeFilter === card.filterValue;
        return (
          <div 
            key={index} 
            onClick={() => onCardClick && onCardClick(card.filterValue)}
            className={`rounded-xl border ${isActive ? 'border-indigo-400 ring-2 ring-indigo-500 bg-indigo-50/10' : 'border-gray-100 bg-white'} shadow-sm p-6 flex flex-col hover:shadow-md transition-all cursor-pointer`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-500 text-sm font-medium mb-1">{card.title}</p>
                <h3 className={`text-3xl font-bold ${card.textColor}`}>{card.value}</h3>
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
