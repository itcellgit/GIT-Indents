import React from 'react';
import { Clock } from 'lucide-react';

const Timeline = ({ currentStatus, history, createdAt, updatedAt }) => {
  // Build the list of steps to display
  let steps = [];

  if (history && history.length > 0) {
    steps = history.map((item, index) => ({
      id: index,
      status: item.status,
      time: item.timestamp
    }));
  } else {
    // Fallback for older indents without history
    steps.push({ id: 'created', status: 'Indent Created', time: createdAt });
    if (currentStatus !== 'Indent Created') {
      steps.push({ id: 'current', status: currentStatus, time: updatedAt });
    }
  }

  return (
    <div className="w-full">
      <h3 className="text-sm font-bold text-gray-800 mb-6 flex items-center gap-2 uppercase tracking-wider">
        <Clock className="w-4 h-4 text-gray-400" />
        Status Timeline
      </h3>
      <div className="relative pl-4 border-l-2 border-indigo-100 space-y-6 ml-3">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const isResolved = step.status === 'Completed';
          const isRejected = step.status.includes('Rejected');

          return (
            <div key={step.id} className="relative">
              {/* Dot */}
              <div 
                className={`absolute -left-[23px] top-1 w-4 h-4 rounded-full border-2 bg-white ${
                  isLast 
                    ? (isResolved ? 'border-green-500 bg-green-500' : isRejected ? 'border-red-500 bg-red-500' : 'border-indigo-600 bg-indigo-600')
                    : 'border-indigo-200 bg-indigo-200'
                }`}
              />
              
              <div className="flex flex-col ml-2">
                <p className={`text-sm font-bold ${
                  isLast 
                    ? (isResolved ? 'text-green-700' : isRejected ? 'text-red-700' : 'text-indigo-700')
                    : 'text-gray-600'
                }`}>
                  {step.status}
                </p>
                {step.time && (
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {new Date(step.time).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'numeric',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: 'numeric',
                      second: 'numeric',
                      hour12: true
                    })}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Timeline;
