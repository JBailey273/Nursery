import React from 'react';

/**
 * Responsive progress indicator for multi-step forms.
 * Renders step numbers as circles and allows horizontal scrolling on mobile
 * so the header never gets squished.
 */
const ProgressSteps = ({ steps = [], currentStep = 1 }) => {
  return (
    <div className="overflow-x-auto">
      <ol className="flex items-center space-x-4 min-w-max p-4">
        {steps.map((label, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;

          const circleClass = [
            'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border',
            isActive
              ? 'bg-green-600 text-white border-green-600'
              : isCompleted
              ? 'bg-green-100 text-green-800 border-green-600'
              : 'bg-white text-gray-500 border-gray-300'
          ].join(' ');

          return (
            <li key={label} className="flex items-center space-x-2">
              <span className={circleClass}>{stepNumber}</span>
              <span className="text-sm whitespace-nowrap">{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default ProgressSteps;
