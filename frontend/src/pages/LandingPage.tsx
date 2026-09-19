import React from 'react';
import {
  Activity,
  ArrowRight,
  ShieldCheck,
  Scan,
  FileText,
  Thermometer,
  Brain,
  Database,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ChevronRight,
  Compass,
} from 'lucide-react';
import { Button } from '../components/common';

interface LandingPageProps {
  onExploreApp: () => void;
  onNavigateToSection?: (sectionId: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onExploreApp }) => {
  const steps = [
    {
      num: '01',
      title: 'Scan',
      tagline: 'Package Ingestion',
      desc: 'Capture or upload clear imagery of medicine packaging trade dress using any mobile device or workstation.',
      icon: Scan,
    },
    {
      num: '02',
      title: 'Identify',
      tagline: 'Visual Trade Dress',
      desc: 'MobileNetV3 deep vision model identifies packaging geometry, color schemes, and manufacturer trade dress.',
      icon: Layers,
    },
    {
      num: '03',
      title: 'Verify',
      tagline: 'Label Text Extraction',
      desc: 'EasyOCR extracts active ingredients, strength, and batch details, cross-referencing official FDA DailyMed & USP monographs.',
      icon: FileText,
    },
    {
      num: '04',
      title: 'Assess',
      tagline: 'Deterministic Rules',
      desc: 'Observed ambient storage conditions are checked against verified monograph temperature thresholds.',
      icon: Thermometer,
    },
    {
      num: '05',
      title: 'Understand',
      tagline: 'ML Risk Estimation',
      desc: 'A trained Gradient Boosting model estimates kinetic risk level with contributing physicochemical factors.',
      icon: Brain,
    },
  ];

  const pillars = [
    {
      title: 'Medicine Identification',
      category: 'Computer Vision & OCR',
      desc: 'AI-assisted packaging recognition combined with optical character recognition parses package branding and label typography into structured medicine records.',
      icon: Scan,
      points: [
        'MobileNetV3-Small transfer learning classifier',
        'CRAFT text detection & CRNN sequence recognition',
        'Consensus fusion scoring and conflict detection',
      ],
      border: 'border-cyan-500/30',
      glow: 'from-cyan-500/10',
      badgeColor: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
    },
    {
      title: 'Verified Storage Information',
      category: 'Authoritative Monographs',
      desc: 'Storage specifications are retrieved directly from official NIH DailyMed Structured Product Labeling (SPL) and USP pharmaceutical monographs.',
      icon: Database,
      points: [
        '25 verified medicine ground-truth monographs',
        'Documented minimum and maximum temperature limits',
        'Official regulatory source traceability and citation links',
      ],
      border: 'border-emerald-500/30',
      glow: 'from-emerald-500/10',
      badgeColor: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'Storage Assessment',
      category: 'Deterministic Verification',
      desc: 'Compares entered environmental conditions against documented stability constraints with strict mathematical rule validation.',
      icon: Thermometer,
      points: [
        'Zero-ambiguity boundary compliance evaluation',
        'Cold-chain constraint detection (2°C – 8°C)',
        'Clear notification when humidity is not monograph-quantified',
      ],
      border: 'border-teal-500/30',
      glow: 'from-teal-500/10',
      badgeColor: 'text-teal-300 bg-teal-500/10 border-teal-500/20',
    },
    {
      title: 'AI-Assisted Risk Estimation',
      category: 'Machine Learning Model',
      desc: 'Estimates storage degradation risk categories using an isolated, trained Gradient Boosting ML model evaluated across 6,000 scenarios.',
      icon: Brain,
      points: [
        '3-class risk taxonomy: Low, Moderate, High',
        'Calibrated probability distribution across classes',
        'Transparent factor attribution and explainability',
      ],
      border: 'border-indigo-500/30',
      glow: 'from-indigo-500/10',
      badgeColor: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20',
    },
  ];

  return (
    <div className="space-y-16 pb-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950 p-8 sm:p-12 lg:p-16 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-24 -mt-24 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-24 -mb-24 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-medium text-cyan-300 backdrop-blur-sm">
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            <span>Intelligent Medicine Storage & Safety Assessment</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
            Smarter medicine storage.{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
              Powered by AI.
            </span>
          </h1>

          <p className="text-sm sm:text-base lg:text-lg text-slate-300 leading-relaxed max-w-2xl font-normal">
            Identify medicine packaging, extract label information, verify documented storage requirements, and assess storage conditions with AI-assisted analysis.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={onExploreApp}
              icon={<ArrowRight className="h-4 w-4 stroke-[2.5]" />}
              className="shadow-lg shadow-cyan-500/20"
            >
              Try MediShelf AI
            </Button>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-5 py-3 text-sm font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition"
            >
              <span>Explore How It Works</span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </a>
          </div>

          {/* Genuine Capability Badges */}
          <div className="pt-6 border-t border-slate-800/80 flex flex-wrap items-center gap-6 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>25 Official FDA/USP Monographs</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-cyan-400" />
              <span>MobileNetV3 Visual Recognition</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-teal-400" />
              <span>Software-Only (Zero Hardware Mandate)</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works (Visual 5-Step Process) */}
      <section id="how-it-works" className="space-y-8 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-0.5 text-xs font-medium text-slate-300">
            <Compass className="h-3.5 w-3.5 text-cyan-400" />
            <span>Operational Architecture</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            How MediShelf AI Works
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            A seamless five-step pipeline connecting visual ingestion to explainable storage risk estimates.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {steps.map((s) => {
            const StepIcon = s.icon;
            return (
              <div
                key={s.num}
                className="group relative rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-cyan-500/40 hover:bg-slate-900 transition flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xl font-bold text-slate-600 group-hover:text-cyan-400 transition-colors">
                      {s.num}
                    </span>
                    <div className="rounded-xl bg-slate-800/80 p-2 text-slate-300 group-hover:bg-cyan-500/20 group-hover:text-cyan-300 transition">
                      <StepIcon className="h-4 w-4" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-cyan-200 transition-colors">
                      {s.title}
                    </h3>
                    <span className="text-[11px] font-mono text-cyan-400 block mt-0.5">
                      {s.tagline}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Product Pillars / Core Value */}
      <section id="features" className="space-y-8 scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-0.5 text-xs font-medium text-slate-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Product Capabilities</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Built for Transparent Healthcare Technology
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Every layer separates empirical machine-learning estimates from certified pharmaceutical monographs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pillars.map((p, idx) => {
            const Icon = p.icon;
            return (
              <div
                key={idx}
                className={`rounded-2xl border ${p.border} bg-gradient-to-br ${p.glow} to-slate-900/40 p-6 sm:p-8 space-y-5 hover:bg-slate-900/60 transition`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className={`inline-block rounded-md border px-2.5 py-0.5 text-[11px] font-mono font-medium ${p.badgeColor}`}>
                      {p.category}
                    </span>
                    <h3 className="text-lg font-bold text-white pt-1">
                      {p.title}
                    </h3>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-slate-300 shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {p.desc}
                </p>

                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  {p.points.map((point, pIdx) => (
                    <div key={pIdx} className="flex items-start gap-2.5 text-xs text-slate-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Scientific & Operational Honesty Notice */}
      <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 sm:p-8 space-y-3">
        <div className="flex items-center gap-2.5 text-amber-300 font-semibold text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <span>Product Transparency & Scientific Integrity Disclosures</span>
        </div>
        <p className="text-xs text-amber-200/90 leading-relaxed">
          MediShelf AI is an intelligent software decision-support prototype. It does not replace licensed pharmacists, certified monograph verification, or accredited laboratory stability testing. The storage-risk AI model was evaluated using simulation-derived scenarios grounded in official USP/FDA monograph constraints. Its benchmark performance demonstrates algorithmic capability but does not establish clinical validation or real-world pharmaceutical stability validity.
        </p>
      </section>

      {/* Bottom Call to Action */}
      <section className="rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 p-8 sm:p-12 text-center space-y-5">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
          Ready to evaluate medicine storage conditions?
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
          Open the application workspace to inspect verified medicine monographs, scan package imagery, or conduct custom storage condition assessments.
        </p>
        <div className="pt-2">
          <Button
            variant="primary"
            size="lg"
            onClick={onExploreApp}
            icon={<ArrowRight className="h-4 w-4 stroke-[2.5]" />}
            className="shadow-xl shadow-cyan-500/20"
          >
            Launch Application Workspace
          </Button>
        </div>
      </section>
    </div>
  );
};
