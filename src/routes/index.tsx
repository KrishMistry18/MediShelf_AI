import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Brain,
  Camera,
  CheckCircle2,
  ChevronRight,
  Database,
  Eye,
  FileCheck2,
  Layers,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Thermometer,
} from "lucide-react";
import { Button } from "@/components/Button";
import { useCatalogCount, useModelsOverview } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MediShelf AI — Understand the Medicine. Understand its Storage." },
      {
        name: "description",
        content:
          "AI-assisted medicine packaging identification, label extraction, authoritative storage limits, and environmental condition assessment.",
      },
      {
        property: "og:title",
        content: "MediShelf AI — Understand the Medicine. Understand its Storage.",
      },
      {
        property: "og:description",
        content:
          "Identify packaging, extract label information, explore documented storage requirements, and evaluate environmental risk using AI-assisted analysis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicLandingPage,
});

function PublicLandingPage() {
  const navigate = useNavigate();
  const catalogCount = useCatalogCount();
  const models = useModelsOverview();

  const formattedCatalogCount = catalogCount.isSuccess
    ? catalogCount.data.toLocaleString()
    : "27,326";

  return (
    <div className="min-h-screen bg-[#F7F6F0] text-[#172720] antialiased selection:bg-[#18B88A]/20 selection:text-[#123E32]">
      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-[#DDE9DF] bg-[#F7F6F0]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#123E32] text-white shadow-sm">
                <ShieldCheck className="h-5 w-5 text-[#18B88A]" />
              </div>
              <div>
                <span className="font-serif text-lg font-bold tracking-tight text-[#123E32]">
                  MediShelf
                </span>
                <span className="ml-1 text-xs font-semibold tracking-wider text-[#18B88A] uppercase">
                  AI
                </span>
              </div>
            </Link>

            <nav className="hidden items-center gap-6 text-sm font-medium text-[#172720]/80 md:flex">
              <a href="#product" className="transition-colors hover:text-[#123E32]">
                Product
              </a>
              <a href="#how-it-works" className="transition-colors hover:text-[#123E32]">
                How It Works
              </a>
              <a href="#intelligence" className="transition-colors hover:text-[#123E32]">
                Medicine Intelligence
              </a>
              <a href="#responsible-ai" className="transition-colors hover:text-[#123E32]">
                Responsible AI
              </a>
              <a href="#about" className="transition-colors hover:text-[#123E32]">
                About
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/medicines"
              className="hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-[#123E32] transition-colors hover:bg-[#DDE9DF]/50 sm:flex"
            >
              <Database className="h-3.5 w-3.5 text-[#18B88A]" />
              <span>{formattedCatalogCount} Records</span>
            </Link>
            <Button
              variant="primary"
              onClick={() => navigate({ to: "/app" })}
              className="h-8.5 bg-[#123E32] text-xs text-white shadow hover:bg-[#123E32]/90"
            >
              <span>Open MediShelf AI</span>
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero Section ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28 lg:pt-20 lg:pb-32">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#DDE9DF]/40 via-transparent to-transparent" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
            {/* Left Column: Editorial Headline & Copy */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#DDE9DF] bg-white px-3.5 py-1 text-xs font-semibold text-[#123E32] shadow-xs">
                <span className="flex h-2 w-2 rounded-full bg-[#18B88A]" />
                Evidence-Based Medicine Identification & Storage Safety
              </div>

              <h1 className="mt-6 font-serif text-4xl font-bold tracking-tight text-[#123E32] sm:text-5xl lg:text-6xl lg:leading-[1.12]">
                Understand the medicine. <br />
                <span className="text-[#123E32]/85 italic">Understand its storage.</span>
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#172720]/80 sm:text-lg">
                Identify medicine packaging, extract label information, explore documented medicine
                storage requirements, and assess environmental conditions using AI-assisted
                analysis.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  onClick={() => navigate({ to: "/scan" })}
                  className="h-10 bg-[#123E32] px-6 text-sm text-white shadow-sm hover:bg-[#123E32]/90"
                >
                  <Camera className="mr-2 h-4 w-4 text-[#18B88A]" />
                  Try MediShelf AI
                </Button>
                <a
                  href="#how-it-works"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-[#DDE9DF] bg-white px-5 text-sm font-medium text-[#123E32] shadow-xs transition-colors hover:bg-[#DDE9DF]/30"
                >
                  Explore How It Works
                </a>
                <Link
                  to="/medicines"
                  className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-[#172720]/75 hover:text-[#123E32]"
                >
                  Browse Catalogue
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </div>

              {/* Key Quantitative Metrics Ribbon */}
              <div className="mt-12 grid grid-cols-2 gap-4 border-t border-[#DDE9DF] pt-8 sm:grid-cols-4">
                <div>
                  <div className="font-serif text-2xl font-bold text-[#123E32]">
                    {formattedCatalogCount}
                  </div>
                  <div className="text-xs font-medium text-[#172720]/70">Catalogue Records</div>
                  <div className="text-[11px] text-[#172720]/50">RxNorm & DailyMed</div>
                </div>
                <div>
                  <div className="font-serif text-2xl font-bold text-[#123E32]">10</div>
                  <div className="text-xs font-medium text-[#172720]/70">
                    Visual Packaging Classes
                  </div>
                  <div className="text-[11px] text-[#172720]/50">MobileNetV3-Small</div>
                </div>
                <div>
                  <div className="font-serif text-2xl font-bold text-[#123E32]">Dual-Track</div>
                  <div className="text-xs font-medium text-[#172720]/70">Storage Verification</div>
                  <div className="text-[11px] text-[#172720]/50">Rules + ML Risk Model</div>
                </div>
                <div>
                  <div className="font-serif text-2xl font-bold text-[#123E32]">Open-World</div>
                  <div className="text-xs font-medium text-[#172720]/70">OCR & Fast Retrieval</div>
                  <div className="text-[11px] text-[#172720]/50">Fuzzy Token Matching</div>
                </div>
              </div>
            </div>

            {/* Right Column: Authentic Product Composition Card */}
            <div className="lg:col-span-5">
              <div className="relative rounded-2xl border border-[#DDE9DF] bg-white p-6 shadow-xl lg:p-7">
                <div className="flex items-center justify-between border-b border-[#DDE9DF] pb-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-[#18B88A]" />
                    <span className="text-xs font-semibold tracking-wide text-[#123E32] uppercase">
                      Analysis Pipeline Preview
                    </span>
                  </div>
                  <span className="rounded bg-[#DDE9DF]/60 px-2 py-0.5 text-[11px] font-mono text-[#123E32]">
                    LIVE ENGINE
                  </span>
                </div>

                {/* Step-by-step verified preview card */}
                <div className="mt-5 space-y-4 text-xs">
                  {/* Visual classification stage */}
                  <div className="rounded-lg border border-[#DDE9DF]/80 bg-[#F7F6F0]/70 p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-medium text-[#123E32]">
                        <Eye className="h-4 w-4 text-[#18B88A]" />
                        <span>Visual Classifier (MobileNetV3-Small)</span>
                      </div>
                      <span className="font-mono text-[11px] font-semibold text-[#123E32]">
                        Score 0.88
                      </span>
                    </div>
                    <div className="mt-2 text-[#172720]/80">
                      Detected Class:{" "}
                      <span className="font-semibold text-[#123E32]">Blister Pack Tablet</span>
                      <span className="ml-2 text-[11px] text-[#172720]/60">
                        (Top-1: 63.3%, Top-3: 73.3% test)
                      </span>
                    </div>
                  </div>

                  {/* OCR extraction stage */}
                  <div className="rounded-lg border border-[#DDE9DF]/80 bg-[#F7F6F0]/70 p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-medium text-[#123E32]">
                        <ScanLine className="h-4 w-4 text-[#18B88A]" />
                        <span>OCR Token Extraction (EasyOCR)</span>
                      </div>
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                        High Confidence
                      </span>
                    </div>
                    <div className="mt-2 font-mono text-[11px] text-[#172720]/90">
                      Tokens: [PARACETAMOL, 500MG, TABLET, BP]
                    </div>
                  </div>

                  {/* Catalogue Match */}
                  <div className="rounded-lg border border-[#18B88A]/30 bg-emerald-50/50 p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-medium text-[#123E32]">
                        <CheckCircle2 className="h-4 w-4 text-[#18B88A]" />
                        <span>Resolved Knowledge Base Record</span>
                      </div>
                      <span className="font-mono text-[11px] font-semibold text-[#123E32]">
                        Match 0.94
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="font-semibold text-[#123E32]">
                        Paracetamol 500 MG Oral Tablet
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-[#172720]/70">
                        <span>DailyMed / USP Monograph</span>
                        <span>•</span>
                        <span>RxCUI 198440</span>
                      </div>
                    </div>
                  </div>

                  {/* Storage assessment outcome */}
                  <div className="rounded-lg border border-[#E7A441]/40 bg-amber-50/50 p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-medium text-[#123E32]">
                        <Thermometer className="h-4 w-4 text-[#E7A441]" />
                        <span>Storage Assessment Track</span>
                      </div>
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                        EXCURSION DETECTED
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-[#172720]/60">Documented Limit:</span>
                        <div className="font-medium text-[#123E32]">
                          20°C to 25°C (Excursions 15–30°C)
                        </div>
                      </div>
                      <div>
                        <span className="text-[#172720]/60">Observed Input:</span>
                        <div className="font-medium text-[#D85E5E]">32.0°C for 48 hours</div>
                      </div>
                    </div>
                    <div className="mt-2.5 border-t border-[#E7A441]/20 pt-2 text-[11px] text-[#172720]/80">
                      <span className="font-semibold text-[#123E32]">ML Risk Model:</span> High Risk
                      (99.56% simulation benchmark)
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3">
                  <Button
                    variant="outline"
                    className="w-full justify-between border-[#DDE9DF] bg-white text-xs text-[#123E32] hover:bg-[#DDE9DF]/30"
                    onClick={() => navigate({ to: "/app" })}
                  >
                    <span>Launch full interactive verification workspace</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: Product Story (The 6 Real Capabilities) ─────────── */}
      <section id="product" className="border-t border-[#DDE9DF] bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold tracking-wider text-[#18B88A] uppercase">
              End-to-End Intelligence
            </span>
            <h2 className="mt-2 font-serif text-3xl font-bold tracking-tight text-[#123E32] sm:text-4xl">
              From package imagery to storage decisions.
            </h2>
            <p className="mt-4 text-base text-[#172720]/75">
              MediShelf AI connects computer vision, optical character recognition, curated
              pharmacopeial monographs, and machine-learning risk estimation into an actionable,
              auditable workflow.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Capability 1 */}
            <div className="rounded-xl border border-[#DDE9DF] bg-[#F7F6F0]/50 p-6 transition-all hover:border-[#18B88A]/40 hover:bg-white hover:shadow-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#123E32] text-white">
                <Camera className="h-5 w-5 text-[#18B88A]" />
              </div>
              <h3 className="mt-5 font-serif text-lg font-bold text-[#123E32]">
                1. Identify Packaging Form
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#172720]/75">
                MobileNetV3-Small neural network trained across 10 packaging classes (blister packs,
                bottles, ampoules, vials, syrups, sprays, and more) to provide an initial physical
                form factor estimate.
              </p>
              <div className="mt-4 text-xs font-mono text-[#123E32]/80">
                Top-1: 63.33% • Top-3: 73.33% on held-out test
              </div>
            </div>

            {/* Capability 2 */}
            <div className="rounded-xl border border-[#DDE9DF] bg-[#F7F6F0]/50 p-6 transition-all hover:border-[#18B88A]/40 hover:bg-white hover:shadow-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#123E32] text-white">
                <ScanLine className="h-5 w-5 text-[#18B88A]" />
              </div>
              <h3 className="mt-5 font-serif text-lg font-bold text-[#123E32]">
                2. Extract Label Information
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#172720]/75">
                High-performance EasyOCR pipeline extracts active ingredients, dosage strengths,
                batch markers, and manufacturer indications directly from user-uploaded images or
                mobile camera captures.
              </p>
              <div className="mt-4 text-xs font-mono text-[#123E32]/80">
                OCR bounding boxes • User correction support
              </div>
            </div>

            {/* Capability 3 */}
            <div className="rounded-xl border border-[#DDE9DF] bg-[#F7F6F0]/50 p-6 transition-all hover:border-[#18B88A]/40 hover:bg-white hover:shadow-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#123E32] text-white">
                <Database className="h-5 w-5 text-[#18B88A]" />
              </div>
              <h3 className="mt-5 font-serif text-lg font-bold text-[#123E32]">
                3. Match Medicine Records
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#172720]/75">
                Rapid indexed open-world retrieval across 27,326 clinical medicine concepts (17,610
                SCD and 9,691 SBD RxNorm terms) plus 25 foundational curated monographs.
              </p>
              <div className="mt-4 text-xs font-mono text-[#123E32]/80">
                Fuzzy token similarity • Ranked candidate list
              </div>
            </div>

            {/* Capability 4 */}
            <div className="rounded-xl border border-[#DDE9DF] bg-[#F7F6F0]/50 p-6 transition-all hover:border-[#18B88A]/40 hover:bg-white hover:shadow-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#123E32] text-white">
                <FileCheck2 className="h-5 w-5 text-[#18B88A]" />
              </div>
              <h3 className="mt-5 font-serif text-lg font-bold text-[#123E32]">
                4. Inspect Documented Limits
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#172720]/75">
                Retrieve authoritative storage guidelines directly from FDA DailyMed package inserts
                and United States Pharmacopeia standards (temperature limits, humidity, light
                sensitivity, freeze prohibition).
              </p>
              <div className="mt-4 text-xs font-mono text-[#123E32]/80">
                Explicit INSUFFICIENT_DATA when unverified
              </div>
            </div>

            {/* Capability 5 */}
            <div className="rounded-xl border border-[#DDE9DF] bg-[#F7F6F0]/50 p-6 transition-all hover:border-[#18B88A]/40 hover:bg-white hover:shadow-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#123E32] text-white">
                <Thermometer className="h-5 w-5 text-[#18B88A]" />
              </div>
              <h3 className="mt-5 font-serif text-lg font-bold text-[#123E32]">
                5. Assess Observed Conditions
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#172720]/75">
                Evaluate ambient storage conditions against quantitative boundaries. Evaluates
                cumulative excursion duration, temperature thresholds, and environmental humidity.
              </p>
              <div className="mt-4 text-xs font-mono text-[#123E32]/80">
                Deterministic compliance check • Clear pass/warn/fail
              </div>
            </div>

            {/* Capability 6 */}
            <div className="rounded-xl border border-[#DDE9DF] bg-[#F7F6F0]/50 p-6 transition-all hover:border-[#18B88A]/40 hover:bg-white hover:shadow-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#123E32] text-white">
                <Brain className="h-5 w-5 text-[#18B88A]" />
              </div>
              <h3 className="mt-5 font-serif text-lg font-bold text-[#123E32]">
                6. Understand Evidence & Risk
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#172720]/75">
                Separate deterministic compliance from machine-learning storage risk.
                GradientBoosting model estimates risk from kinetic excursion features with full
                model introspection.
              </p>
              <div className="mt-4 text-xs font-mono text-[#123E32]/80">
                Simulation-derived benchmark (99.56%)
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: How It Works ────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-xs font-semibold tracking-wider text-[#18B88A] uppercase">
              Operational Workflow
            </span>
            <h2 className="mt-2 font-serif text-3xl font-bold tracking-tight text-[#123E32] sm:text-4xl">
              How MediShelf AI evaluates medicine packaging
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-[#172720]/75">
              Three synchronized analytical layers ensure you never rely on a single opaque model
              prediction.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="relative rounded-2xl border border-[#DDE9DF] bg-white p-8 shadow-xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#DDE9DF]/70 text-[#123E32]">
                <Layers className="h-6 w-6 text-[#123E32]" />
              </div>
              <div className="mt-6 text-xs font-semibold tracking-wider text-[#18B88A] uppercase">
                Phase 1
              </div>
              <h3 className="mt-2 font-serif text-xl font-bold text-[#123E32]">
                Multimodal Ingestion
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#172720]/75">
                Upload packaging photos or capture via mobile camera. The system splits inference
                between visual packaging form classification and OCR text parsing, extracting both
                visual and linguistic evidence simultaneously.
              </p>
            </div>

            <div className="relative rounded-2xl border border-[#DDE9DF] bg-white p-8 shadow-xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#DDE9DF]/70 text-[#123E32]">
                <ShieldCheck className="h-6 w-6 text-[#123E32]" />
              </div>
              <div className="mt-6 text-xs font-semibold tracking-wider text-[#18B88A] uppercase">
                Phase 2
              </div>
              <h3 className="mt-2 font-serif text-xl font-bold text-[#123E32]">
                Evidence Arbitration & Retrieval
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#172720]/75">
                OCR tokens query the 27,326-concept knowledge base. If visual classification and OCR
                agree, confidence is reinforced. If they disagree, open-world OCR retrieval takes
                precedence and flags the discrepancy for human review.
              </p>
            </div>

            <div className="relative rounded-2xl border border-[#DDE9DF] bg-white p-8 shadow-xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#DDE9DF]/70 text-[#123E32]">
                <Thermometer className="h-6 w-6 text-[#123E32]" />
              </div>
              <div className="mt-6 text-xs font-semibold tracking-wider text-[#18B88A] uppercase">
                Phase 3
              </div>
              <h3 className="mt-2 font-serif text-xl font-bold text-[#123E32]">
                Storage Compliance & Risk
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#172720]/75">
                Input temperature, duration, and humidity. Deterministic rules verify compliance
                against official monograph specifications. Simultaneously, an ML model assesses
                excursion degradation risk based on simulated thermal profiles.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: Medicine Intelligence & Presets ─────────────────── */}
      <section id="intelligence" className="border-t border-[#DDE9DF] bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <span className="text-xs font-semibold tracking-wider text-[#18B88A] uppercase">
                Curated Monographs & Clinical Terms
              </span>
              <h2 className="mt-2 font-serif text-3xl font-bold tracking-tight text-[#123E32] sm:text-4xl">
                Medicine Intelligence & Demonstrations
              </h2>
              <p className="mt-3 max-w-2xl text-base text-[#172720]/75">
                Explore real medicines from our database with genuine DailyMed storage boundaries.
                Test any sample directly in the verification workspace.
              </p>
            </div>
            <Link
              to="/medicines"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#123E32] hover:underline"
            >
              <span>Explore all {formattedCatalogCount} records</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Preset 1: Paracetamol */}
            <div className="flex flex-col justify-between rounded-xl border border-[#DDE9DF] bg-[#F7F6F0]/60 p-5 transition-shadow hover:shadow-md">
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded bg-[#DDE9DF] px-2 py-0.5 text-[11px] font-semibold text-[#123E32]">
                    Room Temp Oral
                  </span>
                  <span className="text-xs font-mono text-[#172720]/60">RxCUI 198440</span>
                </div>
                <h3 className="mt-3 font-serif text-base font-bold text-[#123E32]">
                  Paracetamol 500 MG
                </h3>
                <p className="mt-1 text-xs text-[#172720]/70">Oral tablet • DailyMed Monograph</p>
                <div className="mt-4 rounded border border-[#DDE9DF] bg-white p-3 text-xs">
                  <div className="font-semibold text-[#123E32]">Documented Storage:</div>
                  <div className="mt-0.5 text-[#172720]/80">20°C to 25°C (68°F to 77°F)</div>
                  <div className="mt-0.5 text-[11px] text-[#172720]/60">
                    Excursions permitted 15–30°C
                  </div>
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <Button
                  variant="outline"
                  className="w-full border-[#DDE9DF] bg-white text-xs text-[#123E32]"
                  onClick={() =>
                    navigate({
                      to: "/assessment",
                      search: {
                        medicine: "paracetamol-500mg-tablet",
                      },
                    })
                  }
                >
                  Assess Storage
                </Button>
              </div>
            </div>

            {/* Preset 2: Humulin R */}
            <div className="flex flex-col justify-between rounded-xl border border-[#DDE9DF] bg-[#F7F6F0]/60 p-5 transition-shadow hover:shadow-md">
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
                    Cold Chain (2–8°C)
                  </span>
                  <span className="text-xs font-mono text-[#172720]/60">RxCUI 582498</span>
                </div>
                <h3 className="mt-3 font-serif text-base font-bold text-[#123E32]">
                  Humulin R (Insulin Regular)
                </h3>
                <p className="mt-1 text-xs text-[#172720]/70">Injectable solution • Cold Chain</p>
                <div className="mt-4 rounded border border-[#DDE9DF] bg-white p-3 text-xs">
                  <div className="font-semibold text-[#123E32]">Documented Storage:</div>
                  <div className="mt-0.5 text-[#172720]/80">2°C to 8°C (36°F to 46°F)</div>
                  <div className="mt-0.5 text-[11px] font-medium text-[#D85E5E]">
                    Do not freeze • Protect from light
                  </div>
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <Button
                  variant="outline"
                  className="w-full border-[#DDE9DF] bg-white text-xs text-[#123E32]"
                  onClick={() =>
                    navigate({
                      to: "/assessment",
                      search: {
                        medicine: "humulin-r-insulin-regular-100-units-ml",
                      },
                    })
                  }
                >
                  Assess Storage
                </Button>
              </div>
            </div>

            {/* Preset 3: Omeprazole */}
            <div className="flex flex-col justify-between rounded-xl border border-[#DDE9DF] bg-[#F7F6F0]/60 p-5 transition-shadow hover:shadow-md">
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    Moisture Sensitive
                  </span>
                  <span className="text-xs font-mono text-[#172720]/60">RxCUI 312065</span>
                </div>
                <h3 className="mt-3 font-serif text-base font-bold text-[#123E32]">
                  Omeprazole 20 MG
                </h3>
                <p className="mt-1 text-xs text-[#172720]/70">Delayed-release capsule • DailyMed</p>
                <div className="mt-4 rounded border border-[#DDE9DF] bg-white p-3 text-xs">
                  <div className="font-semibold text-[#123E32]">Documented Storage:</div>
                  <div className="mt-0.5 text-[#172720]/80">20°C to 25°C (68°F to 77°F)</div>
                  <div className="mt-0.5 text-[11px] text-[#172720]/60">
                    Keep container tightly closed
                  </div>
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <Button
                  variant="outline"
                  className="w-full border-[#DDE9DF] bg-white text-xs text-[#123E32]"
                  onClick={() =>
                    navigate({
                      to: "/assessment",
                      search: {
                        medicine: "omeprazole-20mg-capsule",
                      },
                    })
                  }
                >
                  Assess Storage
                </Button>
              </div>
            </div>

            {/* Preset 4: Metformin */}
            <div className="flex flex-col justify-between rounded-xl border border-[#DDE9DF] bg-[#F7F6F0]/60 p-5 transition-shadow hover:shadow-md">
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded bg-[#DDE9DF] px-2 py-0.5 text-[11px] font-semibold text-[#123E32]">
                    Controlled Room Temp
                  </span>
                  <span className="text-xs font-mono text-[#172720]/60">RxCUI 861004</span>
                </div>
                <h3 className="mt-3 font-serif text-base font-bold text-[#123E32]">
                  Metformin HCl 500 MG
                </h3>
                <p className="mt-1 text-xs text-[#172720]/70">Oral tablet • DailyMed Monograph</p>
                <div className="mt-4 rounded border border-[#DDE9DF] bg-white p-3 text-xs">
                  <div className="font-semibold text-[#123E32]">Documented Storage:</div>
                  <div className="mt-0.5 text-[#172720]/80">20°C to 25°C (68°F to 77°F)</div>
                  <div className="mt-0.5 text-[11px] text-[#172720]/60">
                    USP Controlled Room Temp
                  </div>
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <Button
                  variant="outline"
                  className="w-full border-[#DDE9DF] bg-white text-xs text-[#123E32]"
                  onClick={() =>
                    navigate({
                      to: "/assessment",
                      search: {
                        medicine: "metformin-500mg-tablet",
                      },
                    })
                  }
                >
                  Assess Storage
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: Responsible AI & Technical Boundaries ─────────── */}
      <section id="responsible-ai" className="border-t border-[#DDE9DF] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-[#DDE9DF] bg-white p-8 sm:p-12 shadow-sm">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-700" />
                Technical Truth & Transparency
              </div>
              <h2 className="mt-4 font-serif text-2xl font-bold tracking-tight text-[#123E32] sm:text-3xl">
                Responsible AI & Scope Boundaries
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#172720]/80">
                MediShelf AI is built with rigorous transparency. We document the precise scope,
                strengths, and scientific limitations of each underlying analytical model:
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-[#DDE9DF] bg-[#F7F6F0]/40 p-5">
                <h3 className="font-semibold text-[#123E32]">10 Trained Visual Classes</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#172720]/75">
                  The MobileNetV3 visual packaging model covers exactly 10 trained physical
                  packaging classes. It does not identify arbitrary medicines by appearance alone.
                </p>
              </div>

              <div className="rounded-lg border border-[#DDE9DF] bg-[#F7F6F0]/40 p-5">
                <h3 className="font-semibold text-[#123E32]">Open-World OCR Retrieval</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#172720]/75">
                  Open-world identification depends on OCR token extraction and fuzzy matching
                  against the 27,326-record knowledge base. Catalogue scores are similarity metrics,
                  not calibrated probabilities.
                </p>
              </div>

              <div className="rounded-lg border border-[#DDE9DF] bg-[#F7F6F0]/40 p-5">
                <h3 className="font-semibold text-[#123E32]">Dual-Track Independence</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#172720]/75">
                  Deterministic compliance (direct comparison to USP/DailyMed quantitative limits)
                  is kept completely distinct from ML storage-risk estimation.
                </p>
              </div>

              <div className="rounded-lg border border-[#DDE9DF] bg-[#F7F6F0]/40 p-5">
                <h3 className="font-semibold text-[#123E32]">Simulation-Derived ML Labels</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#172720]/75">
                  The GradientBoosting storage-risk model (99.56% benchmark) was trained on
                  simulation-derived kinetic excursion profiles, not wet-lab chemical stability
                  assays.
                </p>
              </div>

              <div className="rounded-lg border border-[#DDE9DF] bg-[#F7F6F0]/40 p-5">
                <h3 className="font-semibold text-[#123E32]">Explicit Insufficient Data</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#172720]/75">
                  When a medicine record lacks authoritative storage boundaries, the system
                  explicitly states{" "}
                  <code className="text-[11px] font-mono text-[#123E32]">INSUFFICIENT_DATA</code>{" "}
                  rather than substituting arbitrary defaults.
                </p>
              </div>

              <div className="rounded-lg border border-[#DDE9DF] bg-[#F7F6F0]/40 p-5">
                <h3 className="font-semibold text-[#123E32]">Non-Clinical Prototype Status</h3>
                <p className="mt-2 text-xs leading-relaxed text-[#172720]/75">
                  MediShelf AI is an educational research and engineering demonstration. It does not
                  provide clinical advice or replace licensed pharmacist inspection.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: Call to Action ──────────────────────────────────── */}
      <section className="border-t border-[#DDE9DF] bg-[#123E32] py-16 text-white sm:py-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">
            Start verifying medicine packaging today.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-[#DDE9DF]">
            Scan packaging photos, query 27,326 clinical catalogue concepts, or evaluate storage
            conditions in the interactive workspace.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button
              variant="jade"
              onClick={() => navigate({ to: "/app" })}
              className="h-10 px-6 font-semibold"
            >
              <span>Open MediShelf AI Workspace</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/scan" })}
              className="h-10 border-[#DDE9DF]/40 bg-transparent text-white hover:bg-white/10"
            >
              <Camera className="mr-2 h-4 w-4 text-[#18B88A]" />
              <span>Scan a Medicine Package</span>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer
        id="about"
        className="border-t border-[#DDE9DF] bg-white py-12 text-sm text-[#172720]/75"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 font-serif text-base font-bold text-[#123E32]">
                <ShieldCheck className="h-5 w-5 text-[#18B88A]" />
                <span>MediShelf AI</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[#172720]/70">
                Intelligent medicine packaging verification, OCR text extraction, and environmental
                storage safety assessment platform.
              </p>
            </div>

            <div>
              <div className="text-xs font-semibold tracking-wider text-[#123E32] uppercase">
                Interactive Workspace
              </div>
              <ul className="mt-3 space-y-2 text-xs">
                <li>
                  <Link to="/app" className="hover:text-[#123E32]">
                    Workspace Overview
                  </Link>
                </li>
                <li>
                  <Link to="/scan" className="hover:text-[#123E32]">
                    Scan Medicine
                  </Link>
                </li>
                <li>
                  <Link to="/medicines" className="hover:text-[#123E32]">
                    Medicine Library ({formattedCatalogCount})
                  </Link>
                </li>
                <li>
                  <Link
                    to="/assessment"
                    search={{ medicine: undefined }}
                    className="hover:text-[#123E32]"
                  >
                    Storage Assessment
                  </Link>
                </li>
                <li>
                  <Link to="/alerts" className="hover:text-[#123E32]">
                    Storage Alerts
                  </Link>
                </li>
                <li>
                  <Link to="/models" className="hover:text-[#123E32]">
                    Model Insights & Artifacts
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold tracking-wider text-[#123E32] uppercase">
                Data Provenance
              </div>
              <ul className="mt-3 space-y-2 text-xs">
                <li>
                  <span className="text-[#172720]/80">FDA DailyMed Package Inserts</span>
                </li>
                <li>
                  <span className="text-[#172720]/80">NLM RxNorm Clinical Concepts</span>
                </li>
                <li>
                  <span className="text-[#172720]/80">USP &lt;659&gt; Packaging & Storage</span>
                </li>
                <li>
                  <span className="text-[#172720]/80">MobileNetV3-Small Packaging Classifier</span>
                </li>
                <li>
                  <span className="text-[#172720]/80">EasyOCR Multi-stage Text Recognition</span>
                </li>
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold tracking-wider text-[#123E32] uppercase">
                Responsible Disclaimer
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[#172720]/70">
                MediShelf AI is an educational research and technology demonstration. It does not
                guarantee medicine stability or replace licensed pharmaceutical review. Always
                consult licensed healthcare practitioners.
              </p>
            </div>
          </div>

          <div className="mt-10 border-t border-[#DDE9DF] pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-[#172720]/60">
            <div>© {new Date().getFullYear()} MediShelf AI. All rights reserved.</div>
            <div className="mt-2 sm:mt-0 flex gap-4">
              <span>Open-source Healthcare AI Architecture</span>
              <span>•</span>
              <span>Strict Non-Clinical Research Prototype</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
