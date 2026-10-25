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

type AssessmentSearch = { medicine?: string | undefined };

export const Route = createFileRoute("/assessment")({
  validateSearch: (search: Record<string, unknown>): AssessmentSearch => ({
    medicine: typeof search["medicine"] === "string" ? search["medicine"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Storage Assessment — MediShelf AI" },
      {
        name: "description",
        content:
          "Dual-track storage excursion assessment: evaluate observed temperature exposures against pharmacopeial monograph bounds and kinetic degradation risk.",
      },
      { property: "og:title", content: "Storage Assessment — MediShelf AI" },
    ],
  }),
  component: AssessmentPage,
});

/** Authentic simulation scenario presets */
const SIMULATION_SCENARIOS = [
  {
    label: "Paracetamol: Controlled Room Temp (22°C)",
    medicine: "MED-001",
    temp: 22.0,
    hours: 0,
    humidity: 45,
    tag: "Within Specification",
  },
  {
    label: "Paracetamol: Transit Warmth (28°C, 6h)",
    medicine: "MED-001",
    temp: 28.0,
    hours: 6,
    humidity: 55,
    tag: "Permitted USP Excursion",
  },
  {
    label: "Humulin Insulin: Cold Chain (4°C)",
    medicine: "MED-014",
    temp: 4.0,
    hours: 0,
    humidity: 50,
    tag: "Within Cold Chain",
  },
  {
    label: "Humulin Insulin: Transit Excursion (12°C, 3h)",
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
    bg: "bg-mint/10",
    border: "border-mint/30",
    pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  MODERATE: {
    text: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  HIGH: {
    text: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    pill: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
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
        {/* =========================================================================
            HEADER & DUAL-TRACK ARCHITECTURE DISCLOSURE
           ========================================================================= */}
        <div className="border-b border-border pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-mint" />
              <span>Thermal Kinetic Compliance Workbench</span>
              <span>•</span>
              <span>Deterministic USP Monograph Rules + GBDT Kinetics</span>
            </div>
            <h1 className="font-head text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Storage Excursion & Kinetic Risk Studio
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl font-sans">
              Evaluate temperature excursions against official USP and DailyMed storage boundaries.
              Deterministic compliance rules and mathematical kinetic risk degradation are reported
              separately.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-8.5 px-3 text-xs border-border bg-card hover:bg-secondary font-medium"
              onClick={() => assess.reset()}
              disabled={!result && !assess.isPending}
            >
              <RotateCcw className="mr-1.5 size-3.5 text-muted-foreground" />
              <span>Reset Assessment</span>
            </Button>
          </div>
        </div>

        {/* =========================================================================
            MAIN WORKSPACE GRID (Left: Inputs & Presets, Right: Spectrum Gauge & Verdict)
           ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ── Left Column (5 Cols): Excursion Scenario Parameters ── */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5 shadow-xs">
              <div className="pb-3 border-b border-border">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary block">
                  Stage 01 • Target Medicine Specification
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select a medicine monograph to retrieve calibrated storage limits.
                </p>
              </div>

              {/* Medicine Autocomplete / Selector */}
              <div className="space-y-2">
                <label htmlFor="med-search" className="text-xs font-semibold text-foreground block">
                  Search Monograph
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    id="med-search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search 27k medicines (e.g. Insulin, Paracetamol)..."
                    className="w-full h-9 rounded-lg border border-border bg-background pl-8.5 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Live Autocomplete Dropdown */}
                {searchResults.length > 0 && (
                  <div className="rounded-lg border border-border bg-card p-1 shadow-lg max-h-48 overflow-y-auto space-y-0.5 z-20 relative">
                    {searchResults.map((med) => (
                      <button
                        key={med.medicine_id}
                        type="button"
                        onClick={() => {
                          setMedicineId(med.medicine_id);
                          setSearchQuery("");
                          setSearchResults([]);
                        }}
                        className="w-full text-left p-2 rounded-md hover:bg-secondary flex items-center justify-between text-xs"
                      >
                        <div className="truncate">
                          <strong className="text-foreground block truncate">{med.medicine_name}</strong>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {med.medicine_id} • {med.dosage_form}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-primary shrink-0 ml-2">
                          {med.storage_min_temperature != null
                            ? `${med.storage_min_temperature}–${med.storage_max_temperature}°C`
                            : "CRT"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Primary Curated Medicine Selector */}
                <div className="pt-1">
                  <select
                    value={medicineId}
                    onChange={(e) => {
                      setMedicineId(e.target.value);
                      assess.reset();
                    }}
                    aria-label="Select target medicine monograph"
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                  >
                    {medicines.data?.map((med) => (
                      <option key={med.medicine_id} value={med.medicine_id}>
                        {med.medicine_id}: {med.medicine_name} (
                        {med.storage_min_temperature !== null && med.storage_max_temperature !== null
                          ? `${med.storage_min_temperature}°C to ${med.storage_max_temperature}°C`
                          : "CRT"}
                        )
                      </option>
                    ))}
                  </select>
                </div>

                {/* Active Monograph Reference Card */}
                {selected && (
                  <div className="rounded-lg border border-border bg-background p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <strong className="text-foreground">{selected.medicine_name}</strong>
                      <span className={cn("font-bold", isColdChain ? "text-sky-700 dark:text-sky-300" : "text-primary")}>
                        {isColdChain ? "Strict Cold Chain" : "Controlled Room Temp"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                      <span>Monograph Limits:</span>
                      <strong className="text-foreground font-mono tnum">
                        {selected.storage_min_temperature !== null && selected.storage_max_temperature !== null
                          ? `${selected.storage_min_temperature}°C to ${selected.storage_max_temperature}°C`
                          : "20°C to 25°C"}
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Exposure Parameters (Temperature & Duration) */}
              <div className="space-y-4 pt-2 border-t border-border">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary block">
                  Stage 02 • Observed Excursion Parameters
                </span>

                {/* Temperature Slider & Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="temp-input" className="text-xs font-medium text-foreground">
                      Observed Temperature (°C)
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        id="temp-input"
                        type="number"
                        step={0.5}
                        value={temperature}
                        onChange={(e) => setTemperature(Number(e.target.value))}
                        className="w-16 h-7 rounded border border-border bg-background px-2 text-xs font-mono font-bold text-right text-foreground focus:outline-none focus:border-primary tnum"
                      />
                      <span className="font-mono text-xs text-muted-foreground">°C</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={-10}
                    max={50}
                    step={0.5}
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                    <span>-10°C (Freezing)</span>
                    <span>20°C (CRT)</span>
                    <span>50°C (Heat Breach)</span>
                  </div>
                </div>

                {/* Duration Slider & Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="hours-input" className="text-xs font-medium text-foreground">
                      Excursion Duration (Hours)
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        id="hours-input"
                        type="number"
                        min={0}
                        max={168}
                        step={1}
                        value={hours}
                        onChange={(e) => setHours(Math.max(0, Number(e.target.value)))}
                        className="w-16 h-7 rounded border border-border bg-background px-2 text-xs font-mono font-bold text-right text-foreground focus:outline-none focus:border-primary tnum"
                      />
                      <span className="font-mono text-xs text-muted-foreground">hrs</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={72}
                    step={1}
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                </div>

                {/* Optional Environmental Parameters */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label htmlFor="humidity-input" className="text-[11px] text-muted-foreground block">
                      Relative Humidity (%)
                    </label>
                    <input
                      id="humidity-input"
                      type="number"
                      min={0}
                      max={100}
                      placeholder="Optional"
                      value={humidity}
                      onChange={(e) => setHumidity(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:border-primary tnum"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="expiry-input" className="text-[11px] text-muted-foreground block">
                      Days to Expiry
                    </label>
                    <input
                      id="expiry-input"
                      type="number"
                      min={1}
                      placeholder="Optional"
                      value={daysToExpiry}
                      onChange={(e) => setDaysToExpiry(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:border-primary tnum"
                    />
                  </div>
                </div>
              </div>

              {/* Simulation Scenario Presets */}
              <div className="pt-3 border-t border-border space-y-2">
                <span className="font-mono text-[10px] uppercase text-muted-foreground font-semibold block">
                  Pre-Configured Scenario Presets
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SIMULATION_SCENARIOS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="px-2.5 py-1 rounded-md border border-border bg-background text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint transition-colors"
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
                  className="h-9 px-5 text-xs bg-primary text-primary-foreground font-semibold shadow-xs hover:bg-primary/90"
                  onClick={runAssessment}
                  disabled={assess.isPending || !medicineId}
                >
                  {assess.isPending ? "Evaluating…" : "Evaluate Excursion"}
                  <ArrowRight className="ml-1.5 size-3.5 text-mint" />
                </Button>
              </div>
            </div>
          </div>

          {/* ── Right Column (7 Cols): Spectrum Gauge & Reconciled Verdict ── */}
          <div className="lg:col-span-7 space-y-6">
            {/* Dynamic Calibrated Temperature Spectrum Gauge */}
            <div className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border text-xs font-mono">
                <span className="font-bold uppercase tracking-wider text-primary">
                  Calibrated Temperature Spectrum Gauge
                </span>
                <span className="text-foreground font-semibold">
                  Observed: <strong className="text-primary tnum">{temperature}°C</strong>
                </span>
              </div>

              <div className="px-1 pt-1 space-y-3">
                <div className="flex justify-between font-mono text-[10px] text-muted-foreground tnum">
                  <span>-10°C</span>
                  <span className={cn(isColdChain ? "text-sky-700 dark:text-sky-300 font-bold" : "")}>
                    {isColdChain ? "2°C–8°C (Cold Chain)" : "2°C"}
                  </span>
                  <span className={cn(!isColdChain ? "text-primary font-bold" : "")}>
                    {!isColdChain ? "20°C–25°C (CRT)" : "25°C"}
                  </span>
                  <span>40°C</span>
                  <span>50°C</span>
                </div>

                {/* Calibrated Spectrum Bar */}
                <div className="relative h-6 w-full rounded-md bg-secondary overflow-hidden border border-border">
                  {/* Freezing zone (-10 to 0) -> 0 to 16.6% */}
                  <div className="absolute left-0 top-0 bottom-0 w-[16.6%] bg-blue-100 dark:bg-blue-950/60 border-r border-blue-200 dark:border-blue-900" />
                  
                  {/* Cold chain zone (2 to 8) -> 20% to 30% */}
                  {isColdChain ? (
                    <div className="absolute left-[20%] top-0 bottom-0 w-[10%] bg-sky-200 dark:bg-sky-900/60 border-x border-sky-400" />
                  ) : (
                    /* Controlled room temperature zone (20 to 25) -> 50% to 58.3% */
                    <div className="absolute left-[50%] top-0 bottom-0 w-[8.3%] bg-emerald-200 dark:bg-emerald-900/60 border-x border-emerald-400" />
                  )}

                  {/* Observed Cursor Needle */}
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-destructive shadow-md transition-all duration-300 z-10"
                    style={{
                      left: `${Math.min(Math.max(((temperature + 10) / 60) * 100, 2), 98)}%`,
                    }}
                  >
                    <div className="absolute -top-1.5 -translate-x-1/2 size-3.5 rounded-full bg-destructive border-2 border-white shadow-xs" />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-muted-foreground pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-blue-300 dark:bg-blue-600" />
                    <span>Freeze Risk (&lt;0°C)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-sky-300 dark:bg-sky-600" />
                    <span>Cold Chain (2–8°C)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-300 dark:bg-emerald-600" />
                    <span>Room Temp (20–25°C)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-destructive" />
                    <span>Observed Marker</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Assessment Verdict Canvas */}
            {!result && !assess.isPending && (
              <div className="rounded-xl border border-border bg-card p-10 text-center space-y-3 shadow-xs">
                <Thermometer className="mx-auto size-10 text-muted-foreground" />
                <h3 className="font-head text-base font-bold text-foreground">
                  Ready to Evaluate Storage Excursion
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  Select a medicine monograph, set the observed exposure temperature and duration,
                  and click &ldquo;Evaluate Excursion&rdquo; to test against monograph limits and the
                  kinetic GBDT model.
                </p>
              </div>
            )}

            {assess.isPending && (
              <div className="rounded-xl border border-border bg-card p-12 text-center space-y-3 shadow-xs">
                <div className="size-8 rounded-full border-2 border-mint border-t-transparent animate-spin mx-auto" />
                <p className="font-mono text-xs uppercase tracking-wider text-primary font-bold">
                  Evaluating Monograph Compliance & GBDT Kinetic Model...
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

  const isDivergent = compliance.is_compliant === false && risk.level === "LOW";

  return (
    <div className="space-y-6">
      {/* Divergence Notification Callout */}
      {isDivergent && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-xs space-y-1.5 shadow-xs">
          <div className="flex items-center gap-2 text-warning font-bold">
            <Info className="size-4 shrink-0" />
            <span>Dual-Track Divergence Detected</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            The observed conditions breached the documented USP boundary, causing deterministic
            compliance to <strong>FAIL</strong>. However, because exposure was brief, the kinetic
            degradation model predicted LOW degradation probability. Deterministic USP compliance
            remains the binding release rule: <strong>an ML model estimate must never override a documented storage boundary violation</strong>.
          </p>
        </div>
      )}

      {/* Dual Results Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Track A: Deterministic Rule Verdict */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
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
              <span className="font-mono text-xs text-muted-foreground">Compliance Verdict:</span>
              <span
                className={cn(
                  "rounded px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase",
                  compliance.is_compliant
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
                )}
              >
                {compliance.is_compliant ? "Compliant (PASS)" : "Breached (FAIL)"}
              </span>
            </div>
            <h3 className="font-head text-base font-bold text-foreground mt-2">
              {compliance.summary}
            </h3>
          </div>

          <div className="rounded-lg border border-border bg-background p-3 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Documented Limits:</span>
              <strong className="text-foreground tnum">
                {storage.min_temperature !== null && storage.max_temperature !== null
                  ? `${storage.min_temperature}°C to ${storage.max_temperature}°C`
                  : "Standard Monograph CRT"}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Temperature Deviation:</span>
              <span
                className={cn(
                  "font-bold tnum",
                  compliance.temp_deviation ? "text-destructive" : "text-foreground font-medium",
                )}
              >
                {compliance.temp_deviation ? `${compliance.temp_deviation}°C` : "0.0°C"}
              </span>
            </div>
          </div>
        </div>

        {/* Track B: Machine-Learning Kinetic Risk */}
        <div className={cn("rounded-xl border p-5 space-y-4 shadow-xs", riskTheme.border, riskTheme.bg)}>
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Brain className="size-4 text-primary" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-foreground">
                Track B: Kinetic ML Risk
              </span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">GBDT Model</span>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">Degradation Estimate:</span>
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
              <span className="font-mono text-xs text-muted-foreground tnum">
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
                      <span className="text-foreground tnum">{formatPercent(prob, 1)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
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

      {/* Top Feature Importance Weights & Arrhenius Caveat */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Top Driving Features in Degradation Estimation
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            Feature Weights (15 Inputs)
          </span>
        </div>

        {risk.top_factors && risk.top_factors.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {risk.top_factors.slice(0, 4).map((factor) => (
              <div
                key={factor.feature}
                className="rounded-lg border border-border bg-background p-3 space-y-1"
              >
                <div className="flex justify-between font-mono text-[10px]">
                  <strong className="text-foreground">{factor.feature_label}</strong>
                  <span className="text-primary font-bold tnum">
                    {formatPercent(factor.importance_weight, 1)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {factor.interpretation}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Scientific Honesty Disclosure */}
        <div className="rounded-lg bg-secondary/50 p-3 text-[11px] text-muted-foreground leading-relaxed font-sans">
          <strong>Scientific Provenance Disclosure:</strong> Training labels for this degradation
          model were computed from simulated Arrhenius kinetics formulas across 6,000 scenario permutations.
          The reported 99.56% model accuracy reflects mathematical compliance with synthetic kinetics
          simulations, <em>not measured empirical physical stability trial outcomes</em>.
        </div>
      </div>
    </div>
  );
}
