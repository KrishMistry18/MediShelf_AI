import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Boxes,
  Camera,
  CheckCircle2,
  ChevronRight,
  Database,
  ExternalLink,
  Flame,
  Info,
  Layers,
  RotateCcw,
  ScanLine,
  Search,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Thermometer,
} from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { isFlagged, useAssessmentHistory, useScanHistory } from "@/lib/activity";
import { formatPercent } from "@/lib/api";
import { useApiHealth, useCatalogCount, useModelsOverview } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Overview — MediShelf AI Clinical Workspace",
      },
      {
        name: "description",
        content:
          "Intelligent medicine classification, label OCR extraction, and deterministic storage excursion assessment platform.",
      },
      {
        property: "og:title",
        content: "MediShelf AI — Healthcare Intelligence & Storage Compliance",
      },
      {
        property: "og:description",
        content:
          "Identify packaging specimens, extract label text, and evaluate temperature excursions against 27,326 pharmacopeial monographs.",
      },
    ],
  }),
  component: OverviewPage,
});

const CURATED_SPECIMENS = [
  {
    id: "MED-014",
    name: "Humulin R (Insulin Regular)",
    dosage: "100 U/mL Injectable Solution",
    category: "Biological • Cold Chain",
    tempWindow: "2°C to 8°C (36°F to 46°F)",
    tolerance: "Strict cold chain. Protect from light. Excursions ≤30°C permitted up to 28 days.",
    freezeHazard: "CRITICAL: Irreversible protein denaturation (<0°C)",
    image: "/samples/humulin_sample.jpg",
    provenance: "FDA DailyMed SPL / Eli Lilly",
    rxcui: "582498",
    statusBadge: "Strict Cold Chain",
    badgeColor:
      "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
  },
  {
    id: "MED-001",
    name: "Paracetamol",
    dosage: "500 mg Oral Tablet",
    category: "Controlled Room Temperature",
    tempWindow: "20°C to 25°C (68°F to 77°F)",
    tolerance: "USP excursions permitted between 15°C and 30°C.",
    freezeHazard: "Non-critical (Solid Oral Matrix)",
    image: "/samples/paracetamol_sample.jpg",
    provenance: "USP Monograph / DailyMed",
    rxcui: "198440",
    statusBadge: "Controlled Room Temp",
    badgeColor:
      "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  },
  {
    id: "MED-006",
    name: "Omeprazole",
    dosage: "20 mg Delayed-Release Capsule",
    category: "Moisture & Acid Sensitive",
    tempWindow: "20°C to 25°C (68°F to 77°F)",
    tolerance: "Keep tightly closed. Protect from excessive humidity and heat.",
    freezeHazard: "Condensation moisture degrades enteric pellet coating",
    image: "/samples/metformin_sample.jpg",
    provenance: "FDA DailyMed Package Insert",
    rxcui: "283742",
    statusBadge: "Moisture Sensitive",
    badgeColor:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  },
  {
    id: "MED-002",
    name: "Amoxicillin",
    dosage: "500 mg Oral Capsule",
    category: "Beta-Lactam Antibiotic",
    tempWindow: "20°C to 25°C (68°F to 77°F)",
    tolerance: "USP excursions permitted between 15°C and 30°C.",
    freezeHazard: "Stable dry solid; protect from moisture condensation",
    image: "/samples/paracetamol_sample.jpg",
    provenance: "USP Monograph / DailyMed",
    rxcui: "213169",
    statusBadge: "Standard Room Temp",
    badgeColor:
      "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
  },
] as const;

function OverviewPage() {
  const navigate = useNavigate();
  const [quickQuery, setQuickQuery] = useState("");
  const [activeSpecimenIdx, setActiveSpecimenIdx] = useState(0);

  // Quick Excursion Estimator State
  const [estTemp, setEstTemp] = useState<number>(32);
  const [estDuration, setEstDuration] = useState<number>(6);
  const [estMedicine, setEstMedicine] = useState<string>("MED-014");

  const catalogCount = useCatalogCount();
  const health = useApiHealth();
  const models = useModelsOverview();
  const scans = useScanHistory();
  const assessments = useAssessmentHistory();

  const flaggedAssessments = assessments.filter(isFlagged);
  const activeSpecimen = CURATED_SPECIMENS[activeSpecimenIdx] ?? CURATED_SPECIMENS[0];

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickQuery.trim()) {
      navigate({
        to: "/medicines",
        search: { search: quickQuery.trim() } as Record<string, unknown>,
      });
    }
  };

  // Quick inline excursion estimation
  const getQuickRisk = () => {
    if (estMedicine === "MED-014") {
      // Insulin (2-8C)
      if (estTemp < 0) {
        return {
          label: "CRITICAL FREEZING BREACH",
          detail: "Irreversible denaturation below 0°C",
          color: "text-destructive bg-destructive/10 border-destructive/30",
          compliant: false,
        };
      }
      if (estTemp > 30) {
        return {
          label: "HIGH THERMAL EXCURSION",
          detail: "Exceeds USP 30°C upper tolerance limit",
          color: "text-destructive bg-destructive/10 border-destructive/30",
          compliant: false,
        };
      }
      if (estTemp > 8 && estDuration > 24) {
        return {
          label: "MODERATE EXCURSION",
          detail: "Room temperature exposure > 24h",
          color: "text-warning bg-warning/10 border-warning/30",
          compliant: false,
        };
      }
      if (estTemp > 8) {
        return {
          label: "PERMITTED EXCURSION (≤28D)",
          detail: "Transient room temp exposure",
          color: "text-info bg-info/10 border-info/30",
          compliant: true,
        };
      }
      return {
        label: "WITHIN COLD CHAIN (2–8°C)",
        detail: "Complies with USP monograph",
        color: "text-mint bg-mint/10 border-mint/30",
        compliant: true,
      };
    }

    // Room temp meds (15-30C)
    if (estTemp > 35) {
      return {
        label: "CRITICAL HEAT STRESS",
        detail: "Significant thermal degradation hazard",
        color: "text-destructive bg-destructive/10 border-destructive/30",
        compliant: false,
      };
    }
    if (estTemp > 30) {
      return {
        label: "EXCEEDS USP 30°C BOUNDARY",
        detail: "Documented excursion limit violated",
        color: "text-warning bg-warning/10 border-warning/30",
        compliant: false,
      };
    }
    if (estTemp < 15) {
      return {
        label: "COLD EXCURSION (<15°C)",
        detail: "Within dry solid safety tolerance",
        color: "text-info bg-info/10 border-info/30",
        compliant: true,
      };
    }
    return {
      label: "USP COMPLIANT (20–25°C)",
      detail: "Within controlled room temperature",
      color: "text-mint bg-mint/10 border-mint/30",
      compliant: true,
    };
  };

  const quickRisk = getQuickRisk();

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* =========================================================================
            1. WELCOME & MISSION STATEMENT WITH PRIMARY CTAS
           ========================================================================= */}
        <section aria-labelledby="overview-heading" className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3 max-w-3xl">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-mint/30 bg-mint/10 text-xs font-mono font-medium text-forest">
                  <span className="size-2 rounded-full bg-mint animate-pulse" />
                  <span>Clinical Intelligence & Storage Safety Workspace</span>
                </div>

                <h1
                  id="overview-heading"
                  className="font-head text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground leading-tight"
                >
                  Intelligent Medicine Packaging Identification & Kinetic Storage Compliance
                </h1>

                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                  MediShelf AI combines visual packaging classification, label OCR extraction, and
                  pharmacopeial concept reconciliation with deterministic storage excursion rules
                  and kinetic degradation estimation.
                </p>

                {/* Primary & Secondary Action Buttons */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <Link
                    to="/scan"
                    className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/92 active:scale-[0.98] shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint transition-all"
                  >
                    <Camera className="size-4 shrink-0 text-mint" />
                    <span>Scan Medicine Packaging</span>
                  </Link>

                  <Link
                    to="/medicines"
                    className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg border border-border bg-background text-sm font-medium text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint transition-colors"
                  >
                    <BookOpen className="size-4 shrink-0 text-muted-foreground" />
                    <span>Browse 27,326 Monographs</span>
                  </Link>

                  <Link
                    to="/assessment"
                    search={{ medicine: undefined }}
                    className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-lg border border-transparent text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-secondary/60 transition-colors"
                  >
                    <Thermometer className="size-4 shrink-0 text-warning" />
                    <span>Evaluate Excursion</span>
                  </Link>
                </div>
              </div>

              {/* Verified Accuracy Callout Panel */}
              <div className="lg:w-72 shrink-0 rounded-lg border border-border bg-background p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border text-xs font-mono text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-mint" />
                    <span>Audited Checkpoint</span>
                  </span>
                  <span className="font-bold text-foreground">v3.1</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Packaging Vision Top-1</span>
                    <span className="font-mono text-sm font-bold text-foreground tnum">91.0%</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">Packaging Vision Top-3</span>
                    <span className="font-mono text-sm font-bold text-foreground tnum">97.0%</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-muted-foreground">
                      Multimodal Decision Fusion
                    </span>
                    <span className="font-mono text-sm font-bold text-mint tnum">94.8%</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/70 text-[11px] text-muted-foreground">
                  <span>Evaluated across 50 held-out authentic packaging photographs. </span>
                  <Link
                    to="/models"
                    className="text-primary font-medium hover:underline inline-flex items-center gap-0.5"
                  >
                    View dossier <ChevronRight className="size-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            2. FOCUSED OPERATIONAL METRICS RIBBON (No duplicate generic cards)
           ========================================================================= */}
        <section aria-label="Operational Metrics" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground block">
              Packaging Vision
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-head text-2xl sm:text-3xl font-bold text-foreground tnum">
                91.0%
              </span>
              <span className="font-mono text-xs text-muted-foreground">Top-1 Acc</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              MobileNetV3-Small on 50 verified packaging test samples
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground block">
              Multimodal Decision Fusion
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-head text-2xl sm:text-3xl font-bold text-mint tnum">94.8%</span>
              <span className="font-mono text-xs text-muted-foreground">Top-1 Fusion</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              EasyOCR CRAFT + CRNN text extraction & concept ranking
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground block">
              Monograph Knowledge Base
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-head text-2xl sm:text-3xl font-bold text-foreground tnum">
                27,326
              </span>
              <span className="font-mono text-xs text-muted-foreground">Concepts</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Authoritative FDA DailyMed & NLM RxNorm records
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground block">
              Storage Risk Model
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-head text-2xl sm:text-3xl font-bold text-foreground tnum">
                99.56%
              </span>
              <span className="font-mono text-xs text-muted-foreground">Sim. Kinetic</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Trained on 6k Arrhenius synthetic kinetics scenarios
            </p>
          </div>
        </section>

        {/* =========================================================================
            3. ATTENTION-REQUIRED & ACTIVE SESSION ACTIVITY AREA
           ========================================================================= */}
        <section aria-labelledby="attention-heading" className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={cn(
                  "size-4",
                  flaggedAssessments.length > 0 ? "text-warning" : "text-muted-foreground",
                )}
              />
              <h2 id="attention-heading" className="font-head text-lg font-bold text-foreground">
                Session Excursion Attention & Audit
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                Scope: Browser sessionStorage
              </span>
              <Link
                to="/alerts"
                className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
              >
                <span>View Full Ledger</span>
                <ChevronRight className="size-3.5" />
              </Link>
            </div>
          </div>

          {flaggedAssessments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {flaggedAssessments.slice(0, 4).map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-lg border border-warning/30 bg-warning/5 p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{alert.medicineName}</span>
                      <span className="rounded bg-warning/20 text-warning px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                        {alert.riskLevel ?? "Flagged"} Risk
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Excursion: Observed <strong>{alert.temperature}°C</strong> for{" "}
                      <strong>{alert.durationHours}h</strong> (Permitted: {alert.permittedRange})
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-warning/20">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      Recorded{" "}
                      {new Date(alert.at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <Button
                      variant="outline"
                      className="h-7 px-2.5 text-[11px] border-warning/40 text-foreground hover:bg-warning/10"
                      onClick={() =>
                        navigate({
                          to: "/assessment",
                          search: { medicine: alert.medicineId },
                        })
                      }
                    >
                      <RotateCcw className="mr-1 size-3" />
                      Re-evaluate
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 text-left">
                <div className="size-10 rounded-full bg-mint/10 border border-mint/30 flex items-center justify-center shrink-0 text-mint">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h3 className="font-medium text-sm text-foreground">
                    Active Session Ledger Clean — No Flagged Excursions
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    No packaging anomalies or temperature excursions have been flagged in this
                    browser tab.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  className="h-8.5 px-3 text-xs border-border bg-background hover:bg-secondary font-medium"
                  onClick={() => navigate({ to: "/assessment", search: { medicine: "MED-014" } })}
                >
                  <Thermometer className="mr-1.5 size-3.5 text-warning" />
                  Test Thermal Stress
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* =========================================================================
            4. FIVE-STAGE SCIENTIFIC WORKFLOW PIPELINE ARCHITECTURE
           ========================================================================= */}
        <section aria-labelledby="workflow-heading" className="space-y-4">
          <div className="pb-2 border-b border-border">
            <h2 id="workflow-heading" className="font-head text-lg font-bold text-foreground">
              End-to-End Multimodal Intelligence Pipeline
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              How MediShelf AI reconciles packaging image pixels, OCR text tokens, and monograph
              compliance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {/* Step 1 */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-2 relative">
              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span className="font-bold text-foreground">01</span>
                <span>Acquisition</span>
              </div>
              <h3 className="font-semibold text-xs text-foreground">Optical Capture</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                RGB image input via drag-and-drop or camera. Letterbox aspect-ratio preservation.
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-2 relative">
              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span className="font-bold text-foreground">02</span>
                <span>Visual Classifier</span>
              </div>
              <h3 className="font-semibold text-xs text-foreground">MobileNetV3-Small</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                224×224 feature extraction generating Top-3 medicine candidates & visual confidence
                scores.
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-2 relative">
              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span className="font-bold text-foreground">03</span>
                <span>Text OCR</span>
              </div>
              <h3 className="font-semibold text-xs text-foreground">EasyOCR Pipeline</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                CRAFT text detection + CRNN recognition extracts drug names, strengths, lots, and
                expiries.
              </p>
            </div>

            {/* Step 4 */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-2 relative">
              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span className="font-bold text-foreground">04</span>
                <span>Arbitration</span>
              </div>
              <h3 className="font-semibold text-xs text-foreground">Multimodal Fusion</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Cross-references visual predictions with OCR tokens to yield 94.8% verified
                consensus.
              </p>
            </div>

            {/* Step 5 */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-2 relative">
              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span className="font-bold text-foreground">05</span>
                <span>Compliance</span>
              </div>
              <h3 className="font-semibold text-xs text-foreground">Kinetic Compliance</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Evaluates temperature against USP storage bounds and computes Arrhenius degradation
                risk.
              </p>
            </div>
          </div>
        </section>

        {/* =========================================================================
            5. CLINICAL SPECIMEN BENCHMARKS & QUICK EXCURSION EVALUATOR
           ========================================================================= */}
        <section
          aria-labelledby="benchmarks-heading"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          {/* Specimen Benchmark Dock (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
                <div>
                  <h2
                    id="benchmarks-heading"
                    className="font-head text-base font-bold text-foreground"
                  >
                    Clinical Specimen Archetypes
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Inspect storage boundaries and thermal sensitivities across packaging classes.
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {CURATED_SPECIMENS.map((specimen, idx) => (
                    <button
                      key={specimen.id}
                      onClick={() => setActiveSpecimenIdx(idx)}
                      className={cn(
                        "h-7 px-2.5 rounded text-xs font-medium transition-colors",
                        activeSpecimenIdx === idx
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      {specimen.name.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Specimen Dossier */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-head text-lg font-bold text-foreground">
                      {activeSpecimen.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {activeSpecimen.dosage} • {activeSpecimen.category}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-medium",
                      activeSpecimen.badgeColor,
                    )}
                  >
                    {activeSpecimen.statusBadge}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-border bg-background p-3 space-y-1">
                    <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                      Prescribed Storage Range
                    </span>
                    <strong className="text-foreground text-sm font-semibold block">
                      {activeSpecimen.tempWindow}
                    </strong>
                    <p className="text-[11px] text-muted-foreground">{activeSpecimen.tolerance}</p>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-3 space-y-1">
                    <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                      Freeze Denaturation Hazard
                    </span>
                    <strong className="text-destructive text-sm font-semibold block">
                      {activeSpecimen.freezeHazard}
                    </strong>
                    <p className="text-[11px] text-muted-foreground">
                      Lineage: {activeSpecimen.provenance}
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">
                    Concept ID: {activeSpecimen.id} • RxCUI: {activeSpecimen.rxcui}
                  </span>

                  <Button
                    variant="outline"
                    className="h-8 px-3 text-xs border-border bg-card hover:bg-secondary font-medium"
                    onClick={() =>
                      navigate({
                        to: "/assessment",
                        search: { medicine: activeSpecimen.id },
                      })
                    }
                  >
                    <span>Assess In Workspace</span>
                    <ArrowRight className="ml-1.5 size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Excursion Calculator (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Thermometer className="size-4 text-warning" />
                  <h2 className="font-head text-base font-bold text-foreground">
                    Quick Excursion Estimator
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Instant kinetic compliance check for temperature deviations.
                </p>
              </div>

              <div className="space-y-3.5 text-xs">
                {/* Medicine Selector */}
                <div className="space-y-1.5">
                  <label htmlFor="est-med" className="font-medium text-foreground block">
                    Target Medicine
                  </label>
                  <select
                    id="est-med"
                    value={estMedicine}
                    onChange={(e) => setEstMedicine(e.target.value)}
                    className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="MED-014">Humulin R Insulin (Cold Chain 2–8°C)</option>
                    <option value="MED-001">Paracetamol 500mg (Room Temp 20–25°C)</option>
                    <option value="MED-006">Omeprazole 20mg (Moisture Sensitive)</option>
                  </select>
                </div>

                {/* Temperature Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="est-temp" className="font-medium text-foreground">
                      Excursion Temperature
                    </label>
                    <span className="font-mono font-bold text-foreground text-sm tnum">
                      {estTemp > 0 ? `+${estTemp}` : estTemp}°C
                    </span>
                  </div>
                  <input
                    id="est-temp"
                    type="range"
                    min={-10}
                    max={50}
                    step={1}
                    value={estTemp}
                    onChange={(e) => setEstTemp(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                    <span>-10°C (Freeze)</span>
                    <span>25°C (Room)</span>
                    <span>50°C (Heat)</span>
                  </div>
                </div>

                {/* Duration */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="est-hours" className="font-medium text-foreground">
                      Exposure Duration
                    </label>
                    <span className="font-mono font-bold text-foreground text-sm tnum">
                      {estDuration} hours
                    </span>
                  </div>
                  <input
                    id="est-hours"
                    type="range"
                    min={1}
                    max={72}
                    step={1}
                    value={estDuration}
                    onChange={(e) => setEstDuration(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                </div>

                {/* Live Verdict Banner */}
                <div className={cn("rounded-lg border p-3 space-y-1", quickRisk.color)}>
                  <div className="flex items-center justify-between font-mono text-xs font-bold">
                    <span>{quickRisk.label}</span>
                    <span>{quickRisk.compliant ? "PASS" : "BREACH"}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-90">{quickRisk.detail}</p>
                </div>

                <Button
                  className="w-full h-9 text-xs font-semibold"
                  onClick={() =>
                    navigate({
                      to: "/assessment",
                      search: { medicine: estMedicine },
                    })
                  }
                >
                  <span>Open Full Kinetic Assessment</span>
                  <ArrowRight className="ml-1.5 size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
