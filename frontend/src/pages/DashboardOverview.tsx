import React from 'react';
import {
  ShieldCheck,
  Pill,
  ArrowUpRight,
  Workflow,
  Camera,
  Database,
  Scan,
  FileText,
  Thermometer,
  Layers,
  Brain,
  Search,
  Activity,
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
  onNavigateToAssessment?: () => void;
  onNavigateToMedicines?: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  onNavigateToScan,
  onNavigateToAssessment,
  onNavigateToMedicines,
}) => {
  const capabilityCards = [
    {
      title: 'Verified Medicines',
      value: '25',
      subtitle: 'Authoritative FDA DailyMed & USP monographs',
      icon: <Pill className="h-5 w-5" />,
      theme: 'emerald' as const,
    },
    {
      title: 'Vision Recognition',
      value: '10 Classes',
      subtitle: 'MobileNetV3 packaging classifier',
      icon: <Scan className="h-5 w-5" />,
      theme: 'cyan' as const,
    },
    {
      title: 'Label Text Extraction',
      value: 'Available',
      subtitle: 'EasyOCR deep character recognition',
      icon: <FileText className="h-5 w-5" />,
      theme: 'cyan' as const,
    },
    {
      title: 'Storage Risk Inference',
      value: 'Available',
      subtitle: 'Trained Gradient Boosting ML model',
      icon: <Brain className="h-5 w-5" />,
      theme: 'cyan' as const,
    },
  ];

  const quickActions = [
    {
      title: 'Scan a Medicine',
      desc: 'Capture or upload package imagery to identify branding, extract text, and verify requirements.',
      icon: Camera,
      action: onNavigateToScan,
      buttonText: 'Launch Scanner',
      variant: 'primary' as const,
    },
    {
      title: 'Assess Storage Conditions',
      desc: 'Enter temperature, humidity, and duration to receive deterministic compliance and ML risk estimates.',
      icon: Thermometer,
      action: onNavigateToAssessment || onNavigateToScan,
      buttonText: 'Run Assessment',
      variant: 'secondary' as const,
    },
    {
      title: 'Browse Medicine Catalog',
      desc: 'Explore the 25 verified pharmaceutical records with official storage monographs and citations.',
      icon: Search,
      action: onNavigateToMedicines || onNavigateToScan,
      buttonText: 'View Catalog',
      variant: 'secondary' as const,
    },
  ];

  const pipelineSteps = [
    { step: '1', title: 'Package Capture', desc: 'Camera or file upload', icon: Camera },
    { step: '2', title: 'Quality Assessment', desc: 'Blur, brightness, resolution check', icon: ShieldCheck },
    { step: '3', title: 'Visual Classifier', desc: 'MobileNetV3 trade dress match', icon: Scan },
    { step: '4', title: 'OCR Label Parsing', desc: 'Active ingredient & strength extraction', icon: FileText },
    { step: '5', title: 'Decision Fusion', desc: 'Multimodal consensus validation', icon: Layers },
    { step: '6', title: 'Monograph Verification', desc: 'Official storage temperature range', icon: Database },
    { step: '7', title: 'Storage-Risk AI', desc: 'ML degradation risk inference', icon: Brain },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2">
              <Badge variant="success" size="sm" dot>
                Platform Fully Operational
              </Badge>
              <Badge variant="neutral" size="sm">
                Grounded in FDA & USP Monographs
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              MediShelf AI Workspace
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Software-only decision-support platform combining deep visual package recognition, optical character extraction, and trained storage-risk estimation to safeguard medicine stability without mandatory physical sensor hardware.
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            onClick={onNavigateToScan}
            icon={<ArrowUpRight className="h-4 w-4 stroke-[2.5]" />}
            className="self-start md:self-center shrink-0 shadow-lg shadow-cyan-500/20"
          >
            Scan Medicine
          </Button>
        </div>
      </div>

      {/* Primary Capability KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {capabilityCards.map((card, idx) => (
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

      {/* Quick Actions Grid */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((qa, idx) => {
            const Icon = qa.icon;
            return (
              <Card
                key={idx}
                className="p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition"
              >
                <div className="space-y-2">
                  <div className="rounded-xl bg-slate-800/80 p-2.5 w-fit text-cyan-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    {qa.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {qa.desc}
                  </p>
                </div>
                <Button
                  variant={qa.variant}
                  size="sm"
                  onClick={qa.action}
                  className="w-full justify-center"
                >
                  {qa.buttonText}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Pipeline Architecture Workflow */}
      <Card className="p-6 space-y-4 border-slate-800">
        <SectionHeader
          icon={<Workflow className="h-5 w-5 text-cyan-400" />}
          title="Intelligence & Verification Pipeline"
          badge={
            <Badge variant="info" size="sm">
              7-Step Architecture
            </Badge>
          }
          description="Strict separation between AI/ML estimations, deterministic rules, and authoritative pharmaceutical monographs."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 pt-2">
          {pipelineSteps.map((s) => {
            const StepIcon = s.icon;
            return (
              <div
                key={s.step}
                className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-3.5 space-y-1.5 hover:border-slate-700 transition flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300 font-mono">
                      {s.step}
                    </span>
                    <StepIcon className="h-3.5 w-3.5 text-cyan-400" />
                  </div>
                  <h4 className="text-xs font-semibold text-slate-200">{s.title}</h4>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Recent Activity: Honest Session State */}
      <Card className="p-6 space-y-4 border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Recent Session Activity
            </h3>
          </div>
          <Badge variant="neutral" size="sm" className="font-mono">
            Active Session
          </Badge>
        </div>

        <div className="py-6 text-center space-y-2">
          <p className="text-xs text-slate-300 font-medium">
            No recent activity recorded in this session.
          </p>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            Activity logs populate dynamically when medicine packaging is scanned or storage conditions are evaluated.
          </p>
        </div>
      </Card>
    </div>
  );
};
