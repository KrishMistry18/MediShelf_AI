import React from 'react';
import { Activity, ShieldCheck, Database, RefreshCw, Menu, Home, LayoutDashboard } from 'lucide-react';
import type { SystemHealth, TabKey } from '../../types';
import { Badge } from '../common/Badge';

interface HeaderProps {
  health: SystemHealth | null;
  loading: boolean;
  onRefreshHealth: () => void;
  onToggleSidebar: () => void;
  activeTab?: TabKey;
  onSelectTab?: (tab: TabKey) => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  loading,
  onRefreshHealth,
  onToggleSidebar,
  activeTab,
  onSelectTab,
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

        <button
          onClick={() => onSelectTab && onSelectTab('home')}
          className="flex items-center gap-2.5 cursor-pointer text-left focus:outline-none"
        >
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
        </button>
      </div>

      {/* Center Navigation Switcher for Desktop */}
      {onSelectTab && (
        <div className="hidden md:flex items-center gap-1 rounded-xl bg-slate-950/70 p-1 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => onSelectTab('home')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
              activeTab === 'home'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <Home className="h-3.5 w-3.5" />
            <span>Public Site</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('overview')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
              activeTab !== 'home'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>Workspace</span>
          </button>
        </div>
      )}

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

        {/* Decision Support Prototype Pill */}
        <div
          title={health?.disclaimer}
          className="hidden lg:flex items-center gap-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 text-[11px] font-medium text-cyan-300"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
          <span>Decision Support</span>
        </div>
      </div>
    </header>
  );
};
