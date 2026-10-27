import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Database,
  ExternalLink,
  Filter,
  Layers,
  Package,
  Search,
  SlidersHorizontal,
  Snowflake,
  Sun,
  Thermometer,
  X,
  ShieldCheck,
  Info,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { EmptyState, ErrorState, LoadingState, Skeleton } from "@/components/States";
import { type Medicine } from "@/lib/api";
import { useCategories, useMedicinePage, useModelsOverview } from "@/lib/queries";
import { cn } from "@/lib/utils";

type MedicinesSearch = {
  search?: string | undefined;
  category?: string | undefined;
  page?: number | undefined;
};

export const Route = createFileRoute("/medicines")({
  validateSearch: (search: Record<string, unknown>): MedicinesSearch => ({
    search: typeof search["search"] === "string" ? search["search"] : undefined,
    category: typeof search["category"] === "string" ? search["category"] : undefined,
    page: typeof search["page"] === "number" ? search["page"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Medicine Library — MediShelf AI" },
      {
        name: "description",
        content:
          "Authoritative catalogue of 27,326 medicine storage monographs sourced from FDA DailyMed and NLM RxNorm.",
      },
      { property: "og:title", content: "Medicine Library — MediShelf AI" },
      {
        property: "og:description",
        content:
          "Query storage requirements, dosage formulations, active ingredients, and pharmacopeial lineage.",
      },
    ],
  }),
  component: MedicinesPage,
});

const PAGE_SIZE = 12;

