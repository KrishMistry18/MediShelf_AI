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
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { type Medicine } from "@/lib/api";
import { useCategories, useMedicinePage, useModelsOverview } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/medicines")({
  head: () => ({
    meta: [
      { title: "Pharmacopeial Library — MediShelf AI" },
      {
        name: "description",
        content:
          "Authoritative catalogue of 27,326 medicine storage monographs sourced from FDA DailyMed and NLM RxNorm.",
      },
      { property: "og:title", content: "Pharmacopeial Library — MediShelf AI" },
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

  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Medicine | null>(null);

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

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── Pharmacopeial Search & Discovery Header ─────────────────── */}
        <div className="border-b border-border pb-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                <span className="size-2 rounded-full bg-mint" />
                <span>FDA DailyMed & NLM RxNorm Provenance</span>
                <span>•</span>
                <span>27,326 Indexed Clinical Records</span>
              </div>
              <h1 className="font-head text-3xl font-bold tracking-tight text-foreground">
                Pharmacopeial Knowledge Library
              </h1>
              <p className="text-sm text-muted-foreground max-w-2xl font-sans">
                Search authoritative storage envelopes, chemical entities, and USP stability
                specifications across 27,326 clinical concepts and foundational DailyMed monographs.
              </p>
            </div>

            <Button
              variant="outline"
              className="h-8.5 px-3 text-xs border-border bg-card hover:bg-secondary font-medium shrink-0"
              onClick={() => navigate({ to: "/assessment", search: { medicine: undefined } })}
            >
              <Thermometer className="mr-1.5 size-3 text-warning" />
              <span>Direct Excursion Audit</span>
            </Button>
          </div>

          {/* Integrated Search Console */}
          <div className="pt-2 flex flex-col md:flex-row items-stretch gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={rawQuery}
                onChange={(e) => setRawQuery(e.target.value)}
                placeholder="Search across 27,326 concepts by brand, active ingredient, or ID (e.g. Paracetamol, Insulin, Metformin)..."
                aria-label="Search medicines"
                className="w-full h-11 rounded border border-border bg-card pl-10 pr-10 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
              />
              {rawQuery && (
                <button
                  onClick={() => setRawQuery("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Pill Selection */}
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by therapeutic category"
                className="h-11 rounded border border-border bg-card px-3 text-xs font-mono text-foreground focus:outline-none focus:border-primary shadow-2xs min-w-[200px]"
              >
                <option value="ALL">All Categories (27,326)</option>
                {categories.data?.map((entry) => (
                  <option key={entry.category} value={entry.category}>
                    {entry.category} ({entry.count})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results Telemetry Ribbon */}
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
              <span className="hidden sm:inline">27,301 Clinical RxNorm Concepts</span>
            </div>

            <span className="text-[11px]">
              Page {page} of {totalPages}
            </span>
          </div>
        </div>

        {/* ── Scientific Catalogue Ledger ──────────────────────────────── */}
        <div className="space-y-2">
          {list.isError ? (
            <ErrorState error={list.error} className="m-4" onRetry={() => void list.refetch()} />
          ) : list.isLoading ? (
            <div className="py-16">
              <LoadingState label="Searching 27,326 clinical pharmacopeia records..." />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded border border-border bg-card p-12 text-center space-y-3">
              <Package className="mx-auto size-10 text-muted-foreground" />
              <h3 className="font-head text-base font-bold text-foreground">
                No matching pharmacopeial records found
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                No clinical concepts matched &ldquo;{query}&rdquo;. Try searching for the active
                chemical entity (e.g. &ldquo;acetaminophen&rdquo; instead of brand) or clearing the
                category filter.
              </p>
              <div className="pt-2">
                <Button
                  variant="outline"
                  className="text-xs border-border bg-background"
                  onClick={() => {
                    setRawQuery("");
                    setCategory("ALL");
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded border border-border bg-card overflow-hidden">
              {/* Ledger Header */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 border-b border-border bg-muted/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <div className="col-span-2">Concept ID & Type</div>
                <div className="col-span-5">Pharmacopeial Entity & Formulation</div>
                <div className="col-span-3">Documented Storage Standard</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              {/* Ledger Rows */}
              <div className="divide-y divide-border/60">
                {items.map((medicine) => {
                  const coldChain =
                    medicine.storage_max_temperature !== null &&
                    medicine.storage_max_temperature <= 8;
                  const scannable = Boolean(
                    medicine.image_class && recognisableClasses.has(medicine.image_class),
                  );

                  return (
                    <div
                      key={medicine.medicine_id}
                      onClick={() => setSelected(medicine)}
                      className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 p-4 md:px-5 md:py-3.5 items-center hover:bg-muted/30 transition-colors cursor-pointer group"
                    >
                      {/* Col 1: Identifier & Category Badges */}
                      <div className="md:col-span-2 flex items-center md:flex-col md:items-start gap-2">
                        <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {medicine.medicine_id}
                        </span>
                        {coldChain ? (
                          <span className="inline-flex items-center gap-1 rounded bg-sky-100 text-sky-800 px-1.5 py-0.2 font-mono text-[9px] font-bold">
                            <Snowflake className="size-2.5" />
                            <span>Cold Chain</span>
                          </span>
                        ) : scannable ? (
                          <span className="rounded bg-mint/15 text-mint px-1.5 py-0.2 font-mono text-[9px] font-bold">
                            Vision Class
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono text-muted-foreground">
                            USP Standard
                          </span>
                        )}
                      </div>

                      {/* Col 2: Name & Active Substance */}
                      <div className="md:col-span-5 min-w-0 space-y-1">
                        <h2 className="font-head text-sm md:text-base font-bold text-foreground group-hover:text-primary transition-colors truncate">
                          {medicine.medicine_name}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground">
                          <span>
                            Active:{" "}
                            <strong className="text-foreground">{medicine.generic_name}</strong>
                          </span>
                          {medicine.strength && (
                            <>
                              <span>•</span>
                              <span>{medicine.strength}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{medicine.dosage_form}</span>
                        </div>
                      </div>

                      {/* Col 3: Calibrated Storage Envelope Ribbon */}
                      <div className="md:col-span-3 space-y-1">
                        <span className="font-mono text-[9px] text-muted-foreground uppercase block md:hidden">
                          Storage Envelope:
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "font-mono text-xs font-bold",
                              coldChain ? "text-sky-800" : "text-primary",
                            )}
                          >
                            {medicine.storage_min_temperature !== null &&
                            medicine.storage_max_temperature !== null
                              ? `${medicine.storage_min_temperature}°C to ${medicine.storage_max_temperature}°C`
                              : "Standard CRT (20°C–25°C)"}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate font-sans">
                          {medicine.category}
                        </div>
                      </div>

                      {/* Col 4: Action Dock */}
                      <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2 md:pt-0">
                        <Button
                          variant="outline"
                          className="h-7 text-xs border-border bg-background hover:bg-secondary font-medium"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(medicine);
                          }}
                        >
                          <span>Details</span>
                        </Button>
                        <Button
                          variant="primary"
                          className="h-7 px-2.5 text-xs bg-primary text-primary-foreground font-semibold shadow-2xs hover:bg-primary/90"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate({
                              to: "/assessment",
                              search: { medicine: medicine.medicine_id },
                            });
                          }}
                        >
                          <Thermometer className="mr-1 size-2.5 text-mint" />
                          <span>Assess</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Pagination Ledger ────────────────────────────────────────── */}
        {totalPages > 1 && !list.isError && (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="font-mono text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of{" "}
              {total.toLocaleString()} records
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-8 px-3 text-xs border-border bg-card"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="mr-1 size-3.5" />
                <span>Previous</span>
              </Button>
              <Button
                variant="outline"
                className="h-8 px-3 text-xs border-border bg-card"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <span>Next</span>
                <ChevronRight className="ml-1 size-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Monograph Slide-Over Drawer ─────────────────────────────── */}
        {selected && (
          <MedicineDrawer
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

function MedicineDrawer({
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded border border-border bg-card p-6 shadow-xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div className="space-y-1">
            <span className="font-mono text-[10px] font-bold text-primary uppercase">
              {medicine.medicine_id} • {medicine.source}
            </span>
            <h2 className="font-head text-xl font-bold text-foreground">
              {medicine.medicine_name}
            </h2>
            <p className="text-xs text-muted-foreground font-mono">{medicine.generic_name}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs font-mono">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded border border-border bg-background p-2.5">
              <span className="text-[10px] text-muted-foreground block">Dosage Form</span>
              <strong className="text-foreground">{medicine.dosage_form}</strong>
            </div>
            <div className="rounded border border-border bg-background p-2.5">
              <span className="text-[10px] text-muted-foreground block">Strength</span>
              <strong className="text-foreground">{medicine.strength ?? "Standard"}</strong>
            </div>
            <div className="rounded border border-border bg-background p-2.5">
              <span className="text-[10px] text-muted-foreground block">Permitted Temp</span>
              <strong className="text-primary font-bold">
                {medicine.storage_min_temperature !== null &&
                medicine.storage_max_temperature !== null
                  ? `${medicine.storage_min_temperature}°C to ${medicine.storage_max_temperature}°C`
                  : "Controlled Room Temp (20°C–25°C)"}
              </strong>
            </div>
            <div className="rounded border border-border bg-background p-2.5">
              <span className="text-[10px] text-muted-foreground block">Cold Chain</span>
              <strong className={coldChain ? "text-sky-800 font-bold" : "text-foreground"}>
                {coldChain ? "Yes (2°C–8°C)" : "No (Ambient)"}
              </strong>
            </div>
          </div>

          <div className="rounded border border-border bg-background p-3 space-y-1.5 font-sans">
            <span className="font-mono text-[10px] uppercase text-muted-foreground block">
              Documented Storage Guidelines
            </span>
            <p className="text-xs text-foreground leading-relaxed">
              {medicine.storage_min_temperature !== null &&
              medicine.storage_max_temperature !== null
                ? `Store between ${medicine.storage_min_temperature}°C and ${medicine.storage_max_temperature}°C. Protect from excessive heat, light, and excursions.`
                : "Store at USP Controlled Room Temperature (20°C to 25°C). Excursions permitted between 15°C and 30°C. Protect from excessive moisture."}
            </p>
          </div>

          {medicine.source_url && (
            <div className="rounded border border-border bg-background p-3 space-y-1 font-sans">
              <span className="font-mono text-[10px] uppercase text-muted-foreground block">
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

        <div className="pt-3 border-t border-border flex items-center justify-between">
          <Button variant="outline" className="text-xs" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            className="text-xs bg-primary text-primary-foreground font-semibold"
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
