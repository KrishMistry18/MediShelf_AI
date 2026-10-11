import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Brain,
  Camera,
  CheckCircle2,
  FileText,
  ScanLine,
  ShieldCheck,
  Thermometer,
  AlertTriangle,
  BookOpen,
  Search,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageIntro } from "@/components/PageIntro";
import { EmptyState, ErrorState, Skeleton } from "@/components/States";
import { isFlagged, useAssessmentHistory, useScanHistory } from "@/lib/activity";
import { formatPercent, OCR_STATUS_LABELS } from "@/lib/api";
import { useApiHealth, useCatalogCount, useModelsOverview } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Workspace Overview — MediShelf AI" },
      {
        name: "description",
        content:
          "Medicine packaging verification, monograph lookup, and storage compliance workspace.",
      },
      { property: "og:title", content: "Workspace Overview — MediShelf AI" },
      {
        property: "og:description",
        content:
          "Access authentic medicine monographs and assess environmental storage conditions.",
      },
    ],
  }),
  component: WorkspaceOverview,
});

function WorkspaceOverview() {
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
        eyebrow="Clinical & Regulatory Workspace"
        title="Workspace Overview"
        description="Verify medicine packaging labels, search authoritative storage monographs, and evaluate temperature excursions against documented limits."
        actions={
          <>
            <Button
              variant="outline"
              icon={<Thermometer className="size-3.5 text-warning" />}
              onClick={() => navigate({ to: "/assessment", search: { medicine: undefined } })}
            >
              Assess Storage
            </Button>
            <Button
              icon={<Camera className="size-3.5" />}
              onClick={() => navigate({ to: "/scan" })}
            >
              Scan Medicine
            </Button>
          </>
        }
      />

      {offline && (
        <ErrorState error={health.error} className="mb-5" onRetry={() => void health.refetch()} />
      )}

      {/* Verified Core Operational Telemetry */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <div className="panel p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Catalogue Records
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-head text-2xl font-bold text-foreground">
              {catalogCount.isLoading
                ? "…"
                : catalogCount.isSuccess
                  ? Number(catalogCount.data).toLocaleString()
                  : "—"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {catalogCount.isError ? "Catalogue service unavailable" : "NLM RxNorm & FDA DailyMed"}
          </p>
        </div>

        <div className="panel p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Vision Classifier
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-head text-2xl font-bold text-foreground">
              {models.isLoading
                ? "…"
                : models.isSuccess
                  ? String(models.data.vision.class_count ?? 10)
                  : "—"}
            </span>
            <span className="text-[11px] font-medium text-accent">
              {models.isSuccess && models.data.vision.test_metrics.top1_accuracy
                ? `${(models.data.vision.test_metrics.top1_accuracy * 100).toFixed(1)}% Top-1`
                : models.isError
                  ? "Unavailable"
                  : "63.3% Top-1"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {models.isError ? "Model metadata unavailable" : "MobileNetV3-Small packaging"}
          </p>
        </div>

        <div className="panel p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            ML Storage Risk
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-head text-2xl font-bold text-foreground">
              {models.isLoading
                ? "…"
                : models.isSuccess
                  ? String(models.data.storage_risk.features.length)
                  : models.isError
                    ? "—"
                    : "15"}
            </span>
            <span className="text-[11px] font-medium text-accent">
              {models.isError ? "Unavailable" : "Features"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {models.isError ? "Risk model unavailable" : "GradientBoosting excursion model"}
          </p>
        </div>

        <div className="panel p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Session Alerts
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={cn(
                "font-head text-2xl font-bold",
                openAlerts > 0 ? "text-destructive" : "text-foreground",
              )}
            >
              {openAlerts}
            </span>
            {openAlerts > 0 && (
              <span className="text-[11px] font-medium text-destructive">Breaches</span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {openAlerts > 0 ? "Excursions requiring review" : "No active flags"}
          </p>
        </div>
      </div>

      {/* Primary Workspace Action Pathways */}
      <div className="mb-6 grid gap-4 md:grid-cols-3 lg:gap-5">
        <div className="panel flex flex-col justify-between p-5 transition-all hover:border-primary/40 hover:shadow-md">
          <div>
            <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-sage/60 text-primary">
              <ScanLine className="size-5" />
            </div>
            <h2 className="font-head text-base font-semibold text-foreground">
              Scan Medicine Packaging
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Capture or upload packaging. The multimodal pipeline runs OpenCV quality gating,
              MobileNetV3 visual classification, and EasyOCR text extraction.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-border">
            <Link
              to="/scan"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-accent transition-colors"
            >
              Open Scanner <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>

        <div className="panel flex flex-col justify-between p-5 transition-all hover:border-primary/40 hover:shadow-md">
          <div>
            <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-sage/60 text-primary">
              <BookOpen className="size-5" />
            </div>
            <h2 className="font-head text-base font-semibold text-foreground">
              Search 27,326 Medicines
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Explore authentic regulatory drug concepts from NLM RxNorm and curated monographs with
              verified storage limits, temperature ranges, and excursions.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-border">
            <Link
              to="/medicines"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-accent transition-colors"
            >
              Browse Library <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>

        <div className="panel flex flex-col justify-between p-5 transition-all hover:border-primary/40 hover:shadow-md">
          <div>
            <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-sage/60 text-primary">
              <Thermometer className="size-5" />
            </div>
            <h2 className="font-head text-base font-semibold text-foreground">
              Storage Risk Assessment
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Assess temperature, humidity, and excursion hours against official monographs.
              Compares rule compliance with ML risk classification.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-border">
            <Link
              to="/assessment"
              search={{ medicine: undefined }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-accent transition-colors"
            >
              Run Assessment <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Verification Presets / Samples */}
      <div className="panel mb-6 p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-head text-base font-semibold text-foreground">
              Rapid Demonstration Presets
            </h2>
            <p className="text-xs text-muted-foreground">
              Pre-calibrated test cases across room temperature and cold-chain formulations.
            </p>
          </div>
          <span className="hidden rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline-block">
            Verified FDA DailyMed Monograph Samples
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            onClick={() => navigate({ to: "/assessment", search: { medicine: "MED-001" } })}
            className="flex flex-col text-left p-3.5 rounded-lg border border-border bg-background hover:border-primary/50 transition-colors"
          >
            <span className="font-head text-xs font-bold text-foreground">Paracetamol 500mg</span>
            <span className="mt-0.5 text-[11px] text-muted-foreground">
              Controlled Room Temp: 20°C–25°C
            </span>
            <span className="mt-2 text-[10px] font-mono text-accent">Compliant at 22°C →</span>
          </button>

          <button
            onClick={() => navigate({ to: "/assessment", search: { medicine: "MED-014" } })}
            className="flex flex-col text-left p-3.5 rounded-lg border border-border bg-background hover:border-primary/50 transition-colors"
          >
            <span className="font-head text-xs font-bold text-foreground">Humulin R 100 U/mL</span>
            <span className="mt-0.5 text-[11px] text-muted-foreground">
              Strict Cold Chain: 2°C–8°C
            </span>
            <span className="mt-2 text-[10px] font-mono text-destructive">
              Breach at 9.2°C (3h) →
            </span>
          </button>

          <button
            onClick={() => navigate({ to: "/assessment", search: { medicine: "MED-006" } })}
            className="flex flex-col text-left p-3.5 rounded-lg border border-border bg-background hover:border-primary/50 transition-colors"
          >
            <span className="font-head text-xs font-bold text-foreground">Omeprazole 20mg</span>
            <span className="mt-0.5 text-[11px] text-muted-foreground">
              Delayed Release: 15°C–30°C
            </span>
            <span className="mt-2 text-[10px] font-mono text-accent">Dry Storage Check →</span>
          </button>

          <button
            onClick={() => navigate({ to: "/assessment", search: { medicine: "MED-004" } })}
            className="flex flex-col text-left p-3.5 rounded-lg border border-border bg-background hover:border-primary/50 transition-colors"
          >
            <span className="font-head text-xs font-bold text-foreground">Metformin 500mg</span>
            <span className="mt-0.5 text-[11px] text-muted-foreground">
              USP Standard: 20°C–25°C
            </span>
            <span className="mt-2 text-[10px] font-mono text-accent">
              Extended Excursion Test →
            </span>
          </button>
        </div>
      </div>

      {/* Recent Session History */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel p-5">
          <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
            <h2 className="font-head text-sm font-semibold text-foreground">Recent Scans</h2>
            <Link to="/scan" className="text-xs text-primary hover:text-accent font-medium">
              New Scan →
            </Link>
          </div>

          {scans.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <ScanLine className="mx-auto mb-2 size-6 text-muted-foreground/40" />
              No packaging scans performed in this session yet.
              <div className="mt-3">
                <Button
                  variant="outline"
                  className="text-xs h-8"
                  onClick={() => navigate({ to: "/scan" })}
                >
                  Scan First Medicine
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {scans.slice(0, 4).map((scan, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-xs"
                >
                  <div className="min-w-0 pr-3">
                    <p className="truncate font-medium text-foreground">
                      {scan.medicineName || scan.predictedClass}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {scan.at ? new Date(scan.at).toLocaleTimeString() : "Just now"} ·{" "}
                      {scan.ocrStatus}
                    </p>
                  </div>
                  <span className="status status-success font-mono shrink-0">
                    {scan.confidence
                      ? `${(scan.confidence * 100).toFixed(0)}% Visual`
                      : "Identified"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel p-5">
          <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
            <h2 className="font-head text-sm font-semibold text-foreground">
              Recent Storage Assessments
            </h2>
            <Link
              to="/assessment"
              search={{ medicine: undefined }}
              className="text-xs text-primary hover:text-accent font-medium"
            >
              New Assessment →
            </Link>
          </div>

          {assessments.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <Thermometer className="mx-auto mb-2 size-6 text-muted-foreground/40" />
              No environmental storage assessments recorded yet.
              <div className="mt-3">
                <Button
                  variant="outline"
                  className="text-xs h-8"
                  onClick={() => navigate({ to: "/assessment", search: { medicine: undefined } })}
                >
                  Run Assessment
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {assessments.slice(0, 4).map((a, i) => {
                const flagged = isFlagged(a);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-border p-3 text-xs"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="truncate font-medium text-foreground">
                        {a.medicineName || a.medicineId}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {a.temperature}°C for {a.durationHours}h · Risk {a.riskLevel || "N/A"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "status font-mono shrink-0",
                        flagged ? "status-danger" : "status-success",
                      )}
                    >
                      {flagged ? "Flagged Excursion" : "Compliant"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
