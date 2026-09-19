import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightAction?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightAction, id, className = '', ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-slate-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center justify-center">
              {leftIcon}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full rounded-xl border bg-slate-900/90 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 shadow-sm transition-colors duration-150 focus:outline-none focus:ring-1 ${
              leftIcon ? 'pl-10' : 'pl-3.5'
            } ${rightAction ? 'pr-10' : 'pr-3.5'} ${
              error
                ? 'border-rose-500/80 focus:border-rose-400 focus:ring-rose-400/50'
                : 'border-slate-800 focus:border-cyan-500/80 focus:ring-cyan-500/30'
            } ${className}`}
            {...props}
          />
          {rightAction && (
            <div className="absolute right-2.5 flex items-center">{rightAction}</div>
          )}
        </div>
        {error ? (
          <p className="text-[11px] text-rose-400">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-slate-400">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
