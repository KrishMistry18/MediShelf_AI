import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Package,
  Search,
  Snowflake,
  Thermometer,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { PageIntro } from "@/components/PageIntro";
import { EmptyState, ErrorState, LoadingState, Skeleton } from "@/components/States";
import { type Medicine } from "@/lib/api";
import { useCategories, useMedicinePage, useModelsOverview } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/medicines")({
  head: () => ({
    meta: [
      { title: "Medicine Library — MediShelf AI" },
      {
        name: "description",
        content: "Search verified medicine storage monographs sourced from FDA DailyMed and USP.",
      },
      { property: "og:title", content: "Medicine Library — MediShelf AI" },
      {
        property: "og:description",
        content: "Browse storage requirements, dosage forms, and source references.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MedicinesPage,
});

const PAGE_SIZE = 12;

function MedicinesPage() {
  const navigate = useNavigate();

  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Medicine | null>(null);

  // Debounce so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(rawQuery);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [rawQuery]);

  const categories = useCategories();
  const list = useMedicinePage({ page, pageSize: PAGE_SIZE, search: query, category });

  const models = useModelsOverview();
  const recognisableClasses = new Set(models.data?.vision.class_names ?? []);

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const totalPages = list.data?.total_pages ?? 1;

  return (
    <AppShell>
      <PageIntro
        eyebrow="Verified references"
        title="Medicine library"
        description="Storage requirements transcribed from FDA DailyMed and USP monographs. Every row links back to the source document it came from."
        actions={
          <Button
            variant="outline"
            icon={<Thermometer className="size-3.5" />}
            onClick={() => navigate({ to: "/assessment", search: { medicine: undefined } })}
          >
            Assess storage
          </Button>
        }
      />

      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={rawQuery}
              onChange={(event) => setRawQuery(event.target.value)}
              placeholder="Search medicine, generic name, brand, or SKU…"
              aria-label="Search medicines"
              className="h-9 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
            {rawQuery && (
              <button
                onClick={() => setRawQuery("")}
                aria-label="Clear search"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setPage(1);
              }}
              aria-label="Filter by therapeutic category"
              className="field h-9 w-full lg:w-56"
            >
              <option value="ALL">All categories</option>
              {categories.data?.map((entry) => (
                <option key={entry.category} value={entry.category}>
                  {entry.category} ({entry.count})
                </option>
              ))}
            </select>
            <span className="shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
              {list.isLoading ? "…" : `${total} record${total === 1 ? "" : "s"}`}
            </span>
          </div>
        </div>

        {list.isError ? (
          <ErrorState error={list.error} className="m-4" onRetry={() => void list.refetch()} />
        ) : list.isLoading ? (
          <LoadingState label="Loading monographs" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Package />}
            title="No medicines match those filters"
            description="Try a shorter search term or reset the category filter."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setRawQuery("");
                  setCategory("ALL");
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[12px]">
              <thead className="bg-secondary/60 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th scope="col" className="p-3 font-normal">
                    Medicine
                  </th>
                  <th scope="col" className="p-3 font-normal">
                    Category
                  </th>
                  <th scope="col" className="p-3 font-normal">
                    Form
                  </th>
                  <th scope="col" className="p-3 font-normal">
                    Storage
                  </th>
                  <th scope="col" className="p-3 font-normal">
                    Scannable
                  </th>
                </tr>
              </thead>
              <tbody
                className={cn("divide-y divide-border", list.isPlaceholderData && "opacity-60")}
              >
                {items.map((medicine) => {
                  const coldChain = medicine.storage_max_temperature <= 8;
                  const scannable = recognisableClasses.has(medicine.image_class);
                  return (
                    <tr
                      key={medicine.medicine_id}
                      tabIndex={0}
                      onClick={() => setSelected(medicine)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelected(medicine);
                        }
                      }}
                      className="cursor-pointer transition-colors hover:bg-secondary/50 focus-visible:bg-secondary focus-visible:outline-none"
                    >
                      <td className="p-3">
                        <strong className="block font-medium">{medicine.medicine_name}</strong>
                        <span className="text-[10px] text-muted-foreground">
                          {medicine.generic_name}
                          {medicine.brand_name ? ` · ${medicine.brand_name}` : ""} ·{" "}
                          {medicine.medicine_id}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">{medicine.category}</td>
                      <td className="p-3 text-muted-foreground">{medicine.dosage_form}</td>
                      <td className="p-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 font-mono",
                            coldChain && "text-accent",
                          )}
                        >
                          {coldChain && <Snowflake className="size-3" />}
                          {medicine.storage_min_temperature}–{medicine.storage_max_temperature}°C
                        </span>
                      </td>
                      <td className="p-3">
                        {models.isLoading ? (
                          <Skeleton className="h-4 w-16" />
                        ) : scannable ? (
                          <span className="status status-success">Trained class</span>
                        ) : (
                          <span className="status" title="No image class in the trained classifier">
                            Manual only
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && !list.isError && (
          <div className="flex items-center justify-between gap-3 border-t border-border p-3">
            <span className="font-mono text-[10px] text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-8 px-2.5"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                className="h-8 px-2.5"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                aria-label="Next page"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
        &quot;Trained class&quot; marks the {recognisableClasses.size || "—"} medicines the visual
        classifier was trained on. The remaining records are reference-only: the camera cannot
        identify them, but their storage limits and risk assessment work exactly the same.
      </p>

      {selected && (
        <MedicineDialog
          medicine={selected}
          scannable={recognisableClasses.has(selected.image_class)}
          onClose={() => setSelected(null)}
          onAssess={(id) => navigate({ to: "/assessment", search: { medicine: id } })}
        />
      )}
    </AppShell>
  );
}

function MedicineDialog({
  medicine,
  scannable,
  onClose,
  onAssess,
}: {
  medicine: Medicine;
  scannable: boolean;
  onClose: () => void;
  onAssess: (medicineId: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // A modal that ignores Escape and never moves focus is unusable without a mouse.
  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const coldChain = medicine.storage_max_temperature <= 8;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-foreground/25 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="medicine-dialog-title"
    >
      <div
        className="w-full max-w-lg rounded-[8px] border border-border bg-card p-5 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-accent">
              {medicine.medicine_id} · verified monograph
            </p>
            <h2 id="medicine-dialog-title" className="mt-1 font-head text-xl leading-tight">
              {medicine.medicine_name}
            </h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{medicine.category}</p>
          </div>
          <button
            ref={closeRef}
            aria-label="Close details"
            onClick={onClose}
            className="shrink-0 rounded-[4px] p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div
          className={cn(
            "mt-4 flex items-center gap-2 rounded-[5px] border p-3 text-[12px]",
            coldChain
              ? "border-accent/30 bg-accent/8 text-accent"
              : "border-border bg-secondary/50",
          )}
        >
          {coldChain ? <Snowflake className="size-4" /> : <Thermometer className="size-4" />}
          <span>
            <strong className="font-medium">
              {medicine.storage_min_temperature}–{medicine.storage_max_temperature}°C
            </strong>
            <span className={cn("ml-1.5", coldChain ? "text-accent/80" : "text-muted-foreground")}>
              {coldChain ? "cold chain — do not freeze" : "controlled room temperature"}
            </span>
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[5px] bg-border">
          {(
            [
              ["Generic", medicine.generic_name],
              ["Brand", medicine.brand_name ?? "—"],
              ["Manufacturer", medicine.manufacturer ?? "—"],
              ["Dosage form", medicine.dosage_form],
              ["Strength", medicine.strength],
              [
                "Humidity",
                medicine.storage_max_humidity === null
                  ? "Not quantified in source"
                  : `${medicine.storage_min_humidity ?? 0}–${medicine.storage_max_humidity}% RH`,
              ],
              ["Expiry warning", `${medicine.expiry_warning_days} days ahead`],
              ["Vision class", scannable ? medicine.image_class : "Not trained"],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="bg-card p-3">
              <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                {key}
              </dt>
              <dd className="mt-0.5 break-words text-[12px] font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="jade"
            icon={<Thermometer className="size-3.5" />}
            onClick={() => onAssess(medicine.medicine_id)}
          >
            Assess storage
          </Button>
          <a
            href={medicine.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-[5px] border border-border px-3 py-2 text-[12px] font-medium text-accent hover:bg-secondary"
          >
            {medicine.source} <ExternalLink className="size-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
