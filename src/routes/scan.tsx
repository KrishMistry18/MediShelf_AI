import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Database,
  Edit2,
  ExternalLink,
  Eye,
  FileText,
  HelpCircle,
  ImagePlus,
  Info,
  Layers,
  Minus,
  Pill,
  RefreshCw,
  RotateCcw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Thermometer,
  Upload,
  UserCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { recordScan } from "@/lib/activity";
import {
  FUSION_LABELS,
  OCR_STATUS_LABELS,
  PRODUCT_STATUS_CONFIG,
  formatPercent,
  humanizeClassName,
  scanMedicineImage,
  type CandidateMatch,
  type IdentificationStatus,
  type ProductStatus,
  type ScanResponse,
  type StructuredFields,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Optical Packaging Scanner — MediShelf AI" },
      {
        name: "description",
        content:
          "Multimodal packaging intelligence workspace: MobileNetV3 visual classification, EasyOCR text extraction, and pharmacopeial concept arbitration.",
      },
    ],
  }),
  component: ScanPage,
});

const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/bmp"];

const BENCHMARK_SPECIMENS = [
  {
    file: "paracetamol_sample.jpg",
    label: "Paracetamol 500 mg",
    category: "Oral Solid • Room Temp",
    classDesc: "Blister Pack Tablet",
  },
  {
    file: "humulin_sample.jpg",
    label: "Humulin R 100 U/mL",
    category: "Biological • Cold Chain 2–8°C",
    classDesc: "Vial",
  },
  {
    file: "metformin_sample.jpg",
    label: "Metformin HCl 500 mg",
    category: "Oral Solid • Room Temp",
    classDesc: "Blister Pack Tablet",
  },
  {
    file: "atorvastatin_sample.jpg",
    label: "Atorvastatin 20 mg",
    category: "Oral Solid • DailyMed",
    classDesc: "Blister Pack Tablet",
  },
] as const;

function ScanPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.6);
  const [dragging, setDragging] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [userVerifiedNote, setUserVerifiedNote] = useState<string | null>(null);

  const scan = useMutation({
    mutationFn: (payload: { file: File; threshold: number }) =>
      scanMedicineImage(payload.file, payload.threshold),
    onSuccess: (result, variables) => {
      recordScan(variables.file.name, result);
      if (result.medicine?.medicine_id) {
        setSelectedCandidateId(result.medicine.medicine_id);
      }
    },
  });

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const acceptFile = useCallback(
    (candidate: File | undefined) => {
      if (!candidate) return;
      if (!ACCEPTED.includes(candidate.type)) {
        setLocalError(
          `${candidate.type || "That file type"} is not supported. Use JPEG, PNG, WebP, or BMP.`,
        );
        return;
      }
      if (candidate.size > MAX_BYTES) {
        setLocalError(
          `Image is ${(candidate.size / 1024 / 1024).toFixed(1)} MB. The maximum file size is 15 MB.`,
        );
        return;
      }
      setLocalError(null);
      setSelectedCandidateId(null);
      setUserVerifiedNote(null);
      scan.reset();
      setFile(candidate);
    },
    [scan],
  );

  const loadSample = useCallback(
    async (name: string) => {
      setLocalError(null);
      try {
        const response = await fetch(`/samples/${name}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        acceptFile(new File([blob], name, { type: blob.type || "image/jpeg" }));
      } catch {
        setLocalError(`Could not load benchmark sample /samples/${name}.`);
      }
    },
    [acceptFile],
  );

  const reset = () => {
    setFile(null);
    setLocalError(null);
    setSelectedCandidateId(null);
    setUserVerifiedNote(null);
    scan.reset();
  };

  const result = scan.data;

  const activeCandidate = useMemo(() => {
    if (!result) return null;
    if (selectedCandidateId && result.ocr?.candidate_matches) {
      const found = result.ocr.candidate_matches.find((c) => c.medicine_id === selectedCandidateId);
      if (found) return found;
    }
    return result.ocr?.candidate_matches?.[0] ?? null;
  }, [result, selectedCandidateId]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* =========================================================================
            HEADER & WORKSPACE CONTEXT
           ========================================================================= */}
        <div className="border-b border-border pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-mint" />
              <span>Multimodal Optical Laboratory</span>
              <span>•</span>
              <span>MobileNetV3 + EasyOCR CRAFT/CRNN</span>
            </div>
            <h1 className="font-head text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Packaging Scanner & Label Extraction
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl font-sans">
              Guided pharmaceutical packaging ingestion: visual candidate ranking, text token extraction,
              and cross-reconciliation against 27,326 DailyMed and RxNorm monographs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Softmax Confidence Gate Control */}
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-mono">
              <Sliders className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Gate:</span>
              <strong className="text-foreground">{threshold.toFixed(2)}</strong>
              <input
                type="range"
                min={0.1}
                max={0.95}
                step={0.05}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-16 accent-primary h-1 ml-1 cursor-pointer"
                title="Softmax classification confidence threshold gate"
              />
            </div>

            <Button
              variant="outline"
              className="h-8.5 px-3 text-xs border-border bg-card hover:bg-secondary font-medium"
              onClick={reset}
              disabled={!file && !result}
            >
              <RotateCcw className="mr-1.5 size-3.5 text-muted-foreground" />
              <span>Reset</span>
            </Button>
          </div>
        </div>

        {/* =========================================================================
            MAIN WORKSPACE GRID (Left: Ingestion & Benchmarks, Right: Evidence Panel)
           ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ── Left Column (5 Cols): Optical Capture Surface & Sample Benchmarks ── */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-muted-foreground uppercase tracking-wider font-semibold">
                  Optical Viewfinder
                </span>
                <span className="text-foreground">
                  {file ? `${(file.size / 1024).toFixed(0)} KB • ${file.name}` : "Ready"}
                </span>
              </div>

              {/* Hidden file and camera inputs */}
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED.join(",")}
                className="hidden"
                onChange={(e) => acceptFile(e.target.files?.[0])}
              />
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => acceptFile(e.target.files?.[0])}
              />

              {/* Capture Viewport with Reticle Overlay */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  acceptFile(e.dataTransfer.files?.[0]);
                }}
                className={cn(
                  "relative aspect-4/3 w-full rounded-lg border border-dashed transition-all flex flex-col items-center justify-center p-4 overflow-hidden",
                  dragging
                    ? "border-mint bg-mint/5"
                    : previewUrl
                      ? "border-border bg-muted/40"
                      : "border-border bg-background subtle-grid",
                )}
              >
                {/* Precision Reticle Calipers */}
                <div className="reticle-corner-tl" />
                <div className="reticle-corner-tr" />
                <div className="reticle-corner-bl" />
                <div className="reticle-corner-br" />

                {previewUrl ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={previewUrl}
                      alt="Packaging preview"
                      className="w-full h-full object-contain p-2"
                    />
                    {scan.isPending && <div className="scan-laser-line" />}
                  </div>
                ) : (
                  <div className="text-center px-4 space-y-3">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
                      <ImagePlus className="size-6 text-mint" />
                    </div>
                    <div>
                      <p className="font-head text-sm font-semibold text-foreground">
                        Position Medicine Packaging
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground max-w-xs leading-relaxed">
                        Drag and drop packaging image or click to capture. Ensure brand name,
                        strength, and dosage form are legible.
                      </p>
                    </div>
                    <div className="pt-2 flex flex-wrap justify-center gap-2">
                      <Button
                        variant="primary"
                        className="h-8.5 text-xs bg-primary text-primary-foreground font-medium"
                        onClick={() => cameraRef.current?.click()}
                      >
                        <Camera className="mr-1.5 size-3.5 text-mint" />
                        <span>Camera</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8.5 text-xs border-border bg-card hover:bg-secondary font-medium"
                        onClick={() => inputRef.current?.click()}
                      >
                        <Upload className="mr-1.5 size-3.5" />
                        <span>Select File</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Progressive Processing Overlay */}
                {scan.isPending && (
                  <div className="absolute inset-0 bg-background/95 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-30">
                    <div className="size-10 rounded-full border-2 border-mint border-t-transparent animate-spin mb-4" />
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                      Executing Multimodal Inference
                    </span>
                    <div className="mt-4 space-y-2 text-xs text-muted-foreground font-mono text-left max-w-xs">
                      <div className="flex items-center gap-2">
                        <Check className="size-3 text-mint" />
                        <span>OpenCV Quality & Blur Check</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check className="size-3 text-mint" />
                        <span>MobileNetV3 Feature Extraction</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-mint animate-pulse" />
                        <span className="text-foreground">EasyOCR Label Tokenization</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground/60">
                        <Minus className="size-3" />
                        <span>Catalogue Arbitration (27k Records)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Strip below capture surface */}
              <div className="pt-2 flex items-center justify-between border-t border-border">
                {file ? (
                  <Button
                    variant="outline"
                    className="h-8 text-xs border-border bg-background hover:bg-secondary"
                    onClick={() => inputRef.current?.click()}
                  >
                    <span>Change Image</span>
                  </Button>
                ) : (
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Accepts JPG, PNG, WEBP, BMP ≤ 15 MB
                  </span>
                )}

                <Button
                  variant="primary"
                  className="h-9 px-4 text-xs bg-primary text-primary-foreground font-semibold shadow-xs hover:bg-primary/90"
                  disabled={!file || scan.isPending}
                  onClick={() => file && scan.mutate({ file, threshold })}
                >
                  {scan.isPending ? "Analysing…" : "Run Inference"}
                  <ArrowRight className="ml-1.5 size-3.5" />
                </Button>
              </div>

              {localError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{localError}</span>
                </div>
              )}
            </div>

            {/* Optional Pre-Loaded Benchmark Specimens */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="font-mono text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Pre-Loaded Benchmark Examples
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">Optional Samples</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Test the recognition pipeline with authentic pharmaceutical packaging photographs:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {BENCHMARK_SPECIMENS.map((sample) => (
                  <button
                    key={sample.file}
                    onClick={() => void loadSample(sample.file)}
                    className="flex items-center gap-2.5 rounded-lg border border-border p-2 text-left bg-background hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint transition-colors"
                  >
                    <img
                      src={`/samples/${sample.file}`}
                      alt={sample.label}
                      className="size-11 rounded-md object-cover border border-border shrink-0"
                    />
                    <div className="min-w-0">
                      <strong className="block text-xs font-semibold text-foreground truncate">
                        {sample.label}
                      </strong>
                      <span className="block text-[10px] font-mono text-muted-foreground truncate">
                        {sample.classDesc}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right Column (7 Cols): Reconciled Evidence & Decision Panel ── */}
          <div className="lg:col-span-7 space-y-6">
            {!result && !scan.isPending && (
              <div className="rounded-xl border border-border bg-card p-10 text-center space-y-3 shadow-xs">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
                  <ScanLine className="size-6 text-mint" />
                </div>
                <h3 className="font-head text-lg font-bold text-foreground">
                  Awaiting Packaging Ingestion
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Provide an image or select a benchmark specimen to view visual classification
                  rankings, EasyOCR text tokens, and pharmacopeial concept resolution.
                </p>
              </div>
            )}

            {scan.isError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-3 shadow-xs">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="size-5" />
                  <h3 className="font-head text-base font-bold">Inference Error</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  The backend inference service returned an error. Ensure the FastAPI backend is
                  running at port 8000.
                </p>
                <Button
                  variant="outline"
                  className="h-8.5 text-xs border-border bg-card"
                  onClick={() => file && scan.mutate({ file, threshold })}
                >
                  <RefreshCw className="mr-1.5 size-3.5" />
                  <span>Retry Scan</span>
                </Button>
              </div>
            )}

            {result && !scan.isPending && (
              <ReconciledEvidenceCanvas
                result={result}
                activeCandidate={activeCandidate}
                selectedCandidateId={selectedCandidateId}
                userVerifiedNote={userVerifiedNote}
                onSelectCandidate={setSelectedCandidateId}
                onUserVerify={(note) => setUserVerifiedNote(note)}
                onAssess={(medicineId) =>
                  navigate({ to: "/assessment", search: { medicine: medicineId } })
                }
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/* ── Integrated Multi-Stream Evidence Canvas ────────────────────────── */

function ReconciledEvidenceCanvas({
  result,
  activeCandidate,
  selectedCandidateId,
  userVerifiedNote,
  onSelectCandidate,
  onUserVerify,
  onAssess,
}: {
  result: ScanResponse;
  activeCandidate: CandidateMatch | null;
  selectedCandidateId: string | null;
  userVerifiedNote: string | null;
  onSelectCandidate: (id: string) => void;
  onUserVerify: (note: string) => void;
  onAssess: (medicineId: string) => void;
}) {
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState("");

  const medicine = result.medicine;
  const storage = result.storage_requirements;
  const quality = result.quality;
  const status: ProductStatus = result.product_status ?? "UNKNOWN";
  const statusConfig = PRODUCT_STATUS_CONFIG[status];
  const kbCandidates = result.ocr?.candidate_matches ?? [];
  const visualPredictions = result.top_predictions ?? [];
  const provenance = result.provenance;

  const handoffId = selectedCandidateId ?? medicine?.medicine_id ?? kbCandidates[0]?.medicine_id;

  return (
    <div className="space-y-6">
      {/* 1. Primary Reconciled Decision Dossier */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "rounded px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider",
                statusConfig.badgeClass,
              )}
            >
              {statusConfig.label}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              Inference Latency: {result.inference_time_ms.toFixed(0)} ms
            </span>
          </div>

          <span className="font-mono text-xs font-semibold text-primary">
            Retrieval Score:{" "}
            {result.product_status === "IDENTIFIED" &&
            (result.retrieval_match_score ?? result.score_breakdown?.["text_identity_score"])
              ? formatPercent(
                  result.retrieval_match_score ??
                    result.score_breakdown?.["text_identity_score"] ??
                    0,
                  1,
                )
              : formatPercent(result.confidence, 1)}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="font-mono text-[10px] text-primary uppercase font-bold tracking-wider">
              {handoffId ?? "Unresolved Concept"}
            </span>
            <h2 className="font-head text-2xl font-bold text-foreground">
              {activeCandidate?.medicine_name ??
                medicine?.medicine_name ??
                humanizeClassName(result.predicted_class)}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-1">
              <span>
                Active Entity:{" "}
                <strong className="text-foreground">
                  {activeCandidate?.generic_name ?? medicine?.generic_name ?? "Not extracted"}
                </strong>
              </span>
              <span>•</span>
              <span>
                Strength:{" "}
                <strong className="text-foreground">
                  {activeCandidate?.strength ?? medicine?.strength ?? "Not specified"}
                </strong>
              </span>
              <span>•</span>
              <span>
                Form:{" "}
                <strong className="text-foreground">
                  {activeCandidate?.dosage_form ?? medicine?.dosage_form ?? "Package form"}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {handoffId && (
              <Button
                variant="primary"
                className="h-9 px-4 text-xs bg-primary text-primary-foreground font-semibold shadow-xs hover:bg-primary/90"
                onClick={() => onAssess(handoffId)}
              >
                <Thermometer className="mr-1.5 size-3.5 text-mint" />
                <span>Assess Storage</span>
                <ArrowRight className="ml-1 size-3" />
              </Button>
            )}

            <Button
              variant="outline"
              className="h-9 px-3 text-xs border-border bg-background hover:bg-secondary"
              onClick={() => setShowVerifyDialog(true)}
              title="Pharmacist manual verification of extracted packaging"
            >
              <UserCheck className="mr-1.5 size-3.5 text-muted-foreground" />
              <span>Verify</span>
            </Button>
          </div>
        </div>

        {userVerifiedNote && (
          <div className="rounded-lg border border-mint/40 bg-mint/10 p-3 text-xs text-forest flex items-start gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-mint mt-0.5" />
            <div>
              <strong>Pharmacist Verified:</strong> {userVerifiedNote}
            </div>
          </div>
        )}

        {/* Uncertainty or Divergence Warnings */}
        {(result.fusion?.identification_status === "DIVERGENT" ||
          result.identification_status === "DIVERGENT") && (
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning flex items-start gap-2.5">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <div>
              <strong>Modal Divergence Warning:</strong> Visual packaging classification differs
              from OCR extracted label text. Pharmacist manual verification is recommended before
              logging storage compliance.
            </div>
          </div>
        )}

        {quality && !quality.is_acceptable && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning flex items-start gap-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <div>
              <strong>Image Quality Notice:</strong> {quality.issues.join(". ")}
            </div>
          </div>
        )}

        {/* Scientific Honesty Notice */}
        <div className="rounded-lg bg-secondary/50 p-2.5 text-[11px] text-muted-foreground font-mono flex items-center justify-between">
          <span>Softmax model score: {formatPercent(result.confidence, 1)} (Ranking indicator, not clinical certainty)</span>
          <span className="text-foreground font-semibold">Pharmacopeial Checkpoint v3.1</span>
        </div>
      </div>

      {/* 2. Dual-Track Visual & OCR Evidence Streams */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Stream A: Visual Classifier Output */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Eye className="size-3.5 text-mint" />
              <span className="font-mono text-[10px] uppercase font-bold text-foreground">
                Visual Packaging Model
              </span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">MobileNetV3</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline text-xs">
              <span className="font-semibold text-foreground">
                {humanizeClassName(result.predicted_class)}
              </span>
              <span className="font-mono text-mint font-bold tnum">
                {formatPercent(result.confidence, 1)}
              </span>
            </div>
            <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-mint rounded-full"
                style={{ width: `${result.confidence * 100}%` }}
              />
            </div>
          </div>

          {visualPredictions.length > 1 && (
            <div className="pt-2 border-t border-border/60 space-y-1">
              <span className="font-mono text-[9px] uppercase text-muted-foreground block">
                Top Visual Alternatives
              </span>
              {visualPredictions.slice(1, 3).map((pred) => (
                <div
                  key={pred.class_name}
                  className="flex justify-between text-[11px] font-mono text-muted-foreground"
                >
                  <span>{humanizeClassName(pred.class_name)}</span>
                  <span className="tnum">{formatPercent(pred.confidence, 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stream B: EasyOCR Label Reader */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <ScanLine className="size-3.5 text-mint" />
              <span className="font-mono text-[10px] uppercase font-bold text-foreground">
                OCR Label Reader
              </span>
            </div>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold",
                result.ocr_status === "completed"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
              )}
            >
              {OCR_STATUS_LABELS[result.ocr_status]}
            </span>
          </div>

          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tokens Read:</span>
              <span className="text-foreground font-semibold">
                {result.ocr?.raw_text ? result.ocr.raw_text.split(/\s+/).length : 0} tokens
              </span>
            </div>
            {result.ocr?.fields.batch_number?.value && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Batch / Lot:</span>
                <span className="text-foreground font-semibold">{result.ocr.fields.batch_number.value}</span>
              </div>
            )}
            {result.ocr?.fields.expiry_date?.value && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expiry Label:</span>
                <span className="text-foreground font-semibold">{result.ocr.fields.expiry_date.value}</span>
              </div>
            )}
          </div>

          {result.ocr?.raw_text && (
            <div className="pt-2 border-t border-border/60">
              <span className="font-mono text-[9px] uppercase text-muted-foreground block mb-1">
                Extracted Text Snippet
              </span>
              <p className="font-mono text-[10px] bg-background p-2 rounded-md border border-border text-muted-foreground truncate">
                {result.ocr.raw_text}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Actionable Candidate Ranking Ledger */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="font-head text-base font-bold text-foreground">
              Candidate Concept Ranking
            </h3>
            <p className="text-xs text-muted-foreground">
              Select an alternative pharmacopeial candidate to switch target monograph:
            </p>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {kbCandidates.length} Matches Found
          </span>
        </div>

        {kbCandidates.length > 0 ? (
          <div className="space-y-2">
            {kbCandidates.slice(0, 5).map((cand, idx) => {
              const isSelected = cand.medicine_id === handoffId;
              return (
                <div
                  key={cand.medicine_id}
                  onClick={() => onSelectCandidate(cand.medicine_id)}
                  className={cn(
                    "rounded-lg border p-3 cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                    isSelected
                      ? "border-mint bg-mint/5"
                      : "border-border bg-background hover:border-primary/40",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        #{idx + 1}
                      </span>
                      <strong className="text-xs font-bold text-foreground truncate">
                        {cand.medicine_name}
                      </strong>
                      <span className="font-mono text-[9px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
                        {cand.medicine_id}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground font-mono">
                      {cand.generic_name && <span>{cand.generic_name}</span>}
                      {cand.strength && <span>• {cand.strength}</span>}
                      {cand.dosage_form && <span>• {cand.dosage_form}</span>}
                      {cand.source_name && <span>• {cand.source_name}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-xs font-bold text-primary tnum">
                      {formatPercent(cand.similarity_score, 1)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAssess(cand.medicine_id);
                      }}
                      className="px-2.5 py-1 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                    >
                      Audit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No direct matches above threshold in the 27,326 knowledge base.
          </div>
        )}
      </div>

      {/* 4. Documented Storage Boundaries Ribbon */}
      {medicine && storage && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Thermometer className="size-4 text-warning" />
              <h3 className="font-head text-base font-bold text-foreground">
                Documented Pharmacopeial Storage Boundaries
              </h3>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {provenance?.source_name ?? medicine.source}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg border border-border bg-background p-3">
              <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                Prescribed Temperature
              </span>
              <strong className="text-foreground text-sm font-semibold block mt-0.5">
                {storage.min_temperature != null && storage.max_temperature != null
                  ? `${storage.min_temperature}°C to ${storage.max_temperature}°C`
                  : "Not specified"}
              </strong>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                Regulatory Standards
              </span>
              <strong className="text-foreground text-sm font-semibold block mt-0.5">
                {storage.regulatory_source || "USP Monograph Specification"}
              </strong>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                Freeze Hazard
              </span>
              <strong
                className={cn(
                  "text-sm font-semibold block mt-0.5",
                  (storage.min_temperature != null && storage.min_temperature >= 2 && storage.max_temperature <= 8)
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {(storage.min_temperature != null && storage.min_temperature >= 2 && storage.max_temperature <= 8)
                  ? "CRITICAL FREEZE SENSITIVE (<0°C)"
                  : "Non-critical (Solid Matrix)"}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Manual Pharmacist Verification Dialog / Sheet */}
      {showVerifyDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-head text-base font-bold text-foreground">
                Pharmacist Verification Provenance
              </h3>
              <button
                onClick={() => setShowVerifyDialog(false)}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Record human pharmacist verification for this packaging classification. Provenance
              will be logged in your session audit ledger.
            </p>
            <textarea
              value={verifyNotes}
              onChange={(e) => setVerifyNotes(e.target.value)}
              placeholder="e.g. Verified brand name Paracetamol, 500mg blister pack packaging matches monograph MED-001..."
              className="w-full h-24 rounded-lg border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                className="h-8.5 px-3 text-xs"
                onClick={() => setShowVerifyDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="h-8.5 px-4 text-xs font-semibold"
                onClick={() => {
                  if (verifyNotes.trim()) {
                    onUserVerify(verifyNotes.trim());
                  }
                  setShowVerifyDialog(false);
                }}
              >
                Save Verification
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
