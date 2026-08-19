import React from 'react';
import { Check } from 'lucide-react';
import { formatDate } from '../../utils/formatDate';

const Timeline = ({ currentStatus, timestamps }) => {
  const steps = [
    { id: 'Pending', label: 'Submitted', time: timestamps?.submitted },
    { id: 'Assigned', label: 'Assigned', time: timestamps?.assigned },
    { id: 'In Progress', label: 'In Progress', time: timestamps?.inProgress },
    { id: 'Resolved', label: 'Resolved', time: timestamps?.resolved },
  ];

  const getStepStatus = (stepId, index) => {
    const statusOrder = ['Pending', 'Assigned', 'In Progress', 'Resolved'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'current';
    return 'pending';
  };

  return (
    <div className="py-4 w-full">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Status Timeline</h3>
      <div className="relative flex justify-between items-center w-full max-w-3xl mx-auto">
        {/* Connecting line */}
        <div className="absolute top-5 left-8 right-8 h-1 bg-gray-200 z-0">
          <div 
            className="h-full bg-indigo-500 transition-all duration-500" 
            style={{ 
              width: `${(steps.findIndex(s => s.id === currentStatus) / (steps.length - 1)) * 100}%` 
            }}
          />
        </div>

        {/* Steps */}
        {steps.map((step, index) => {
          const status = getStepStatus(step.id, index);
          
          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center group">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center border-4 transition-colors duration-300 ${
                  status === 'completed' 
                    ? 'bg-indigo-600 border-indigo-200 text-white' 
                    : status === 'current'
                    ? 'bg-white border-indigo-600 text-indigo-600'
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {status === 'completed' ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <span className="text-sm font-semibold">{index + 1}</span>
                )}
              </div>
              <div className="mt-3 text-center w-20">
                <p className={`text-xs font-semibold ${
                  status === 'completed' || status === 'current' ? 'text-gray-800' : 'text-gray-400'
                }`}>
                  {step.label}
                </p>
                {step.time && (
                  <p className="text-[10px] text-gray-500 mt-1 whitespace-nowrap">
                    {formatDate(step.time)}
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
