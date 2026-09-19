import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Pill,
  ArrowUpRight,
  Server,
  Workflow,
  Camera,
  Database,
  Scan,
  FileText,
  Thermometer,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { SystemHealth } from '../types';
import {
  Badge,
  Button,
  Card,
  SectionHeader,
  StatCard,
} from '../components/common';

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
      value: '25',
      subtitle: 'Verified DailyMed monographs (Phase 2)',
      icon: <Pill className="h-5 w-5" />,
      theme: 'cyan' as const,
    },
    {
      title: 'CV Packaging Classes',
      value: '10',
      subtitle: 'MobileNetV3 trained models (Phase 3)',
      icon: <Scan className="h-5 w-5" />,
      theme: 'emerald' as const,
    },
    {
      title: 'OCR Label Parsing',
      value: 'Active',
      subtitle: 'EasyOCR CRAFT + CRNN engine (Phase 4)',
      icon: <FileText className="h-5 w-5" />,
      theme: 'cyan' as const,
    },
    {
      title: 'Storage Risk Engine',
      value: 'Pending',
      subtitle: 'Planned for Phase 5 development',
      icon: <AlertTriangle className="h-5 w-5" />,
      theme: 'amber' as const,
    },
  ];

  const workflowSteps = [
    { step: 1, title: 'Capture Package', desc: 'Mobile camera or file upload', icon: Camera },
    { step: 2, title: 'Quality Gate', desc: 'Sharpness, exposure, resolution', icon: ShieldCheck },
    { step: 3, title: 'CV Classifier', desc: 'MobileNetV3-Small trade dress', icon: Scan },
    { step: 4, title: 'Deep OCR', desc: 'Expiry, batch, dosage strength', icon: FileText },
    { step: 5, title: 'Decision Fusion', desc: 'Consensus scoring & conflict check', icon: Layers },
    { step: 6, title: 'Monograph Lookup', desc: 'Official DailyMed storage bounds', icon: Database },
    { step: 7, title: 'Storage Safety', desc: 'Deterministic compliance check', icon: Thermometer },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2">
              <Badge variant="success" size="sm" dot>
                Phases 1–4 Fully Operational
              </Badge>
              <Badge variant="warning" size="sm">
                Phase 5 Storage Risk ML Next
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              MediShelf AI Storage & Safety Platform
            </h1>
            <p className="text-xs sm:text-sm text-slate-300/90 max-w-2xl leading-relaxed">
              Software-only multi-modal intelligence system combining transfer-learning computer vision, deep OCR text parsing, and verified pharmaceutical storage monographs to safeguard medicine stability without mandatory physical hardware.
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            onClick={onNavigateToScan}
            icon={<ArrowUpRight className="h-4 w-4 stroke-[2.5]" />}
            className="self-start md:self-center shrink-0"
          >
            Launch Scanner
          </Button>
        </div>
      </div>

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => (
          <StatCard
            key={idx}
            title={card.title}
            value={card.value}
            subtitle={card.subtitle}
            icon={card.icon}
            theme={card.theme}
          />
        ))}
      </div>

      {/* Two Column Layout: Safety Workflow & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pipeline Architecture Card */}
        <Card className="lg:col-span-8 p-6 space-y-4">
          <SectionHeader
            icon={<Workflow className="h-5 w-5 text-cyan-400" />}
            title="Multi-Modal Intelligence & Safety Workflow"
            badge={
              <Badge variant="info" size="sm">
                7-Step Pipeline
              </Badge>
            }
            description="Strict architectural separation between AI/ML estimations, deterministic rules, and authoritative pharmaceutical monographs."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
            {workflowSteps.map((s) => {
              const StepIcon = s.icon;
              return (
                <div
                  key={s.step}
                  className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3.5 space-y-1.5 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 font-mono">
                      {s.step}
                    </span>
                    <StepIcon className="h-3.5 w-3.5 text-cyan-400" />
                  </div>
                  <h3 className="text-xs font-semibold text-slate-200">{s.title}</h3>
                  <p className="text-[11px] text-slate-400 leading-snug">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Backend & Environment Diagnostics Card */}
        <Card className="lg:col-span-4 p-6 space-y-4">
          <SectionHeader
            icon={<Server className="h-5 w-5 text-emerald-400" />}
            title="System Diagnostics"
            description="Real-time operational verification communicating with the FastAPI backend."
          />

          <div className="space-y-3 rounded-xl border border-slate-800/80 bg-slate-950/70 p-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
              <span className="text-slate-400">FastAPI API:</span>
              <span className="font-mono font-semibold text-emerald-400 uppercase">
                {health?.status || 'connecting'}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
              <span className="text-slate-400">Database Engine:</span>
              <span className="font-mono text-cyan-300">
                {health?.database === 'connected' ? 'SQLite (SQLAlchemy 2.0)' : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
              <span className="text-slate-400">Runtime Environment:</span>
              <span className="font-mono text-slate-300">{health?.environment || 'development'}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
              <span className="text-slate-400">Backend Version:</span>
              <span className="font-mono text-slate-300">v{health?.version || '0.1.0'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Hardware Dependency:</span>
              <span className="font-semibold text-emerald-400">None (Software-Only)</span>
            </div>
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 text-xs text-cyan-300 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-cyan-200">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span>Phase 1–4 Release Ready</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Medicine dataset, CV model, and EasyOCR pipeline verified. Architecture prepared for Phase 5 storage-risk model integration.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
