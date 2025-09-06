import React from 'react';
import { Clock, CheckCircle } from 'lucide-react';

const statusStyles = {
  scheduled: 'bg-indigo-100 text-indigo-800 border border-indigo-300',
  in_progress: 'bg-blue-100 text-blue-800 border border-blue-300',
  completed: 'bg-green-200 text-green-800 border border-green-500',
  cancelled: 'bg-red-100 text-red-800 border border-red-300',
};

export default function StatusBadge({ status }) {
  const baseClasses = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold';
  const className = `${baseClasses} ${statusStyles[status] || ''}`;

  return (
    <span className={className}>
      {status === 'scheduled' && <Clock className="h-3 w-3" />}
      {status === 'completed' && <CheckCircle className="h-3 w-3" />}
      {status.replace('_', ' ').toUpperCase()}
    </span>
  );
}
