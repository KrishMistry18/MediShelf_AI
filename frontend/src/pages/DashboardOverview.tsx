import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Flame,
  Pill,
  ArrowUpRight,
  Server,
  CheckCircle2,
  Workflow,
} from 'lucide-react';
import type { SystemHealth } from '../types';

interface DashboardOverviewProps {
  health: SystemHealth | null;
  onNavigateToScan: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  health,
  onNavigateToScan,
}) => {
  const statCards = [
    {
      title: 'Monitored Medicines',
      value: '24',
      subtitle: 'Target: 20-50 classes (Phase 2)',
      icon: Pill,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/20',
    },
    {
      title: 'Safe Storage',
      value: '19',
      subtitle: 'Within nominal bounds',
      icon: ShieldCheck,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
    },
    {
      title: 'Storage Warning',
      value: '3',
      subtitle: 'Mild deviation from spec',
      icon: AlertTriangle,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
    },
    {
      title: 'High Risk / Expired',
      value: '2',
      subtitle: 'Immediate review needed',
      icon: Flame,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/20',
    },
  ];

  const workflowSteps = [
    { step: 1, title: 'Capture Image', desc: 'Mobile camera or file upload' },
    { step: 2, title: 'CV Recognition', desc: 'MobileNetV3 / EfficientNet' },
    { step: 3, title: 'OCR Extraction', desc: 'Expiry date & label parsing' },
    { step: 4, title: 'Metadata Lookup', desc: 'Pharma storage bounds' },
    { step: 5, title: 'ML Risk Engine', desc: 'Random Forest / Gradient Boost' },
    { step: 6, title: 'Deterministic Rules', desc: 'Expiry & temperature check' },
    { step: 7, title: 'Explainable Report', desc: 'Contributing risk factors' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 mb-2">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Phase 1 Foundation Active</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              MediShelf AI Storage & Safety Platform
            </h1>
            <p className="mt-1 text-sm text-slate-400 max-w-2xl">
              Software-only intelligence pipeline integrating transfer-learning computer vision, OCR text parsing, and machine-learning risk assessment for medicine storage safety.
            </p>
          </div>

          <button
            onClick={onNavigateToScan}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-500 transition active:scale-95"
          >
            <span>Scan Medicine</span>
            <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className={`rounded-xl border ${card.borderColor} bg-slate-900/60 p-5 backdrop-blur transition hover:border-slate-700`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{card.title}</span>
                <div className={`rounded-lg p-2 ${card.bgColor}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold tracking-tight text-white">{card.value}</div>
                <div className="mt-1 text-xs text-slate-400">{card.subtitle}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Two Column Layout: Pipeline & Backend Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Architecture Card */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Workflow className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">End-to-End Safety Workflow</h2>
          </div>
          <p className="text-xs text-slate-400 mb-6">
            Strict separation between AI/ML inference, deterministic validation rules, and pharmaceutical metadata.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {workflowSteps.map((s) => (
              <div
                key={s.step}
                className="relative rounded-xl border border-slate-800/80 bg-slate-950/50 p-3.5 transition hover:border-slate-700"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">
                    {s.step}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Step {s.step}</span>
                </div>
                <h4 className="text-xs font-semibold text-slate-200">{s.title}</h4>
                <p className="mt-0.5 text-[11px] text-slate-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Backend & Environment Status Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">System Diagnostics</h2>
          </div>
          <p className="text-xs text-slate-400">
            Real-time health verification communicating with the FastAPI backend and SQLAlchemy persistence layer.
          </p>

          <div className="space-y-3 rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
              <span className="text-slate-400">API Status:</span>
              <span className="font-mono font-semibold text-emerald-400 uppercase">
                {health?.status || 'Connecting...'}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
              <span className="text-slate-400">Database Engine:</span>
              <span className="font-mono text-cyan-300">
                {health?.database === 'connected' ? 'SQLite (Ready for Postgres)' : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
              <span className="text-slate-400">Environment:</span>
              <span className="font-mono text-slate-300">{health?.environment || 'development'}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
              <span className="text-slate-400">Backend Version:</span>
              <span className="font-mono text-slate-300">v{health?.version || '0.1.0'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Hardware Requirements:</span>
              <span className="font-semibold text-emerald-400">None (Software-Only)</span>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300">
            <strong>Ready for Phase 2:</strong> Medicine metadata schema and database ingestion pipeline.
          </div>
        </div>
      </div>
    </div>
  );
};
