import React from 'react';
import { Timer } from 'lucide-react';
import { formatDuration } from '../../utils/completionTime';

// avgCompletion ({ hours, count }) is optional; when passed, an info-only Avg Completion Time card is appended.
const StatsCards = ({ statsCards, statsCounts, onCardClick, activeFilter, avgCompletion }) => {
  const totalCards = statsCards.length + (avgCompletion ? 1 : 0);
  const gridCols = totalCards > 5 ? 'lg:grid-cols-3 xl:grid-cols-6' : 'lg:grid-cols-5';

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 ${gridCols} gap-6`}>
      {statsCards.map((card, idx) => {
        const Icon = card.icon;
        const isActive = activeFilter === card.title;
        return (
          <div
            key={idx}
            onClick={() => onCardClick && onCardClick(card.title)}
            className={`rounded-xl border ${card.border} ${isActive ? 'ring-2 ring-indigo-500 bg-indigo-50/20' : 'bg-white'} p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden cursor-pointer`}
          >
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full ${card.bg} opacity-50`}></div>
            <div className="flex items-center justify-between relative z-10">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">{card.title}</p>
                <h3 className="text-3xl font-bold text-slate-800">{statsCounts[card.title] || 0}</h3>
              </div>
              <div className={`p-3 rounded-lg ${card.bg} ${card.color}`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          </div>
        );
      })}
      {avgCompletion && (
        <div className="rounded-xl border border-purple-100 bg-white p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full bg-purple-50 opacity-50"></div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Avg Completion Time</p>
              <h3 className="text-3xl font-bold text-slate-800">{formatDuration(avgCompletion.hours)}</h3>
              <p className="text-xs text-slate-400 mt-1">based on {avgCompletion.count} completed indent{avgCompletion.count !== 1 ? 's' : ''}</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 text-purple-600">
              <Timer className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsCards;
