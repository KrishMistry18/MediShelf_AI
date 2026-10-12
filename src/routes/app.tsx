import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronRight,
  Database,
  ExternalLink,
  Flame,
  Layers,
  ScanLine,
  Search,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Thermometer,
} from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { isFlagged, useAssessmentHistory, useScanHistory } from "@/lib/activity";
import { useApiHealth, useCatalogCount, useModelsOverview } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Workspace — MediShelf AI Healthcare Intelligence" },
      {
        name: "description",
        content:
          "Specialized analytical workspace for medicine packaging optical verification and kinetic storage compliance.",
      },
    ],
  }),
  component: WorkspaceOverview,
});

const CURATED_SPECIMENS = [
  {
    id: "MED-014",
    name: "Humulin R (Insulin Regular)",
    dosage: "100 U/mL Injectable Solution",
    category: "Cold-Chain Biological",
    tempWindow: "2°C to 8°C",
    tolerance: "Strict cold chain. Protect from light. Excursions ≤30°C permitted up to 28 days.",
    freezeHazard: "IRREVERSIBLE PROTEIN DENATURATION (<0°C)",
    image: "/samples/humulin_sample.jpg",
    provenance: "FDA DailyMed SPL / Eli Lilly",
    rxcui: "582498",
  },
  {
    id: "MED-001",
    name: "Paracetamol",
    dosage: "500 mg Oral Tablet",
    category: "Controlled Room Temperature",
    tempWindow: "20°C to 25°C",
    tolerance: "USP excursions permitted between 15°C and 30°C.",
    freezeHazard: "Non-critical (Solid Oral Matrix)",
    image: "/samples/paracetamol_sample.jpg",
    provenance: "USP Monograph / DailyMed",
    rxcui: "198440",
  },
  {
    id: "MED-006",
    name: "Omeprazole",
    dosage: "20 mg Delayed-Release Capsule",
    category: "Moisture & Acid Sensitive",
    tempWindow: "20°C to 25°C",
    tolerance: "Keep tightly closed. Protect from excessive moisture.",
    freezeHazard: "Moisture condensation risk",
    image: "/samples/metformin_sample.jpg",
    provenance: "FDA DailyMed Package Insert",
    rxcui: "283742",
  },
] as const;

