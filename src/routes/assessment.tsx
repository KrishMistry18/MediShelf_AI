import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  ExternalLink,
  Flame,
  Info,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Thermometer,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { recordAssessment } from "@/lib/activity";
import {
  ApiError,
  formatPercent,
  predictStorageRisk,
  searchMedicines,
  type Medicine,
  type RiskLevel,
  type StorageRiskRequest,
  type StorageRiskResponse,
} from "@/lib/api";
import { useAllMedicines, useMedicine, useStorageRiskMetadata } from "@/lib/queries";
import { cn } from "@/lib/utils";

type AssessmentSearch = { medicine: string | undefined };

export const Route = createFileRoute("/assessment")({
  validateSearch: (search: Record<string, unknown>): AssessmentSearch => ({
    medicine: typeof search["medicine"] === "string" ? search["medicine"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Excursion Assessment — MediShelf AI" },
      {
        name: "description",
        content:
          "Dual-track storage excursion assessment: evaluate observed temperature exposures against pharmacopeial monograph bounds and kinetic degradation risk.",
      },
      { property: "og:title", content: "Excursion Assessment — MediShelf AI" },
    ],
  }),
  component: AssessmentPage,
});

/** Authentic simulation scenario presets */
const SIMULATION_SCENARIOS = [
  {
    label: "Paracetamol: Controlled Room Temp",
    medicine: "MED-001",
    temp: 22.0,
    hours: 0,
    humidity: 45,
    tag: "Within Specification",
  },
  {
    label: "Paracetamol: Summer Transit (28°C, 6h)",
    medicine: "MED-001",
    temp: 28.0,
    hours: 6,
    humidity: 55,
    tag: "Permitted USP Excursion",
  },
  {
    label: "Humulin Insulin: Refrigerated Cold Chain (4°C)",
    medicine: "MED-014",
    temp: 4.0,
    hours: 0,
    humidity: 50,
    tag: "Within Cold Chain",
  },
  {
    label: "Humulin Insulin: Cold-Chain Break (12°C, 3h)",
    medicine: "MED-014",
    temp: 12.0,
    hours: 3,
    humidity: 50,
    tag: "Moderate Thermal Excursion",
  },
  {
    label: "Humulin Insulin: Vehicle Heat Spike (35°C, 24h)",
    medicine: "MED-014",
    temp: 35.0,
    hours: 24,
    humidity: 65,
    tag: "Severe Heat Breach",
  },
  {
    label: "Humulin Insulin: Accidental Freezing (-4°C, 12h)",
    medicine: "MED-014",
    temp: -4.0,
    hours: 12,
    humidity: 50,
    tag: "Critical Freezing Breach",
  },
] as const;

const RISK_THEMES: Record<RiskLevel, { text: string; bg: string; border: string; pill: string }> = {
  LOW: {
    text: "text-mint",
    bg: "bg-mint/8",
    border: "border-mint/30",
    pill: "bg-emerald-100 text-emerald-800",
  },
  MODERATE: {
    text: "text-amber",
    bg: "bg-amber/10",
    border: "border-amber/30",
    pill: "bg-amber-100 text-amber-800",
  },
  HIGH: {
    text: "text-coral",
    bg: "bg-coral/10",
    border: "border-coral/30",
    pill: "bg-rose-100 text-rose-800",
  },
};

