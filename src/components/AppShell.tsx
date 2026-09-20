import { Link, useRouterState } from "@tanstack/react-router";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Boxes,
  Menu,
  ScanLine,
  ShieldCheck,
  Thermometer,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAssessmentHistory, isFlagged } from "@/lib/activity";
import { formatPercent } from "@/lib/api";
import { useApiHealth, useCatalogCount, useModelsOverview } from "@/lib/queries";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Overview", icon: Boxes, number: "01" },
  { to: "/scan", label: "Scan medicine", icon: ScanLine, number: "02" },
  { to: "/medicines", label: "Medicine library", icon: BookOpen, number: "03" },
  { to: "/assessment", label: "Storage assessment", icon: Thermometer, number: "04" },
  { to: "/alerts", label: "Alerts", icon: AlertTriangle, number: "05" },
  { to: "/models", label: "Model insights", icon: BarChart3, number: "06" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const health = useApiHealth();
  const catalogCount = useCatalogCount();
  const models = useModelsOverview();
  const assessments = useAssessmentHistory();

  const openAlerts = assessments.filter(isFlagged).length;
  const riskAccuracy = models.data?.storage_risk.test_metrics.accuracy ?? null;

  // A drawer that cannot be dismissed with Escape traps keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const online = health.isSuccess && health.data.status === "healthy";
  const statusLabel = health.isLoading
    ? "Connecting"
    : online
      ? "API online"
      : health.isError
        ? "API offline"
        : "Degraded";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-[5px] focus:bg-primary focus:px-3 focus:py-2 focus:text-[13px] focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="fixed inset-x-0 top-0 z-40 flex h-12 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            aria-label="Open navigation"
            aria-expanded={open}
            className="text-foreground md:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" />
          </button>
          <Link to="/" className="font-head text-[15px] font-bold">
            MediShelf AI
          </Link>
          <span className="hidden rounded-[3px] border border-accent/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-accent sm:inline">
            Education only
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <span className="hidden font-mono text-[10px] text-muted-foreground lg:block">
            {catalogCount.isSuccess ? `${catalogCount.data} monographs` : "monographs —"}
          </span>
          <span
            className="flex items-center gap-1.5 text-[11px]"
            title={
              online
                ? `${health.data.project_name} ${health.data.version} · database ${health.data.database}`
                : statusLabel
            }
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                online ? "pulse-dot bg-accent" : health.isLoading ? "bg-warning" : "bg-destructive",
              )}
            />
            <span className="text-foreground/70">{statusLabel}</span>
          </span>
          <span className="grid size-7 place-items-center rounded-[6px] bg-secondary text-[10px] font-semibold">
            MS
          </span>
        </div>
      </header>

      {open && (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-foreground/20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed bottom-0 left-0 top-12 z-50 flex w-56 flex-col justify-between border-r border-border bg-background transition-transform md:w-52 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <nav className="p-3" aria-label="Main navigation">
          <div className="mb-2 flex items-center justify-between px-2 pt-1">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              Workspace
            </p>
            <button
              aria-label="Close navigation"
              className="md:hidden"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="space-y-0.5">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.to;
              const badge = item.to === "/alerts" && openAlerts > 0 ? String(openAlerts) : null;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-[4px] px-2 py-2 text-[13px] transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/70 hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <span className="w-5 font-mono text-[10px] opacity-50">{item.number}</span>
                  <Icon className="size-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {badge && (
                    <span className="ml-auto font-mono text-[10px] text-warning">{badge}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Storage-risk model</span>
            <span className="font-mono text-accent">
              {riskAccuracy === null ? "—" : formatPercent(riskAccuracy, 2)}
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${(riskAccuracy ?? 0) * 100}%` }}
            />
          </div>
          <p className="mt-1 font-mono text-[9px] text-muted-foreground">
            Test accuracy on simulated scenarios
          </p>
          <div className="mt-3 flex gap-2 border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3 shrink-0" />
            <span>Educational use only. Not for clinical decisions.</span>
          </div>
        </div>
      </aside>

      <main id="main-content" className="min-h-screen pt-12 md:pl-52">
        <div className="mx-auto max-w-[1500px] p-4 sm:p-5 lg:p-6">{children}</div>
      </main>
    </div>
  );
}
