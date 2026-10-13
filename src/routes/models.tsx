import { createFileRoute } from "@tanstack/react-router";
import {
  Brain,
  CheckCircle2,
  CircleAlert,
  Database,
  ExternalLink,
  FileText,
  FlaskConical,
  Layers,
  Scale,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ErrorState, LoadingState } from "@/components/States";
import { formatPercent, humanizeClassName, type ModelsOverview } from "@/lib/api";
import { useModelsOverview } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/models")({
  head: () => ({
    meta: [
      { title: "Model Insights & Validation Dossier — MediShelf AI" },
      {
        name: "description",
        content:
          "Empirical evaluation benchmarks, 10x10 confusion matrices, and scientific disclosures for MediShelf AI models.",
      },
      { property: "og:title", content: "Model Insights & Validation Dossier — MediShelf AI" },
    ],
  }),
  component: ModelsPage,
});

function ModelsPage() {
  const models = useModelsOverview();

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── Technical Research Header ────────────────────────────────── */}
        <div className="border-b border-border pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-mint" />
              <span>Verified Scientific Evaluation Dossier</span>
              <span>•</span>
              <span>Artifact Checkpoint v2.0</span>
            </div>
            <h1 className="font-head text-3xl font-bold tracking-tight text-foreground">
              Model Evaluation & Verification Dossier
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl font-sans">
              Empirical benchmarks loaded dynamically from artifact checkpoints on disk. Evaluated
              on 30 held-out packaging photographs (3 per class) and simulated kinetic stability
              scenarios.
            </p>
          </div>

          <div className="font-mono text-xs text-muted-foreground bg-card border border-border px-3.5 py-2 rounded shrink-0">
            <span className="text-foreground font-semibold">Checkpoint v2.0</span> • PyTorch &
            Scikit-Learn
          </div>
        </div>

        {models.isLoading && (
          <div className="py-16">
            <LoadingState label="Reading model checkpoints and verification artifacts from disk..." />
          </div>
        )}

        {models.isError && (
          <div className="py-8">
            <ErrorState error={models.error} onRetry={() => void models.refetch()} />
          </div>
        )}

        {models.isSuccess && <ModelsContent data={models.data} />}
      </div>
    </AppShell>
  );
}

