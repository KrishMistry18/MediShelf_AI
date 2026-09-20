import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ExternalLink,
  FileText,
  ImagePlus,
  Info,
  RotateCcw,
  ScanLine,
  Thermometer,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageIntro } from "@/components/PageIntro";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { recordScan } from "@/lib/activity";
import {
  FUSION_LABELS,
  OCR_STATUS_LABELS,
  formatPercent,
  humanizeClassName,
  scanMedicineImage,
  type IdentificationStatus,
  type ScanResponse,
  type StructuredFields,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Scan Medicine — MediShelf AI" },
      {
        name: "description",
        content:
          "Run a real medicine package photo through the MobileNetV3 classifier and EasyOCR label reader.",
      },
      { property: "og:title", content: "Scan Medicine — MediShelf AI" },
      {
        property: "og:description",
        content: "Capture packaging and review visual and label-text evidence side by side.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScanPage,
});

const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/bmp"];

/** Benchmark photos served from public/samples/. */
const DEMO_SAMPLES = [
  {
    file: "paracetamol_sample.jpg",
    label: "Paracetamol 500 mg",
    detail: "Carton · room temperature",
  },
  { file: "humulin_sample.jpg", label: "Humulin R 100 U/mL", detail: "Vial · cold chain 2–8°C" },
  { file: "metformin_sample.jpg", label: "Metformin 500 mg", detail: "Blister · room temperature" },
  {
    file: "atorvastatin_sample.jpg",
    label: "Atorvastatin 20 mg",
    detail: "Blister · room temperature",
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

  const scan = useMutation({
    mutationFn: (payload: { file: File; threshold: number }) =>
      scanMedicineImage(payload.file, payload.threshold),
    onSuccess: (result, variables) => recordScan(variables.file.name, result),
  });

  // Object URLs leak until revoked, and a scan page invites repeated selection.
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
          `Image is ${(candidate.size / 1024 / 1024).toFixed(1)} MB. The limit is 15 MB.`,
        );
        return;
      }
      setLocalError(null);
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
        setLocalError(`Could not load the demo image /samples/${name}.`);
      }
    },
    [acceptFile],
  );

  const reset = () => {
    setFile(null);
    setLocalError(null);
    scan.reset();
  };

  const result = scan.data;

  return (
    <AppShell>
      <PageIntro
        eyebrow="Multimodal verification"
        title="Scan medicine"
        description="One photo, two independent readings: a MobileNetV3 classifier judges the package visually while EasyOCR reads the printed label. They are reconciled only after both have run."
        actions={
          <Button
            variant="outline"
            icon={<RotateCcw className="size-3.5" />}
            onClick={reset}
            disabled={!file && !result}
          >
            Reset
          </Button>
        }
      />

      <div className="grid grid-cols-12 gap-4 lg:gap-5">
        <section className="panel col-span-12 p-5 lg:col-span-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-head text-base">Package capture</h2>
            <span className="font-mono text-[10px] text-muted-foreground">
              JPG · PNG · WEBP · BMP · max 15 MB
            </span>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(event) => acceptFile(event.target.files?.[0])}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => acceptFile(event.target.files?.[0])}
          />

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              acceptFile(event.dataTransfer.files?.[0]);
            }}
            className={cn(
              "relative grid min-h-[360px] place-items-center overflow-hidden rounded-[6px] border border-dashed bg-secondary/50 transition-colors",
              dragging ? "border-accent bg-accent/5" : "border-foreground/20",
            )}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Selected medicine package awaiting verification"
                className="absolute inset-0 size-full object-contain p-4"
              />
            ) : (
              <div className="px-4 text-center">
                <ImagePlus className="mx-auto size-8 text-accent" />
                <p className="mt-3 text-sm font-medium">Place the medicine package in frame</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Sharp, evenly lit, label facing the camera. Drag an image here or pick one below.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button
                    icon={<Camera className="size-4" />}
                    onClick={() => cameraRef.current?.click()}
                  >
                    Use camera
                  </Button>
                  <Button
                    variant="outline"
                    icon={<Upload className="size-4" />}
                    onClick={() => inputRef.current?.click()}
                  >
                    Upload file
                  </Button>
                </div>
              </div>
            )}

            {scan.isPending && (
              <div className="absolute inset-0 grid place-items-center bg-background/90">
                <div className="px-6 text-center">
                  <ScanLine className="mx-auto size-8 animate-pulse text-accent" />
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em]">
                    Running classifier and label reader
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Text recognition runs on CPU and usually takes 5–15 seconds.
                  </p>
                </div>
              </div>
            )}
          </div>

          {file && (
            <p className="mt-3 truncate font-mono text-[10px] text-muted-foreground">
              {file.name} · {(file.size / 1024).toFixed(0)} KB
            </p>
          )}

          <div className="mt-4 border-t border-border pt-4">
            <label className="block">
              <span className="mb-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                <span>Confidence gate</span>
                <span className="text-foreground">{threshold.toFixed(2)}</span>
              </span>
              <input
                type="range"
                min={0.1}
                max={0.95}
                step={0.05}
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
                className="w-full accent-[var(--accent)]"
              />
            </label>
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
              A prediction is only treated as an identification above this softmax score. The
              trained default is 0.60; raising it trades recall for fewer wrong identifications.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {localError ? (
              <p className="text-[11px] text-destructive">{localError}</p>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                Images are sent to the local API and are not stored.
              </span>
            )}
            <Button
              variant="jade"
              disabled={!file || scan.isPending}
              onClick={() => file && scan.mutate({ file, threshold })}
            >
              {scan.isPending ? "Analysing…" : "Run verification"}
            </Button>
          </div>
        </section>

        <aside className="col-span-12 space-y-4 lg:col-span-5 lg:space-y-5">
          <section className="panel p-5">
            <h2 className="font-head text-base">Benchmark images</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Photos from the evaluation set. Useful for comparing behaviour on a class the model
              handles well against one it struggles with.
            </p>
            <div className="mt-4 grid gap-2">
              {DEMO_SAMPLES.map((sample) => (
                <button
                  key={sample.file}
                  className="flex items-center gap-3 rounded-[6px] border border-border p-2.5 text-left transition-colors hover:bg-secondary"
                  onClick={() => void loadSample(sample.file)}
                >
                  <img
                    src={`/samples/${sample.file}`}
                    alt=""
                    className="size-12 shrink-0 rounded-[4px] object-cover ring-1 ring-border"
                  />
                  <span className="min-w-0">
                    <strong className="block truncate text-[12px] font-medium">
                      {sample.label}
                    </strong>
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {sample.detail}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="panel p-5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-head text-base">Evidence</h2>
              {result && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  {result.inference_time_ms.toFixed(0)} ms
                </span>
              )}
            </div>

            {scan.isPending && <LoadingState label="Waiting on the inference API" />}

            {scan.isError && !scan.isPending && (
              <ErrorState
                error={scan.error}
                onRetry={() => file && scan.mutate({ file, threshold })}
                className="mt-3"
              />
            )}

            {!scan.isPending && !scan.isError && !result && (
              <EmptyState
                icon={<ScanLine />}
                title="No scan yet"
                description="Choose an image and run verification. Results appear here with the confidence behind each one."
              />
            )}

            {result && !scan.isPending && <EvidencePanel result={result} />}
          </section>
        </aside>

        {result && !scan.isPending && (
          <ScanDetail
            result={result}
            onAssess={(id) => navigate({ to: "/assessment", search: { medicine: id } })}
          />
        )}
      </div>
    </AppShell>
  );
}