function AssessmentPage() {
  const search = Route.useSearch();
  const medicines = useAllMedicines();
  const metadata = useStorageRiskMetadata();

  const [medicineId, setMedicineId] = useState(search.medicine ?? "MED-014");
  const [temperature, setTemperature] = useState(12.0);
  const [hours, setHours] = useState(4);
  const [humidity, setHumidity] = useState<number | "">(55);
  const [daysToExpiry, setDaysToExpiry] = useState<number | "">("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Medicine[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchMedicines(searchQuery.trim(), 8);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (search.medicine) setMedicineId(search.medicine);
  }, [search.medicine]);

  const isCatalogMedicine = Boolean(
    medicines.data?.some((item) => item.medicine_id.toLowerCase() === medicineId.toLowerCase()),
  );
  const customMedicine = useMedicine(
    !medicines.isLoading && !isCatalogMedicine ? medicineId : undefined,
  );

  const selected: Medicine | undefined = useMemo(() => {
    const fromList = medicines.data?.find(
      (item) => item.medicine_id.toLowerCase() === medicineId.toLowerCase(),
    );
    if (fromList) return fromList;
    if (customMedicine.data) return customMedicine.data;
    return undefined;
  }, [medicines.data, medicineId, customMedicine.data]);

  const assess = useMutation({
    mutationFn: (payload: StorageRiskRequest) => predictStorageRisk(payload),
    onSuccess: (result, variables) =>
      recordAssessment(
        {
          temperature: variables.current_temperature,
          humidity: variables.current_humidity ?? null,
          durationHours: variables.excursion_duration_hours,
          daysToExpiry: variables.days_to_expiry ?? null,
        },
        result,
      ),
  });

  const runAssessment = () => {
    const payload: StorageRiskRequest = {
      medicine_id: medicineId,
      current_temperature: temperature,
      excursion_duration_hours: hours,
    };
    if (humidity !== "") payload.current_humidity = humidity;
    if (daysToExpiry !== "") payload.days_to_expiry = daysToExpiry;
    assess.mutate(payload);
  };

  const applyPreset = (preset: (typeof SIMULATION_SCENARIOS)[number]) => {
    setMedicineId(preset.medicine);
    setTemperature(preset.temp);
    setHours(preset.hours);
    setHumidity(preset.humidity);
    assess.reset();
  };

  const result = assess.data;

  const minLimit = selected?.storage_min_temperature ?? 20;
  const maxLimit = selected?.storage_max_temperature ?? 25;
  const isColdChain = maxLimit <= 8;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── Workbench Header ─────────────────────────────────────────── */}
        <div className="border-b border-border pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-mint" />
              <span>Thermal Kinetic Workbench</span>
              <span>•</span>
              <span>Deterministic USP Rules + GBDT Kinetics</span>
            </div>
            <h1 className="font-head text-3xl font-bold tracking-tight text-foreground">
              Storage Excursion Analytical Studio
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl font-sans">
              Evaluate ambient temperature exposures against official pharmacopeial specifications.
              Strict boundary compliance and simulation-trained kinetic degradation are verified
              independently.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-8.5 px-3 text-xs border-border bg-card hover:bg-secondary font-medium"
              onClick={() => assess.reset()}
              disabled={!result && !assess.isPending}
            >
              <RotateCcw className="mr-1.5 size-3" />
              <span>Reset Parameters</span>
            </Button>
          </div>
        </div>

        {/* ── 4-Stage Analytical Workflow ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column (5 Cols): Target Medicine Context & Exposure Form */}
          <div className="lg:col-span-5 space-y-6">
            {/* Stage 1: Medicine Selection & Documented Specification */}
            <div className="rounded border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border text-xs font-mono">
                <span className="font-bold uppercase tracking-wider text-primary">
                  Stage 01 • Target Medicine Context
                </span>
                <span className="text-muted-foreground">
                  {selected?.source ?? "Knowledge Base"}
                </span>
              </div>

              {/* Medicine Concept Lookup */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-foreground">
                  Select Medicine Concept
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search 27,326 clinical concepts (e.g. Insulin, Paracetamol)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-9 rounded border border-border bg-background pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSearchResults([]);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                  {searchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded border border-border bg-card p-1 shadow-lg">
                      {searchResults.map((med) => (
                        <button
                          key={med.medicine_id}
                          type="button"
                          onClick={() => {
                            setMedicineId(med.medicine_id);
                            setSearchQuery("");
                            setSearchResults([]);
                            assess.reset();
                          }}
                          className="flex w-full flex-col items-start rounded p-2 text-left text-xs hover:bg-secondary transition-colors"
                        >
                          <strong className="text-foreground">{med.medicine_name}</strong>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {med.generic_name} • {med.medicine_id}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <select
                  value={selected?.medicine_id ?? medicineId}
                  onChange={(e) => {
                    setMedicineId(e.target.value);
                    assess.reset();
                  }}
                  className="w-full h-9 rounded border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:border-primary font-mono"
                >
                  {selected &&
                    !medicines.data?.some((item) => item.medicine_id === selected.medicine_id) && (
                      <option key={selected.medicine_id} value={selected.medicine_id}>
                        {selected.medicine_name} [{selected.source}]
                      </option>
                    )}
                  {medicines.data?.map((item) => (
                    <option key={item.medicine_id} value={item.medicine_id}>
                      {item.medicine_name} ({item.medicine_id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Documented Specification Ribbon */}
              {selected && (
                <div className="rounded border border-border bg-background p-3.5 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Documented Standard:</span>
                    <strong className="text-foreground">
                      {selected.storage_min_temperature !== null &&
                      selected.storage_max_temperature !== null
                        ? `${selected.storage_min_temperature}°C to ${selected.storage_max_temperature}°C`
                        : "Advisory Monograph"}
                    </strong>
                  </div>
                  {isColdChain && (
                    <div className="flex justify-between text-coral font-bold text-[11px] pt-1 border-t border-border/60">
                      <span>Freezing Rule:</span>
                      <span>DO NOT FREEZE (Denatures)</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Stage 2: Environmental Exposure Studio */}
            <div className="rounded border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border text-xs font-mono">
                <span className="font-bold uppercase tracking-wider text-primary">
                  Stage 02 • Environmental Exposure
                </span>
                <span className="text-muted-foreground">Observed Field Readings</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Temperature */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Temperature (°C)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min={-50}
                    max={80}
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    className="w-full h-9 rounded border border-border bg-background px-3 font-mono text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                  <span className="font-mono text-[10px] text-muted-foreground mt-0.5 block">
                    Observed reading
                  </span>
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Duration (Hours)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    step="0.5"
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                    className="w-full h-9 rounded border border-border bg-background px-3 font-mono text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                  <span className="font-mono text-[10px] text-muted-foreground mt-0.5 block">
                    Cumulative time
                  </span>
                </div>

                {/* Humidity */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Relative Humidity (%RH)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={humidity}
                    onChange={(e) =>
                      setHumidity(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="w-full h-9 rounded border border-border bg-background px-3 font-mono text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                  <span className="font-mono text-[10px] text-muted-foreground mt-0.5 block">
                    Optional
                  </span>
                </div>

                {/* Days to Expiry */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Days to Expiry
                  </label>
                  <input
                    type="number"
                    value={daysToExpiry}
                    placeholder="365"
                    onChange={(e) =>
                      setDaysToExpiry(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="w-full h-9 rounded border border-border bg-background px-3 font-mono text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                  <span className="font-mono text-[10px] text-muted-foreground mt-0.5 block">
                    Shelf-life factor
                  </span>
                </div>
              </div>

              {/* Simulation Scenario Presets */}
              <div className="pt-3 border-t border-border space-y-2">
                <span className="font-mono text-[10px] uppercase text-muted-foreground font-semibold block">
                  Simulation Scenario Presets
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SIMULATION_SCENARIOS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => applyPreset(preset)}
                      className="px-2 py-1 rounded border border-border bg-background text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                      title={preset.tag}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Trigger */}
              <div className="pt-3 border-t border-border flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground">
                  Dual-Track Evaluation
                </span>
                <Button
                  variant="primary"
                  className="h-9 px-5 text-xs bg-primary text-primary-foreground font-bold shadow-2xs hover:bg-primary/90"
                  onClick={runAssessment}
                  disabled={assess.isPending || !medicineId}
                >
                  {assess.isPending ? "Evaluating…" : "Evaluate Excursion"}
                  <ArrowRight className="ml-1.5 size-3.5 text-mint" />
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column (7 Cols): Calibrated Spectrum Gauge & Results */}
          <div className="lg:col-span-7 space-y-6">
            {/* Stage 3: Calibrated Temperature Spectrum Gauge */}
            <div className="rounded border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border text-xs font-mono">
                <span className="font-bold uppercase tracking-wider text-primary">
                  Stage 03 • Calibrated Temperature Spectrum
                </span>
                <span className="text-foreground font-semibold">
                  Observed: <strong className="text-primary">{temperature}°C</strong>
                </span>
              </div>

              <div className="px-2 pt-2 space-y-2">
                <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                  <span>-10°C</span>
                  <span className="text-sky-800 font-bold">2°C</span>
                  <span className="text-primary font-bold">20°C–25°C</span>
                  <span>40°C</span>
                  <span>50°C</span>
                </div>

                {/* Calibrated Temperature Spectrum Bar */}
                <div className="relative h-6 w-full rounded bg-secondary overflow-hidden border border-border">
                  <div className="absolute left-0 top-0 bottom-0 w-[16.6%] bg-blue-100 border-r border-blue-200" />
                  <div className="absolute left-[20%] top-0 bottom-0 w-[10%] bg-sky-200/80 border-x border-sky-300" />
                  <div className="absolute left-[50%] top-0 bottom-0 w-[8.3%] bg-emerald-200/80 border-x border-emerald-300" />

                  {/* Observed Cursor Marker */}
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-coral shadow-md transition-all duration-300 z-10"
                    style={{
                      left: `${Math.min(Math.max(((temperature + 10) / 60) * 100, 2), 98)}%`,
                    }}
                  >
                    <div className="absolute -top-1 -translate-x-1/2 size-3 rounded-full bg-coral border-2 border-white shadow-xs" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-muted-foreground pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-blue-300" />
                    <span>Freeze Risk (&lt;0°C)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-sky-300" />
                    <span>Cold Chain (2°C–8°C)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-300" />
                    <span>Controlled Room Temp (20°C–25°C)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stage 4: Authoritative Dual-Track Evaluation Canvas */}
            {!result && !assess.isPending && (
              <div className="rounded border border-border bg-card p-12 text-center space-y-3">
                <Thermometer className="mx-auto size-10 text-muted-foreground" />
                <h3 className="font-head text-lg font-bold text-foreground">
                  Ready to Evaluate Excursion
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  Configure exposure parameters or select a scenario preset on the left, then click
                  &ldquo;Evaluate Excursion&rdquo; to test against monograph limits and the kinetic
                  GBDT model.
                </p>
              </div>
            )}

            {assess.isPending && (
              <div className="rounded border border-border bg-card p-12 text-center space-y-3">
                <div className="size-8 rounded-full border-2 border-mint border-t-transparent animate-spin mx-auto" />
                <p className="font-mono text-xs uppercase tracking-wider text-primary font-bold">
                  Evaluating Monograph Rules & GBDT Kinetic Model...
                </p>
              </div>
            )}

            {result && !assess.isPending && (
              <DualTrackResultsCanvas result={result} submitted={assess.variables!} />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function DualTrackResultsCanvas({
  result,
  submitted,
}: {
  result: StorageRiskResponse;
  submitted: StorageRiskRequest;
}) {
  const compliance = result.deterministic_compliance;
  const risk = result.ml_risk;
  const storage = result.storage_requirements;
  const riskTheme = risk.level ? RISK_THEMES[risk.level] : RISK_THEMES.LOW;

  const divergent = compliance.is_compliant === false && risk.level === "LOW";

  return (
    <div className="space-y-6">
      {/* Divergence Notification Callout */}
      {divergent && (
        <div className="rounded border border-warning/30 bg-warning/10 p-4 text-xs space-y-1.5">
          <div className="flex items-center gap-2 text-warning font-bold">
            <Info className="size-4 shrink-0" />
            <span>Dual-Track Divergence Detected</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            The observed conditions breached the documented USP boundary, causing deterministic
            compliance to FAIL. However, because exposure was short, the kinetic degradation model
            estimated LOW degradation. Deterministic compliance remains the binding release rule.
          </p>
        </div>
      )}

      {/* Dual Results Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Track A: Deterministic Rule Verdict */}
        <div className="rounded border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-foreground">
                Track A: Monograph Rules
              </span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">USP & DailyMed</span>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">Compliance:</span>
              <span
                className={cn(
                  "rounded px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase",
                  compliance.is_compliant
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800",
                )}
              >
                {compliance.is_compliant ? "Compliant (PASS)" : "Breached (FAIL)"}
              </span>
            </div>
            <h3 className="font-head text-base font-bold text-foreground mt-2">
              {compliance.summary}
            </h3>
          </div>

          <div className="rounded border border-border bg-background p-3 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Documented Limits:</span>
              <strong className="text-foreground">
                {storage.min_temperature !== null && storage.max_temperature !== null
                  ? `${storage.min_temperature}°C to ${storage.max_temperature}°C`
                  : "Advisory"}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Temperature Deviation:</span>
              <span
                className={
                  compliance.temp_deviation ? "text-coral font-bold" : "text-foreground font-medium"
                }
              >
                {compliance.temp_deviation ? `${compliance.temp_deviation}°C` : "0.0°C"}
              </span>
            </div>
          </div>
        </div>

        {/* Track B: Machine-Learning Kinetic Risk */}
        <div className={cn("rounded border p-5 space-y-4", riskTheme.border, riskTheme.bg)}>
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Brain className="size-4 text-primary" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-foreground">
                Track B: Kinetic ML Risk
              </span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">GradientBoosting</span>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">Degradation Risk:</span>
              <span
                className={cn(
                  "rounded px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase",
                  riskTheme.pill,
                )}
              >
                {risk.level ?? "UNAVAILABLE"}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className={cn("font-head text-2xl font-bold", riskTheme.text)}>
                {risk.level} RISK
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {risk.confidence !== null
                  ? `${formatPercent(risk.confidence, 1)} Confidence`
                  : "No estimate"}
              </span>
            </div>
          </div>

          {risk.probabilities && (
            <div className="space-y-1.5 pt-2 border-t border-border/60">
              {(["LOW", "MODERATE", "HIGH"] as const).map((lvl) => {
                const prob = risk.probabilities ? (risk.probabilities[lvl] ?? 0) : 0;
                return (
                  <div key={lvl} className="font-mono text-[10px]">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-muted-foreground">{lvl}</span>
                      <span className="text-foreground">{formatPercent(prob, 1)}</span>
                    </div>
                    <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", RISK_THEMES[lvl].pill)}
                        style={{ width: `${prob * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top Feature Importance Weights */}
      {risk.top_factors && risk.top_factors.length > 0 && (
        <div className="rounded border border-border bg-card p-5 space-y-3">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Top Driving Features in Degradation Estimation
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {risk.top_factors.slice(0, 4).map((factor) => (
              <div
                key={factor.feature}
                className="rounded border border-border bg-background p-2.5 space-y-1"
              >
                <div className="flex justify-between font-mono text-[10px]">
                  <strong className="text-foreground">{factor.feature_label}</strong>
                  <span className="text-primary font-bold">
                    {formatPercent(factor.importance_weight, 1)} weight
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {factor.interpretation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
