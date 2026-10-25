import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Brain,
  CheckCircle2,
  Clock,
  Info,
  RotateCcw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Thermometer,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
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
      { title: "Excursion & Audit Ledger — MediShelf AI" },
      {
        name: "description",
        content:
          "Audit trail of storage boundary violations, thermal stress excursions, and uncertain scans recorded in this browser session.",
      },
      { property: "og:title", content: "Excursion & Audit Ledger — MediShelf AI" },
    ],
  }),
  component: AlertsPage,
});

function AlertsPage() {
  const navigate = useNavigate();
  const assessments = useAssessmentHistory();
  const scans = useScanHistory();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const flaggedAssessments = assessments.filter(isFlagged);
  const lowConfidenceScans = scans.filter(
    (scan) => !scan.isConfident || scan.fusionStatus === "DIVERGENT" || !scan.qualityAcceptable,
  );

  const hasActivity = assessments.length > 0 || scans.length > 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* =========================================================================
            HEADER & SESSION STORAGE DISCLOSURE
           ========================================================================= */}
        <div className="border-b border-border pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-mint" />
              <span>Local Session Audit Ledger (sessionStorage)</span>
              <span>•</span>
              <span>Ephemeral Client Records</span>
            </div>
            <h1 className="font-head text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Excursion & Audit Exceptions Ledger
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl font-sans">
              Review flagged storage boundary breaches, thermal stress excursions, and scans
              requiring pharmacist verification recorded during your active session.
            </p>
          </div>

          {hasActivity && (
            <Button
              variant="outline"
              className="h-9 px-3.5 text-xs border-border bg-card hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 shrink-0 font-medium transition-colors"
              onClick={() => setShowClearConfirm(true)}
            >
              <Trash2 className="mr-1.5 size-3.5 text-muted-foreground group-hover:text-destructive" />
              <span>Clear Session Ledger</span>
            </Button>
          )}
        </div>

        {/* =========================================================================
            SESSION SCOPE DISCLOSURE BANNER
           ========================================================================= */}
        <div className="rounded-xl border border-border bg-card p-4 text-xs font-mono text-muted-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Info className="size-4 text-primary shrink-0" />
            <span className="text-foreground font-semibold">Persistence Scope: Active Tab Only</span>
            <span>—</span>
            <span>
              Records are held in browser <code className="bg-secondary px-1.5 py-0.5 rounded text-foreground">sessionStorage</code>. No data is stored in a remote cloud database.
            </span>
          </div>

          <span className="text-[11px] font-bold text-primary shrink-0">
            {assessments.length} Assessments • {scans.length} Scans Logged
          </span>
        </div>

        {/* =========================================================================
            AUDIT LEDGER GRID (Left: Storage Breaches, Right: Flagged Scans)
           ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ── Left Column (7 cols): Storage Boundary Violations ── */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border text-xs font-mono">
                <div className="flex items-center gap-2">
                  <Thermometer className="size-4 text-warning" />
                  <h2 className="font-head text-base font-bold text-foreground">
                    Storage Boundary Breaches
                  </h2>
                </div>
                <span
                  className={cn(
                    "rounded px-2.5 py-0.5 font-bold uppercase",
                    flaggedAssessments.length > 0
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                  )}
                >
                  {flaggedAssessments.length > 0
                    ? `${flaggedAssessments.length} Breaches Logged`
                    : "Zero Breaches"}
                </span>
              </div>

              {flaggedAssessments.length === 0 ? (
                <div className="py-8 px-6 bg-background rounded-lg border border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="size-10 rounded-full bg-mint/10 border border-mint/30 flex items-center justify-center shrink-0 text-mint">
                      <ShieldCheck className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-head text-sm font-bold text-foreground">
                        {assessments.length === 0
                          ? "No assessments evaluated yet"
                          : "All Evaluated Scenarios Compliant"}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {assessments.length === 0
                          ? "Run an excursion assessment to evaluate temperature breaches against monograph specifications."
                          : `All ${assessments.length} session storage assessments complied with documented USP envelopes.`}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="h-8.5 px-3.5 text-xs border-border bg-card hover:bg-secondary shrink-0 font-medium"
                    onClick={() => navigate({ to: "/assessment", search: { medicine: undefined } })}
                  >
                    <span>Assess Excursion</span>
                    <ArrowRight className="ml-1 size-3" />
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {flaggedAssessments.map((record) => {
                    const isFreeze = record.temperature < 0;
                    return (
                      <div
                        key={record.id}
                        className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <strong className="text-xs font-bold text-foreground">
                              {record.medicineName}
                            </strong>
                            <span className="font-mono text-[10px] bg-secondary px-2 py-0.5 rounded text-muted-foreground">
                              {record.medicineId}
                            </span>
                            {isFreeze && (
                              <span className="inline-flex items-center gap-1 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 px-1.5 py-0.5 font-mono text-[9px] font-bold">
                                <Snowflake className="size-2.5" />
                                <span>Freeze Hazard</span>
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-muted-foreground font-mono">
                            Observed: <strong className="text-foreground tnum">{record.temperature}°C</strong> for{" "}
                            <strong className="text-foreground tnum">{record.durationHours}h</strong> • Permitted:{" "}
                            {record.permittedRange}
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono pt-0.5">
                            <Clock className="size-3 text-muted-foreground" />
                            <span>
                              Recorded at {new Date(record.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span>•</span>
                            <span className="text-destructive font-bold uppercase">
                              {record.isCompliant ? "Compliant" : "USP Monograph Boundary Breach"}
                            </span>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          className="h-8 text-xs border-border bg-background hover:bg-secondary shrink-0 font-medium"
                          onClick={() =>
                            navigate({
                              to: "/assessment",
                              search: { medicine: record.medicineId },
                            })
                          }
                        >
                          <RotateCcw className="mr-1.5 size-3" />
                          <span>Re-audit</span>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Right Column (5 cols): Flagged Optical Scans & Review Notices ── */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
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
                <div className="py-6 px-4 bg-background rounded-lg border border-border text-center space-y-2">
                  <div className="text-xs text-muted-foreground">
                    <strong className="block text-foreground font-head text-sm">
                      No packaging scans ingested
                    </strong>
                    Scan packaging photos to audit label OCR and classification quality.
                  </div>
                  <Button
                    variant="outline"
                    className="h-8 text-xs border-border bg-card hover:bg-secondary font-medium"
                    onClick={() => navigate({ to: "/scan" })}
                  >
                    <span>Open Scanner</span>
                  </Button>
                </div>
              ) : lowConfidenceScans.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground space-y-1">
                  <CheckCircle2 className="size-5 text-mint mx-auto" />
                  <strong className="text-foreground block font-head text-sm">All Scans Verified</strong>
                  <p>All {scans.length} packaging scans cleared confidence gates without modal divergence.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {lowConfidenceScans.map((scan) => (
                    <div key={scan.id} className="py-3 text-xs space-y-1">
                      <div className="flex justify-between items-baseline font-mono text-[11px]">
                        <strong className="text-foreground truncate max-w-[200px]">{scan.fileName}</strong>
                        <span className="text-warning font-bold tnum">
                          {formatPercent(scan.confidence, 0)} Conf
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        Class: {scan.predictedClass} •{" "}
                        <span className="text-warning font-bold">
                          {scan.fusionStatus ? `Fusion: ${scan.fusionStatus}` : "Quality Notice"}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Privacy Transparency Notice */}
            <div className="rounded-xl border border-border bg-secondary/30 p-4 text-xs font-mono text-muted-foreground space-y-1.5 shadow-xs">
              <span className="text-foreground font-bold text-[11px] block">
                Session Storage Ledger Guarantee
              </span>
              <p className="text-[11px] leading-relaxed">
                All records shown here are ephemeral client-side artifacts stored exclusively in your
                browser&apos;s <code className="text-foreground">sessionStorage</code>. No medical records, package scans, or excursion inputs
                are transmitted or stored on remote servers.
              </p>
            </div>
          </div>
        </div>

        {/* Clear Confirmation Dialog */}
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-5" />
                <h3 className="font-head text-base font-bold">Clear Session Ledger?</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This will delete all recorded storage excursions and scan entries from your active
                browser session. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  className="h-8.5 px-3 text-xs"
                  onClick={() => setShowClearConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="h-8.5 px-4 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold"
                  onClick={() => {
                    clearActivity();
                    setShowClearConfirm(false);
                  }}
                >
                  Confirm Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