/* ----------------------------- result views ----------------------------- */

function EvidencePanel({ result }: { result: ScanResponse }) {
  const quality = result.quality;
  const fusion = result.fusion;

  return (
    <div className="mt-4 space-y-4">
      {quality && !quality.is_acceptable && (
        <div className="rounded-[5px] border border-warning/30 bg-warning/10 p-3">
          <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-warning">
            <AlertTriangle className="size-3" /> Quality gate failed
          </p>
          <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed">
            {quality.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          {quality.recommendations.length > 0 && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              {quality.recommendations.join(" ")}
            </p>
          )}
        </div>
      )}

      <EvidenceBlock
        icon={result.is_confident ? <CheckCircle2 /> : <AlertTriangle />}
        label="Visual evidence · MobileNetV3"
        value={result.medicine?.medicine_name ?? humanizeClassName(result.predicted_class)}
        confidence={formatPercent(result.confidence, 1)}
        status={
          result.is_confident
            ? "Above gate"
            : `Below gate (${formatPercent(result.confidence_threshold, 0)})`
        }
        tone={result.is_confident ? "accent" : "warning"}
      />

      <EvidenceBlock
        icon={<FileText />}
        label="Label text · EasyOCR"
        value={
          result.ocr_status === "completed"
            ? (result.ocr?.fields.medicine_name.value ??
              result.ocr?.candidate_matches[0]?.medicine_name ??
              "No medicine name matched")
            : OCR_STATUS_LABELS[result.ocr_status]
        }
        confidence={
          result.ocr_status === "completed" ? `${result.ocr?.raw_text.length ?? 0} chars` : "—"
        }
        status={OCR_STATUS_LABELS[result.ocr_status]}
        tone={result.ocr_status === "completed" ? "accent" : "muted"}
      />

      {fusion && (
        <div
          className={cn(
            "rounded-[5px] border p-3",
            fusion.identification_status === "CONFIRMED"
              ? "border-accent/30 bg-accent/8"
              : fusion.identification_status === "DIVERGENT"
                ? "border-destructive/25 bg-destructive/5"
                : "border-warning/30 bg-warning/8",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p
              className={cn(
                "font-mono text-[9px] uppercase tracking-[0.15em]",
                fusion.identification_status === "CONFIRMED"
                  ? "text-accent"
                  : fusion.identification_status === "DIVERGENT"
                    ? "text-destructive"
                    : "text-warning",
              )}
            >
              Cross-check · {fusion.identification_status}
            </p>
            <span className="font-mono text-[10px] text-muted-foreground">
              agreement {formatPercent(fusion.agreement_score, 0)}
            </span>
          </div>
          <p className="mt-1 text-[12px] font-medium">
            {FUSION_LABELS[fusion.identification_status]}
          </p>
          {fusion.reasons[0] && (
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {fusion.reasons[0]}
            </p>
          )}
        </div>
      )}

      <p className="border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
        {result.message}
      </p>
    </div>
  );
}

function EvidenceBlock({
  icon,
  label,
  value,
  confidence,
  status,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  confidence: string;
  status: string;
  tone: "accent" | "warning" | "muted";
}) {
  const toneClass =
    tone === "accent"
      ? "text-accent"
      : tone === "warning"
        ? "text-warning"
        : "text-muted-foreground";
  return (
    <div className="border-b border-border pb-3 last:border-0 last:pb-0">
      <div className={cn("flex items-center gap-2 [&_svg]:size-3.5", toneClass)}>
        {icon}
        <span className="font-mono text-[9px] uppercase tracking-[0.15em]">{label}</span>
        <span className="ml-auto font-mono text-[10px]">{confidence}</span>
      </div>
      <p className="mt-1 text-[12px] font-medium">{value}</p>
      <span className={cn("mt-0.5 inline-block font-mono text-[9px] uppercase", toneClass)}>
        {status}
      </span>
    </div>
  );
}

function ScanDetail({
  result,
  onAssess,
}: {
  result: ScanResponse;
  onAssess: (medicineId: string) => void;
}) {
  const medicine = result.medicine;
  const storage = result.storage_requirements;

  return (
    <>
      <section className="panel col-span-12 p-5 lg:col-span-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-head text-base">Candidate ranking</h2>
          <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
            Top 3 of {result.top_predictions.length > 0 ? "10 classes" : "—"}
          </span>
        </div>

        <ol className="space-y-2.5">
          {result.top_predictions.map((prediction, index) => {
            const isTop = index === 0;
            const meetsGate = prediction.confidence >= result.confidence_threshold;
            return (
              <li key={prediction.class_name}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[12px]">
                    <span className="mr-1.5 font-mono text-[10px] text-muted-foreground">
                      {index + 1}
                    </span>
                    <strong className={cn(isTop ? "font-medium" : "font-normal")}>
                      {prediction.medicine_name ?? humanizeClassName(prediction.class_name)}
                    </strong>
                    {prediction.medicine_id && (
                      <span className="ml-1.5 font-mono text-[9px] text-muted-foreground">
                        {prediction.medicine_id}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-[11px]">
                    {formatPercent(prediction.confidence, 1)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-500",
                      meetsGate ? "bg-accent" : "bg-warning",
                    )}
                    style={{ width: `${Math.max(prediction.confidence * 100, 1.5)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>

        <div className="mt-4 flex gap-2 rounded-[5px] border border-border bg-secondary/40 p-3 text-[10px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3 shrink-0" />
          <span>
            On the held-out split this classifier picks the right medicine first 50% of the time but
            places it in the top three 80% of the time. Scan the whole list, not just the winner.
          </span>
        </div>
      </section>

      <section className="panel col-span-12 p-5 lg:col-span-5">
        <h2 className="mb-3 font-head text-base">Verified monograph</h2>
        {medicine && storage ? (
          <div className="space-y-3">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-accent">
                {medicine.medicine_id}
              </p>
              <p className="mt-0.5 text-[13px] font-medium">{medicine.medicine_name}</p>
              <p className="text-[11px] text-muted-foreground">
                {medicine.generic_name}
                {medicine.brand_name ? ` · ${medicine.brand_name}` : ""}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[5px] bg-border">
              {[
                ["Storage", `${storage.min_temperature}–${storage.max_temperature}°C`],
                ["Form", medicine.dosage_form],
                ["Strength", medicine.strength],
                ["Expiry warning", `${medicine.expiry_warning_days} days`],
              ].map(([key, value]) => (
                <div key={key} className="bg-background p-2.5">
                  <dt className="font-mono text-[9px] uppercase text-muted-foreground">{key}</dt>
                  <dd className="mt-0.5 text-[12px] font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            <Button
              variant="jade"
              className="w-full"
              icon={<Thermometer className="size-3.5" />}
              onClick={() => onAssess(medicine.medicine_id)}
            >
              Assess storage conditions
            </Button>

            <a
              href={medicine.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-accent"
            >
              {medicine.source} <ExternalLink className="size-3" />
            </a>
          </div>
        ) : (
          <EmptyState
            icon={<AlertTriangle />}
            title="No monograph attached"
            description={
              result.is_confident
                ? "The predicted class has no matching catalog record."
                : `Confidence stayed below the ${formatPercent(result.confidence_threshold, 0)} gate, so no monograph was retrieved. Retake the photo or look the medicine up in the library.`
            }
          />
        )}
      </section>

      <OcrPanel result={result} />
    </>
  );
}

const OCR_FIELD_LABELS: Array<[keyof StructuredFields, string]> = [
  ["medicine_name", "Medicine"],
  ["generic_name", "Generic name"],
  ["strength", "Strength"],
  ["dosage_form", "Dosage form"],
  ["batch_number", "Batch / lot"],
  ["expiry_date", "Expiry"],
  ["manufacturing_date", "Manufactured"],
  ["manufacturer", "Manufacturer"],
];

function OcrPanel({ result }: { result: ScanResponse }) {
  const ocr = result.ocr;
  const [showRaw, setShowRaw] = useState(false);

  const populated = useMemo(
    () => (ocr ? OCR_FIELD_LABELS.filter(([key]) => ocr.fields[key].value) : []),
    [ocr],
  );

  return (
    <section className="panel col-span-12 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-head text-base">Label text extraction</h2>
        <span
          className={cn(
            "status",
            result.ocr_status === "completed" ? "status-success" : "status-warning",
          )}
        >
          {OCR_STATUS_LABELS[result.ocr_status]}
        </span>
      </div>

      {result.ocr_status !== "completed" && (
        <div className="mb-4 rounded-[5px] border border-border bg-secondary/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
          {result.ocr_status === "unavailable" ? (
            <>
              The OCR engine is not loaded in this environment, so this scan rests on the visual
              model alone. Download the weights once with{" "}
              <code className="font-mono text-[10px]">
                python -c &quot;import easyocr; easyocr.Reader([&apos;en&apos;], gpu=False,
                download_enabled=True)&quot;
              </code>
              .
              {ocr?.error ? <span className="mt-1 block">Engine reported: {ocr.error}</span> : null}
            </>
          ) : (
            <>
              Text recognition was skipped because the image failed the quality gate. Reading a
              blurred or underexposed label produces plausible-looking but wrong characters, so the
              pipeline declines rather than guessing.
            </>
          )}
        </div>
      )}

      {ocr && result.ocr_status === "completed" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div>
            {populated.length > 0 ? (
              <dl className="grid gap-px overflow-hidden rounded-[5px] bg-border sm:grid-cols-2">
                {populated.map(([key, label]) => {
                  const field = ocr.fields[key];
                  return (
                    <div key={key} className="bg-background p-3">
                      <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                        {label}
                      </dt>
                      <dd className="mt-0.5 text-[12px] font-medium">{field.value}</dd>
                      {field.raw_text && field.raw_text !== field.value && (
                        <p className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground">
                          read as “{field.raw_text}”
                        </p>
                      )}
                    </div>
                  );
                })}
              </dl>
            ) : (
              <EmptyState
                icon={<FileText />}
                title="No structured fields recognised"
                description="Text was detected but none of it matched the expiry, batch, strength, or manufacturer patterns."
              />
            )}

            <button
              onClick={() => setShowRaw((value) => !value)}
              className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-accent"
            >
              {showRaw ? "Hide" : "Show"} raw recognised text ({ocr.raw_text.length} chars)
            </button>
            {showRaw && (
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-[5px] border border-border bg-secondary/40 p-3 font-mono text-[10px] leading-relaxed">
                {ocr.raw_text || "(empty)"}
              </pre>
            )}
          </div>

          <div>
            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Catalog matches from text
            </p>
            {ocr.candidate_matches.length > 0 ? (
              <ul className="space-y-2">
                {ocr.candidate_matches.map((candidate) => (
                  <li
                    key={candidate.medicine_id}
                    className="rounded-[5px] border border-border p-2.5"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <strong className="truncate text-[12px] font-medium">
                        {candidate.medicine_name}
                      </strong>
                      <span className="shrink-0 font-mono text-[10px] text-accent">
                        {formatPercent(candidate.similarity_score, 0)}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                      matched “{candidate.matched_token}”
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                No catalog entry was similar enough to the recognised text.
              </p>
            )}
          </div>
        </div>
      )}

      <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
        Cross-checking reports whether two independent readings of the same package agree. It is not
        a statement about product authenticity, potency, or safety. MediShelf AI is an educational
        prototype — verify the physical packaging and consult a pharmacist.
      </p>
    </section>
  );
}
