import React from 'react';

export interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  icon,
  title,
  badge,
  description,
  actions,
  className = '',
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${className}`}>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          {icon && <span className="text-slate-400 flex items-center">{icon}</span>}
          <h2 className="text-sm sm:text-base font-semibold text-white tracking-tight">
            {title}
          </h2>
          {badge}
        </div>
        {description && <p className="text-xs text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
};
