import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Brain,
  CheckCircle2,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Snowflake,
  Thermometer,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
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
      { title: "Session Excursion Audit — MediShelf AI" },
      {
        name: "description",
        content:
          "Audit trail of storage boundary violations and elevated degradation risks in this session.",
      },
      { property: "og:title", content: "Session Excursion Audit — MediShelf AI" },
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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── Ledger Header ────────────────────────────────────────────── */}
        <div className="border-b border-border pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-mint" />
              <span>Local Session Audit Ledger (Ephemeral sessionStorage)</span>
            </div>
            <h1 className="font-head text-3xl font-bold tracking-tight text-foreground">
              Excursion & Audit Exceptions
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl font-sans">
              Review storage boundary breaches, thermal stress events, and uncertain scans recorded
              during your active session. Data is private and retained only in your local browser.
            </p>
          </div>

          {hasActivity && (
            <Button
              variant="outline"
              className="h-8.5 px-3 text-xs border-border bg-card hover:bg-secondary shrink-0 font-medium"
              onClick={() => clearActivity()}
            >
              <Trash2 className="mr-1.5 size-3.5 text-muted-foreground" />
              <span>Clear Session Ledger</span>
            </Button>
          )}
        </div>

        {/* ── Main Ledger Grid ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Storage Boundary Violations (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border text-xs font-mono">
                <div className="flex items-center gap-2">
                  <Thermometer className="size-4 text-warning" />
                  <h2 className="font-head text-base font-bold text-foreground">
                    Storage Boundary Breaches
                  </h2>
                </div>
                <span
                  className={cn(
                    "rounded px-2 py-0.5 font-bold uppercase",
                    flagged.length > 0
                      ? "bg-rose-100 text-rose-800"
                      : "bg-emerald-100 text-emerald-800",
                  )}
                >
                  {flagged.length > 0 ? `${flagged.length} Breaches Logged` : "0 Flags"}
                </span>
              </div>

              {flagged.length === 0 ? (
                <div className="py-6 px-4 bg-background rounded border border-border/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="size-6 text-mint shrink-0" />
                    <div>
                      <h3 className="font-head text-sm font-bold text-foreground">
                        {assessments.length === 0
                          ? "No assessments conducted yet"
                          : "Zero Thermal Breaches"}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {assessments.length === 0
                          ? "Run an excursion evaluation to record temperature deviations."
                          : `All ${assessments.length} session assessments conformed to official monograph boundaries.`}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="h-8 text-xs border-border bg-card hover:bg-secondary shrink-0 font-medium"
                    onClick={() => navigate({ to: "/assessment", search: { medicine: undefined } })}
                  >
                    <span>Assess Excursion</span>
                    <ArrowRight className="ml-1 size-3" />
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {flagged.map((record) => (
                    <div key={record.id} className="py-3.5 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-xs font-bold text-foreground">
                            {record.medicineName}
                          </strong>
                          <span className="font-mono text-[10px] bg-secondary px-1.5 py-0.2 rounded text-muted-foreground">
                            {record.medicineId}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] font-mono text-muted-foreground">
                          Excursion: {record.temperature}°C for {record.durationHours}h •{" "}
                          <span
                            className={
                              record.isCompliant ? "text-mint font-bold" : "text-coral font-bold"
                            }
                          >
                            {record.isCompliant ? "COMPLIANT" : "BREACH"}
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        className="h-7 text-xs border-border bg-background hover:bg-secondary shrink-0"
                        onClick={() =>
                          navigate({
                            to: "/assessment",
                            search: { medicine: record.medicineId },
                          })
                        }
                      >
                        <span>Re-audit</span>
                        <ArrowRight className="ml-1 size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Flagged Optical Scans & Privacy Ledger (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border text-xs font-mono">
                <div className="flex items-center gap-2">
                  <ScanLine className="size-4 text-mint" />
                  <h2 className="font-head text-base font-bold text-foreground">
                    Scans Flagged for Review
                  </h2>
                </div>
                <span className="text-muted-foreground">
                  {lowConfidenceScans.length} of {scans.length}
                </span>
              </div>

              {scans.length === 0 ? (
                <div className="py-6 px-4 bg-background rounded border border-border/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-muted-foreground">
                    <strong className="block text-foreground font-head text-sm">
                      No packages scanned
                    </strong>
                    Scan packaging photos to audit label extraction quality.
                  </div>
                  <Button
                    variant="outline"
                    className="h-8 text-xs border-border bg-card hover:bg-secondary shrink-0 font-medium"
                    onClick={() => navigate({ to: "/scan" })}
                  >
                    <span>Scan Package</span>
                  </Button>
                </div>
              ) : lowConfidenceScans.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <CheckCircle2 className="size-4 text-mint" />
                  <span>All {scans.length} packaging scans cleared confidence gates cleanly.</span>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {lowConfidenceScans.map((scan) => (
                    <div key={scan.id} className="py-2.5 text-xs">
                      <div className="flex justify-between items-baseline font-mono text-[11px]">
                        <strong className="text-foreground">{scan.fileName}</strong>
                        <span className="text-amber font-bold">
                          {formatPercent(scan.confidence, 0)} Conf
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground font-mono">
                        {scan.predictedClass} •{" "}
                        {scan.fusionStatus ? `Fusion: ${scan.fusionStatus}` : "Quality Notice"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Privacy Transparency Notice */}
            <div className="rounded border border-border bg-muted/30 p-4 text-xs font-mono text-muted-foreground space-y-1">
              <span className="text-foreground font-bold text-[11px] block">
                Session Storage Ledger Scope
              </span>
              <p className="text-[10px] leading-relaxed">
                All records shown here are ephemeral client-side artifacts stored in your
                browser&apos;s sessionStorage. No personal data, package scans, or excursion inputs
                are persisted on remote servers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
