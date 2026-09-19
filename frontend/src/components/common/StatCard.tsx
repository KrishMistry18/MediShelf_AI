import React from 'react';
import { Card } from './Card';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  theme?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate';
  className?: string;
}

const themeStyles = {
  cyan: {
    iconBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    cardBorder: 'hover:border-cyan-500/40',
  },
  emerald: {
    iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    cardBorder: 'hover:border-emerald-500/40',
  },
  amber: {
    iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    cardBorder: 'hover:border-amber-500/40',
  },
  rose: {
    iconBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    cardBorder: 'hover:border-rose-500/40',
  },
  slate: {
    iconBg: 'bg-slate-800 text-slate-300 border-slate-700/60',
    cardBorder: 'hover:border-slate-700',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  theme = 'slate',
  className = '',
}) => {
  const currentTheme = themeStyles[theme];

  return (
    <Card
      hover
      className={`p-5 transition-all duration-200 ${currentTheme.cardBorder} ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {title}
        </span>
        {icon && (
          <div className={`rounded-xl p-2.5 border ${currentTheme.iconBg}`}>
            {icon}
          </div>
        )}
      </div>
      <div className="mt-2.5">
        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-mono">
          {value}
        </div>
        {subtitle && (
          <div className="mt-1 text-xs text-slate-400 leading-snug">
            {subtitle}
          </div>
        )}
      </div>
    </Card>
  );
};
