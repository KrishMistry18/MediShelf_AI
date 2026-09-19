import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'An error occurred',
  message,
  onRetry,
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center p-8 sm:p-10 text-center rounded-2xl border border-rose-500/30 bg-rose-950/20 text-rose-300 ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-3">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-sm sm:text-base font-semibold text-white tracking-tight">
        {title}
      </h3>
      <p className="mt-1 text-xs text-rose-300/90 max-w-md leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry Request
          </Button>
        </div>
      )}
    </div>
  );
};
