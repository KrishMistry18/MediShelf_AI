import React from 'react';
import { Activity, ShieldAlert, Database, RefreshCw, Menu } from 'lucide-react';
import type { SystemHealth } from '../../types';
import { Badge } from '../common/Badge';

interface HeaderProps {
  health: SystemHealth | null;
  loading: boolean;
  onRefreshHealth: () => void;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  loading,
  onRefreshHealth,
  onToggleSidebar,
}) => {
  const isHealthy = health?.status === 'healthy';
  const isDbConnected = health?.database === 'connected';

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800/80 bg-slate-900/90 px-4 backdrop-blur-md md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition md:hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 shadow-md shadow-emerald-500/20">
            <Activity className="h-5 w-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white font-sans">
                MediShelf
              </span>
              <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-cyan-300 border border-cyan-500/30 font-mono">
                AI
              </span>
            </div>
            <p className="hidden text-[11px] font-medium text-slate-400 sm:block">
              Intelligent Medicine Storage & Safety Assessment
            </p>
          </div>
        </div>
      </div>

      {/* Right side: Live System Status Badges */}
      <div className="flex items-center gap-2.5">
        {/* API Status Badge */}
        <Badge
          variant={isHealthy ? 'success' : 'danger'}
          size="sm"
          dot
          className="font-mono"
        >
          <span className="hidden sm:inline">API:</span>
          <span>{health?.status || 'connecting'}</span>
        </Badge>

        {/* Database Status Badge */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-950/70 px-2.5 py-0.5 text-[11px] font-mono text-slate-300">
          <Database className={`h-3 w-3 ${isDbConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span>DB: {health?.database || 'checking'}</span>
        </div>

        {/* Health Refresh Button */}
        <button
          onClick={onRefreshHealth}
          disabled={loading}
          aria-label="Refresh system health diagnostics"
          title="Refresh backend status"
          className="rounded-xl border border-slate-800 bg-slate-950/50 p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition disabled:opacity-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>

        {/* Academic Disclaimer Pill */}
        <div
          title={health?.disclaimer}
          className="hidden lg:flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[11px] font-medium text-amber-300"
        >
          <ShieldAlert className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span>Academic Research Platform</span>
        </div>
      </div>
    </header>
  );
};