function ModelsContent({ data }: { data: ModelsOverview }) {
  const { vision, storage_risk: risk } = data;
  const perClass = vision.test_metrics.per_class ?? {};
  const confusion = vision.test_metrics.confusion_matrix ?? [];
  const confusionLabels = vision.test_metrics.class_names ?? vision.class_names;

  return (
    <div className="space-y-10">
      {/* ── Model Identity & Typographic Metrics Ledger ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Model 1: Visual Packaging Classifier */}
        <div className="rounded border border-border bg-card p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded bg-primary/10 text-primary">
                <ScanLine className="size-5 text-mint" />
              </div>
              <div>
                <h2 className="font-head text-base font-bold text-foreground">
                  Visual Packaging Classifier
                </h2>
                <span className="font-mono text-[10px] text-muted-foreground">
                  MobileNetV3-Small • Input: 224x224 RGB
                </span>
              </div>
            </div>
            <span className="rounded bg-mint/10 text-mint px-2 py-0.5 font-mono text-[10px] font-bold">
              10 Classes
            </span>
          </div>

          {/* Metric Ledger */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded border border-border bg-background p-3.5">
              <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                Top-1 Accuracy
              </span>
              <strong className="font-head text-3xl font-bold text-foreground block mt-1">
                {formatPercent(vision.test_metrics.top1_accuracy, 1)}
              </strong>
              <span className="font-mono text-[10px] text-muted-foreground">
                {vision.test_metrics.top1_accuracy != null && vision.test_metrics.sample_count
                  ? `${Math.round(vision.test_metrics.top1_accuracy * vision.test_metrics.sample_count)} of ${vision.test_metrics.sample_count} test images`
                  : "Held-out test images"}
              </span>
            </div>

            <div className="rounded border border-border bg-background p-3.5">
              <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                Top-3 Accuracy
              </span>
              <strong className="font-head text-3xl font-bold text-foreground block mt-1">
                {formatPercent(vision.test_metrics.top3_accuracy, 1)}
              </strong>
              <span className="font-mono text-[10px] text-muted-foreground">
                {vision.test_metrics.top3_accuracy != null && vision.test_metrics.sample_count
                  ? `${Math.round(vision.test_metrics.top3_accuracy * vision.test_metrics.sample_count)} of ${vision.test_metrics.sample_count} test images`
                  : "Held-out test images"}
              </span>
            </div>

            <div className="rounded border border-border bg-background p-3.5">
              <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                Macro F1 Score
              </span>
              <strong className="font-head text-3xl font-bold text-foreground block mt-1">
                {(vision.test_metrics.macro_f1 ?? 0).toFixed(4)}
              </strong>
              <span className="font-mono text-[10px] text-muted-foreground">Balanced mean</span>
            </div>
          </div>

          <div className="rounded border border-border bg-background p-3.5 text-xs font-mono space-y-1.5 text-muted-foreground">
            <div className="flex justify-between">
              <span>Precision / Recall:</span>
              <span className="text-foreground">
                {vision.test_metrics.macro_precision != null && vision.test_metrics.macro_recall != null
                  ? `${vision.test_metrics.macro_precision.toFixed(4)} Macro Prec • ${vision.test_metrics.macro_recall.toFixed(4)} Macro Recall`
                  : "Balanced evaluation"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Test Set Protocol:</span>
              <span className="text-foreground">
                {vision.test_metrics.sample_count ?? 30} images (3 per class held-out)
              </span>
            </div>
            <div className="flex justify-between">
              <span>Finetune Epochs:</span>
              <span className="text-foreground">
                {String(vision.hyperparameters["finetune_epochs"] ?? "30")} epochs
              </span>
            </div>
          </div>
        </div>

        {/* Model 2: Storage-Risk Classifier */}
        <div className="rounded border border-border bg-card p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded bg-primary/10 text-primary">
                <Brain className="size-5 text-mint" />
              </div>
              <div>
                <h2 className="font-head text-base font-bold text-foreground">
                  Storage-Risk Degradation Model
                </h2>
                <span className="font-mono text-[10px] text-muted-foreground">
                  GradientBoostingClassifier • 15 Kinetic Features
                </span>
              </div>
            </div>
            <span className="rounded bg-sky-100 text-sky-800 px-2 py-0.5 font-mono text-[10px] font-bold">
              3 Risk Levels
            </span>
          </div>

          {/* Metric Ledger */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded border border-border bg-background p-3.5">
              <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                Test Accuracy
              </span>
              <strong className="font-head text-3xl font-bold text-foreground block mt-1">
                {formatPercent(risk.test_metrics.accuracy, 2)}
              </strong>
              <span className="font-mono text-[10px] text-muted-foreground">
                Simulation benchmark
              </span>
            </div>

            <div className="rounded border border-border bg-background p-3.5">
              <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                Macro F1 Score
              </span>
              <strong className="font-head text-3xl font-bold text-foreground block mt-1">
                {(risk.test_metrics.macro_f1 ?? 0).toFixed(4)}
              </strong>
              <span className="font-mono text-[10px] text-muted-foreground">3 risk classes</span>
            </div>

            <div className="rounded border border-border bg-background p-3.5">
              <span className="font-mono text-[10px] uppercase text-muted-foreground block">
                Evaluated Scenarios
              </span>
              <strong className="font-head text-3xl font-bold text-foreground block mt-1">
                {(risk.dataset_samples ?? 0).toLocaleString()}
              </strong>
              <span className="font-mono text-[10px] text-muted-foreground">Synthetic dataset</span>
            </div>
          </div>

          <div className="rounded border border-border bg-background p-3.5 text-xs font-mono space-y-1.5 text-muted-foreground">
            <div className="flex justify-between">
              <span>Dataset Split:</span>
              <span className="text-foreground">
                {risk.splits["train_samples"] ?? 4199} train • {risk.splits["test_samples"] ?? 900}{" "}
                test
              </span>
            </div>
            <div className="flex justify-between">
              <span>Target Classes:</span>
              <span className="text-foreground">{risk.target_classes.join(" • ")}</span>
            </div>
            <div className="flex justify-between">
              <span>Evaluation Base:</span>
              <span className="text-foreground">Simulated thermal kinetics</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Scientific Truth & Methodological Boundaries ─────────────── */}
      <div className="rounded border border-warning/30 bg-warning/10 p-5 text-xs leading-relaxed space-y-2">
        <div className="flex items-center gap-2 text-warning font-bold">
          <CircleAlert className="size-4 shrink-0" />
          <span>Scientific Disclosure & Methodological Limitations</span>
        </div>
        <ul className="space-y-1.5 text-foreground/85 list-disc list-inside pt-1">
          {data.limitations.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>

      {/* ── Per-Class Results & Degradation Feature Importance ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Per-Class Vision Ledger */}
        <div className="rounded border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <h3 className="font-head text-base font-bold text-foreground">
                Per-Class Vision Performance
              </h3>
              <p className="text-xs text-muted-foreground">
                Held-out test split (3 images per class across 10 classes)
              </p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">n=30</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-border text-[10px] text-muted-foreground uppercase">
                <tr>
                  <th className="pb-2 font-normal">Class Name</th>
                  <th className="pb-2 font-normal">Precision</th>
                  <th className="pb-2 font-normal">Recall</th>
                  <th className="pb-2 font-normal">F1 Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {Object.entries(perClass).map(([cls, scores]) => (
                  <tr key={cls}>
                    <td className="py-2 font-sans font-medium text-foreground">
                      {humanizeClassName(cls)}
                    </td>
                    <td className="py-2 text-muted-foreground">{scores.precision.toFixed(2)}</td>
                    <td className="py-2 text-muted-foreground">{scores.recall.toFixed(2)}</td>
                    <td className="py-2">
                      <span
                        className={cn(
                          "font-bold",
                          scores["f1-score"] >= 0.7
                            ? "text-mint"
                            : scores["f1-score"] > 0
                              ? "text-amber"
                              : "text-coral",
                        )}
                      >
                        {scores["f1-score"].toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Degradation Feature Importance */}
        <div className="rounded border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <h3 className="font-head text-base font-bold text-foreground">
                Degradation Feature Importance
              </h3>
              <p className="text-xs text-muted-foreground">
                Normalized global feature weights in the fitted GradientBoosting model
              </p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">15 Features</span>
          </div>

          <div className="space-y-3">
            {Object.entries(risk.feature_importances)
              .slice(0, 7)
              .map(([feat, wt]) => (
                <div key={feat} className="text-xs font-mono space-y-1">
                  <div className="flex justify-between">
                    <span className="text-foreground">{feat}</span>
                    <span className="text-primary font-bold">{formatPercent(wt, 2)}</span>
                  </div>
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.max(wt * 100, 1)}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>

          <p className="pt-3 border-t border-border text-[11px] text-muted-foreground leading-relaxed">
            Cumulative excursion duration and temperature deviation account for the vast majority of
            model decision splits, matching physical Arrhenius kinetics.
          </p>
        </div>
      </div>

      {/* ── Visual Confusion Matrix Grid ────────────────────────────── */}
      {confusion.length > 0 && (
        <div className="rounded border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <h3 className="font-head text-base font-bold text-foreground">
                Vision Confusion Matrix (10x10)
              </h3>
              <p className="text-xs text-muted-foreground">
                Rows = Ground Truth Class • Columns = Predicted Class
              </p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">Diagonal = Correct</span>
          </div>

          <div className="overflow-x-auto pt-1">
            <ConfusionMatrixGrid matrix={confusion} labels={confusionLabels} />
          </div>
        </div>
      )}
    </div>
  );
}

function ConfusionMatrixGrid({ matrix, labels }: { matrix: number[][]; labels: string[] }) {
  const maxVal = Math.max(...matrix.flat(), 1);

  return (
    <div className="min-w-[640px] text-xs font-mono">
      <div className="grid grid-cols-[160px_repeat(10,1fr)] gap-1 items-center pb-2 border-b border-border text-[9px] text-muted-foreground">
        <div>Ground Truth</div>
        {labels.map((l, i) => (
          <div key={l} className="text-center font-bold" title={humanizeClassName(l)}>
            C{i}
          </div>
        ))}
      </div>

      <div className="space-y-1 mt-1.5">
        {matrix.map((row, rIdx) => (
          <div
            key={labels[rIdx] ?? rIdx}
            className="grid grid-cols-[160px_repeat(10,1fr)] gap-1 items-center"
          >
            <div
              className="truncate text-[10px] text-foreground font-sans pr-2"
              title={humanizeClassName(labels[rIdx] ?? "")}
            >
              {humanizeClassName(labels[rIdx] ?? "")}
            </div>
            {row.map((val, cIdx) => {
              const isDiagonal = rIdx === cIdx;
              const hasCount = val > 0;

              return (
                <div
                  key={`${rIdx}-${cIdx}`}
                  className={cn(
                    "h-8 rounded flex items-center justify-center font-bold text-xs transition-colors",
                    isDiagonal && hasCount
                      ? "bg-mint/20 text-forest border border-mint/40"
                      : !isDiagonal && hasCount
                        ? "bg-coral/20 text-coral border border-coral/30"
                        : "bg-muted/30 text-muted-foreground/40",
                  )}
                  title={`True: ${humanizeClassName(labels[rIdx] ?? "")} -> Pred: ${humanizeClassName(labels[cIdx] ?? "")} (${val})`}
                >
                  {val}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