function MedicinesPage() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();

  const [rawQuery, setRawQuery] = useState(searchParams.search ?? "");
  const [query, setQuery] = useState(searchParams.search ?? "");
  const [category, setCategory] = useState(searchParams.category ?? "ALL");
  const [page, setPage] = useState(searchParams.page ?? 1);
  const [selected, setSelected] = useState<Medicine | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(rawQuery);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [rawQuery]);

  const categories = useCategories();
  const list = useMedicinePage({ page, pageSize: PAGE_SIZE, search: query, category });
  const models = useModelsOverview();
  const recognisableClasses = new Set(models.data?.vision.class_names ?? []);

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const totalPages = list.data?.total_pages ?? 1;

  const hasActiveFilters = Boolean(rawQuery.trim()) || category !== "ALL";

  const clearFilters = () => {
    setRawQuery("");
    setQuery("");
    setCategory("ALL");
    setPage(1);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* =========================================================================
            HEADER & DISCOVERY CONSOLE
           ========================================================================= */}
        <div className="border-b border-border pb-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                <span className="size-2 rounded-full bg-mint" />
                <span>FDA DailyMed & NLM RxNorm Lineage</span>
                <span>•</span>
                <span>27,326 Clinical Records</span>
              </div>
              <h1 className="font-head text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Pharmacopeial Knowledge Library
              </h1>
              <p className="text-sm text-muted-foreground max-w-2xl font-sans">
                Search verified temperature envelopes, chemical formulations, and USP stability
                monographs across 27,326 indexed clinical drug records.
              </p>
            </div>

            <Button
              variant="outline"
              className="h-9 px-3.5 text-xs border-border bg-card hover:bg-secondary font-medium shrink-0"
              onClick={() => navigate({ to: "/assessment", search: { medicine: undefined } })}
            >
              <Thermometer className="mr-1.5 size-3.5 text-warning" />
              <span>Direct Excursion Audit</span>
            </Button>
          </div>

          {/* Integrated Search & Filter Console */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={rawQuery}
                onChange={(e) => setRawQuery(e.target.value)}
                placeholder="Search by brand name, active substance, or concept ID (e.g. Paracetamol, Insulin, Metformin)..."
                aria-label="Search medicines"
                className="w-full h-11 rounded-lg border border-border bg-card pl-10 pr-10 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
              />
              {rawQuery && (
                <button
                  onClick={() => setRawQuery("")}
                  aria-label="Clear search text"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by therapeutic category"
                className="h-11 rounded-lg border border-border bg-card px-3.5 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs min-w-[200px]"
              >
                <option value="ALL">All Categories (27,326)</option>
                {categories.data?.map((entry) => (
                  <option key={entry.category} value={entry.category}>
                    {entry.category} ({entry.count})
                  </option>
                ))}
              </select>

              {hasActiveFilters && (
                <Button
                  variant="outline"
                  className="h-11 px-3 text-xs border-border bg-card hover:bg-secondary shrink-0"
                  onClick={clearFilters}
                  title="Reset all filters"
                >
                  <X className="mr-1 size-3.5" />
                  <span>Reset</span>
                </Button>
              )}
            </div>
          </div>

          {/* Results Telemetry Bar */}
          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground pt-1">
            <div className="flex items-center gap-3">
              <span className="text-foreground font-semibold">
                {list.isLoading
                  ? "Searching index..."
                  : `${total.toLocaleString()} concept${total === 1 ? "" : "s"} found`}
              </span>
              <span>•</span>
              <span className="hidden sm:inline">25 Curated Monographs</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">27,301 Clinical RxNorm Records</span>
            </div>

            <span className="text-[11px] tnum">
              Page {page} of {totalPages}
            </span>
          </div>
        </div>

        {/* =========================================================================
            CATALOGUE TABLE / LEDGER
           ========================================================================= */}
        <div className="space-y-4">
          {list.isError ? (
            <ErrorState error={list.error} className="m-4" onRetry={() => void list.refetch()} />
          ) : list.isLoading ? (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 py-3 border-b border-border/50 last:border-0"
                >
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-6 w-1/4" />
                  <Skeleton className="h-6 w-16 ml-auto" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-12 text-center space-y-3 shadow-xs">
              <Package className="mx-auto size-10 text-muted-foreground" />
              <h3 className="font-head text-base font-bold text-foreground">
                No matching pharmacopeial records found
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                No clinical concepts matched &ldquo;{query}&rdquo;. Try searching for the active
                substance (e.g. &ldquo;acetaminophen&rdquo; instead of brand name) or clearing the
                category filter.
              </p>
              <div className="pt-2">
                <Button
                  variant="outline"
                  className="text-xs border-border bg-background"
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      <th className="py-3 px-4 font-semibold w-28">Concept ID</th>
                      <th className="py-3 px-4 font-semibold">Medicine & Formulation</th>
                      <th className="py-3 px-4 font-semibold">Active Substance & Strength</th>
                      <th className="py-3 px-4 font-semibold w-48">Storage Range</th>
                      <th className="py-3 px-4 font-semibold text-right w-36">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-xs">
                    {items.map((medicine) => {
                      const coldChain =
                        medicine.storage_max_temperature !== null &&
                        medicine.storage_max_temperature <= 8;
                      const scannable = Boolean(
                        medicine.image_class && recognisableClasses.has(medicine.image_class),
                      );

                      return (
                        <tr
                          key={medicine.medicine_id}
                          onClick={() => setSelected(medicine)}
                          className="hover:bg-secondary/40 transition-colors cursor-pointer group"
                        >
                          {/* Concept ID & Badges */}
                          <td className="py-3.5 px-4 align-top">
                            <span className="font-mono text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                              {medicine.medicine_id}
                            </span>
                            <div className="mt-1">
                              {coldChain ? (
                                <span className="inline-flex items-center gap-1 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 px-1.5 py-0.5 font-mono text-[9px] font-bold">
                                  <Snowflake className="size-2.5" />
                                  <span>Cold Chain</span>
                                </span>
                              ) : scannable ? (
                                <span className="rounded bg-mint/15 text-forest dark:text-mint px-1.5 py-0.5 font-mono text-[9px] font-bold">
                                  Vision Class
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  RxNorm
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Medicine & Formulation */}
                          <td className="py-3.5 px-4 align-top">
                            <strong className="font-head text-sm font-bold text-foreground group-hover:text-primary transition-colors block">
                              {medicine.medicine_name}
                            </strong>
                            <span className="text-[11px] text-muted-foreground block mt-0.5">
                              {medicine.dosage_form} • {medicine.category}
                            </span>
                          </td>

                          {/* Active Substance & Strength */}
                          <td className="py-3.5 px-4 align-top font-mono text-[11px]">
                            <span className="text-foreground font-semibold">
                              {medicine.generic_name}
                            </span>
                            {medicine.strength && (
                              <span className="text-muted-foreground block mt-0.5">
                                {medicine.strength}
                              </span>
                            )}
                          </td>

                          {/* Storage Range */}
                          <td className="py-3.5 px-4 align-top">
                            <span
                              className={cn(
                                "font-mono text-xs font-bold block tnum",
                                coldChain ? "text-sky-800 dark:text-sky-300" : "text-primary",
                              )}
                            >
                              {medicine.storage_min_temperature !== null &&
                              medicine.storage_max_temperature !== null
                                ? `${medicine.storage_min_temperature}°C to ${medicine.storage_max_temperature}°C`
                                : "20°C to 25°C (USP CRT)"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {coldChain ? "Protect from freezing" : "Excursions: 15–30°C"}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 align-top text-right space-x-1.5">
                            <Button
                              variant="outline"
                              className="h-7 text-xs border-border bg-background hover:bg-secondary font-medium"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelected(medicine);
                              }}
                            >
                              Details
                            </Button>
                            <Button
                              variant="primary"
                              className="h-7 px-2.5 text-xs bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate({
                                  to: "/assessment",
                                  search: { medicine: medicine.medicine_id },
                                });
                              }}
                            >
                              <Thermometer className="mr-1 size-3 text-mint" />
                              Assess
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && !list.isError && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border pt-4">
              <span className="font-mono text-xs text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of{" "}
                {total.toLocaleString()} records
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="h-8.5 px-3 text-xs border-border bg-card"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="mr-1 size-3.5" />
                  <span>Previous</span>
                </Button>
                <span className="px-2 font-mono text-xs text-foreground font-semibold tnum">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  className="h-8.5 px-3 text-xs border-border bg-card"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <span>Next</span>
                  <ChevronRight className="ml-1 size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            MONOGRAPH DETAIL MODAL / DRAWER
           ========================================================================= */}
        {selected && (
          <MedicineDetailModal
            medicine={selected}
            scannable={Boolean(
              selected.image_class && recognisableClasses.has(selected.image_class),
            )}
            onClose={() => setSelected(null)}
            onAssess={(id) => navigate({ to: "/assessment", search: { medicine: id } })}
          />
        )}
      </div>
    </AppShell>
  );
}

function MedicineDetailModal({
  medicine,
  scannable,
  onClose,
  onAssess,
}: {
  medicine: Medicine;
  scannable: boolean;
  onClose: () => void;
  onAssess: (id: string) => void;
}) {
  const coldChain =
    medicine.storage_max_temperature !== null && medicine.storage_max_temperature <= 8;

  // Escape listener
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                {medicine.medicine_id}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground uppercase">
                {medicine.source} Record
              </span>
            </div>
            <h2 id="modal-title" className="font-head text-xl font-bold text-foreground">
              {medicine.medicine_name}
            </h2>
            <p className="text-xs text-muted-foreground font-mono">
              Active Entity: <strong className="text-foreground">{medicine.generic_name}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close monograph details"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Verified Reference Data Grid */}
        <div className="space-y-4 text-xs">
          <div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">
              Verified Pharmacopeial Reference Fields
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="rounded-lg border border-border bg-background p-2.5">
                <span className="text-[10px] text-muted-foreground block">Dosage Form</span>
                <strong className="text-foreground font-semibold">{medicine.dosage_form}</strong>
              </div>
              <div className="rounded-lg border border-border bg-background p-2.5">
                <span className="text-[10px] text-muted-foreground block">Strength</span>
                <strong className="text-foreground font-semibold">
                  {medicine.strength || "Standard"}
                </strong>
              </div>
              <div className="rounded-lg border border-border bg-background p-2.5">
                <span className="text-[10px] text-muted-foreground block">Category</span>
                <strong className="text-foreground font-semibold truncate block">
                  {medicine.category}
                </strong>
              </div>
              <div className="rounded-lg border border-border bg-background p-2.5">
                <span className="text-[10px] text-muted-foreground block">Permitted Range</span>
                <strong className="text-primary font-bold tnum">
                  {medicine.storage_min_temperature !== null &&
                  medicine.storage_max_temperature !== null
                    ? `${medicine.storage_min_temperature}°C to ${medicine.storage_max_temperature}°C`
                    : "20°C to 25°C (USP CRT)"}
                </strong>
              </div>
              <div className="rounded-lg border border-border bg-background p-2.5">
                <span className="text-[10px] text-muted-foreground block">Cold Chain</span>
                <strong
                  className={
                    coldChain ? "text-sky-800 dark:text-sky-300 font-bold" : "text-foreground"
                  }
                >
                  {coldChain ? "Yes (2°C–8°C)" : "No (Ambient)"}
                </strong>
              </div>
              <div className="rounded-lg border border-border bg-background p-2.5">
                <span className="text-[10px] text-muted-foreground block">RxNorm CUI</span>
                <strong className="font-mono text-foreground font-semibold">
                  {medicine.rxnorm_cui ?? "Mapped Monograph"}
                </strong>
              </div>
            </div>
          </div>

          {/* Storage Guidelines & Freeze Alerts */}
          <div className="rounded-lg border border-border bg-background p-3.5 space-y-1.5">
            <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground block">
              Documented Storage Guidelines
            </span>
            <p className="text-xs text-foreground leading-relaxed">
              {medicine.storage_min_temperature !== null &&
              medicine.storage_max_temperature !== null
                ? `Store between ${medicine.storage_min_temperature}°C and ${medicine.storage_max_temperature}°C. Maintain temperature monitoring and protect from excessive humidity.`
                : "Store at USP Controlled Room Temperature (20°C to 25°C). Excursions permitted between 15°C and 30°C. Protect from excessive moisture."}
            </p>
            {coldChain && (
              <p className="text-xs text-destructive font-semibold pt-1">
                Freeze Hazard: Do not freeze. Exposure below 0°C may cause irreversible protein
                denaturation or structural degradation.
              </p>
            )}
          </div>

          {/* Source Attribution */}
          {medicine.source_url && (
            <div className="rounded-lg border border-border bg-background p-3 space-y-1">
              <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground block">
                Provenance & Regulatory Source
              </span>
              <a
                href={medicine.source_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary underline truncate block"
              >
                {medicine.source} ({medicine.source_id ?? medicine.source_url})
              </a>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-border flex items-center justify-between">
          <Button variant="outline" className="text-xs" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            className="text-xs bg-primary text-primary-foreground font-semibold shadow-xs"
            onClick={() => onAssess(medicine.medicine_id)}
          >
            <Thermometer className="mr-1.5 size-3.5 text-mint" />
            <span>Launch Excursion Audit</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
