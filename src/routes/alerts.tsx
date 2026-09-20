import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  BellRing,
  Brain,
  CheckCircle2,
  ScanLine,
  ShieldCheck,
  Snowflake,
  Thermometer,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageIntro } from "@/components/PageIntro";
import { EmptyState } from "@/components/States";
import {
  clearActivity,
  isFlagged,
  useAssessmentHistory,
  useScanHistory,
  type AssessmentRecord,
  type ScanRecord,
} from "@/lib/activity";
import { formatPercent } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Storage Alerts — MediShelf AI" },
      {
        name: "description",
        content: "Storage boundary breaches and elevated risk estimates from this session.",
      },
      { property: "og:title", content: "Storage Alerts — MediShelf AI" },
      {
        property: "og:description",
        content: "Review boundary violations and model-estimated risk with their severity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const navigate = useNavigate();
  const assessments = useAssessmentHistory();
  const scans = useScanHistory();

  const flagged = assessments.filter(isFlagged);
  const lowConfidenceScans = scans.filter(
    (scan) => !scan.isConfident || scan.fusionStatus === "DIVERGENT" || !scan.qualityAcceptable,
  );

  const hasActivity = assessments.length > 0 || scans.length > 0;

  return (
    <AppShell>
      <PageIntro
        eyebrow="Exceptions register"
        title="Alerts"
        description="Everything here comes from assessments and scans you ran in this browser session. Nothing is pre-populated and nothing is sent to a server."
        actions={
          hasActivity ? (
            <Button
              variant="outline"
              icon={<Trash2 className="size-3.5" />}
              onClick={() => clearActivity()}
            >
              Clear session
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px] lg:gap-5">
        <div className="space-y-4 lg:space-y-5">
          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border p-4">
              <h2 className="font-head text-base">Storage exceptions</h2>
              <span
                className={cn("status", flagged.length > 0 ? "status-warning" : "status-success")}
              >
                {flagged.length > 0 ? `${flagged.length} open` : "none open"}
              </span>
            </div>

            {flagged.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck />}
                title={
                  assessments.length === 0 ? "No assessments run yet" : "Every assessment passed"
                }
                description={
                  assessments.length === 0
                    ? "Run a storage assessment and anything that breaches the documented limits or scores above LOW risk will be listed here."
                    : `All ${assessments.length} assessment${assessments.length === 1 ? "" : "s"} in this session stayed inside the monograph limits with LOW estimated risk.`
                }
                action={
                  <Button
                    variant="jade"
                    icon={<Thermometer className="size-3.5" />}
                    onClick={() => navigate({ to: "/assessment", search: { medicine: undefined } })}
                  >
                    Run an assessment
                  </Button>
                }
              />
            ) : (
              <div className="divide-y divide-border">
                {flagged.map((record) => (
                  <AssessmentAlert key={record.id} record={record} />
                ))}
              </div>
            )}
          </section>

          <section className="panel overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border p-4">
              <h2 className="font-head text-base">Scans needing review</h2>
              <span
                className={cn(
                  "status",
                  lowConfidenceScans.length > 0 ? "status-warning" : undefined,
                )}
              >
                {scans.length === 0
                  ? "no scans"
                  : `${lowConfidenceScans.length} of ${scans.length}`}
              </span>
            </div>

            {scans.length === 0 ? (
              <EmptyState
                icon={<ScanLine />}
                title="No scans in this session"
                description="Scans that fall below the confidence gate, fail the quality check, or where the two signals disagree get listed here for a second look."
                action={
                  <Button variant="outline" onClick={() => navigate({ to: "/scan" })}>
                    Scan a package
                  </Button>
                }
              />
            ) : lowConfidenceScans.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 />}
                title="All scans cleared the gate"
                description={`${scans.length} scan${scans.length === 1 ? "" : "s"} met the confidence threshold with acceptable image quality.`}
              />
            ) : (
              <div className="divide-y divide-border">
                {lowConfidenceScans.map((record) => (
                  <ScanAlert key={record.id} record={record} />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="panel h-fit p-5">
          <BellRing className="size-5 text-accent" />
          <h2 className="mt-3 font-head text-base">How alerts are raised</h2>

          <div className="mt-4 space-y-4 text-[11px] leading-relaxed">
            <div>
              <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                <ShieldCheck className="size-3" /> Boundary breach
              </p>
              <p className="mt-1 text-muted-foreground">
                A direct comparison against the monograph range. Deterministic, reproducible, and
                binding.
              </p>
            </div>

            <div>
              <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                <Brain className="size-3" /> Elevated risk estimate
              </p>
              <p className="mt-1 text-muted-foreground">
                The trained model scored MODERATE or HIGH degradation risk. Probabilistic, and
                derived from simulated scenarios.
              </p>
            </div>

            <div className="rounded-[5px] border border-border bg-secondary/50 p-3">
              <p className="text-muted-foreground">
                The two fire independently. A three-hour excursion breaches the limit while scoring
                LOW risk; a nearly expired product can score MODERATE while fully compliant.
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-border pt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            Session-scoped · no telemetry
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function AssessmentAlert({ record }: { record: AssessmentRecord }) {
  const severity = !record.isCompliant && record.riskLevel === "HIGH" ? "high" : "watch";
  const belowMinimum = record.temperature < Number(record.permittedRange.split("–")[0]);

  return (
    <article className="flex gap-4 p-4">
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-[5px]",
          severity === "high" ? "bg-destructive/12 text-destructive" : "bg-warning/15 text-warning",
        )}
      >
        {belowMinimum ? <Snowflake className="size-4" /> : <AlertTriangle className="size-4" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-[13px] font-medium">
            {record.medicineName}
            <span className="ml-1.5 font-mono text-[9px] text-muted-foreground">
              {record.medicineId}
            </span>
          </h3>
          <span
            className={cn(
              "status shrink-0",
              severity === "high" ? "status-danger" : "status-warning",
            )}
          >
            {severity === "high" ? "High" : "Watch"}
          </span>
        </div>

        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {record.temperature}°C held for {record.durationHours} h against a permitted{" "}
          {record.permittedRange}
          {record.tempCompliant ? "" : ` — ${record.tempDeviation}°C outside the range`}.
        </p>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-[0.12em]">
          <span className={record.isCompliant ? "text-accent" : "text-warning"}>
            compliance {record.isCompliant ? "pass" : "fail"}
          </span>
          <span
            className={
              record.riskLevel === "LOW"
                ? "text-accent"
                : record.riskLevel === "HIGH"
                  ? "text-destructive"
                  : "text-warning"
            }
          >
            ml risk {record.riskLevel} ({formatPercent(record.riskConfidence, 0)})
          </span>
          <span className="text-muted-foreground">{relativeTime(record.at)}</span>
        </div>
      </div>
    </article>
  );
}

function ScanAlert({ record }: { record: ScanRecord }) {
  const reason = !record.qualityAcceptable
    ? "Image failed the quality gate"
    : record.fusionStatus === "DIVERGENT"
      ? "Visual model and label text disagree"
      : `Confidence ${formatPercent(record.confidence, 0)} stayed below the ${formatPercent(record.threshold, 0)} gate`;

  return (
    <article className="flex gap-4 p-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-[5px] bg-secondary text-muted-foreground">
        <ScanLine className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="truncate text-[13px] font-medium">
            {record.medicineName ?? record.predictedClass}
          </h3>
          <span className="status">{record.fusionStatus ?? "UNCONFIRMED"}</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{reason}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
          <span className="truncate">{record.fileName}</span>
          <span>{record.latencyMs.toFixed(0)} ms</span>
          <span>{relativeTime(record.at)}</span>
        </div>
      </div>
    </article>
  );
}

function relativeTime(iso: string): string {
  const deltaMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} d ago`;
}
