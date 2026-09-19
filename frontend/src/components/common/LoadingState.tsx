import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  message?: string;
  subtext?: string;
  className?: string;
  compact?: boolean;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  subtext,
  className = '',
  compact = false,
}) => {
  if (compact) {
    return (
      <div className={`flex items-center justify-center gap-2 py-4 text-xs text-slate-400 ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center p-10 sm:p-14 text-center rounded-2xl border border-slate-800/80 bg-slate-900/30 ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-3.5">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
      </div>
      <p className="text-sm font-semibold text-slate-200 tracking-tight">{message}</p>
      {subtext && <p className="mt-1 text-xs text-slate-400 max-w-xs">{subtext}</p>}
    </div>
  );
};
