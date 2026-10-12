import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Camera,
  Check,
  ChevronRight,
  Database,
  ExternalLink,
  Flame,
  Layers,
  ScanLine,
  ShieldAlert,
  Snowflake,
  Sparkles,
  Thermometer,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/Button";
import { useCatalogCount, useModelsOverview } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title:
          "MediShelf AI — A Better Understanding of Every Label. A Clearer View of Storage Conditions.",
      },
      {
        name: "description",
        content:
          "Scientific healthcare intelligence uniting medicine packaging recognition, label OCR extraction, 27,326 clinical concepts, and dual-track storage compliance.",
      },
      {
        property: "og:title",
        content:
          "MediShelf AI — A Better Understanding of Every Label. A Clearer View of Storage Conditions.",
      },
      {
        property: "og:description",
        content:
          "Scientific healthcare intelligence uniting medicine packaging recognition, label OCR extraction, 27,326 clinical concepts, and dual-track storage compliance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicLandingPage,
});

// Authentic benchmark samples for the interactive hero optical visualizer
const SPECIMEN_PROFILES = [
  {
    id: "paracetamol",
    medicineId: "MED-001",
    name: "Paracetamol 500 MG",
    classification: "Oral Solid Dose • Blister Pack Tablet",
    image: "/samples/paracetamol_sample.jpg",
    formFactor: "Blister Pack (Solid)",
    ocrTokens: ["PARACETAMOL", "500 MG", "TABLET", "BP"],
    rxcui: "198440",
    provenance: "USP Monograph / DailyMed SPL",
    minTemp: 20,
    maxTemp: 25,
    excursionBand: "15°C to 30°C",
    freezeBehavior: "Tolerant (No liquid phase)",
    kineticCategory: "High Thermal Resilience",
    badgeLabel: "Controlled Room Temp",
    badgeStyle: "text-emerald-700 bg-emerald-100/80 border-emerald-300",
  },
  {
    id: "humulin",
    medicineId: "MED-014",
    name: "Humulin R (Insulin Regular)",
    classification: "Cold-Chain Biological • Injectable Solution",
    image: "/samples/humulin_sample.jpg",
    formFactor: "Vial (Aqueous Suspension)",
    ocrTokens: ["HUMULIN R", "100 U/ML", "INSULIN", "INJECTION"],
    rxcui: "582498",
    provenance: "FDA DailyMed Package Insert",
    minTemp: 2,
    maxTemp: 8,
    excursionBand: "Up to 28 days at ≤30°C",
    freezeBehavior: "IRREVERSIBLE DENATURATION (<0°C)",
    kineticCategory: "Critical Biological Stability",
    badgeLabel: "Refrigerated Cold Chain (2-8°C)",
    badgeStyle: "text-sky-800 bg-sky-100/90 border-sky-300",
  },
] as const;

