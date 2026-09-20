import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Brain,
  Camera,
  CheckCircle2,
  FileText,
  ScanLine,
  ShieldCheck,
  Thermometer,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageIntro } from "@/components/PageIntro";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { isFlagged, useAssessmentHistory, useScanHistory } from "@/lib/activity";
import { formatPercent, OCR_STATUS_LABELS } from "@/lib/api";
import { useApiHealth, useCatalogCount, useModelsOverview } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Verification Desk — MediShelf AI" },
      {
        name: "description",
        content: "Medicine identification and storage-risk verification workspace.",
      },
      { property: "og:title", content: "Verification Desk — MediShelf AI" },
      {
        property: "og:description",
        content: "Review medicine evidence, monographs, and storage-risk signals.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Overview,
});

function Overview() {
  const navigate = useNavigate();

  const health = useApiHealth();
  const catalogCount = useCatalogCount();
  const models = useModelsOverview();
  const scans = useScanHistory();
  const assessments = useAssessmentHistory();

  const lastScan = scans[0];
  const openAlerts = assessments.filter(isFlagged).length;
  const offline = health.isError;

  return (
    <AppShell>
      <PageIntro
        eyebrow="Verification desk"
        title="Overview"
        description="Identify a medicine package, then check whether its storage conditions hold up against the documented limits."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/assessment", search: { medicine: undefined } })}
            >
              Assess storage
            </Button>
            <Button onClick={() => navigate({ to: "/scan" })}>Scan medicine</Button>
          </>
        }
      />

      {offline && (
        <ErrorState
          error={health.error}
          className="mb-4 lg:mb-5"
          onRetry={() => void health.refetch()}
        />
      )}

      <div className="grid grid-cols-12 gap-4 lg:gap-5">
        {/* Live counters, all sourced from the API rather than written into the markup. */}
        <div className="col-span-12 grid grid-cols-2 gap-px overflow-hidden rounded-[6px] bg-border ring-1 ring-border sm:grid-cols-4">
          <Stat
            label="Monographs"
            value={catalogCount.isSuccess ? String(catalogCount.data) : null}
            hint="FDA DailyMed / USP"
          />
          <Stat
            label="Vision classes"
            value={models.isSuccess ? String(models.data.vision.class_count ?? "—") : null}
            hint="Trained package types"
          />
          <Stat
            label="Open flags"
            value={String(openAlerts)}
            hint="This session"
            tone={openAlerts > 0 ? "warning" : "default"}
          />
          <Stat
            label="Risk model"
            value={
              models.isSuccess
                ? formatPercent(models.data.storage_risk.test_metrics.accuracy, 2)
                : null
            }
            hint="Simulated test split"
          />
        </div>

        <section className="panel col-span-12 p-5 lg:col-span-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-head text-[16px]">Last scan</h2>
            {lastScan && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {new Date(lastScan.at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>

          {lastScan ? (
            <div className="space-y-3">
              <Evidence
                label="Visual · MobileNetV3"
                value={lastScan.medicineName ?? lastScan.predictedClass.replace(/_/g, " ")}
                status={lastScan.isConfident ? "Above gate" : "Below gate"}
                tone={lastScan.isConfident ? "jade" : "amber"}
              />
              <Evidence
                label="Label text · EasyOCR"
                value={
                  lastScan.batchNumber || lastScan.expiryDate
                    ? [
                        lastScan.batchNumber ? `LOT ${lastScan.batchNumber}` : null,
                        lastScan.expiryDate ? `EXP ${lastScan.expiryDate}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : OCR_STATUS_LABELS[lastScan.ocrStatus]
                }
                status={lastScan.ocrStatus === "completed" ? "Read" : "No fields"}
                tone={lastScan.ocrStatus === "completed" ? "jade" : "amber"}
              />

              {lastScan.agreementScore !== null && (
                <div>
                  <div className="mb-1 flex justify-between font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                    <span>Cross-check agreement</span>
                    <span>{formatPercent(lastScan.agreementScore, 0)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-500"
                      style={{ width: `${Math.max(lastScan.agreementScore * 100, 1)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                <span className="truncate">{lastScan.fileName}</span>
                <span>{lastScan.latencyMs.toFixed(0)} ms</span>
                {lastScan.storageRange && <span>{lastScan.storageRange}</span>}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {lastScan.medicineId && (
                  <button
                    onClick={() =>
                      navigate({ to: "/assessment", search: { medicine: lastScan.medicineId! } })
                    }
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent"
                  >
                    Assess this medicine <ArrowRight className="size-3" />
                  </button>
                )}
                <button
                  onClick={() => navigate({ to: "/scan" })}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Scan again
                </button>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<ScanLine />}
              title="Nothing scanned yet"
              description="Run a scan and the evidence from the most recent one appears here."
              action={
                <Button
                  variant="jade"
                  icon={<Camera className="size-3.5" />}
                  onClick={() => navigate({ to: "/scan" })}
                >
                  Start a scan
                </Button>
              }
            />
          )}
        </section>

        <section className="panel col-span-12 flex flex-col p-5 lg:col-span-5">
          <h2 className="mb-3 font-head text-[16px]">Scan a package</h2>
          <button
            onClick={() => navigate({ to: "/scan" })}
            className="group grid min-h-36 flex-1 place-items-center rounded-[6px] border border-dashed border-foreground/20 bg-secondary/50 px-4 text-center transition-colors hover:border-accent hover:bg-accent/5"
          >
            <div>
              <Camera className="mx-auto mb-2 size-5 text-accent" />
              <p className="text-[13px] font-medium">Camera or file upload</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                JPG · PNG · WEBP · max 15 MB
              </p>
            </div>
          </button>
          <Button variant="jade" className="mt-3 w-full" onClick={() => navigate({ to: "/scan" })}>
            Start scan
          </Button>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            Inference runs on your machine through the local API. Images are not uploaded anywhere
            or retained.
          </p>
        </section>

        <section className="panel col-span-12 p-5 lg:col-span-7">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-head text-[16px]">Pipeline</h2>
            <span className={cn("status", offline ? "status-warning" : "status-success")}>
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  offline ? "bg-warning" : "pulse-dot bg-accent",
                )}
              />
              {offline ? "API unavailable" : "All stages available"}
            </span>
          </div>
          <div className="grid gap-px overflow-hidden rounded-[5px] bg-border sm:grid-cols-3">
            <Stage
              icon={<Camera />}
              title="Capture"
              detail="Camera or upload, with a blur and exposure gate before anything is read"
            />
            <Stage
              icon={<FileText />}
              title="Two readings"
              detail="A classifier judges the package; OCR reads the label. Neither sees the other's answer"
            />
            <Stage
              icon={<Thermometer />}
              title="Risk"
              detail="Monograph rules and the ML estimate are computed and reported separately"
            />
          </div>
        </section>

        <section className="panel col-span-12 p-5 lg:col-span-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-head text-[16px]">Session activity</h2>
            <span className={cn("status", openAlerts > 0 ? "status-warning" : undefined)}>
              {openAlerts > 0 ? `${openAlerts} flagged` : "nothing flagged"}
            </span>
          </div>

          {assessments.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck />}
              title="No assessments yet"
              description="Storage checks you run will be summarised here, with breaches and elevated risk called out."
              action={
                <Button
                  variant="outline"
                  icon={<Thermometer className="size-3.5" />}
                  onClick={() => navigate({ to: "/assessment", search: { medicine: undefined } })}
                >
                  Assess storage
                </Button>
              }
            />
          ) : (
            <>
              <div className="space-y-2">
                {assessments.slice(0, 4).map((record) => {
                  const flagged = isFlagged(record);
                  return (
                    <div
                      key={record.id}
                      className={cn(
                        "flex items-center gap-2 rounded-[4px] border px-2.5 py-2 text-[12px]",
                        flagged
                          ? "border-warning/25 bg-warning/8"
                          : "border-border bg-secondary/40",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          flagged ? "bg-warning" : "bg-accent",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate font-medium">
                          {record.medicineName}
                        </strong>
                        <span className="block text-[10px] text-muted-foreground">
                          {record.temperature}°C · {record.durationHours} h · permitted{" "}
                          {record.permittedRange}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "shrink-0 font-mono text-[10px]",
                          record.riskLevel === "LOW"
                            ? "text-accent"
                            : record.riskLevel === "HIGH"
                              ? "text-destructive"
                              : "text-warning",
                        )}
                      >
                        {record.riskLevel}
                      </span>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => navigate({ to: "/alerts" })}
                className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-accent"
              >
                Open alerts <ArrowRight className="size-3" />
              </button>
            </>
          )}

          <p className="mt-3 border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground">
            Compliance is deterministic. Degradation risk is a model estimate. They can disagree,
            and the compliance verdict is the binding one.
          </p>
        </section>

        {models.isSuccess && (
          <section className="panel col-span-12 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-head text-[16px]">Accuracy, stated plainly</h2>
              <button
                onClick={() => navigate({ to: "/models" })}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent"
              >
                Full benchmarks <ArrowRight className="size-3" />
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex gap-3">
                <ScanLine className="mt-0.5 size-4 shrink-0 text-accent" />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  <strong className="text-foreground">Package recognition is weak.</strong> Top-1
                  accuracy is {formatPercent(models.data.vision.test_metrics.top1_accuracy, 0)} and
                  top-3 is {formatPercent(models.data.vision.test_metrics.top3_accuracy, 0)} on{" "}
                  {models.data.vision.test_metrics.sample_count ?? "—"} held-out images. Read the
                  candidate list, never just the first result.
                </p>
              </div>
              <div className="flex gap-3">
                <Brain className="mt-0.5 size-4 shrink-0 text-accent" />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  <strong className="text-foreground">
                    Risk accuracy of{" "}
                    {formatPercent(models.data.storage_risk.test_metrics.accuracy, 2)} is not what
                    it looks like.
                  </strong>{" "}
                  Its labels come from a deterministic simulation, so the score measures how well
                  the model learned those rules — not real shelf-life outcomes.
                </p>
              </div>
            </div>
          </section>
        )}

        <p className="col-span-12 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
          MediShelf AI supports education and engineering research. It is not a clinical tool and
          must not guide medication decisions. Always verify packaging and consult a licensed
          pharmacist.
        </p>
      </div>
    </AppShell>
  );
}

/* ------------------------------ primitives ------------------------------ */

function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | null;
  hint: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="bg-background p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>
      {value === null ? (
        <Skeleton className="mt-1.5 h-6 w-14" />
      ) : (
        <p
          className={cn(
            "mt-0.5 font-head text-[20px]",
            tone === "warning" ? "text-warning" : undefined,
          )}
        >
          {value}
        </p>
      )}
      <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function Evidence({
  label,
  value,
  status,
  tone,
}: {
  label: string;
  value: string;
  status: string;
  tone: "jade" | "amber";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-[13px] font-medium">{value}</p>
      </div>
      <span
        className={cn("status shrink-0", tone === "jade" ? "status-success" : "status-warning")}
      >
        {tone === "jade" && <CheckCircle2 className="size-2.5" />}
        {status}
      </span>
    </div>
  );
}

function Stage({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="bg-background p-3 [&_svg]:mb-2.5 [&_svg]:size-4 [&_svg]:text-accent">
      <div>{icon}</div>
      <p className="text-[12px] font-medium">{title}</p>
      <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}
