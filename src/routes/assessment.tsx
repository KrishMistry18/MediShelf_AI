import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Brain,
  CheckCircle2,
  ExternalLink,
  Info,
  ShieldCheck,
  Snowflake,
  Thermometer,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageIntro } from "@/components/PageIntro";
import { EmptyState, ErrorState, LoadingState, Skeleton } from "@/components/States";
import { recordAssessment } from "@/lib/activity";
import {
  formatPercent,
  predictStorageRisk,
  type Medicine,
  type RiskLevel,
  type StorageRiskRequest,
  type StorageRiskResponse,
} from "@/lib/api";
import { useAllMedicines, useStorageRiskMetadata } from "@/lib/queries";
import { cn } from "@/lib/utils";

type AssessmentSearch = { medicine: string | undefined };

export const Route = createFileRoute("/assessment")({
  // Lets the scan page hand off a recognised medicine via /assessment?medicine=MED-014.
  validateSearch: (search: Record<string, unknown>): AssessmentSearch => ({
    medicine: typeof search["medicine"] === "string" ? search["medicine"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Storage Assessment — MediShelf AI" },
      {
        name: "description",
        content:
          "Compare observed storage conditions against monograph limits and a trained degradation-risk model.",
      },
      { property: "og:title", content: "Storage Assessment — MediShelf AI" },
      {
        property: "og:description",
        content: "Deterministic compliance and model-estimated risk, reported separately.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssessmentPage,
});

/** Starting points that exercise different parts of the model's response surface. */
const PRESETS = [
  { label: "Room temp, in range", medicine: "MED-001", temp: 22, hours: 0, humidity: 45 },
  { label: "Mild heat, 3 h", medicine: "MED-001", temp: 27, hours: 3, humidity: 55 },
  { label: "Cold-chain breach, 3 h", medicine: "MED-014", temp: 9.2, hours: 3, humidity: 50 },
  { label: "Insulin left in a car", medicine: "MED-014", temp: 35, hours: 24, humidity: 65 },
  { label: "Insulin frozen", medicine: "MED-014", temp: -5, hours: 12, humidity: 50 },
] as const;

const RISK_TONE: Record<RiskLevel, { text: string; bg: string; border: string; bar: string }> = {
  LOW: {
    text: "text-accent",
    bg: "bg-accent/8",
    border: "border-accent/30",
    bar: "bg-accent",
  },
  MODERATE: {
    text: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/35",
    bar: "bg-warning",
  },
  HIGH: {
    text: "text-destructive",
    bg: "bg-destructive/8",
    border: "border-destructive/30",
    bar: "bg-destructive",
  },
};

function AssessmentPage() {
  const search = Route.useSearch();

  const medicines = useAllMedicines();
  const metadata = useStorageRiskMetadata();

  const [medicineId, setMedicineId] = useState(search.medicine ?? "MED-014");
  const [temperature, setTemperature] = useState(9.2);
  const [hours, setHours] = useState(3);
  const [humidity, setHumidity] = useState<number | "">(50);
  const [daysToExpiry, setDaysToExpiry] = useState<number | "">("");

  // A medicine handed over from the scan page should replace the default selection.
  useEffect(() => {
    if (search.medicine) setMedicineId(search.medicine);
  }, [search.medicine]);

  const selected: Medicine | undefined = useMemo(
    () => medicines.data?.find((item) => item.medicine_id === medicineId),
    [medicines.data, medicineId],
  );

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
    // exactOptionalPropertyTypes: only attach optional keys when they hold a real value.
    if (humidity !== "") payload.current_humidity = humidity;
    if (daysToExpiry !== "") payload.days_to_expiry = daysToExpiry;
    assess.mutate(payload);
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setMedicineId(preset.medicine);
    setTemperature(preset.temp);
    setHours(preset.hours);
    setHumidity(preset.humidity);
    assess.reset();
  };

  const result = assess.data;

  return (
    <AppShell>
      <PageIntro
        eyebrow="Environment verification"
        title="Storage assessment"
        description="Two answers to two different questions: whether the conditions broke the documented limit, and how much degradation a trained model expects. They are computed independently and reported separately."
      />

      <section className="panel p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Medicine">
            {medicines.isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <select
                value={medicineId}
                onChange={(event) => {
                  setMedicineId(event.target.value);
                  assess.reset();
                }}
                className="field"
                disabled={!medicines.isSuccess}
              >
                {medicines.data?.map((item) => (
                  <option key={item.medicine_id} value={item.medicine_id}>
                    {item.medicine_name} · {item.storage_min_temperature}–
                    {item.storage_max_temperature}°C
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field
            label="Temperature °C"
            hint={
              selected
                ? `Permitted ${selected.storage_min_temperature}–${selected.storage_max_temperature}`
                : undefined
            }
          >
            <input
              type="number"
              step="0.5"
              min={-50}
              max={100}
              value={temperature}
              onChange={(event) => setTemperature(Number(event.target.value))}
              className="field font-mono"
            />
          </Field>

          <Field label="Exposure hours" hint="How long the condition held">
            <input
              type="number"
              min={0}
              max={1000}
              step="0.5"
              value={hours}
              onChange={(event) => setHours(Number(event.target.value))}
              className="field font-mono"
            />
          </Field>

          <Field label="Relative humidity %" hint="Optional">
            <input
              type="number"
              min={0}
              max={100}
              value={humidity}
              onChange={(event) =>
                setHumidity(event.target.value === "" ? "" : Number(event.target.value))
              }
              className="field font-mono"
            />
          </Field>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Days to expiry" hint="Optional — blank assumes 365">
            <input
              type="number"
              min={-3650}
              max={3650}
              value={daysToExpiry}
              onChange={(event) =>
                setDaysToExpiry(event.target.value === "" ? "" : Number(event.target.value))
              }
              className="field font-mono"
              placeholder="365"
            />
          </Field>

          <div className="lg:col-span-3">
            <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Scenario presets
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className="rounded-[4px] border border-border px-2.5 py-1.5 text-[11px] transition-colors hover:border-accent hover:bg-secondary"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="max-w-xl text-[11px] leading-relaxed text-muted-foreground">
            Values are entered by hand. This prototype has no sensor integration, so nothing here is
            live telemetry from a real storage location.
          </p>
          <Button variant="jade" onClick={runAssessment} disabled={assess.isPending || !medicineId}>
            {assess.isPending ? "Evaluating…" : "Run assessment"}
          </Button>
        </div>
      </section>

      {medicines.isError && (
        <ErrorState
          error={medicines.error}
          className="mt-5"
          onRetry={() => void medicines.refetch()}
        />
      )}

      {assess.isPending && (
        <section className="panel mt-5">
          <LoadingState label="Scoring conditions against the monograph and the model" />
        </section>
      )}

      {assess.isError && !assess.isPending && (
        <ErrorState error={assess.error} className="mt-5" onRetry={runAssessment} />
      )}

      {!assess.isPending && !assess.isError && !result && (
        <section className="panel mt-5">
          <EmptyState
            icon={<Thermometer />}
            title="No assessment yet"
            description="Pick a medicine and conditions, or start from a preset, then run the assessment."
          />
        </section>
      )}

      {result && !assess.isPending && assess.variables && (
        <AssessmentResult result={result} submitted={assess.variables} />
      )}

      {metadata.isSuccess && (
        <section className="panel mt-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-head text-[15px]">Model provenance</h2>
            <span className="status">{metadata.data.model_version}</span>
          </div>
          <div className="mt-3 grid gap-px overflow-hidden rounded-[5px] bg-border sm:grid-cols-3">
            <Cell label="Algorithm" value={metadata.data.algorithm} />
            <Cell label="Input features" value={String(metadata.data.features.length)} />
            <Cell label="Risk classes" value={metadata.data.target_classes.join(" · ")} />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            {metadata.data.disclaimer}
          </p>
        </section>
      )}
    </AppShell>
  );
}

function AssessmentResult({
  result,
  submitted,
}: {
  result: StorageRiskResponse;
  submitted: StorageRiskRequest;
}) {
  const compliance = result.deterministic_compliance;
  const risk = result.ml_risk;
  const storage = result.storage_requirements;
  const tone = RISK_TONE[risk.level];

  // The two verdicts answer different questions and routinely disagree: a brief excursion
  // breaches the documented limit while accumulating too little thermal stress to matter.
  // Saying so explicitly is the difference between a usable result and a confusing one.
  const divergent = !compliance.is_compliant && risk.level === "LOW";
  const belowMinimum = submitted.current_temperature < storage.min_temperature;

  return (
    <>
      {divergent && (
        <div className="mt-5 flex gap-3 rounded-[6px] border border-border bg-secondary/50 p-4">
          <Info className="mt-0.5 size-4 shrink-0 text-accent" />
          <div className="text-[11px] leading-relaxed">
            <p className="text-[12px] font-medium text-foreground">
              The two verdicts disagree, and that is expected here.
            </p>
            <p className="mt-1 text-muted-foreground">
              Conditions fell outside the documented range, so compliance fails — that is a hard
              rule and not negotiable. The model still estimates LOW degradation risk because it
              weighs deviation multiplied by duration, and {compliance.temp_deviation}°C held for{" "}
              {submitted.excursion_duration_hours} h accumulates little thermal stress. Treat the
              compliance result as the binding one.
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-3 lg:gap-5">
        <ResultCard
          icon={<Thermometer />}
          number="01"
          title="Documented limits"
          badge="Official monograph"
        >
          <Row
            label="Permitted range"
            value={`${storage.min_temperature}–${storage.max_temperature}°C`}
          />
          <Row label="Observed" value={`${submitted.current_temperature}°C`} />
          <Row label="Held for" value={`${submitted.excursion_duration_hours} h`} />
          <Row
            label="Humidity limits"
            value={
              storage.has_quantified_humidity
                ? `${storage.min_humidity ?? 0}–${storage.max_humidity}% RH`
                : "Not quantified"
            }
          />
          <Row label="Dosage form" value={result.medicine.dosage_form} />

          {!storage.has_quantified_humidity && (
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
              {storage.humidity_monograph_notice}
            </p>
          )}

          <a
            href={storage.source_url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-accent"
          >
            {storage.regulatory_source} <ExternalLink className="size-3" />
          </a>
        </ResultCard>

        <ResultCard
          icon={<ShieldCheck />}
          number="02"
          title="Boundary compliance"
          badge="Rule-based"
        >
          <div className={compliance.is_compliant ? "result-pass" : "result-warn"}>
            {compliance.is_compliant ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : belowMinimum ? (
              <Snowflake className="size-4 shrink-0" />
            ) : (
              <Thermometer className="size-4 shrink-0" />
            )}
            <strong>
              {compliance.is_compliant
                ? "Within range"
                : belowMinimum
                  ? "Below minimum temperature"
                  : "Above maximum temperature"}
            </strong>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            {compliance.summary}
          </p>

          {!compliance.temp_compliant && (
            <div className="mt-3 flex items-baseline justify-between rounded-[4px] bg-secondary/60 px-2.5 py-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                Deviation
              </span>
              <span className="font-mono text-[13px] font-medium">
                {compliance.temp_deviation}°C
              </span>
            </div>
          )}

          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
            {compliance.humidity_status_text}
          </p>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            This check is a direct comparison against the monograph. No model is involved, so the
            answer is reproducible and auditable.
          </p>
        </ResultCard>

        <ResultCard
          icon={<Brain />}
          number="03"
          title="Degradation risk"
          badge="ML estimate"
          className={cn(tone.border, tone.bg)}
        >
          <div className="flex items-end justify-between gap-2">
            <span className={cn("font-head text-3xl leading-none", tone.text)}>{risk.level}</span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {formatPercent(risk.confidence, 1)} confidence
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {(["LOW", "MODERATE", "HIGH"] as const).map((level) => {
              const probability = risk.probabilities[level] ?? 0;
              return (
                <div key={level}>
                  <div className="mb-1 flex justify-between font-mono text-[9px] uppercase tracking-[0.14em]">
                    <span
                      className={
                        level === risk.level ? RISK_TONE[level].text : "text-muted-foreground"
                      }
                    >
                      {level}
                    </span>
                    <span className="text-muted-foreground">{formatPercent(probability, 1)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-background">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-500",
                        RISK_TONE[level].bar,
                      )}
                      style={{ width: `${Math.max(probability * 100, 0.5)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-3 font-mono text-[9px] text-muted-foreground">
            {risk.model_name} · {risk.training_dataset_type}
          </p>
        </ResultCard>
      </div>

      <section className="panel mt-4 p-5 lg:mt-5">
        <h2 className="mb-1 font-head text-[15px]">What drove this estimate</h2>
        <p className="mb-4 text-[11px] text-muted-foreground">
          The model&apos;s five highest-weighted inputs, with the value each one took for this
          scenario. Weights are global to the trained model, not recomputed per prediction.
        </p>

        <div className="grid gap-px overflow-hidden rounded-[5px] bg-border">
          {risk.top_factors.map((factor) => (
            <div key={factor.feature} className="bg-background p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-[12px] font-medium">{factor.feature_label}</p>
                <span className="font-mono text-[10px] text-muted-foreground">
                  weight {formatPercent(factor.importance_weight, 1)}
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-accent/70"
                  style={{ width: `${Math.max(factor.importance_weight * 100, 0.5)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                {factor.interpretation}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
          {result.disclaimer}
        </p>
      </section>
    </>
  );
}

/* ------------------------------ primitives ------------------------------ */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-[11px] font-medium">
      <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block font-mono text-[9px] text-muted-foreground">{hint}</span>
      )}
    </label>
  );
}

function ResultCard({
  icon,
  number,
  title,
  badge,
  children,
  className,
}: {
  icon: React.ReactNode;
  number: string;
  title: string;
  badge: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-accent [&_svg]:size-4">
          {icon}
          <div>
            <p className="font-mono text-[9px] text-muted-foreground">{number}</p>
            <h2 className="font-head text-[15px] text-foreground">{title}</h2>
          </div>
        </div>
        <span className="status shrink-0">{badge}</span>
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border py-2 text-[11px] last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <strong className="text-right font-mono font-medium">{value}</strong>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-[12px] font-medium">{value}</p>
    </div>
  );
}
