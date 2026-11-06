import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Camera,
  CheckCircle2,
  Info,
  Layers,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Thermometer,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Overview — MediShelf AI",
      },
      {
        name: "description",
        content:
          "MediShelf AI combines medicine-package image recognition, OCR-based label extraction, medicine reference retrieval and storage-condition assessment in one explainable workflow.",
      },
      {
        property: "og:title",
        content: "MediShelf AI — Intelligent Medicine Identification & Storage Assessment",
      },
      {
        property: "og:description",
        content:
          "Intelligent medicine identification, label OCR extraction, and storage-condition compliance.",
      },
    ],
  }),
  component: OverviewPage,
});

const WORKFLOW_STEPS = [
  {
    step: "01",
    name: "Capture",
    description: "Upload a medicine-package photograph or use a compatible camera.",
    icon: Camera,
  },
  {
    step: "02",
    name: "Recognize",
    description:
      "MobileNetV3-Small analyses the package and EasyOCR extracts printed label information.",
    icon: ScanLine,
  },
  {
    step: "03",
    name: "Reconcile",
    description:
      "The extracted text and visual predictions are compared with available medicine catalogue records.",
    icon: Layers,
  },
  {
    step: "04",
    name: "Assess",
    description:
      "The system evaluates documented storage requirements and separately provides an ML-based storage-risk estimate where supported.",
    icon: Thermometer,
  },
] as const;

function OverviewPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-10">
        {/* =========================================================================
            A. WELCOME & PRODUCT INTRODUCTION
           ========================================================================= */}
        <section aria-labelledby="overview-heading" className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-10 shadow-xs relative overflow-hidden">
            <div className="max-w-3xl space-y-4 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-mint/40 bg-mint/10 text-xs font-mono font-medium text-forest dark:text-mint">
                <span className="size-2 rounded-full bg-mint animate-pulse" />
                <span>Explainable Medicine Intelligence</span>
              </div>

              <div>
                <h1
                  id="overview-heading"
                  className="font-head text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-[1.15]"
                >
                  MediShelf AI
                </h1>
                <p className="font-head text-lg sm:text-xl text-primary font-semibold mt-1">
                  Intelligent Medicine Identification &amp; Storage Assessment
                </p>
              </div>

              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed font-sans pt-1">
                MediShelf AI combines medicine-package image recognition, OCR-based label
                extraction, medicine reference retrieval and storage-condition assessment in one
                explainable workflow.
              </p>
            </div>
          </div>
        </section>

        {/* =========================================================================
            B. PRIMARY ACTIONS
           ========================================================================= */}
        <section aria-label="Primary Actions" className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h2 className="font-head text-base font-bold text-foreground">
              What would you like to do?
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              Select a clinical action
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Action 1: Scan Medicine */}
            <Link
              to="/scan"
              className="group rounded-xl border border-border bg-card p-6 flex flex-col justify-between gap-4 transition-all duration-200 hover:border-primary/50 hover:shadow-md hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
            >
              <div className="space-y-3">
                <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground font-head font-bold shadow-xs transition-transform group-hover:scale-105">
                  <Camera className="size-5 text-mint" />
                </div>
                <div>
                  <h3 className="font-head text-lg font-bold text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                    <span>Scan Medicine</span>
                    <ArrowRight className="size-4 opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0 text-primary" />
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Upload or capture packaging photographs to analyze visual features, extract
                    printed labels, and identify the medicine concept.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60 flex items-center gap-1.5 text-xs font-semibold text-primary">
                <span>Launch Scanner</span>
                <ArrowRight className="size-3.5" />
              </div>
            </Link>

            {/* Action 2: Browse Medicine Library */}
            <Link
              to="/medicines"
              className="group rounded-xl border border-border bg-card p-6 flex flex-col justify-between gap-4 transition-all duration-200 hover:border-primary/50 hover:shadow-md hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
            >
              <div className="space-y-3">
                <div className="flex size-11 items-center justify-center rounded-lg bg-secondary text-primary font-head font-bold shadow-xs transition-transform group-hover:scale-105">
                  <BookOpen className="size-5 text-forest dark:text-mint" />
                </div>
                <div>
                  <h3 className="font-head text-lg font-bold text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                    <span>Browse Medicine Library</span>
                    <ArrowRight className="size-4 opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0 text-primary" />
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Search authoritative pharmacopeial reference records, active ingredients, dosage
                    forms, and documented temperature limits.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60 flex items-center gap-1.5 text-xs font-semibold text-primary">
                <span>Explore Monographs</span>
                <ArrowRight className="size-3.5" />
              </div>
            </Link>

            {/* Action 3: Assess Storage */}
            <Link
              to="/assessment"
              search={{ medicine: undefined }}
              className="group rounded-xl border border-border bg-card p-6 flex flex-col justify-between gap-4 transition-all duration-200 hover:border-primary/50 hover:shadow-md hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
            >
              <div className="space-y-3">
                <div className="flex size-11 items-center justify-center rounded-lg bg-warning/10 text-warning font-head font-bold shadow-xs transition-transform group-hover:scale-105">
                  <Thermometer className="size-5" />
                </div>
                <div>
                  <h3 className="font-head text-lg font-bold text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                    <span>Assess Storage</span>
                    <ArrowRight className="size-4 opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0 text-primary" />
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Evaluate observed storage temperature and excursion duration against official
                    limits and kinetic degradation risk models.
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border/60 flex items-center gap-1.5 text-xs font-semibold text-primary">
                <span>Evaluate Excursion</span>
                <ArrowRight className="size-3.5" />
              </div>
            </Link>
          </div>
        </section>

        {/* =========================================================================
            C. HOW MEDISHELF AI WORKS (Simple 4-Step Process Strip)
           ========================================================================= */}
        <section aria-labelledby="how-it-works-heading" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pb-2 border-b border-border">
            <h2 id="how-it-works-heading" className="font-head text-lg font-bold text-foreground">
              How MediShelf AI Works
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              Four-step multimodal intelligence pipeline
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {WORKFLOW_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.step}
                  className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs relative flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-mint bg-mint/15 px-2 py-0.5 rounded">
                        {step.step}
                      </span>
                      <Icon className="size-4 text-muted-foreground" />
                    </div>
                    <h3 className="font-head text-base font-bold text-foreground">{step.name}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* =========================================================================
            D. RESPONSIBLE-USE NOTE
           ========================================================================= */}
        <section aria-label="Responsible-use notice">
          <div className="rounded-xl border border-border/80 bg-secondary/40 p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs">
            <Info className="size-4.5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-head text-xs font-bold text-foreground block">
                Responsible Clinical Use Notice
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                AI-assisted medicine information should be verified against official product
                labelling. Uncertain results require manual or pharmacist review.
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