function WorkspaceOverview() {
  const navigate = useNavigate();
  const [quickQuery, setQuickQuery] = useState("");
  const [activeSpecimenIdx, setActiveSpecimenIdx] = useState(0);

  const catalogCount = useCatalogCount();
  const scans = useScanHistory();
  const assessments = useAssessmentHistory();

  const openAlerts = assessments.filter(isFlagged).length;
  const recentAssessment = assessments[0];
  const recentScan = scans[0];
  const activeSpecimen = CURATED_SPECIMENS[activeSpecimenIdx] ?? CURATED_SPECIMENS[0];

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickQuery.trim()) {
      navigate({ to: "/medicines", search: { q: quickQuery.trim() } });
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
        {/* ── Studio Header & Primary Action Horizon ─────────────────── */}
        <div className="border-b border-border pb-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
                <span className="size-2 rounded-full bg-mint" />
                <span>Analytical Operations Studio</span>
                <span className="text-border">|</span>
                <span>Pharmacopeial Evidence Gateway</span>
              </div>
              <h1 className="font-head text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                Workspace Operations
              </h1>
              <p className="text-sm text-muted-foreground max-w-2xl font-sans leading-relaxed">
                Coordinate optical medicine packaging ingestion, label parsing against 27,326
                pharmacopeial records, and dual-track kinetic storage compliance.
              </p>
            </div>

            {/* Fast Task Triggers */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                className="h-9 px-4 text-xs border-border bg-card hover:bg-secondary font-medium"
                onClick={() => navigate({ to: "/medicines" })}
              >
                <BookOpen className="mr-1.5 size-3.5 text-muted-foreground" />
                <span>Search Catalogue</span>
              </Button>
              <Button
                variant="primary"
                className="h-9 px-4 text-xs bg-primary text-primary-foreground font-semibold shadow-2xs hover:bg-primary/90"
                onClick={() => navigate({ to: "/scan" })}
              >
                <Camera className="mr-1.5 size-3.5 text-mint" />
                <span>Launch Scanner Bay</span>
              </Button>
            </div>
          </div>

          {/* Integrated Monograph Search Bar */}
          <form onSubmit={handleQuickSearch} className="mt-6 max-w-2xl">
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 size-4 text-muted-foreground" />
              <input
                type="text"
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
                placeholder="Search across 27,326 clinical concepts (e.g. Paracetamol, Insulin, Metformin)..."
                className="w-full h-11 rounded border border-border bg-card pl-10 pr-24 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
              />
              <button
                type="submit"
                className="absolute right-1.5 h-8 px-3 rounded bg-secondary text-xs font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                Search
              </button>
            </div>
          </form>
        </div>

        {/* ── Active Session State Ledger (When Activity Exists) ───────── */}
        {recentAssessment || recentScan ? (
          <div className="rounded border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-muted-foreground uppercase tracking-wider">
                Active Session Telemetry
              </span>
              <span className="text-foreground">
                {assessments.length} Assessments • {scans.length} Scans in Session
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {recentAssessment && (
                <div className="rounded border border-border/80 bg-background p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">
                      Latest Excursion Evaluation
                    </span>
                    <h3 className="font-head text-sm font-bold text-foreground mt-0.5">
                      {recentAssessment.medicineName}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 text-xs font-mono">
                      <span>{recentAssessment.temperature}°C</span>
                      <span>•</span>
                      <span>{recentAssessment.durationHours}h exposure</span>
                      <span>•</span>
                      <span
                        className={
                          recentAssessment.isCompliant
                            ? "text-mint font-semibold"
                            : "text-coral font-semibold"
                        }
                      >
                        {recentAssessment.isCompliant ? "COMPLIANT" : "BREACH"}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="h-7 text-xs border-border bg-card hover:bg-secondary shrink-0"
                    onClick={() =>
                      navigate({
                        to: "/assessment",
                        search: { medicine: recentAssessment.medicineId },
                      })
                    }
                  >
                    <span>Re-evaluate</span>
                  </Button>
                </div>
              )}

              {recentScan && (
                <div className="rounded border border-border/80 bg-background p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">
                      Latest Packaging Scan
                    </span>
                    <h3 className="font-head text-sm font-bold text-foreground mt-0.5">
                      {recentScan.medicineName ?? "Unresolved Specimen"}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 text-xs font-mono text-muted-foreground">
                      <span>{recentScan.fusionStatus ?? recentScan.predictedClass}</span>
                      <span>•</span>
                      <span>Confidence: {((recentScan.confidence ?? 0) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="h-7 text-xs border-border bg-card hover:bg-secondary shrink-0"
                    onClick={() => navigate({ to: "/scan" })}
                  >
                    <span>Scan Again</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* ── Core Editorial Workbench: Specialized Twin Bays ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Bay (7 Cols): Analytical Action Launchpad */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-mint">
                Primary Analytical Tools
              </span>
              <h2 className="mt-1 font-head text-2xl font-bold tracking-tight text-foreground">
                Dedicated Intelligence Workflows
              </h2>
            </div>

            {/* Workflow 1: Optical Packaging Ingestion Bay */}
            <div className="rounded border border-border bg-card p-6 space-y-4 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-mint" />
                    <span className="font-mono text-[11px] text-muted-foreground uppercase">
                      Optical Pipeline
                    </span>
                  </div>
                  <h3 className="font-head text-xl font-bold text-foreground">
                    Multimodal Packaging Scanner
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed font-sans max-w-lg">
                    Real-time container geometry classification across 10 packaging form factors,
                    combined with high-resolution EasyOCR label parsing and open-world catalogue
                    arbitration across 27,326 clinical concepts.
                  </p>
                </div>

                <div className="hidden sm:flex size-14 items-center justify-center rounded border border-border bg-background shrink-0">
                  <Camera className="size-6 text-primary" />
                </div>
              </div>

              <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
                  <span>FOV: 224x224 RGB</span>
                  <span>•</span>
                  <span>Interactive Coordinate Calipers</span>
                </div>
                <Button
                  variant="primary"
                  className="h-8.5 px-4 text-xs bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                  onClick={() => navigate({ to: "/scan" })}
                >
                  <span>Open Scanner Bay</span>
                  <ArrowRight className="ml-1.5 size-3.5" />
                </Button>
              </div>
            </div>

            {/* Workflow 2: Thermal Kinetic Excursion Modeling */}
            <div className="rounded border border-border bg-card p-6 space-y-4 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-warning" />
                    <span className="font-mono text-[11px] text-muted-foreground uppercase">
                      Thermal Governance
                    </span>
                  </div>
                  <h3 className="font-head text-xl font-bold text-foreground">
                    Excursion Compliance & Kinetic Risk
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed font-sans max-w-lg">
                    Evaluate ambient storage conditions against authoritative USP Controlled Room
                    Temperature boundaries and run simulation-trained GBDT kinetic degradation
                    estimations for cold-chain biologicals and oral solids.
                  </p>
                </div>

                <div className="hidden sm:flex size-14 items-center justify-center rounded border border-border bg-background shrink-0">
                  <Thermometer className="size-6 text-warning" />
                </div>
              </div>

              <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
                  <span>USP Guidelines</span>
                  <span>•</span>
                  <span>Arrhenius Thermal Kinetics</span>
                </div>
                <Button
                  variant="outline"
                  className="h-8.5 px-4 text-xs border-border bg-card hover:bg-secondary font-semibold"
                  onClick={() =>
                    navigate({
                      to: "/assessment",
                      search: { medicine: "MED-014" },
                    })
                  }
                >
                  <span>Launch Excursion Audit</span>
                  <ArrowRight className="ml-1.5 size-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Right Bay (5 Cols): Pharmacopeial Specimen Spotlight */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-mint">
                Dossier Spotlight
              </span>
              <h2 className="mt-1 font-head text-2xl font-bold tracking-tight text-foreground">
                Pharmacopeial Archetypes
              </h2>
            </div>

            <div className="rounded border border-border bg-card p-5 space-y-4">
              {/* Specimen Switcher Tabs */}
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="font-mono text-[10px] uppercase text-muted-foreground">
                  Select Specimen
                </span>
                <div className="flex items-center gap-1 bg-background rounded p-0.5 border border-border">
                  {CURATED_SPECIMENS.map((spec, idx) => (
                    <button
                      key={spec.id}
                      onClick={() => setActiveSpecimenIdx(idx)}
                      className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                        activeSpecimenIdx === idx
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {spec.id}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Specimen Dossier Details */}
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="size-16 rounded border border-border bg-background p-1.5 overflow-hidden shrink-0">
                    <img
                      src={activeSpecimen.image}
                      alt={activeSpecimen.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <span className="rounded bg-secondary px-1.5 py-0.2 font-mono text-[9px] text-muted-foreground">
                      RxCUI {activeSpecimen.rxcui}
                    </span>
                    <h3 className="font-head text-base font-bold text-foreground mt-1">
                      {activeSpecimen.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">{activeSpecimen.dosage}</p>
                  </div>
                </div>

                <div className="rounded border border-border bg-background p-3.5 space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Standard Range:</span>
                    <strong className="text-primary font-bold">{activeSpecimen.tempWindow}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Classification:</span>
                    <span className="text-foreground">{activeSpecimen.category}</span>
                  </div>
                  <div className="pt-2 border-t border-border/60 text-[11px] text-muted-foreground font-sans">
                    {activeSpecimen.tolerance}
                  </div>
                  <div className="pt-1 text-[11px] font-bold text-coral font-sans">
                    {activeSpecimen.freezeHazard}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-border text-xs">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {activeSpecimen.provenance}
                </span>
                <Button
                  variant="outline"
                  className="h-7 text-xs border-border bg-background hover:bg-secondary font-medium"
                  onClick={() =>
                    navigate({
                      to: "/assessment",
                      search: { medicine: activeSpecimen.id },
                    })
                  }
                >
                  <Thermometer className="mr-1 size-3 text-primary" />
                  <span>Evaluate Specimen</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
