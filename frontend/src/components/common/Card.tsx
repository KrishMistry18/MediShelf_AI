import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'subtle' | 'accent' | 'warning' | 'danger';
  hover?: boolean;
}

const variantStyles: Record<NonNullable<CardProps['variant']>, string> = {
  default: 'border border-slate-800 bg-slate-900/60 shadow-xl shadow-slate-950/40',
  subtle: 'border border-slate-800/70 bg-slate-950/50 shadow-md',
  accent: 'border border-cyan-500/30 bg-cyan-950/20 shadow-lg shadow-cyan-950/20',
  warning: 'border border-amber-500/30 bg-amber-950/20 shadow-lg shadow-amber-950/20',
  danger: 'border border-rose-500/30 bg-rose-950/20 shadow-lg shadow-rose-950/20',
};

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  hover = false,
  className = '',
  children,
  ...props
}) => {
  return (
    <div
      className={`rounded-2xl backdrop-blur-xs transition-all duration-200 ${variantStyles[variant]} ${
        hover ? 'hover:border-slate-700 hover:shadow-2xl hover:-translate-y-0.5' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div className={`p-5 sm:p-6 border-b border-slate-800/80 ${className}`} {...props}>
    {children}
  </div>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div className={`p-5 sm:p-6 ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div
    className={`p-4 sm:p-5 border-t border-slate-800/80 bg-slate-950/30 rounded-b-2xl ${className}`}
    {...props}
  >
    {children}
  </div>
);