function PublicLandingPage() {
  const navigate = useNavigate();
  const catalogCount = useCatalogCount();
  const [activeSpecimenIdx, setActiveSpecimenIdx] = useState<number>(0);

  const specimen = SPECIMEN_PROFILES[activeSpecimenIdx] ?? SPECIMEN_PROFILES[0];
  const catalogCountFormatted = catalogCount.isSuccess
    ? catalogCount.data.toLocaleString()
    : "27,326";

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-mint/25 selection:text-ink antialiased">
      {/* ── Public Editorial Masthead ───────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="flex size-8 items-center justify-center rounded bg-primary text-primary-foreground font-head font-bold text-xs tracking-wider shadow-xs transition-transform group-hover:scale-105">
                MS
              </div>
              <div className="flex flex-col">
                <span className="font-head text-base font-bold tracking-tight text-foreground leading-none">
                  MediShelf AI
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
                  Healthcare Intelligence
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-muted-foreground">
              <a href="#thesis" className="transition-colors hover:text-foreground">
                Clinical Thesis
              </a>
              <a href="#architecture" className="transition-colors hover:text-foreground">
                4-Stage Engine
              </a>
              <a href="#specimens" className="transition-colors hover:text-foreground">
                Stability Profiles
              </a>
              <a href="#disclosure" className="transition-colors hover:text-foreground">
                Methodology & Limits
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/medicines"
              className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded border border-border bg-card font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Database className="size-3 text-mint" />
              <span>{catalogCountFormatted} Concepts</span>
            </Link>

            <Button
              variant="primary"
              onClick={() => navigate({ to: "/app" })}
              className="h-8.5 px-4 bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 shadow-xs"
            >
              <span>Launch Studio</span>
              <ArrowRight className="ml-1.5 size-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Editorial Hero: Asymmetric Visual Composition ─────────────── */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28 lg:pt-20 lg:pb-32 border-b border-border bg-gradient-to-b from-background via-background to-card/40">
        <div className="pointer-events-none absolute inset-0 -z-10 graticule opacity-40" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
            {/* Left: Oversized Editorial Statement */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1 text-xs font-mono text-muted-foreground shadow-2xs">
                <span className="size-2 rounded-full bg-mint" />
                <span>Multimodal Packaging Recognition & Kinetic Verification</span>
              </div>

              <h1 className="font-head text-4xl sm:text-5xl lg:text-[3.75rem] font-bold tracking-tight text-foreground leading-[1.08]">
                A better understanding of every label.
                <span className="block mt-2 font-normal italic text-primary">
                  A clearer view of storage conditions.
                </span>
              </h1>

              <p className="max-w-xl text-base sm:text-lg leading-relaxed text-muted-foreground font-sans">
                Connecting physical package visual identification, optical character extraction, and
                27,326 authoritative pharmacopeial clinical concepts with dual-track storage
                excursion compliance and kinetic degradation risk modeling.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  onClick={() => navigate({ to: "/scan" })}
                  className="h-11 px-6 bg-primary text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  <Camera className="mr-2 size-4 text-mint" />
                  Open Scanning Studio
                </Button>

                <Link
                  to="/medicines"
                  className="inline-flex h-11 items-center justify-center rounded border border-border bg-card px-5 text-xs font-medium text-foreground transition-colors hover:bg-secondary shadow-2xs"
                >
                  Explore 27,326 Monograph Database
                </Link>

                <Link
                  to="/models"
                  className="inline-flex h-11 items-center justify-center px-3 text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
                >
                  Audit Model Metrics &rarr;
                </Link>
              </div>

              {/* Research Scope Ledger */}
              <div className="pt-8 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
                <div>
                  <div className="font-head text-2xl font-bold text-primary">
                    {catalogCountFormatted}
                  </div>
                  <div className="text-xs font-medium text-foreground">Clinical Concepts</div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    NLM RxNorm & DailyMed
                  </div>
                </div>

                <div>
                  <div className="font-head text-2xl font-bold text-primary">10 Classes</div>
                  <div className="text-xs font-medium text-foreground">Packaging Geometry</div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    MobileNetV3-Small
                  </div>
                </div>

                <div>
                  <div className="font-head text-2xl font-bold text-primary">Dual-Track</div>
                  <div className="text-xs font-medium text-foreground">Compliance Guardrails</div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    USP Bounds + Kinetic GBDT
                  </div>
                </div>

                <div>
                  <div className="font-head text-2xl font-bold text-primary">Open-World</div>
                  <div className="text-xs font-medium text-foreground">Arbitration Engine</div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    Fuzzy Token Matching
                  </div>
                </div>
              </div>
            </div>

            {/* Right: The Interactive Optical Anatomy Visualizer */}
            <div className="lg:col-span-6">
              <div className="relative rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                {/* Visualizer Top Bar with Specimen Tabs */}
                <div className="flex flex-wrap items-center justify-between border-b border-border bg-muted/30 px-4 py-3 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-mint" />
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Optical Evidence Studio
                    </span>
                  </div>

                  <div className="flex items-center gap-1 rounded bg-background p-0.5 border border-border">
                    {SPECIMEN_PROFILES.map((item, idx) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveSpecimenIdx(idx)}
                        className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors ${
                          activeSpecimenIdx === idx
                            ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {item.id === "paracetamol" ? "Solid Dose (Room)" : "Insulin (Cold Chain)"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Specimen Visual Workspace */}
                <div className="p-5 sm:p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
                    {/* Packaging Photograph with Optical Reticle Overlay */}
                    <div className="sm:col-span-5 relative rounded-lg border border-border bg-background p-2.5 subtle-grid overflow-hidden">
                      {/* Four Corner Reticle Calipers */}
                      <div className="reticle-corner-tl" />
                      <div className="reticle-corner-tr" />
                      <div className="reticle-corner-bl" />
                      <div className="reticle-corner-br" />

                      <div className="relative aspect-4/3 w-full rounded overflow-hidden bg-ink/5 flex items-center justify-center">
                        <img
                          src={specimen.image}
                          alt={specimen.name}
                          className="w-full h-full object-contain p-1 transition-transform duration-300 hover:scale-105"
                        />
                        {/* Interactive Scan Laser Beam */}
                        <div className="scan-laser-line" />

                        {/* OCR Bounding Tag */}
                        <div className="absolute inset-x-3 bottom-2 rounded bg-card/90 border border-mint px-2 py-0.5 backdrop-blur-xs flex items-center justify-between">
                          <span className="font-mono text-[9px] font-bold text-foreground">
                            OCR: {specimen.ocrTokens[0]}
                          </span>
                          <span className="font-mono text-[8px] bg-mint text-white px-1 rounded-2xs font-semibold">
                            94.2%
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground px-0.5">
                        <span>FOV: 224x224 RGB</span>
                        <span className="text-primary font-medium">{specimen.formFactor}</span>
                      </div>
                    </div>

                    {/* Extracted Evidence & Lineage Column */}
                    <div className="sm:col-span-7 space-y-3">
                      {/* Monograph Match Card */}
                      <div className="rounded border border-border bg-background p-3.5">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-muted-foreground uppercase">
                            Pharmacopeial Record
                          </span>
                          <span className="rounded bg-mint/15 px-1.5 py-0.5 text-forest font-bold">
                            RxCUI {specimen.rxcui}
                          </span>
                        </div>
                        <h3 className="font-head text-base font-bold text-foreground mt-1">
                          {specimen.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {specimen.classification}
                        </p>
                      </div>

                      {/* Optical Tokens */}
                      <div className="rounded border border-border bg-background p-3">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground block mb-1.5">
                          Detected OCR Label Tokens
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {specimen.ocrTokens.map((tok) => (
                            <span
                              key={tok}
                              className="rounded border border-border/80 bg-card px-2 py-0.5 font-mono text-[10px] text-foreground"
                            >
                              {tok}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Storage Boundaries Spectrum Preview */}
                      <div className="rounded border border-border bg-background p-3">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-mono uppercase text-muted-foreground">
                            Storage Standard
                          </span>
                          <span
                            className={`rounded border px-2 py-0.5 font-mono text-[10px] font-semibold ${specimen.badgeStyle}`}
                          >
                            {specimen.badgeLabel}
                          </span>
                        </div>
                        <div className="font-mono text-sm font-bold text-primary mt-1.5">
                          {specimen.minTemp}°C to {specimen.maxTemp}°C
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {specimen.excursionBand} •{" "}
                          <strong className="text-foreground">{specimen.freezeBehavior}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Visualizer Footer Dock */}
                <div className="border-t border-border bg-muted/20 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    Photographic specimen from held-out validation set
                  </span>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="h-8 text-xs bg-card border-border hover:bg-secondary"
                      onClick={() =>
                        navigate({
                          to: "/assessment",
                          search: { medicine: specimen.medicineId },
                        })
                      }
                    >
                      <Thermometer className="mr-1.5 size-3.5 text-primary" />
                      <span>Assess Storage in Studio</span>
                    </Button>
                    <Button
                      variant="primary"
                      className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => navigate({ to: "/scan" })}
                    >
                      <span>Scan Live Package</span>
                      <ArrowRight className="ml-1.5 size-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: The Clinical Thesis (Why Unified Intelligence) ───── */}
      <section id="thesis" className="py-20 sm:py-28 bg-card border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-5 space-y-4">
              <span className="font-mono text-xs font-semibold tracking-wider text-mint uppercase">
                The Clinical Problem
              </span>
              <h2 className="font-head text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                Identifying a medicine is only half the battle.
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                Conventional AI healthcare tools stop at classifying a box or reading OCR text. In
                pharmaceutical reality, knowing the medicine’s identity means nothing if ambient
                temperature breach has compromised its active ingredients.
              </p>
              <p className="text-base text-muted-foreground leading-relaxed">
                MediShelf AI unifies physical visual verification with pharmacopeial storage rules
                and kinetic degradation estimation — providing actionable clinical evidence from
                label to shelf.
              </p>
            </div>

            {/* Asymmetrical Scientific Ledger (Not generic cards!) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="border-b border-border pb-6">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-sm font-bold text-mint">01</span>
                  <h3 className="font-head text-lg font-bold text-foreground">
                    Label-Linked Pharmacopeial Monographs
                  </h3>
                </div>
                <p className="mt-2 pl-7 text-sm text-muted-foreground leading-relaxed">
                  Extracted text tokens map directly to authentic FDA DailyMed package inserts and
                  NLM RxNorm concepts, establishing strict USP storage temperature boundaries.
                </p>
              </div>

              <div className="border-b border-border pb-6">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-sm font-bold text-mint">02</span>
                  <h3 className="font-head text-lg font-bold text-foreground">
                    Dual-Track Excursion Governance
                  </h3>
                </div>
                <p className="mt-2 pl-7 text-sm text-muted-foreground leading-relaxed">
                  Rigorous separation between deterministic pharmacopeial pass/fail thresholds and
                  machine learning kinetic risk estimation based on Arrhenius thermal simulation.
                </p>
              </div>

              <div className="border-b border-border pb-6">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-sm font-bold text-mint">03</span>
                  <h3 className="font-head text-lg font-bold text-foreground">
                    Open-World Pharmacopeial Arbitration
                  </h3>
                </div>
                <p className="mt-2 pl-7 text-sm text-muted-foreground leading-relaxed">
                  Rather than being locked to a closed set of 10 trained visual classes, the
                  retrieval engine indexes 27,326 clinical concepts with fuzzy token arbitration.
                </p>
              </div>

              <div>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-sm font-bold text-mint">04</span>
                  <h3 className="font-head text-lg font-bold text-foreground">
                    Auditable Scientific Lineage
                  </h3>
                </div>
                <p className="mt-2 pl-7 text-sm text-muted-foreground leading-relaxed">
                  Every recommendation tracks transparent lineage back to RxCUI identifiers,
                  DailyMed SPL document sets, or trained model verification checkpoints.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: Full-Width Deep Forest Section — 4-Stage Multimodal Engine ── */}
      <section id="architecture" className="ink-canvas py-24 sm:py-32 border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-3">
            <span className="font-mono text-xs font-semibold tracking-wider text-mint uppercase">
              System Architecture
            </span>
            <h2 className="font-head text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
              From raw package imagery to verified storage decisions.
            </h2>
            <p className="text-base sm:text-lg text-sage/90 leading-relaxed font-sans">
              MediShelf AI rejects opaque black-box outputs. Each analytical stage produces
              verifiable, human-inspectable evidence before escalating to the next layer.
            </p>
          </div>

          {/* 4-Stage Horizontal Workflow Ledger */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="relative border-t-2 border-mint pt-5 space-y-2">
              <span className="font-mono text-xs font-bold text-mint uppercase tracking-wider">
                Stage 01
              </span>
              <h3 className="font-head text-xl font-bold text-white">Physical Form</h3>
              <p className="text-xs text-sage/80 leading-relaxed">
                MobileNetV3-Small neural network classifies the container geometry across 10 form
                factors (blister packs, vials, bottles, ampoules).
              </p>
              <div className="pt-2 font-mono text-[11px] text-sage/60">
                Top-1: 63.3% • Top-3: 73.3% on test
              </div>
            </div>

            <div className="relative border-t-2 border-mint pt-5 space-y-2">
              <span className="font-mono text-xs font-bold text-mint uppercase tracking-wider">
                Stage 02
              </span>
              <h3 className="font-head text-xl font-bold text-white">Optical Text</h3>
              <p className="text-xs text-sage/80 leading-relaxed">
                EasyOCR extracts active chemical entities, dosage strengths, and pharmacopeial
                notations with interactive bounding coordinate calipers.
              </p>
              <div className="pt-2 font-mono text-[11px] text-sage/60">
                Multi-pass OCR • Interactive editing
              </div>
            </div>

            <div className="relative border-t-2 border-mint pt-5 space-y-2">
              <span className="font-mono text-xs font-bold text-mint uppercase tracking-wider">
                Stage 03
              </span>
              <h3 className="font-head text-xl font-bold text-white">Catalogue Match</h3>
              <p className="text-xs text-sage/80 leading-relaxed">
                Arbitrates between visual container form and OCR tokens to retrieve the optimal
                candidate from 27,326 pharmacopeial clinical concepts.
              </p>
              <div className="pt-2 font-mono text-[11px] text-sage/60">
                Ranked alternatives • Provenance logs
              </div>
            </div>

            <div className="relative border-t-2 border-mint pt-5 space-y-2">
              <span className="font-mono text-xs font-bold text-mint uppercase tracking-wider">
                Stage 04
              </span>
              <h3 className="font-head text-xl font-bold text-white">Storage Decision</h3>
              <p className="text-xs text-sage/80 leading-relaxed">
                Evaluates ambient exposure against authoritative USP guidelines while running a
                15-feature GBDT model for kinetic excursion risk assessment.
              </p>
              <div className="pt-2 font-mono text-[11px] text-sage/60">
                Deterministic Rules + Kinetic ML
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: Stability Profiles (Room Temp vs Cold-Chain Biologicals) ── */}
      <section id="specimens" className="py-20 sm:py-28 bg-background border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div>
              <span className="font-mono text-xs font-semibold tracking-wider text-mint uppercase">
                Pharmacopeial Stability Profiles
              </span>
              <h2 className="mt-1 font-head text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                Room Temperature vs Critical Cold-Chain Biologicals
              </h2>
              <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
                Explore real medicines from our database with authentic DailyMed storage boundaries.
                Observe the stark contrast in thermal tolerances and irreversible freeze hazards.
              </p>
            </div>

            <Link
              to="/medicines"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <span>Browse All {catalogCountFormatted} Concepts</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Paracetamol Solid Oral */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <span className="rounded bg-emerald-100/80 text-emerald-800 font-mono text-[10px] font-semibold px-2 py-0.5">
                    Room Temperature Solid Oral
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">RxCUI 198440</span>
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <div className="size-16 rounded border border-border bg-background p-1 overflow-hidden shrink-0">
                    <img
                      src="/samples/paracetamol_sample.jpg"
                      alt="Paracetamol"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h3 className="font-head text-lg font-bold text-foreground">
                      Paracetamol 500 MG
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Oral Solid Dose • USP Controlled Room Temperature
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded border border-border bg-background p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Permitted Temperature:</span>
                    <strong className="text-foreground font-mono">20°C to 25°C</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Permitted Excursion:</span>
                    <span className="text-primary font-medium font-mono">15°C to 30°C</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Freezing Hazard:</span>
                    <span className="text-muted-foreground">Non-critical</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground">
                  High thermal tolerance profile
                </span>
                <Button
                  variant="outline"
                  className="h-8 text-xs border-border bg-card hover:bg-secondary"
                  onClick={() =>
                    navigate({
                      to: "/assessment",
                      search: { medicine: "MED-001" },
                    })
                  }
                >
                  <Thermometer className="mr-1.5 size-3 text-primary" />
                  <span>Assess Storage</span>
                </Button>
              </div>
            </div>

            {/* Humulin Insulin Cold Chain */}
            <div className="rounded-lg border border-border bg-card p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <span className="rounded bg-sky-100/90 text-sky-800 font-mono text-[10px] font-semibold px-2 py-0.5">
                    Critical Cold Chain (2–8°C)
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">RxCUI 582498</span>
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <div className="size-16 rounded border border-border bg-background p-1 overflow-hidden shrink-0">
                    <img
                      src="/samples/humulin_sample.jpg"
                      alt="Humulin R"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h3 className="font-head text-lg font-bold text-foreground">
                      Humulin R (Insulin Regular)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Injectable Solution • Cold-Chain Biological
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded border border-border bg-background p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Permitted Temperature:</span>
                    <strong className="text-sky-800 font-mono">2°C to 8°C</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Permitted Excursion:</span>
                    <span className="text-amber font-medium font-mono">Up to 28 days at ≤30°C</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Freezing Hazard:</span>
                    <span className="text-coral font-bold uppercase text-[10px]">
                      DO NOT FREEZE (Denatures)
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground">
                  Immediate irreversible denaturation on freeze
                </span>
                <Button
                  variant="outline"
                  className="h-8 text-xs border-border bg-card hover:bg-secondary"
                  onClick={() =>
                    navigate({
                      to: "/assessment",
                      search: { medicine: "MED-014" },
                    })
                  }
                >
                  <Thermometer className="mr-1.5 size-3 text-primary" />
                  <span>Assess Storage</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: Scientific Truth & Methodological Boundaries ─────── */}
      <section id="disclosure" className="py-20 sm:py-28 bg-card border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-warning/30 bg-warning/10 px-3 py-0.5 text-xs font-mono text-warning">
              <ShieldAlert className="size-3.5 text-warning" />
              <span>Scientific Truth & Technical Boundaries</span>
            </div>
            <h2 className="font-head text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Rigorous Disclosure of Capabilities & Limits
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
              MediShelf AI is built with scientific integrity. We explicitly document where the
              model succeeds, what its training limits are, and how decisions are governed:
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-xs">
            <div className="space-y-2 border-t border-border pt-4">
              <h3 className="font-bold text-foreground text-sm">10 Trained Visual Classes</h3>
              <p className="text-muted-foreground leading-relaxed">
                MobileNetV3 evaluates physical container form factor (blister packs, vials,
                bottles). It does not identify arbitrary chemical entities by appearance alone
                without OCR.
              </p>
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <h3 className="font-bold text-foreground text-sm">Open-World OCR Retrieval</h3>
              <p className="text-muted-foreground leading-relaxed">
                Medicine identification relies on OCR text extraction matched against the 27,326
                catalogue. Scores represent string similarity, not medical certainty.
              </p>
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <h3 className="font-bold text-foreground text-sm">Simulation-Derived Risk Model</h3>
              <p className="text-muted-foreground leading-relaxed">
                The GBDT risk model was trained on simulation-derived thermal excursion profiles
                rather than destructive chemical assays.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: Editorial Closing Action ─────────────────────────── */}
      <section className="ink-canvas py-20 sm:py-24 text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="font-head text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Start verifying medicine packaging today.
          </h2>
          <p className="mx-auto max-w-xl text-sm sm:text-base text-sage/80 font-sans">
            Scan packaging photos, query 27,326 clinical concepts, or evaluate storage excursion
            compliance in the live verification studio.
          </p>

          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Button
              variant="primary"
              onClick={() => navigate({ to: "/app" })}
              className="h-10 bg-mint text-ink font-bold px-6 hover:bg-mint/90 shadow-xs"
            >
              <span>Launch Studio</span>
              <ArrowRight className="ml-2 size-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/scan" })}
              className="h-10 border-sage/30 bg-transparent text-white hover:bg-white/10"
            >
              <Camera className="mr-2 size-4 text-mint" />
              <span>Scan Medicine Package</span>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Editorial Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-border bg-background py-8 text-xs text-muted-foreground">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-head font-bold text-foreground">MediShelf AI</span>
            <span>—</span>
            <span>Healthcare Intelligence & Storage Compliance Research System</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span>FDA DailyMed & NLM RxNorm Lineage</span>
            <span>•</span>
            <Link to="/models" className="text-primary hover:underline">
              Model Artifacts
            </Link>
            <span>•</span>
            <span>Academic Research Platform</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
