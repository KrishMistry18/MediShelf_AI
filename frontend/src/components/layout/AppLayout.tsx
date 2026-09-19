import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import type { SystemHealth, TabKey } from '../../types';
import { AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

interface AppLayoutProps {
  health: SystemHealth | null;
  loading: boolean;
  onRefreshHealth: () => void;
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  health,
  loading,
  onRefreshHealth,
  activeTab,
  onSelectTab,
  children,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 antialiased selection:bg-cyan-500/20 selection:text-white">
      <Header
        health={health}
        loading={loading}
        onRefreshHealth={onRefreshHealth}
        onToggleSidebar={() => setIsMobileMenuOpen((prev) => !prev)}
      />

      {/* Mandatory Clinical/AI Research Banner */}
      <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-200/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span className="text-[11px] sm:text-xs">
              <strong>Academic Healthcare Demonstration:</strong> AI outputs and CV estimations assist identification and do not replace certified pharmacist monograph verification or accredited laboratory testing.
            </span>
          </div>
          <span className="hidden lg:inline text-[11px] font-mono text-amber-300/80 shrink-0">
            Separation: CV/OCR ↔ Catalog Database ↔ Deterministic Rules
          </span>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/60 px-4 sm:px-6 py-3.5 text-xs text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-slate-300">
            <Info className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span className="text-[11px] sm:text-xs">
              MediShelf AI Research Platform — System v{health?.version || '0.1.0'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Software-Only Architecture
            </span>
            <span>•</span>
            <span>Mobile & Desktop Responsive</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
