import { createFileRoute } from "@tanstack/react-router";
import { Brain, CircleAlert, FlaskConical, ScanLine } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageIntro } from "@/components/PageIntro";
import { ErrorState, LoadingState } from "@/components/States";
import { formatPercent, humanizeClassName, type ModelsOverview } from "@/lib/api";
import { useModelsOverview } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/models")({
  head: () => ({
    meta: [
      { title: "Model Insights — MediShelf AI" },
      {
        name: "description",
        content:
          "Architecture, training provenance, and measured benchmark results for the MediShelf AI models.",
      },
      { property: "og:title", content: "Model Insights — MediShelf AI" },
      {
        property: "og:description",
        content: "Inspect methodology, coverage, and the limitations of each inference track.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ModelsPage,
});

function ModelsPage() {
  const models = useModelsOverview();

  return (
    <AppShell>
      <PageIntro
        eyebrow="Technical transparency"
        title="Model insights"
        description="Every figure on this page is read from the training artifacts on disk at request time, so it cannot drift from the checkpoints the app is actually running."
      />

      {models.isLoading && (
        <section className="panel">
          <LoadingState label="Reading model artifacts" />
        </section>
      )}

      {models.isError && <ErrorState error={models.error} onRetry={() => void models.refetch()} />}

      {models.isSuccess && <ModelsContent data={models.data} />}
    </AppShell>
  );
}

function ModelsContent({ data }: { data: ModelsOverview }) {
  const { vision, storage_risk: risk } = data;
  const perClass = vision.test_metrics.per_class ?? {};
  const confusion = vision.test_metrics.confusion_matrix ?? [];
  const confusionLabels = vision.test_metrics.class_names ?? vision.class_names;

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <ModelCard
          icon={<ScanLine />}
          title="Visual package classifier"
          subtitle={`${vision.architecture ?? "—"} · ${vision.framework_version ?? "—"}`}
          available={vision.available}
        >
          <Metric
            label="Top-1 accuracy"
            value={formatPercent(vision.test_metrics.top1_accuracy, 1)}
          />
          <Metric
            label="Top-3 accuracy"
            value={formatPercent(vision.test_metrics.top3_accuracy, 1)}
          />
          <Metric label="Macro F1" value={(vision.test_metrics.macro_f1 ?? 0).toFixed(4)} />

          <div className="col-span-full grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
            <Metric label="Classes" value={String(vision.class_count ?? "—")} small />
            <Metric
              label="Input size"
              value={vision.image_size ? `${vision.image_size}px` : "—"}
              small
            />
            <Metric
              label="Confidence gate"
              value={vision.confidence_threshold?.toFixed(2) ?? "—"}
              small
            />
            <Metric
              label="Test images"
              value={String(vision.test_metrics.sample_count ?? "—")}
              small
            />
          </div>

          <p className="col-span-full bg-card p-3 text-[10px] leading-relaxed text-muted-foreground">
            Fine-tuned for {String(vision.hyperparameters["epochs"] ?? "—")} epochs with{" "}
            {String(vision.hyperparameters["optimizer"] ?? "—")} at learning rate{" "}
            {String(vision.hyperparameters["lr"] ?? "—")}, batch size{" "}
            {String(vision.hyperparameters["batch_size"] ?? "—")}, seed{" "}
            {String(vision.hyperparameters["seed"] ?? "—")}. Dataset {vision.dataset_version ?? "—"}
            .
          </p>
        </ModelCard>

        <ModelCard
          icon={<Brain />}
          title="Storage-risk classifier"
          subtitle={`${risk.algorithm ?? "—"} · ${risk.dataset_type ?? "—"}`}
          available={risk.available}
        >
          <Metric label="Test accuracy" value={formatPercent(risk.test_metrics.accuracy, 2)} />
          <Metric label="Macro F1" value={(risk.test_metrics.macro_f1 ?? 0).toFixed(4)} />
          <Metric label="Scenarios" value={(risk.dataset_samples ?? 0).toLocaleString()} />

          <div className="col-span-full grid grid-cols-3 gap-px bg-border">
            <Metric label="Train" value={String(risk.splits["train_samples"] ?? "—")} small />
            <Metric label="Validation" value={String(risk.splits["val_samples"] ?? "—")} small />
            <Metric label="Test" value={String(risk.splits["test_samples"] ?? "—")} small />
          </div>

          <p className="col-span-full bg-card p-3 text-[10px] leading-relaxed text-muted-foreground">
            {risk.features.length} engineered features across {risk.target_classes.length} risk
            classes, seed {risk.random_seed ?? "—"}. Labels come from a deterministic simulation of
            USP/FDA storage constraints, not from laboratory stability studies.
          </p>
        </ModelCard>
      </div>

      {/* Limitations sit directly under the headline numbers on purpose — reading 99.56%
          without the caveat that the labels are synthetic is the misleading outcome. */}
      <section className="panel mt-4 p-5 lg:mt-5">
        <div className="mb-3 flex items-center gap-2">
          <CircleAlert className="size-4 text-warning" />
          <h2 className="font-head text-base">How to read these numbers</h2>
        </div>
        <ul className="space-y-2.5">
          {data.limitations.map((note) => (
            <li key={note} className="flex gap-2.5 text-[11px] leading-relaxed">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-warning" />
              <span className="text-foreground/80">{note}</span>
            </li>
          ))}
        </ul>
      </section>

      {vision.training_history.length > 0 && (
        <section className="panel mt-4 p-5 lg:mt-5">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-head text-base">Vision training curve</h2>
            <span className="font-mono text-[10px] text-muted-foreground">
              best validation {formatPercent(vision.best_val_accuracy, 1)}
            </span>
          </div>
          <p className="mb-4 text-[11px] text-muted-foreground">
            Train accuracy climbing well above validation accuracy is the signature of too little
            data per class, not of too much training.
          </p>
          <TrainingCurve history={vision.training_history} />
        </section>
      )}

      <div className="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-2 lg:gap-5">
        {Object.keys(perClass).length > 0 && (
          <section className="panel overflow-hidden">
            <div className="border-b border-border p-4">
              <h2 className="font-head text-base">Per-class vision results</h2>
              <p className="mt-1 text-[10px] text-muted-foreground">
                One test image per class. Support of 1 means precision and recall can only be 0 or
                1.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[11px]">
                <thead className="bg-secondary/60 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th scope="col" className="p-3 font-normal">
                      Class
                    </th>
                    <th scope="col" className="p-3 font-normal">
                      Precision
                    </th>
                    <th scope="col" className="p-3 font-normal">
                      Recall
                    </th>
                    <th scope="col" className="p-3 font-normal">
                      F1
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.entries(perClass).map(([className, scores]) => {
                    const f1 = scores["f1-score"];
                    return (
                      <tr key={className}>
                        <td className="p-3 font-medium">{humanizeClassName(className)}</td>
                        <td className="p-3 font-mono text-muted-foreground">
                          {scores.precision.toFixed(2)}
                        </td>
                        <td className="p-3 font-mono text-muted-foreground">
                          {scores.recall.toFixed(2)}
                        </td>
                        <td className="p-3">
                          <span
                            className={cn(
                              "font-mono",
                              f1 >= 0.8
                                ? "text-accent"
                                : f1 > 0
                                  ? "text-warning"
                                  : "text-destructive",
                            )}
                          >
                            {f1.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="panel p-5">
          <h2 className="font-head text-base">Storage-risk feature weights</h2>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Global importance from the fitted gradient-boosting model, descending.
          </p>
          <ul className="mt-4 space-y-2">
            {Object.entries(risk.feature_importances)
              .slice(0, 8)
              .map(([feature, weight]) => (
                <li key={feature}>
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="truncate font-mono text-[10px]">{feature}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {formatPercent(weight, 2)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(weight * 100, 0.4)}%` }}
                    />
                  </div>
                </li>
              ))}
          </ul>
          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
            Humidity features carry zero weight: the simulation that generated the labels did not
            vary degradation by humidity, so the model never learned to use it.
          </p>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-2 lg:gap-5">
        {confusion.length > 0 && (
          <section className="panel p-5">
            <h2 className="font-head text-base">Vision confusion matrix</h2>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Rows are the true class, columns the prediction. Off-diagonal cells are mistakes.
            </p>
            <ConfusionMatrix matrix={confusion} labels={confusionLabels} />
          </section>
        )}

        <div className="space-y-4 lg:space-y-5">
          {Object.keys(risk.validation_comparison).length > 0 && (
            <section className="panel p-5">
              <div className="mb-3 flex items-center gap-2">
                <FlaskConical className="size-4 text-accent" />
                <h2 className="font-head text-base">Algorithm selection</h2>
              </div>
              <p className="mb-3 text-[10px] text-muted-foreground">
                Candidates scored on the validation split. The highest macro F1 was promoted.
              </p>
              <div className="grid gap-px overflow-hidden rounded-[5px] bg-border">
                {Object.entries(risk.validation_comparison).map(([name, scores]) => {
                  const chosen = name === risk.algorithm;
                  return (
                    <div
                      key={name}
                      className={cn(
                        "flex flex-wrap items-baseline justify-between gap-2 p-3",
                        chosen ? "bg-accent/8" : "bg-card",
                      )}
                    >
                      <span className="text-[12px]">
                        <strong className={cn(chosen ? "font-medium text-accent" : "font-normal")}>
                          {name}
                        </strong>
                        {chosen && (
                          <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.14em] text-accent">
                            selected
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        acc {formatPercent(scores.accuracy, 2)} · macro F1{" "}
                        {scores.macro_f1.toFixed(4)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {risk.confusion_matrix.matrix && (
            <section className="panel p-5">
              <h2 className="font-head text-base">Storage-risk confusion matrix</h2>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Held-out test split of {risk.splits["test_samples"] ?? "—"} scenarios.
              </p>
              <ConfusionMatrix
                matrix={risk.confusion_matrix.matrix}
                labels={risk.confusion_matrix.labels ?? risk.target_classes}
              />
            </section>
          )}
        </div>
      </div>

      {data.independent_verification && (
        <VerificationPanel report={data.independent_verification} />
      )}

      <div className="mt-4 rounded-[6px] border border-warning/25 bg-warning/8 p-4 text-[11px] leading-relaxed text-foreground/80 lg:mt-5">
        <strong className="text-warning">Not a clinical instrument.</strong> {data.disclaimer}
      </div>
    </>
  );
}

/* ------------------------------ components ------------------------------ */

function ModelCard({
  icon,
  title,
  subtitle,
  available,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  available: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2 text-accent [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0">
          {icon}
          <div className="min-w-0">
            <h2 className="font-head text-base text-foreground">{title}</h2>
            <p className="truncate font-mono text-[9px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <span className={cn("status shrink-0", available ? "status-success" : "status-warning")}>
          {available ? "Loaded" : "Artifact missing"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[5px] bg-border">
        {children}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  small = false,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="bg-card p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 font-head", small ? "text-[15px]" : "text-xl")}>{value}</p>
    </div>
  );
}

/**
 * Inline SVG rather than a charting library: the shell is server-rendered, and chart
 * libraries that measure the DOM on mount cause hydration mismatches here.
 */
function TrainingCurve({ history }: { history: ModelsOverview["vision"]["training_history"] }) {
  const width = 640;
  const height = 180;
  const padding = { top: 10, right: 10, bottom: 22, left: 30 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const x = (index: number) =>
    padding.left + (history.length <= 1 ? 0 : (index / (history.length - 1)) * plotWidth);
  const y = (value: number) => padding.top + (1 - value) * plotHeight;

  const line = (key: "train_acc" | "val_acc") =>
    history
      .map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point[key])}`)
      .join(" ");

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full min-w-[420px]"
        role="img"
        aria-label="Training and validation accuracy per epoch"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--border)"
              strokeWidth="1"
            />
            <text
              x={padding.left - 6}
              y={y(tick) + 3}
              textAnchor="end"
              className="fill-[var(--muted-foreground)] font-mono"
              fontSize="8"
            >
              {tick * 100}
            </text>
          </g>
        ))}

        {history.map((point, index) => (
          <text
            key={point.epoch}
            x={x(index)}
            y={height - 6}
            textAnchor="middle"
            className="fill-[var(--muted-foreground)] font-mono"
            fontSize="8"
          >
            {point.epoch}
          </text>
        ))}

        <path d={line("train_acc")} fill="none" stroke="var(--accent)" strokeWidth="1.75" />
        <path
          d={line("val_acc")}
          fill="none"
          stroke="var(--warning)"
          strokeWidth="1.75"
          strokeDasharray="4 3"
        />

        {history.map((point, index) => (
          <g key={`points-${point.epoch}`}>
            <circle cx={x(index)} cy={y(point.train_acc)} r="2.5" fill="var(--accent)" />
            <circle cx={x(index)} cy={y(point.val_acc)} r="2.5" fill="var(--warning)" />
          </g>
        ))}
      </svg>

      <div className="mt-2 flex gap-4 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-accent" /> train
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 border-t border-dashed border-warning" /> validation
        </span>
        <span className="ml-auto normal-case tracking-normal">epoch →</span>
      </div>
    </div>
  );
}

function ConfusionMatrix({ matrix, labels }: { matrix: number[][]; labels: string[] }) {
  const max = Math.max(1, ...matrix.flat());
  const short = (label: string) =>
    label.length <= 4 ? label.toUpperCase() : label.slice(0, 3).toUpperCase();

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="border-collapse font-mono text-[9px]">
        <thead>
          <tr>
            <th className="p-1" />
            {labels.map((label) => (
              <th
                key={label}
                scope="col"
                className="p-1 font-normal text-muted-foreground"
                title={label}
              >
                {short(label)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, rowIndex) => (
            <tr key={labels[rowIndex] ?? rowIndex}>
              <th
                scope="row"
                className="whitespace-nowrap py-1 pr-2 text-right font-normal text-muted-foreground"
                title={labels[rowIndex]}
              >
                {short(labels[rowIndex] ?? String(rowIndex))}
              </th>
              {row.map((count, columnIndex) => {
                const onDiagonal = rowIndex === columnIndex;
                const intensity = count / max;
                return (
                  <td key={columnIndex} className="p-0.5">
                    <div
                      className={cn(
                        "grid size-6 place-items-center rounded-[3px] tabular-nums",
                        count === 0 && "text-muted-foreground/40",
                      )}
                      style={
                        count === 0
                          ? { background: "var(--secondary)" }
                          : {
                              background: `color-mix(in oklab, var(${
                                onDiagonal ? "--accent" : "--destructive"
                              }) ${Math.round(18 + intensity * 72)}%, transparent)`,
                              color: intensity > 0.5 ? "var(--accent-foreground)" : "inherit",
                            }
                      }
                      title={`true ${labels[rowIndex]} → predicted ${labels[columnIndex]}: ${count}`}
                    >
                      {count}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Metrics recomputed from the saved checkpoints by tools/verify_models.py. */
function VerificationPanel({ report }: { report: Record<string, unknown> }) {
  const vision = report["vision"] as
    | Record<
        string,
        { n?: number; top1_accuracy?: number; top3_accuracy?: number; mean_latency_ms?: number }
      >
    | undefined;
  const risk = report["storage_risk"] as
    { test_accuracy?: number; train_accuracy?: number; val_accuracy?: number } | undefined;

  const splitOrder = ["test", "val", "train", "raw"] as const;
  const splitLabels: Record<string, string> = {
    test: "Held-out test",
    val: "Validation",
    train: "Train (seen)",
    raw: "All images",
  };

  return (
    <section className="panel mt-4 p-5 lg:mt-5">
      <h2 className="font-head text-base">Independent re-verification</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        Produced by <code className="font-mono text-[10px]">tools/verify_models.py</code>, which
        reloads the saved checkpoints and recomputes every metric from the datasets in the repo
        rather than trusting the training logs.
      </p>

      {vision && (
        <div className="mt-4 grid gap-px overflow-hidden rounded-[5px] bg-border sm:grid-cols-2 lg:grid-cols-4">
          {splitOrder
            .filter((split) => vision[split])
            .map((split) => {
              const scores = vision[split]!;
              return (
                <div key={split} className="bg-card p-3">
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                    {splitLabels[split]} · n={scores.n ?? "—"}
                  </p>
                  <p className="mt-1 font-head text-lg">{formatPercent(scores.top1_accuracy, 0)}</p>
                  <p className="font-mono text-[9px] text-muted-foreground">
                    top-3 {formatPercent(scores.top3_accuracy, 0)}
                    {scores.mean_latency_ms ? ` · ${scores.mean_latency_ms.toFixed(0)} ms` : ""}
                  </p>
                </div>
              );
            })}
        </div>
      )}

      {risk && (
        <p className="mt-3 font-mono text-[10px] text-muted-foreground">
          storage-risk recomputed — train {formatPercent(risk.train_accuracy, 2)} · val{" "}
          {formatPercent(risk.val_accuracy, 2)} · test {formatPercent(risk.test_accuracy, 2)}
        </p>
      )}
    </section>
  );
}
