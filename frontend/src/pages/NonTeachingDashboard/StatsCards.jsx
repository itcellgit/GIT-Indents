import React from 'react';

const StatsCards = ({ statsCards, statsCounts, onCardClick, activeFilter }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
    </div>
  );
};

export default StatsCards;
