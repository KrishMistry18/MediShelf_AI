import React from 'react';
import {
  LayoutDashboard,
  Thermometer,
  Pill,
  Camera,
  Bell,
  Cpu,
  ShieldCheck,
  ChevronRight,
  X,
  Home,
} from 'lucide-react';
import type { TabKey } from '../../types';

interface SidebarProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeVariant?: 'neutral' | 'success' | 'info';
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
}) => {
  const navItems: NavItem[] = [
    { key: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'medicines', label: 'Medicines', icon: Pill, badge: '25 Monographs', badgeVariant: 'info' },
    { key: 'scan', label: 'Scan Medicine', icon: Camera, badge: 'CV + OCR', badgeVariant: 'success' },
    { key: 'assessment', label: 'Storage Assessment', icon: Thermometer },
    { key: 'alerts', label: 'Storage Alerts', icon: Bell },
    { key: 'models', label: 'Model Information', icon: Cpu },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800/80 bg-slate-900/95 p-4 backdrop-blur-md transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile close bar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 md:hidden">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Workspace Menu
          </span>
          <button
            onClick={onCloseMobile}
            aria-label="Close menu"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Public Website Switcher Link */}
        <div className="pt-1 pb-3">
          <button
            type="button"
            onClick={() => {
              onSelectTab('home');
              onCloseMobile();
            }}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition cursor-pointer border ${
              activeTab === 'home'
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-cyan-400" />
              <span>Public Product Site</span>
            </div>
            <ChevronRight className="h-3 w-3 text-slate-500" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="space-y-1 mt-1" aria-label="Main platform navigation">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Product Workspace
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeTab === item.key ||
              (item.key === 'assessment' && activeTab === 'monitoring');

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onSelectTab(item.key);
                  onCloseMobile();
                }}
                className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent text-emerald-300 border border-emerald-500/30 shadow-xs'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`h-4 w-4 transition-colors ${
                      isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-300'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-mono border ${
                      isActive
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800/90 text-slate-400 border-slate-700/60'
                    }`}
                  >
                    {item.badge}
                  </span>
                ) : (
                  isActive && <ChevronRight className="h-3.5 w-3.5 text-emerald-400" />
                )}
              </button>
            );
          })}
        </nav>

        {/* System Architecture Status Footer Box */}
        <div className="mt-auto pt-4 border-t border-slate-800/80">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Verified Monograph Ground Truth</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Official FDA DailyMed & USP monographs with MobileNetV3 visual recognition and trained storage-risk estimation.
            </p>
            <div className="pt-1 text-[10px] font-mono text-emerald-400/90 flex items-center justify-between border-t border-slate-800/60">
              <span>Software-Only Decision Support</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
