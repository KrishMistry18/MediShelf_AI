import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-semibold shadow-md shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500 active:scale-[0.98] border border-emerald-400/30',
  secondary:
    'bg-slate-800 text-slate-200 hover:bg-slate-700 active:bg-slate-800/90 border border-slate-700/80 shadow-sm',
  outline:
    'bg-transparent border border-slate-700 text-slate-300 hover:bg-slate-800/80 hover:text-white hover:border-slate-600',
  ghost:
    'bg-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent',
  danger:
    'bg-rose-600/90 text-white font-medium hover:bg-rose-500 active:bg-rose-700 border border-rose-500/40 shadow-sm shadow-rose-600/20',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-2.5 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2 text-xs md:text-sm rounded-xl gap-2',
  lg: 'px-5 py-2.5 text-sm font-semibold rounded-xl gap-2.5',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      loading = false,
      icon,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-current" />
        ) : (
          icon && <span className="shrink-0">{icon}</span>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
