import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'primary' | 'purple';
  size?: 'sm' | 'md';
  dot?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<NonNullable<BadgeProps['variant']>, string> = {
  neutral: 'bg-slate-800/80 text-slate-300 border-slate-700/60',
  success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  warning: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  danger: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  info: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  primary: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  purple: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
};

const dotColors: Record<NonNullable<BadgeProps['variant']>, string> = {
  neutral: 'bg-slate-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger: 'bg-rose-400',
  info: 'bg-cyan-400',
  primary: 'bg-blue-400',
  purple: 'bg-purple-400',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
  children,
  ...props
}) => {
  const sizeStyle = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  const vStyle = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium font-sans leading-none ${sizeStyle} ${vStyle} ${className}`}
      {...props}
    >
      {dot && (
        <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  );
};
